/**
 * agentApi.ts
 *
 * SSE streaming client for the FretAgent Express sidecar.
 *
 * Sends a POST to /api/agent (proxied by Vite to http://localhost:3001) and
 * yields strongly-typed AgentEvent objects as the server pushes them.
 *
 * Event types from the server:
 *   { type: "thought", thought: string }   — a reasoning step
 *   { type: "chunk",   content: string }   — raw delta chunk
 *   { type: "answer",  answer: string }    — final practice plan (markdown)
 *   { type: "error",   message: string }   — failure message
 *
 * Usage:
 *   for await (const event of streamAgent(goal, difficulty, userContext)) {
 *     // handle event
 *   }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Personalisation payload sent from the Guitar Learning Tool backend. */
export interface UserContext {
  learnedScales?: string[];
  topChords?: string[];
}

/** A single streaming event from the agent endpoint. */
export type AgentEvent =
  | { type: 'thought'; thought: string }
  | { type: 'chunk'; content: string }
  | { type: 'answer'; answer: string }
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// Stream helper
// ---------------------------------------------------------------------------

/**
 * Open an SSE stream to POST /api/agent and yield AgentEvent objects.
 *
 * Reads the response as a text stream, splits on the SSE `data:` prefix, and
 * yields each parsed event. Stops on `[DONE]` or on a server error event.
 *
 * @param goal       - The player's stated practice goal.
 * @param difficulty - One of "beginner" | "intermediate" | "advanced".
 * @param userContext - Optional player context from the FastAPI backend.
 * @param signal     - Optional AbortSignal to cancel the stream early.
 * @yields AgentEvent objects as they arrive.
 * @throws {Error} If the HTTP response is not OK.
 */
export async function* streamAgent(
  goal: string,
  difficulty: string,
  userContext?: UserContext,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, difficulty, userContext }),
    signal,
  });

  if (!response.ok) {
    // The agent server returns { error } for validation/config failures;
    // show that rather than a bare status line.
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const detail = typeof body?.error === 'string' ? body.error : response.statusText;
    throw new Error(`Agent request failed (${response.status}): ${detail}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE lines are separated by double newlines
      const parts = buffer.split('\n\n');
      // Keep the last incomplete part in the buffer
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;

        const raw = line.slice('data:'.length).trim();
        if (raw === '[DONE]') return;

        try {
          const event = JSON.parse(raw) as AgentEvent;
          yield event;
          // Stop iterating after the answer to avoid processing stale chunks
          if (event.type === 'error') return;
        } catch {
          // Malformed JSON line — skip silently
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
