/**
 * Agent route — POST /api/agent
 *
 * Accepts { goal, difficulty, userContext? } from the frontend, calls the
 * Subconscious streaming API, and pipes SSE events back to the client:
 *
 *   { type: "thought", thought: string }   — reasoning steps as they surface
 *   { type: "chunk",   content: string }   — raw delta chunks
 *   { type: "answer",  answer: string }    — emitted once when the run finishes
 *   { type: "error",   message: string }   — emitted on failure
 *
 * The optional userContext payload personalises the agent prompt with the
 * player's mastered scales and most-used chords from the Guitar Learning
 * Tool's FastAPI backend.
 *
 * Request bodies are validated with zod BEFORE any SSE headers are sent, so
 * malformed input gets a plain 400 JSON response. Once streaming starts,
 * every failure is reported as an SSE "error" event and the response is
 * always ended. If the browser disconnects mid-run, the upstream Subconscious
 * stream/poll is aborted so the run stops consuming credits.
 *
 * The router is mounted behind requireLocalRequest (see middleware/localOnly.ts)
 * because it spends the owner's API key.
 */

import { Router, Request, Response } from "express";
import { Subconscious } from "subconscious";
import type { ReasoningNode } from "subconscious";
import { z } from "zod";
import { formatZodError } from "../lib/validation.js";

export const agentRouter = Router();

// ---------------------------------------------------------------------------
// Client factory — replaceable for testing (dependency injection)
// ---------------------------------------------------------------------------

/** One event yielded by the Subconscious stream. */
export interface StreamEvent {
  type: string;
  content?: string;
  runId?: string;
  message?: string;
}

/** The parts of a finished run's result that this route reads. */
export interface RunResultShape {
  answer?: string;
  reasoning?: ReasoningNode;
}

/** Minimal interface for the parts of the Subconscious client we use. */
export interface SubconsciousClient {
  stream(
    options: Record<string, unknown>,
    streamOptions?: { signal?: AbortSignal },
  ): AsyncIterable<StreamEvent>;
  get?(runId: string): Promise<{ result?: RunResultShape; status?: string }>;
  wait?(
    runId: string,
    options?: { intervalMs?: number; maxAttempts?: number; signal?: AbortSignal },
  ): Promise<{ result?: RunResultShape; status?: string }>;
}

/** Creates a Subconscious client for one request. */
export type ClientFactory = () => SubconsciousClient;

/** Production factory: a real Subconscious client using SUBCONSCIOUS_API_KEY. */
const defaultClientFactory: ClientFactory = () =>
  new Subconscious({ apiKey: process.env.SUBCONSCIOUS_API_KEY }) as SubconsciousClient;

let _clientFactory: ClientFactory = defaultClientFactory;

/**
 * Override the Subconscious client factory.
 * Call this in tests to inject a mock — avoids ESM module-mock hoisting issues.
 *
 * @param factory - Function that returns a SubconsciousClient-compatible object.
 */
export function setClientFactory(factory: ClientFactory): void {
  _clientFactory = factory;
}

/** Reset to the real Subconscious client (call in afterEach). */
export function resetClientFactory(): void {
  _clientFactory = defaultClientFactory;
}

/**
 * Whether the real client would be used but has no API key to use.
 * Injected (test) factories never need a key.
 *
 * @returns True when the default factory is active and SUBCONSCIOUS_API_KEY is unset.
 */
function isApiKeyMissing(): boolean {
  return _clientFactory === defaultClientFactory && !process.env.SUBCONSCIOUS_API_KEY;
}

// ---------------------------------------------------------------------------
// JSON string decoding
// The stream delivers partial JSON, so values are pulled out with regexes and
// their string bodies decoded with JSON.parse (handles \uXXXX, \", \\, \n …).
// ---------------------------------------------------------------------------

/** Body of a JSON string literal: any non-quote/non-backslash char, or an escape pair. */
const JSON_STRING_BODY = String.raw`((?:[^"\\]|\\[\s\S])*)`;

const THOUGHT_PATTERN = new RegExp(String.raw`"thought"\s*:\s*"` + JSON_STRING_BODY + '"', "g");
const TITLE_PATTERN = new RegExp(String.raw`"title"\s*:\s*"` + JSON_STRING_BODY + '"', "g");
const ANSWER_PATTERN = new RegExp(String.raw`"answer"\s*:\s*"` + JSON_STRING_BODY + '"');

/**
 * Decode the body of a JSON string literal (the text between the quotes).
 * Raw control characters, which JSON forbids inside strings, are escaped
 * first so a slightly malformed body still decodes.
 *
 * @param raw - String body as matched by JSON_STRING_BODY.
 * @returns The decoded string, or `raw` unchanged if it is not valid JSON.
 */
export function decodeJsonStringBody(raw: string): string {
  const sanitised = raw.replace(
    /[\u0000-\u001f]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  try {
    return JSON.parse(`"${sanitised}"`) as string;
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Thought extractor
// Pulls completed "thought" and "title" strings from partial JSON as it builds.
// ---------------------------------------------------------------------------

/**
 * Extract completed thought and title strings from a partial JSON accumulation.
 *
 * @param content - The raw accumulated JSON string from the stream.
 * @returns Array of human-readable thought strings (newlines flattened to spaces), deduplicated.
 */
export function extractThoughts(content: string): string[] {
  const thoughts: string[] = [];

  for (const match of content.matchAll(THOUGHT_PATTERN)) {
    const thought = decodeJsonStringBody(match[1]).replace(/\r?\n/g, " ").trim();
    if (thought.length > 10) thoughts.push(thought);
  }

  for (const match of content.matchAll(TITLE_PATTERN)) {
    const title = decodeJsonStringBody(match[1]).trim();
    if (title.length > 5 && !thoughts.includes(title)) {
      thoughts.unshift(title);
    }
  }

  return thoughts;
}

/**
 * Extract the final answer from accumulated stream content.
 *
 * Tries a full JSON parse first; if the content is partial JSON, falls back
 * to the first complete `"answer": "..."` string; otherwise returns the raw
 * content (the engine sometimes streams plain markdown).
 *
 * @param content - The raw accumulated text from the stream.
 * @returns The decoded answer text.
 */
export function extractAnswer(content: string): string {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null && "answer" in parsed) {
      const { answer } = parsed as { answer: unknown };
      if (typeof answer === "string") return answer;
    }
    return content;
  } catch {
    const match = ANSWER_PATTERN.exec(content);
    return match ? decodeJsonStringBody(match[1]) : content;
  }
}

// ---------------------------------------------------------------------------
// Reasoning tree flattener
// ---------------------------------------------------------------------------

/**
 * Walk the ReasoningNode tree depth-first and return human-readable strings.
 *
 * @param node - Root of the reasoning tree returned by Subconscious.
 * @returns Flat array of titles, thoughts, and conclusions.
 */
export function flattenReasoningTree(node: ReasoningNode): string[] {
  const results: string[] = [];
  if (node.title?.trim()) results.push(node.title.trim());
  if (node.thought?.trim() && node.thought.trim().length > 10) {
    results.push(node.thought.trim());
  }
  for (const subtask of node.subtask ?? []) {
    results.push(...flattenReasoningTree(subtask));
  }
  if (node.conclusion?.trim() && node.conclusion.trim().length > 10) {
    results.push(node.conclusion.trim());
  }
  return results;
}

// ---------------------------------------------------------------------------
// Difficulty → instructions prose
// ---------------------------------------------------------------------------

/** Supported player levels. */
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

/** One of the supported player levels. */
type Difficulty = (typeof DIFFICULTIES)[number];

const DIFFICULTY_CONTEXT: Record<Difficulty, string> = {
  beginner:
    "The user is a beginner guitarist — keep explanations simple, avoid jargon, " +
    "and focus on foundational habits. Recommend open chords, easy keys, and short practice windows.",
  intermediate:
    "The user is an intermediate guitarist who understands basic chords, scales, and " +
    "simple theory. Push them toward technique refinement, music theory depth, and more " +
    "challenging repertoire.",
  advanced:
    "The user is an advanced guitarist with serious dedication — think sub-6-second " +
    "Rubik's cube solver level of obsession. Give them deep theory, advanced techniques, " +
    "specific licks and song excerpts, uncommon scales, and professional practice methodology.",
};

/**
 * Narrow an arbitrary string to a supported difficulty.
 *
 * @param value - Candidate difficulty.
 * @returns True if value is a key of DIFFICULTY_CONTEXT.
 */
function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const MAX_GOAL_LENGTH = 1000;
const MAX_CONTEXT_ITEMS = 50;
const MAX_CONTEXT_ITEM_LENGTH = 100;

/** A bounded list of short strings (scale names, chord names). */
const contextListSchema = z
  .array(z.string().max(MAX_CONTEXT_ITEM_LENGTH, `items must be at most ${MAX_CONTEXT_ITEM_LENGTH} characters`))
  .max(MAX_CONTEXT_ITEMS, `must contain at most ${MAX_CONTEXT_ITEMS} items`)
  .optional();

/** Schema for the POST /api/agent request body. */
const agentRequestSchema = z.object({
  goal: z
    .string({ required_error: "is required", invalid_type_error: "must be a string" })
    .trim()
    .min(1, "is required")
    .max(MAX_GOAL_LENGTH, `must be at most ${MAX_GOAL_LENGTH} characters`),
  difficulty: z.enum(DIFFICULTIES).default("intermediate"),
  userContext: z
    .object({
      learnedScales: contextListSchema,
      topChords: contextListSchema,
    })
    .optional(),
});

/** Validated POST /api/agent request body. */
type AgentRequest = z.infer<typeof agentRequestSchema>;

/** Personalisation payload from the Guitar Learning Tool's FastAPI backend. */
type UserContext = NonNullable<AgentRequest["userContext"]>;

// ---------------------------------------------------------------------------
// Build agent instructions
// ---------------------------------------------------------------------------

/**
 * Build the full instructions string for the Subconscious agent.
 *
 * @param goal - The player's stated practice goal.
 * @param difficulty - One of "beginner" | "intermediate" | "advanced".
 * @param userContext - Optional personalisation data from the Guitar Tool backend.
 * @returns Full instructions string to pass as the agent's system prompt.
 */
export function buildInstructions(
  goal: string,
  difficulty: string,
  userContext?: UserContext,
): string {
  const context = DIFFICULTY_CONTEXT[isDifficulty(difficulty) ? difficulty : "intermediate"];

  let personalisation = "";
  if (userContext) {
    const parts: string[] = [];
    if (userContext.learnedScales && userContext.learnedScales.length > 0) {
      parts.push(
        `Scales the player has already mastered: ${userContext.learnedScales.join(", ")}. ` +
          "Build on these rather than re-teaching them.",
      );
    }
    if (userContext.topChords && userContext.topChords.length > 0) {
      parts.push(
        `Chords they use most often: ${userContext.topChords.join(", ")}. ` +
          "Incorporate these into exercises where appropriate.",
      );
    }
    if (parts.length > 0) {
      personalisation = `\n\nPlayer's current knowledge from their practice history:\n${parts.join("\n")}`;
    }
  }

  return `You are FretAgent, an expert guitar practice coach with deep knowledge of \
music theory, technique pedagogy, and practice methodology.

Player level context: ${context}${personalisation}

The user's goal: "${goal}"

Your job — use tools efficiently, 3 calls maximum:
1. Do ONE web_search to find relevant techniques, tutorials, and song references.
2. Optionally read one page with page_reader if a specific result is worth diving into.
3. Optionally call music_theory_lookup for precise scale/chord/fretboard data if needed.
4. Optionally call research_paper_lookup for one practice methodology reference.
5. Synthesise everything into a focused, structured practice plan.

Your practice plan MUST include (keep it concise — aim for 400–600 words total):
- A one-paragraph overview of what the plan targets
- A 5-minute warm-up routine
- 2–3 core technique drills specific to the goal
- 2–3 specific song excerpts or licks to practise (with artist/song names)
- A brief weekly schedule (3–4 bullet points max)

Be specific and actionable — not generic advice. Reference actual scales by name, \
actual songs, actual techniques. Format your response as well-structured markdown \
with headers and bullet points.`;
}

// ---------------------------------------------------------------------------
// Tool definitions sent to Subconscious
// ---------------------------------------------------------------------------

/**
 * Build the tool list for the agent run. Function tools call back into this
 * server's /api/tools/* endpoints at toolBaseUrl (the public ngrok URL).
 *
 * @param toolBaseUrl - Publicly reachable base URL of this server.
 * @returns Tool definitions in the Subconscious input format.
 */
function buildToolDefinitions(toolBaseUrl: string): Record<string, unknown>[] {
  return [
    { type: "platform", id: "web_search", options: {} },
    { type: "platform", id: "page_reader", options: {} },
    {
      type: "function",
      name: "music_theory_lookup",
      description:
        "Look up structured music theory data: scales (notes, intervals, fretboard positions), " +
        "chord progressions, interval relationships, and chord voicings for any key and scale type. " +
        "Use this when you need precise musical data rather than web search results.",
      url: `${toolBaseUrl}/api/tools/music-theory`,
      method: "POST",
      headers: { "ngrok-skip-browser-warning": "true" },
      parameters: {
        type: "object",
        properties: {
          query_type: {
            type: "string",
            enum: ["scale_info", "chord_progression", "intervals", "chord_info"],
            description: "The type of music theory data to look up",
          },
          key: { type: "string", description: "Musical key e.g. 'A', 'C#', 'Bb'" },
          scale: {
            type: "string",
            description:
              "Scale or mode: major, natural_minor, minor_pentatonic, major_pentatonic, " +
              "dorian, mixolydian, phrygian, lydian, harmonic_minor, melodic_minor, blues, " +
              "whole_tone, diminished",
          },
          chord: { type: "string", description: "Chord name e.g. 'Am7', 'Cmaj7', 'G7'" },
        },
        required: ["query_type"],
      },
    },
    {
      type: "function",
      name: "research_paper_lookup",
      description:
        "Search curated research papers on practice methodology, motor learning, " +
        "and music theory. Use this to ground recommendations in peer-reviewed research.",
      url: `${toolBaseUrl}/api/tools/research-papers`,
      method: "POST",
      headers: { "ngrok-skip-browser-warning": "true" },
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The practice topic or technique you need research on, " +
              "e.g. 'deliberate practice session length' or 'motor learning for scales'.",
          },
          concepts: {
            type: "array",
            items: { type: "string" },
            description:
              "Specific keywords to boost matching, e.g. ['contextual interference', " +
              "'minor pentatonic', 'CAGED']. Optional but improves relevance.",
          },
        },
        required: ["query"],
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// SSE channel
// ---------------------------------------------------------------------------

/** A write-guarded SSE response that tracks client disconnects. */
interface SseChannel {
  /** Aborts when the client disconnects before the response is ended. */
  readonly signal: AbortSignal;
  /** True while the client is connected and the response has not ended. */
  isOpen(): boolean;
  /** Write one `data:` event (no-op once closed). */
  send(payload: Record<string, unknown>): void;
  /** Write the [DONE] sentinel and end the response (no-op once closed). */
  finish(): void;
  /** End the response without the sentinel (no-op once closed). */
  end(): void;
}

/**
 * Send SSE headers and wrap the response in a disconnect-aware channel.
 *
 * Disconnects are detected on the RESPONSE's 'close' event. The request's
 * 'close' event is not usable: since Node 16 it fires as soon as the request
 * body has been consumed (which express.json() does before this handler
 * runs), not when the client goes away. A response 'close' before we called
 * end() means the socket dropped mid-stream.
 *
 * @param res - Express response to stream on.
 * @returns The channel wrapper.
 */
function openSseChannel(res: Response): SseChannel {
  const controller = new AbortController();
  let disconnected = false;

  res.on("close", () => {
    if (res.writableEnded) return;
    disconnected = true;
    controller.abort();
  });
  // Socket errors surface as a 'close' (handled above); this just prevents an
  // unhandled 'error' event from crashing the process.
  res.on("error", (err) => console.warn("[agent] Response error:", err.message));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const isOpen = () => !disconnected && !res.writableEnded;
  return {
    signal: controller.signal,
    isOpen,
    send: (payload) => {
      if (isOpen()) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    },
    finish: () => {
      if (isOpen()) res.end("data: [DONE]\n\n");
    },
    end: () => {
      if (isOpen()) res.end();
    },
  };
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

/** Mutable state accumulated while consuming one agent stream. */
interface RunState {
  fullContent: string;
  runId?: string;
  sentThoughts: Set<string>;
}

const NO_RESPONSE_MESSAGE = "No response received from agent — please try again.";

/**
 * Send any thoughts not already sent on this run.
 *
 * @param sse - Channel to write to.
 * @param state - Run state holding the sent-thought set.
 * @param thoughts - Candidate thoughts.
 */
function sendNewThoughts(sse: SseChannel, state: RunState, thoughts: string[]): void {
  for (const thought of thoughts) {
    if (state.sentThoughts.has(thought)) continue;
    state.sentThoughts.add(thought);
    sse.send({ type: "thought", thought });
  }
}

/**
 * Fetch the canonical run result via client.wait (or client.get).
 *
 * @param client - Subconscious client.
 * @param runId - Run to fetch; when undefined nothing is fetched.
 * @param signal - Aborts polling if the client disconnects.
 * @returns The answer (if any) and reasoning thoughts; empty on failure.
 */
async function fetchFinalRun(
  client: SubconsciousClient,
  runId: string | undefined,
  signal: AbortSignal,
): Promise<{ answer?: string; thoughts: string[] }> {
  if (!runId) return { thoughts: [] };
  try {
    let run: { result?: RunResultShape; status?: string } = {};
    if (client.wait) {
      run = await client.wait(runId, { maxAttempts: 20, intervalMs: 2000, signal });
    } else if (client.get) {
      run = await client.get(runId);
    }
    console.log("[agent] run.status:", run.status, "result keys:", Object.keys(run.result ?? {}));
    console.log("[agent] answer preview:", run.result?.answer?.slice(0, 100));
    const reasoning = run.result?.reasoning;
    return {
      answer: run.result?.answer || undefined,
      thoughts: reasoning ? flattenReasoningTree(reasoning) : [],
    };
  } catch (err) {
    // wait/get failed (or was aborted) — caller falls back to text extraction.
    console.warn("[agent] Fetching final run failed:", err instanceof Error ? err.message : err);
    return { thoughts: [] };
  }
}

/**
 * Send the final answer + [DONE] and end the response. Falls back to
 * extracting thoughts/answer from accumulated delta text when the run
 * result is unavailable.
 *
 * @param sse - Channel to write to.
 * @param client - Subconscious client.
 * @param state - Accumulated run state.
 */
async function finishRun(sse: SseChannel, client: SubconsciousClient, state: RunState): Promise<void> {
  const final = await fetchFinalRun(client, state.runId, sse.signal);
  sendNewThoughts(sse, state, final.thoughts);

  let answer = final.answer;
  if (!answer) {
    sendNewThoughts(sse, state, extractThoughts(state.fullContent));
    answer = extractAnswer(state.fullContent);
  }

  sse.send({ type: "answer", answer });
  sse.finish();
}

/**
 * Finish the run, or report an error if nothing at all was received.
 *
 * @param sse - Channel to write to.
 * @param client - Subconscious client.
 * @param state - Accumulated run state.
 */
async function finishOrReportEmpty(sse: SseChannel, client: SubconsciousClient, state: RunState): Promise<void> {
  if (!state.runId && state.fullContent.length === 0) {
    sse.send({ type: "error", message: NO_RESPONSE_MESSAGE });
    sse.end();
    return;
  }
  await finishRun(sse, client, state);
}

/**
 * Create the client, start the Subconscious stream, and relay it over SSE.
 * Never throws: every failure becomes an SSE error event (unless the client
 * has already disconnected), and the response is always ended.
 *
 * @param sse - Open SSE channel.
 * @param request - Validated request body.
 */
async function relayAgentRun(sse: SseChannel, request: AgentRequest): Promise<void> {
  const state: RunState = { fullContent: "", sentThoughts: new Set() };
  let client: SubconsciousClient | undefined;

  try {
    client = _clientFactory();
    const toolBaseUrl = process.env.TOOL_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const stream = client.stream(
      {
        engine: "tim-claude",
        input: {
          instructions: buildInstructions(request.goal, request.difficulty, request.userContext),
          tools: buildToolDefinitions(toolBaseUrl),
        },
      },
      { signal: sse.signal },
    );

    for await (const event of stream) {
      if (!sse.isOpen()) return;
      if (event.runId) state.runId = event.runId;

      if (event.type === "delta") {
        state.fullContent += event.content ?? "";
        if (event.content) sse.send({ type: "chunk", content: event.content });
      } else if (event.type === "done") {
        await finishRun(sse, client, state);
        return;
      } else if (event.type === "error") {
        sse.send({ type: "error", message: String(event.message ?? "Agent error") });
        sse.end();
        return;
      }
    }

    console.log(`[agent] Loop exited. runId=${state.runId ?? "none"}, content=${state.fullContent.length} chars`);
    if (sse.isOpen()) await finishOrReportEmpty(sse, client, state);
  } catch (err) {
    await handleRelayFailure(err, sse, client, state);
  }
}

/**
 * Handle an exception from client creation or stream consumption.
 *
 * @param err - The thrown value.
 * @param sse - Channel to write to.
 * @param client - The client, if it was created before the failure.
 * @param state - Accumulated run state.
 */
async function handleRelayFailure(
  err: unknown,
  sse: SseChannel,
  client: SubconsciousClient | undefined,
  state: RunState,
): Promise<void> {
  if (!sse.isOpen()) {
    console.log("[agent] Stream stopped after client disconnect.");
    return;
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[agent] Stream error:", err);

  // "terminated" means the Subconscious server closed the connection after
  // streaming all data — treat it as a normal completion, not an error.
  if (message === "terminated" && client) {
    await finishOrReportEmpty(sse, client, state);
    return;
  }
  sse.send({ type: "error", message });
  sse.end();
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

agentRouter.post("/", async (req: Request, res: Response) => {
  const parsed = agentRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  if (isApiKeyMissing()) {
    res.status(500).json({ error: "SUBCONSCIOUS_API_KEY is not configured" });
    return;
  }

  const request = parsed.data;
  console.log(`[agent] Starting stream for goal: "${request.goal}" (difficulty: ${request.difficulty})`);

  const sse = openSseChannel(res);
  await relayAgentRun(sse, request);
});
