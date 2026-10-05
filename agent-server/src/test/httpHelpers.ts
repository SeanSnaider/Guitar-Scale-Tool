/**
 * Shared HTTP helpers for the agent-server integration tests.
 *
 * Starts the real Express app on an ephemeral loopback port (app.listen(0))
 * and talks to it with Node's built-in fetch, so no extra test dependencies
 * (e.g. supertest) are needed. Also provides a time-bounded Server-Sent
 * Events reader so a response that never ends makes a test FAIL instead of
 * hanging the suite.
 *
 * Test-only: excluded from the production build via tsconfig.build.json.
 */

import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";

/** A running app instance bound to an ephemeral loopback port. */
export interface TestServer {
  /** Base URL such as "http://127.0.0.1:54321". */
  baseUrl: string;
  /** Forcefully closes open connections and stops the server. */
  close(): Promise<void>;
}

/** One decoded `data:` payload from an SSE stream. */
export type SseEvent = Record<string, unknown>;

/** Result of reading an SSE response body with a deadline. */
export interface SseReadResult {
  /** JSON payloads in arrival order (the "[DONE]" sentinel is excluded). */
  events: SseEvent[];
  /** True when the server ended the response before the deadline. */
  ended: boolean;
  /** True when the "[DONE]" sentinel was received. */
  sawDone: boolean;
  /** Set when the body stream errored (e.g. the server destroyed the socket). */
  streamError?: string;
}

/**
 * Start the Express app on 127.0.0.1 with an OS-assigned port.
 *
 * @returns A handle with the base URL and a close function.
 */
export function startTestServer(): Promise<TestServer> {
  const app = createApp();
  return new Promise((resolve, reject) => {
    const server: Server = app.listen(0, "127.0.0.1", (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}

/**
 * POST a JSON body to the given URL.
 *
 * @param url - Absolute URL to post to.
 * @param body - Value to JSON-encode as the request body.
 * @param init - Extra fetch options (headers are merged).
 * @returns The fetch Response.
 */
export function postJson(url: string, body: unknown, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    body: JSON.stringify(body),
  });
}

/**
 * Parse complete `data: ...` blocks out of an SSE text buffer.
 *
 * @param buffer - Accumulated SSE text.
 * @returns Parsed payload strings and the unconsumed remainder.
 */
function drainSseBlocks(buffer: string): { payloads: string[]; rest: string } {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const payloads = blocks
    .map((block) => block.trim())
    .filter((block) => block.startsWith("data: "))
    .map((block) => block.slice("data: ".length));
  return { payloads, rest };
}

/**
 * Read an SSE response body until it ends or the deadline passes.
 *
 * @param response - A fetch Response whose body is an SSE stream.
 * @param timeoutMs - Maximum time to wait for the server to end the stream.
 * @returns Events received, and whether the stream ended in time.
 */
export async function readSse(response: Response, timeoutMs: number): Promise<SseReadResult> {
  const result: SseReadResult = { events: [], ended: false, sawDone: false };
  if (!response.body) return { ...result, ended: true };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let buffer = "";

  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), remaining);
      });
      const chunk = await Promise.race([reader.read(), timeout]);
      clearTimeout(timer);
      if (chunk === "timeout") break;
      if (chunk.done) {
        result.ended = true;
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      const { payloads, rest } = drainSseBlocks(buffer);
      buffer = rest;
      for (const payload of payloads) {
        if (payload === "[DONE]") result.sawDone = true;
        else result.events.push(JSON.parse(payload) as SseEvent);
      }
    }
  } catch (err) {
    result.streamError = err instanceof Error ? err.message : String(err);
  } finally {
    if (!result.ended) await reader.cancel().catch(() => undefined);
  }
  return result;
}

/**
 * Poll a predicate until it returns true or the timeout elapses.
 *
 * @param predicate - Condition to wait for.
 * @param timeoutMs - Maximum time to wait.
 * @returns True if the predicate became true in time, false otherwise.
 */
export async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return predicate();
}
