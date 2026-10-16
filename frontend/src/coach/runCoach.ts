/**
 * runCoach.ts
 *
 * The Practice Coach agent, run entirely in the browser on the user's key.
 * This replaces FretAgent's Express server + Subconscious engine:
 *
 *   FretAgent                         here
 *   ───────────────────────────────   ─────────────────────────────────────
 *   Subconscious web_search           Claude's web_search (server tool)
 *   Subconscious page_reader          Claude's web_fetch (server tool)
 *   POST /api/tools/music-theory      musicTheoryLookup(), in the page
 *   POST /api/tools/research-papers   searchPapers(), in the page
 *   SSE thought / chunk / answer      onSteps / onPlan callbacks
 *
 * Server tools run on Anthropic's side inside a turn; the two client tools
 * come back as tool_use blocks, run here, and go back as tool_result. Each
 * turn's full assistant content (thinking, search results, tool calls) is
 * appended unchanged, which keeps thinking blocks valid across turns.
 */

import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL, createClaudeClient } from '../ai/claude';
import { SCALES } from '../data/musicTheory';
import { SYSTEM_PROMPT } from './prompt';
import { searchPapers } from './researchPapers';
import { QUERY_TYPES, musicTheoryLookup, type TheoryQuery, type TuningContext } from './theoryTool';

/** One visible step of the agent's work, for the activity trace. */
export type CoachStep =
  | { kind: 'thinking'; text: string }
  | { kind: 'search'; query: string }
  | { kind: 'fetch'; url: string }
  | { kind: 'theory'; label: string }
  | { kind: 'research'; query: string }
  | { kind: 'note'; text: string };

/** A web page the plan drew on. */
export interface CoachSource {
  url: string;
  title: string;
}

export interface CoachResult {
  markdown: string;
  sources: CoachSource[];
  usage: { inputTokens: number; outputTokens: number; webSearches: number; webFetches: number };
  /** True when the plan was cut off by the token cap. */
  truncated: boolean;
}

export interface RunCoachOptions {
  apiKey: string;
  /** The user turn (see buildGoalMessage). */
  goalMessage: string;
  tuning: TuningContext;
  signal: AbortSignal;
  /** Called with the full step list whenever it changes. */
  onSteps: (steps: CoachStep[]) => void;
  /** Called with the plan text so far as it streams. */
  onPlan: (markdown: string) => void;
}

/** Hard cap on model turns, so a confused run can't loop on your bill. */
const MAX_TURNS = 8;
/** Re-issues allowed when a streamed tool input isn't parseable JSON. */
const MAX_JSON_RETRIES = 2;
/**
 * Sonnet 5.5 thinks adaptively; thinking counts toward max_tokens, so this
 * leaves room for thinking plus a 600-word plan.
 */
const MAX_TOKENS = 16_000;

// ─── Tools ────────────────────────────────────────────────────────────────────

/**
 * Tool definitions. Server tools are capped with max_uses (a web search is
 * billed per search) and fetched pages are capped in tokens. Client tools set
 * eager_input_streaming because this is a streamed request; their inputs are
 * then validated here before running (see validate* below).
 */
const TOOLS: Anthropic.Messages.ToolUnion[] = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 2 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 1, max_content_tokens: 8000 },
  {
    name: 'music_theory_lookup',
    description:
      "Exact music theory from the app's own engine: scale notes, degrees and intervals, frets on each string " +
      "for the player's tuning, CAGED position windows, diatonic chords and common progressions, interval " +
      'tables, and chord tones. Use it instead of memory whenever the plan gives notes, frets or chords.',
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: QUERY_TYPES,
          description:
            'scale_info: notes, frets and positions of a scale. chord_progression: diatonic chords of a 7-note ' +
            'scale. intervals: every interval from a root. chord_info: the tones of one chord.',
        },
        key: { type: 'string', description: "Root note, e.g. 'A', 'C#', 'Bb'." },
        scale: { type: 'string', description: `Scale for scale_info and chord_progression. One of: ${Object.keys(SCALES).join(', ')}.` },
        chord: { type: 'string', description: "Chord for chord_info, e.g. 'Am7', 'Cmaj7', 'F#dim'." },
      },
      required: ['query_type'],
      additionalProperties: false,
    },
  },
  {
    name: 'research_paper_lookup',
    description:
      'Search curated excerpts from research on deliberate practice, motor learning, and guitar pedagogy. ' +
      'Use it to ground how the player should practise (session length, spacing, tempo work, feedback).',
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "Topic, e.g. 'deliberate practice session length'." },
        concepts: {
          type: 'array',
          items: { type: 'string' },
          description: "Optional keywords that boost matching, e.g. ['contextual interference', 'tempo'].",
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

// The tolerant partial-JSON parser behind eager input streaming can hand back
// a silently truncated object, so every client-tool input is checked here.

function validateTheory(input: unknown): TheoryQuery | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (!QUERY_TYPES.includes(o.query_type as TheoryQuery['query_type'])) return null;
  for (const k of ['key', 'scale', 'chord'] as const) {
    if (o[k] !== undefined && typeof o[k] !== 'string') return null;
  }
  return o as unknown as TheoryQuery;
}

function validateResearch(input: unknown): { query: string; concepts: string[] } | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (typeof o.query !== 'string' || !o.query.trim()) return null;
  if (o.concepts !== undefined && !(Array.isArray(o.concepts) && o.concepts.every((c) => typeof c === 'string'))) {
    return null;
  }
  return { query: o.query, concepts: (o.concepts as string[] | undefined) ?? [] };
}

/** Human label for a theory lookup in the trace ("A minor pentatonic: scale info"). */
function theoryLabel(q: TheoryQuery): string {
  const what = q.query_type.replace('_', ' ');
  if (q.query_type === 'chord_info') return `${q.chord ?? q.key ?? 'chord'}: ${what}`;
  const scale = q.scale ? ` ${q.scale.replace(/_/g, ' ')}` : '';
  return `${q.key ?? ''}${q.query_type === 'intervals' ? '' : scale}: ${what}`.trim();
}

/**
 * Runs one client tool call.
 *
 * @returns The tool_result to send back, and the trace step to show (if any).
 */
function runClientTool(
  block: Anthropic.ToolUseBlock,
  tuning: TuningContext,
): { result: Anthropic.ToolResultBlockParam; step?: CoachStep } {
  const invalid = (): { result: Anthropic.ToolResultBlockParam } => ({
    result: {
      type: 'tool_result',
      tool_use_id: block.id,
      is_error: true,
      content: JSON.stringify({ INVALID_JSON: JSON.stringify(block.input) }),
    },
  });

  if (block.name === 'music_theory_lookup') {
    const q = validateTheory(block.input);
    if (!q) return invalid();
    return {
      result: { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(musicTheoryLookup(q, tuning)) },
      step: { kind: 'theory', label: theoryLabel(q) },
    };
  }
  if (block.name === 'research_paper_lookup') {
    const q = validateResearch(block.input);
    if (!q) return invalid();
    const results = searchPapers(q.query, q.concepts);
    return {
      result: {
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify({ results, total_found: results.length }),
      },
      step: { kind: 'research', query: q.query },
    };
  }
  return {
    result: { type: 'tool_result', tool_use_id: block.id, is_error: true, content: `Unknown tool: ${block.name}` },
  };
}

// ─── Run ──────────────────────────────────────────────────────────────────────

/** Thrown for a run that can't produce a plan; the message is user-facing. */
export class CoachError extends Error {}

/**
 * Runs the Coach to completion.
 *
 * @throws CoachError for refusals and runaway runs, the SDK's typed errors
 *   for API failures, and its abort error when `signal` fires.
 */
export async function runCoach(opts: RunCoachOptions): Promise<CoachResult> {
  const client = createClaudeClient(opts.apiKey);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: opts.goalMessage }];
  const steps: CoachStep[] = [];
  const sources = new Map<string, CoachSource>();
  const usage = { inputTokens: 0, outputTokens: 0, webSearches: 0, webFetches: 0 };

  /** Plan text since the last tool block; earlier narration moves into the trace. */
  let plan = '';
  const pushStep = (step: CoachStep) => {
    steps.push(step);
    opts.onSteps([...steps]);
  };
  const flushNarration = () => {
    if (plan.trim()) pushStep({ kind: 'note', text: plan.trim() });
    plan = '';
    opts.onPlan('');
  };

  let jsonRetries = 0;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        // Summarised thinking feeds the "Thinking" lines in the trace
        thinking: { type: 'adaptive', display: 'summarized' },
        output_config: { effort: 'medium' },
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      },
      { signal: opts.signal },
    );

    let thinkingStep: { kind: 'thinking'; text: string } | null = null;
    stream.on('streamEvent', (event) => {
      if (event.type !== 'content_block_start') return;
      const t = event.content_block.type;
      if (t === 'thinking') {
        thinkingStep = { kind: 'thinking', text: '' };
        pushStep(thinkingStep);
      } else if (t === 'server_tool_use' || t === 'tool_use') {
        flushNarration();
      }
    });
    stream.on('thinking', (delta) => {
      if (!thinkingStep) return;
      thinkingStep.text += delta;
      opts.onSteps([...steps]);
    });
    stream.on('text', (delta) => {
      plan += delta;
      opts.onPlan(plan);
    });
    stream.on('contentBlock', (block) => {
      if (block.type === 'server_tool_use') {
        const input = (block.input ?? {}) as { query?: string; url?: string };
        if (block.name === 'web_search' && input.query) pushStep({ kind: 'search', query: input.query });
        if (block.name === 'web_fetch' && input.url) {
          pushStep({ kind: 'fetch', url: input.url });
          sources.set(input.url, { url: input.url, title: input.url });
        }
      } else if (block.type === 'text') {
        for (const c of block.citations ?? []) {
          if (c.type === 'web_search_result_location') sources.set(c.url, { url: c.url, title: c.title ?? c.url });
        }
      }
    });

    let message: Anthropic.Message;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Only an unparseable streamed tool input is retried; API errors and aborts propagate
      if (err instanceof Anthropic.APIError || opts.signal.aborted || jsonRetries++ >= MAX_JSON_RETRIES) throw err;
      flushNarration();
      continue;
    }

    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.webSearches += message.usage.server_tool_use?.web_search_requests ?? 0;
    usage.webFetches += message.usage.server_tool_use?.web_fetch_requests ?? 0;

    if (message.stop_reason === 'refusal') {
      throw new CoachError('Claude declined this request. Try rephrasing the goal.');
    }
    // A long server-tool turn can pause; send it back as-is to continue
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: message.content });
      continue;
    }

    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (toolUses.length === 0) {
      if (!plan.trim()) throw new CoachError('Claude finished without writing a plan. Try again.');
      return { markdown: plan.trim(), sources: [...sources.values()], usage, truncated: message.stop_reason === 'max_tokens' };
    }
    // A tool input cut off at the cap can still look valid; don't run it
    if (message.stop_reason === 'max_tokens') {
      throw new CoachError('Claude ran out of room mid-research. Try a narrower goal.');
    }

    messages.push({ role: 'assistant', content: message.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      const { result, step } = runClientTool(block, opts.tuning);
      results.push(result);
      if (step) pushStep(step);
    }
    messages.push({ role: 'user', content: results });
  }

  throw new CoachError('The Coach used too many steps without finishing. Try a more specific goal.');
}
