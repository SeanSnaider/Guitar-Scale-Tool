/**
 * Regression tests for POST /api/agent and its JSON-string helpers.
 *
 * Runs the real Express app on an ephemeral loopback port and injects a mock
 * Subconscious client through setClientFactory(), so no network access or
 * API key is needed. Covers:
 *   - SSE lifecycle: upstream errors end the response, client disconnects
 *     abort the upstream run, factory failures become SSE errors.
 *   - API-key handling: missing key is a 500 before streaming; the key is
 *     never logged.
 *   - Request validation (zod) and the local-only access guard.
 *   - JSON string decoding in extractThoughts / extractAnswer.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractAnswer,
  extractThoughts,
  resetClientFactory,
  setClientFactory,
} from "./agent.js";
import type { StreamEvent, SubconsciousClient } from "./agent.js";
import { postJson, readSse, startTestServer, waitUntil } from "../test/httpHelpers.js";
import type { TestServer } from "../test/httpHelpers.js";

/** Upper bound for any single SSE response in these tests. */
const RESPONSE_DEADLINE_MS = 2000;

const VALID_BODY = { goal: "Learn the A minor pentatonic", difficulty: "beginner" };

let server: TestServer;
let agentUrl: string;

/**
 * Build a mock client whose stream yields the given events in order.
 *
 * @param events - Stream events to emit.
 * @returns A SubconsciousClient-compatible mock.
 */
function scriptedClient(events: StreamEvent[]): SubconsciousClient {
  return {
    stream: () =>
      (async function* (): AsyncGenerator<StreamEvent> {
        for (const event of events) yield event;
      })(),
  };
}

/**
 * Resolve when the signal aborts, or after the fallback delay.
 *
 * @param signal - Signal to observe (may be undefined).
 * @param fallbackMs - Maximum time to wait.
 */
function waitForAbort(signal: AbortSignal | undefined, fallbackMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, fallbackMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

beforeAll(async () => {
  server = await startTestServer();
  agentUrl = `${server.baseUrl}/api/agent`;
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  setClientFactory(() =>
    scriptedClient([
      { type: "delta", content: '{"answer": "Practise slowly."}' },
      { type: "done" },
    ]),
  );
});

afterEach(() => {
  resetClientFactory();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Defect A — SSE lifecycle
// ---------------------------------------------------------------------------

describe("POST /api/agent streaming lifecycle", () => {
  it("streams chunks and a final answer for a successful run", async () => {
    const res = await postJson(agentUrl, VALID_BODY);
    expect(res.status).toBe(200);
    const sse = await readSse(res, RESPONSE_DEADLINE_MS);

    expect(sse.ended).toBe(true);
    expect(sse.sawDone).toBe(true);
    expect(sse.events).toContainEqual({ type: "answer", answer: "Practise slowly." });
  });

  it("sends an SSE error event and ends the response when the upstream stream throws mid-run", async () => {
    setClientFactory(() => ({
      stream: () =>
        (async function* (): AsyncGenerator<StreamEvent> {
          yield { type: "delta", content: "partial" };
          await new Promise((resolve) => setTimeout(resolve, 50));
          throw new Error("boom");
        })(),
    }));

    const res = await postJson(agentUrl, VALID_BODY);
    const sse = await readSse(res, RESPONSE_DEADLINE_MS);

    expect.soft(sse.events).toContainEqual({ type: "error", message: "boom" });
    expect.soft(sse.ended, `response must end within ${RESPONSE_DEADLINE_MS}ms instead of hanging`).toBe(true);
  });

  it("aborts the upstream stream when the client disconnects mid-run", async () => {
    let upstreamSignal: AbortSignal | undefined;
    setClientFactory(() => ({
      stream: (_options, streamOptions) => {
        upstreamSignal = streamOptions?.signal;
        return (async function* (): AsyncGenerator<StreamEvent> {
          yield { type: "delta", content: "partial", runId: "run-disconnect" };
          await waitForAbort(streamOptions?.signal, 3000);
        })();
      },
    }));

    const clientAbort = new AbortController();
    const res = await postJson(agentUrl, VALID_BODY, { signal: clientAbort.signal });
    const reader = res.body!.getReader();
    await reader.read();
    clientAbort.abort();

    const aborted = await waitUntil(() => upstreamSignal?.aborted === true, 1500);
    expect(aborted, "upstream AbortSignal should fire after client disconnect").toBe(true);
  });

  it("passes the abort signal to client.wait when fetching the final run", async () => {
    let waitOptions: { signal?: AbortSignal } | undefined;
    setClientFactory(() => ({
      ...scriptedClient([
        { type: "delta", content: "{}", runId: "run-42" },
        { type: "done" },
      ]),
      wait: async (_runId, options) => {
        waitOptions = options;
        return { status: "succeeded", result: { answer: "Final plan" } };
      },
    }));

    const res = await postJson(agentUrl, VALID_BODY);
    const sse = await readSse(res, RESPONSE_DEADLINE_MS);

    expect(sse.events).toContainEqual({ type: "answer", answer: "Final plan" });
    expect(waitOptions?.signal).toBeInstanceOf(AbortSignal);
  });

  it("turns a synchronous client factory failure into an SSE error event", async () => {
    setClientFactory(() => {
      throw new Error("factory exploded");
    });

    const res = await postJson(agentUrl, VALID_BODY);
    const sse = await readSse(res, RESPONSE_DEADLINE_MS);

    expect.soft(sse.streamError, "socket should not be torn down mid-stream").toBeUndefined();
    expect.soft(sse.events).toContainEqual({ type: "error", message: "factory exploded" });
    expect.soft(sse.ended).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Defect A — API key handling
// ---------------------------------------------------------------------------

describe("POST /api/agent API key handling", () => {
  const originalKey = process.env.SUBCONSCIOUS_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.SUBCONSCIOUS_API_KEY;
    else process.env.SUBCONSCIOUS_API_KEY = originalKey;
  });

  it("responds 500 JSON before streaming when SUBCONSCIOUS_API_KEY is missing and the default client is used", async () => {
    delete process.env.SUBCONSCIOUS_API_KEY;
    resetClientFactory();

    const res = await postJson(agentUrl, VALID_BODY);
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text().catch(() => "");

    expect(res.status).toBe(500);
    expect(contentType).toContain("application/json");
    expect(JSON.parse(text)).toEqual({ error: "SUBCONSCIOUS_API_KEY is not configured" });
  });

  it("never logs any part of the API key", async () => {
    process.env.SUBCONSCIOUS_API_KEY = "sk-live-SECRETVALUE";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await postJson(agentUrl, VALID_BODY);
    await readSse(res, RESPONSE_DEADLINE_MS);

    const logged = [...logSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map((arg) => String(arg))
      .join("\n");
    expect(logged).not.toContain("sk-liv");
  });
});

// ---------------------------------------------------------------------------
// Defect B — request validation
// ---------------------------------------------------------------------------

describe("POST /api/agent request validation", () => {
  it("rejects a non-string learnedScales with 400 JSON before streaming", async () => {
    const res = await postJson(agentUrl, { goal: "x", userContext: { learnedScales: "Cmaj" } });
    const body = (await res.json().catch(() => ({}))) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/learnedScales/);
  });

  it("rejects a numeric goal with 400 JSON", async () => {
    const res = await postJson(agentUrl, { goal: 5 });
    const body = (await res.json().catch(() => ({}))) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/goal/);
  });

  it("rejects a whitespace-only goal with 400", async () => {
    const res = await postJson(agentUrl, { goal: "   " });
    expect(res.status).toBe(400);
  });

  it("rejects a goal longer than 1000 characters with 400", async () => {
    const res = await postJson(agentUrl, { goal: "a".repeat(1001) });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown difficulty with 400", async () => {
    const res = await postJson(agentUrl, { goal: "Learn sweep picking", difficulty: "expert" });
    expect(res.status).toBe(400);
  });

  it("rejects more than 50 learnedScales with 400", async () => {
    const learnedScales = Array.from({ length: 51 }, (_, i) => `scale ${i}`);
    const res = await postJson(agentUrl, { goal: "x", userContext: { learnedScales } });
    expect(res.status).toBe(400);
  });

  it("accepts a valid body with userContext and streams a response", async () => {
    const res = await postJson(agentUrl, {
      goal: "Improve alternate picking",
      userContext: { learnedScales: ["A minor pentatonic"], topChords: ["Am", "G"] },
    });
    const sse = await readSse(res, RESPONSE_DEADLINE_MS);

    expect(res.status).toBe(200);
    expect(sse.sawDone).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Defect C — local-only access to the paid agent endpoint
// ---------------------------------------------------------------------------

describe("POST /api/agent local-only guard", () => {
  it("rejects a request carrying X-Forwarded-For (i.e. arriving via a tunnel) with 403", async () => {
    const res = await postJson(agentUrl, VALID_BODY, { headers: { "X-Forwarded-For": "1.2.3.4" } });
    const contentType = res.headers.get("content-type") ?? "";
    await res.body?.cancel();

    expect(res.status).toBe(403);
    expect(contentType).toContain("application/json");
  });

  it("allows a plain loopback request through", async () => {
    const res = await postJson(agentUrl, VALID_BODY);
    await res.body?.cancel();
    expect(res.status).toBe(200);
  });

  it("leaves the tool endpoints reachable through a tunnel", async () => {
    const res = await postJson(
      `${server.baseUrl}/api/tools/music-theory`,
      { query_type: "scale_info", key: "C", scale: "major" },
      { headers: { "X-Forwarded-For": "1.2.3.4" } },
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Defect D — JSON string decoding
// ---------------------------------------------------------------------------

describe("extractThoughts", () => {
  it("decodes \\uXXXX escapes in thoughts", () => {
    const content = '{"thought": "It\\u2019s best to practise slowly first"}';
    expect(extractThoughts(content)).toEqual(["It’s best to practise slowly first"]);
  });

  it("turns escaped newlines in thoughts into spaces", () => {
    const content = '{"thought": "First line of reasoning\\nsecond line"}';
    expect(extractThoughts(content)).toEqual(["First line of reasoning second line"]);
  });

  it("decodes escaped quotes and backslashes in thoughts", () => {
    const content = '{"thought": "Use the \\"spider\\" drill \\\\ daily"}';
    expect(extractThoughts(content)).toEqual(['Use the "spider" drill \\ daily']);
  });

  it("decodes \\uXXXX escapes in titles", () => {
    const content = '{"title": "Planning the warm\\u2011up"}';
    expect(extractThoughts(content)).toEqual(["Planning the warm‑up"]);
  });
});

describe("extractAnswer", () => {
  it("does not truncate the regex fallback at an escaped quote followed by a comma", () => {
    const partial = '{"answer": "He said \\"hi\\", then left", "reasoning": ';
    expect(extractAnswer(partial)).toBe('He said "hi", then left');
  });

  it("decodes \\uXXXX and newline escapes in the regex fallback", () => {
    const partial = '{"answer": "Don\\u2019t rush\\nStay relaxed", "x": ';
    expect(extractAnswer(partial)).toBe("Don’t rush\nStay relaxed");
  });

  it("uses the parsed answer when the content is complete JSON", () => {
    expect(extractAnswer('{"answer": "Done"}')).toBe("Done");
  });

  it("falls back to the raw content when no answer field is present", () => {
    expect(extractAnswer("plain text plan")).toBe("plain text plan");
  });
});

describe("POST /api/agent answer fallback over HTTP", () => {
  it("streams the full answer when the accumulated content is partial JSON with an escaped quote and comma", async () => {
    setClientFactory(() =>
      scriptedClient([
        { type: "delta", content: '{"answer": "He said \\"hi\\", then left", "reasoning": ' },
        { type: "done" },
      ]),
    );

    const res = await postJson(agentUrl, VALID_BODY);
    const sse = await readSse(res, RESPONSE_DEADLINE_MS);

    expect(sse.events).toContainEqual({ type: "answer", answer: 'He said "hi", then left' });
  });
});
