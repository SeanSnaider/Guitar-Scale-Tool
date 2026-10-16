/**
 * coach.test.tsx
 *
 * The Practice Coach (FretAgent, rebuilt in the browser): its two local
 * tools, the plan parser, and the agent loop against a scripted fake of the
 * SDK's message stream (no network, no key).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { searchPapers } from '../coach/researchPapers';
import { musicTheoryLookup, resolveScaleKey } from '../coach/theoryTool';
import { isGuitarTab, parseScaleMentions } from '../coach/planParser';
import { buildGoalMessage } from '../coach/prompt';
import { TUNINGS } from '../data/musicTheory';

const STANDARD = { name: 'Standard', notes: TUNINGS.standard.notes };

// ─── Fake SDK stream ─────────────────────────────────────────────────────────

type Block = Record<string, unknown> & { type: string };
interface ScriptedTurn {
  content: Block[];
  stop_reason: string;
}

/** Turns queued for the next messages.stream() calls, and what each call was sent. */
const script: ScriptedTurn[] = [];
const sentRequests: Array<{ messages: Array<{ role: string; content: unknown }> }> = [];

function fakeStream(turn: ScriptedTurn) {
  const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
  const emit = (e: string, ...a: unknown[]) => handlers[e]?.forEach((h) => h(...a));
  const stream = {
    on(e: string, h: (...a: unknown[]) => void) {
      (handlers[e] ??= []).push(h);
      return stream;
    },
    async finalMessage() {
      for (const block of turn.content) {
        emit('streamEvent', { type: 'content_block_start', content_block: { type: block.type } });
        if (block.type === 'text') emit('text', block.text);
        if (block.type === 'thinking') emit('thinking', block.thinking);
        emit('contentBlock', block);
      }
      return {
        content: turn.content,
        stop_reason: turn.stop_reason,
        usage: { input_tokens: 1000, output_tokens: 500, server_tool_use: { web_search_requests: 1, web_fetch_requests: 0 } },
      };
    },
  };
  return stream;
}

vi.mock('../ai/claude', async (orig) => {
  const real = await orig<typeof import('../ai/claude')>();
  return {
    ...real,
    createClaudeClient: () => ({
      messages: {
        stream: (params: { messages: Array<{ role: string; content: unknown }> }) => {
          // Snapshot: the loop mutates the same array on later turns
          sentRequests.push({ messages: structuredClone(params.messages) });
          const turn = script.shift();
          if (!turn) throw new Error('no scripted turn left');
          return fakeStream(turn);
        },
      },
    }),
  };
});

import { runCoach, CoachError, type CoachStep } from '../coach/runCoach';

beforeEach(() => {
  script.length = 0;
  sentRequests.length = 0;
});

const PLAN = '## Overview\nWork the A minor pentatonic box, then D dorian.\n\n```\ne|--5--8--|\nB|--5--8--|\nG|--5--7--|\n```';

// ─── Tools ───────────────────────────────────────────────────────────────────

describe('research_paper_lookup (ported)', () => {
  it('ranks excerpts by matched terms and ignores stopwords', () => {
    const hits = searchPapers('how to do deliberate practice for feedback');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(3);
    expect(hits[0].id).toBe('ericsson-1993-dp-definition');
    // "how", "to", "do", "for" alone match nothing
    expect(searchPapers('how to do for')).toEqual([]);
  });
});

describe('music_theory_lookup (the app engine)', () => {
  it('D dorian chords come from stacked thirds (IV is major)', () => {
    const r = musicTheoryLookup({ query_type: 'chord_progression', key: 'D', scale: 'dorian' }, STANDARD) as {
      chords: Array<{ degree: string; triad: string }>;
    };
    expect(r.chords.map((c) => c.triad)).toEqual(['Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'C']);
  });

  it('spells for the key and gives frets for the given tuning', () => {
    const r = musicTheoryLookup({ query_type: 'scale_info', key: 'F', scale: 'major' }, STANDARD) as {
      notes: string[];
      frets_by_string_low_to_high: Record<string, number[]>;
    };
    expect(r.notes).toContain('Bb');
    expect(r.frets_by_string_low_to_high['1:E']).toContain(1); // F on the low E

    const dropD = musicTheoryLookup({ query_type: 'scale_info', key: 'D', scale: 'major' }, { name: 'Drop D', notes: TUNINGS.drop_d.notes }) as {
      frets_by_string_low_to_high: Record<string, number[]>;
    };
    expect(dropD.frets_by_string_low_to_high['1:D']).toContain(0);
  });

  it('accepts the names a model uses and reports bad input as { error }', () => {
    expect(resolveScaleKey('natural_minor')).toBe('minor');
    expect(resolveScaleKey('Minor Pentatonic')).toBe('minor_pentatonic');
    expect(musicTheoryLookup({ query_type: 'chord_info', chord: 'Am7' }, STANDARD)).toMatchObject({ notes: ['A', 'C', 'E', 'G'] });
    expect(musicTheoryLookup({ query_type: 'scale_info', key: 'H' }, STANDARD)).toHaveProperty('error');
    expect(musicTheoryLookup({ query_type: 'chord_progression', key: 'A', scale: 'minor_pentatonic' }, STANDARD)).toHaveProperty('error');
  });
});

describe('plan parser', () => {
  it('finds scale mentions but not chords or articles', () => {
    const m = parseScaleMentions('Use the A minor pentatonic box. Strum an A minor chord. Then a minor tweak, then Bb major.');
    expect(m.map((x) => x.label)).toEqual(['A Minor Pentatonic', 'Bb Major (Ionian)']);
  });

  it('detects tab blocks', () => {
    expect(isGuitarTab('e|--0--|\nB|--1--|\nG|--0--|')).toBe(true);
    expect(isGuitarTab('const x = 1;')).toBe(false);
  });
});

describe('the goal message', () => {
  it('carries level, tuning and local progress, with the goal fenced', () => {
    const msg = buildGoalMessage('faster legato', 'advanced', { tuningName: 'Drop D', learnedScales: ['G Dorian'], topChords: ['Am'] });
    expect(msg).toMatch(/advanced player/);
    expect(msg).toMatch(/Tuning: Drop D/);
    expect(msg).toMatch(/G Dorian/);
    expect(msg).toMatch(/<goal>\nfaster legato\n<\/goal>/);
  });
});

// ─── Agent loop ──────────────────────────────────────────────────────────────

function run(signal = new AbortController().signal) {
  const steps: CoachStep[][] = [];
  const plans: string[] = [];
  const promise = runCoach({
    apiKey: 'sk-ant-api03-test',
    goalMessage: 'goal',
    tuning: STANDARD,
    signal,
    onSteps: (s) => steps.push(s),
    onPlan: (p) => plans.push(p),
  });
  return { promise, steps, plans };
}

describe('runCoach', () => {
  it('runs server search, then local tools, then streams the plan', async () => {
    script.push(
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'thinking', thinking: 'Plan the research.', signature: 's' },
          { type: 'text', text: 'Let me look this up.' },
          { type: 'server_tool_use', id: 'srv1', name: 'web_search', input: { query: 'legato drills' } },
          { type: 'web_search_tool_result', tool_use_id: 'srv1', content: [] },
          { type: 'tool_use', id: 't1', name: 'music_theory_lookup', input: { query_type: 'scale_info', key: 'A', scale: 'minor_pentatonic' } },
          { type: 'tool_use', id: 't2', name: 'research_paper_lookup', input: { query: 'deliberate practice' } },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text: PLAN,
            citations: [{ type: 'web_search_result_location', url: 'https://example.com/legato', title: 'Legato guide', cited_text: '', encrypted_index: '' }],
          },
        ],
      },
    );

    const { promise, steps, plans } = run();
    const res = await promise;

    expect(res.markdown).toBe(PLAN);
    expect(res.sources).toEqual([{ url: 'https://example.com/legato', title: 'Legato guide' }]);
    expect(res.usage).toMatchObject({ inputTokens: 2000, webSearches: 2 });

    // Narration before the tools moved into the trace, out of the plan
    const kinds = steps[steps.length - 1].map((s) => s.kind);
    expect(kinds).toEqual(['thinking', 'note', 'search', 'theory', 'research']);
    expect(plans[plans.length - 1]).toBe(PLAN);

    // Second request: full assistant turn echoed back, then both tool results
    const second = sentRequests[1].messages;
    expect(second[1]).toMatchObject({ role: 'assistant' });
    const results = second[2].content as Array<{ tool_use_id: string; content: string; is_error?: boolean }>;
    expect(results.map((r) => r.tool_use_id)).toEqual(['t1', 't2']);
    expect(JSON.parse(results[0].content).notes).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect(results.every((r) => !r.is_error)).toBe(true);
  });

  it('answers a malformed tool input with an error result instead of running it', async () => {
    script.push(
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'research_paper_lookup', input: { query: 42 } }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: PLAN }] },
    );
    await run().promise;
    const results = sentRequests[1].messages[2].content as Array<{ is_error?: boolean; content: string }>;
    expect(results[0].is_error).toBe(true);
    expect(results[0].content).toMatch(/INVALID_JSON/);
  });

  it('resumes a paused server-tool turn', async () => {
    script.push(
      { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 's', name: 'web_search', input: { query: 'q' } }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: PLAN }] },
    );
    const res = await run().promise;
    expect(res.markdown).toBe(PLAN);
    const resent = sentRequests[1].messages;
    expect(resent[resent.length - 1]).toMatchObject({ role: 'assistant' });
  });

  it('turns a refusal into a readable error', async () => {
    script.push({ stop_reason: 'refusal', content: [] });
    await expect(run().promise).rejects.toBeInstanceOf(CoachError);
  });

  it('gives up after the turn cap instead of looping', async () => {
    for (let i = 0; i < 9; i++) {
      script.push({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: `t${i}`, name: 'research_paper_lookup', input: { query: 'tempo' } }] });
    }
    await expect(run().promise).rejects.toThrow(/too many steps/);
    expect(sentRequests).toHaveLength(8);
  });
});

// ─── View ────────────────────────────────────────────────────────────────────

describe('Coach view', () => {
  it('asks for the key first, then runs, renders the plan and saves it', async () => {
    const { useApiKeyStore } = await import('../ai/apiKey');
    const { useHistoryStore } = await import('../store/useHistoryStore');
    const { useGuitarStore } = await import('../store/useGuitarStore');
    const { default: PracticeCoach } = await import('../components/coach/PracticeCoach');
    useApiKeyStore.getState().clearApiKey();
    useHistoryStore.setState({ plans: [] });

    render(<PracticeCoach />);
    expect(screen.getByLabelText('Anthropic API key')).toBeInTheDocument();
    act(() => useApiKeyStore.getState().setApiKey('sk-ant-api03-test', false));

    script.push({ stop_reason: 'end_turn', content: [{ type: 'text', text: PLAN }] });
    fireEvent.click(screen.getByRole('button', { name: 'Teach me the modes of the major scale' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Generate plan' }));
    });

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('figure')).toHaveTextContent('Tab');
    expect(useHistoryStore.getState().plans[0].goal).toBe('Teach me the modes of the major scale');

    // A scale the plan names opens on the fretboard
    fireEvent.click(screen.getByRole('button', { name: 'Show D Dorian on the fretboard' }));
    expect(useGuitarStore.getState()).toMatchObject({ selectedRoot: 'D', selectedScale: 'dorian', activeTab: 'fretboard' });
  });
});
