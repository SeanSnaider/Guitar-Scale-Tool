/**
 * usePracticeAgent.ts
 *
 * State machine hook that drives the FretAgent streaming interaction.
 *
 * Responsibilities:
 *  - Fetches the player's learned scales and top chords from the FastAPI
 *    backend to personalise the agent prompt (gracefully degraded when the
 *    backend is unavailable).
 *  - Runs the SSE stream from the Express agent sidecar.
 *  - Exposes the current status, collected thought strings, streaming
 *    content, and final answer to the component.
 *  - Provides an `abort` function so the user can cancel mid-stream.
 *
 * States:
 *   idle      — nothing running, ready for input
 *   thinking  — stream open, collecting thoughts and chunks
 *   complete  — final answer received
 *   error     — stream terminated with an error
 */

import { useState, useCallback, useRef } from 'react';
import { streamAgent, type UserContext } from '../services/agentApi';
import { getLearnedScales, getChordStats } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentStatus = 'idle' | 'thinking' | 'complete' | 'error';

export interface PracticeAgentState {
  /** Current phase of the agent run. */
  status: AgentStatus;
  /** Reasoning steps collected so far, in order received. */
  thoughts: string[];
  /** Accumulated raw delta content (used for real-time streaming preview). */
  streamingContent: string;
  /** Final practice plan in markdown (only set when status === 'complete'). */
  answer: string | null;
  /** Error message (only set when status === 'error'). */
  errorMessage: string | null;
}

export interface UsePracticeAgentReturn extends PracticeAgentState {
  /**
   * Start a new agent run.
   *
   * @param goal - The player's practice goal text.
   * @param difficulty - One of "beginner" | "intermediate" | "advanced".
   */
  run: (goal: string, difficulty: string) => Promise<void>;
  /** Cancel the current stream (no-op when idle). */
  abort: () => void;
  /** Reset state back to idle so the user can start a new run. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: PracticeAgentState = {
  status: 'idle',
  thoughts: [],
  streamingContent: '',
  answer: null,
  errorMessage: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the full lifecycle of a FretAgent streaming run.
 *
 * @returns State and control functions for the agent interaction.
 */
export function usePracticeAgent(): UsePracticeAgentReturn {
  const [state, setState] = useState<PracticeAgentState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    // Return to the form. The aborted run exits silently, so without this
    // the UI would stay in 'thinking' with the form disabled.
    setState((prev) => (prev.status === 'thinking' ? { ...prev, status: 'idle' } : prev));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  /**
   * Fetch user context from the FastAPI backend.
   * Returns undefined if the backend is unreachable — agent still runs without it.
   */
  const fetchUserContext = async (): Promise<UserContext | undefined> => {
    try {
      const [masteryList, chordStats] = await Promise.all([
        getLearnedScales(),
        getChordStats(),
      ]);

      const learnedScales = masteryList
        .map((m) => m.scale_key.replace(/-/g, ' '))
        .slice(0, 10);

      const topChords = chordStats.most_common
        .slice(0, 8)
        .map((c) => c.chord);

      if (learnedScales.length === 0 && topChords.length === 0) return undefined;
      return { learnedScales, topChords };
    } catch {
      // FastAPI not running or error — proceed without personalisation
      return undefined;
    }
  };

  const run = useCallback(async (goal: string, difficulty: string) => {
    // Cancel any in-flight run
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      status: 'thinking',
      thoughts: [],
      streamingContent: '',
      answer: null,
      errorMessage: null,
    });

    const userContext = await fetchUserContext();
    if (controller.signal.aborted) return;

    let finished = false;
    try {
      for await (const event of streamAgent(goal, difficulty, userContext, controller.signal)) {
        if (controller.signal.aborted) return;

        if (event.type === 'thought') {
          setState((prev) => ({
            ...prev,
            thoughts: [...prev.thoughts, event.thought],
          }));
        } else if (event.type === 'chunk') {
          setState((prev) => ({
            ...prev,
            streamingContent: prev.streamingContent + event.content,
          }));
        } else if (event.type === 'answer') {
          finished = true;
          setState((prev) => ({
            ...prev,
            status: 'complete',
            answer: event.answer,
          }));
        } else if (event.type === 'error') {
          finished = true;
          setState((prev) => ({
            ...prev,
            status: 'error',
            errorMessage: event.message,
          }));
        }
      }
      if (!finished && !controller.signal.aborted) {
        // The server always ends a run with an answer or error event; if the
        // stream closed without one, the connection dropped mid-run.
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'The connection closed before the coach finished. Please try again.',
        }));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Unexpected error';
      setState((prev) => ({ ...prev, status: 'error', errorMessage: message }));
    }
  }, []);

  return { ...state, run, abort, reset };
}
