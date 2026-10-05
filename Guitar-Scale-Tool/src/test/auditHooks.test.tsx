/**
 * auditHooks.test.tsx
 *
 * Regression tests for hook defects found during the repository audit:
 *  - cancelling the Practice Coach left it stuck in "thinking" forever;
 *  - a stream that closed without an answer also left it "thinking";
 *  - ChordAI's mount-time permission probe never released the microphone;
 *  - the API client discarded FastAPI's `detail` error messages.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { AgentEvent } from '../services/agentApi';

const streamAgentMock = vi.fn();

vi.mock('../services/agentApi', () => ({
  streamAgent: (...args: unknown[]) => streamAgentMock(...args),
}));

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    getLearnedScales: vi.fn(() => Promise.reject(new Error('offline'))),
    getChordStats: vi.fn(() => Promise.reject(new Error('offline'))),
    getAllMastery: vi.fn(() => Promise.reject(new Error('offline'))),
  };
});

import { usePracticeAgent } from '../hooks/usePracticeAgent';
import { useChordAI } from '../hooks/useChordAI';

/**
 * Builds a fake agent stream that yields one thought, then waits until the
 * abort signal fires and rejects like fetch does.
 */
function streamUntilAborted() {
  return async function* (
    _goal: string, _difficulty: string, _ctx: unknown, signal: AbortSignal,
  ): AsyncGenerator<AgentEvent> {
    yield { type: 'thought', thought: 'Looking up pentatonic drills' };
    await new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  };
}

describe('usePracticeAgent', () => {
  beforeEach(() => streamAgentMock.mockReset());

  it('returns to idle when the user cancels mid-stream', async () => {
    streamAgentMock.mockImplementation(streamUntilAborted());
    const { result } = renderHook(() => usePracticeAgent());

    let runPromise: Promise<void> = Promise.resolve();
    act(() => { runPromise = result.current.run('Learn sweep picking', 'advanced'); });
    await waitFor(() => expect(result.current.thoughts).toHaveLength(1));

    await act(async () => {
      result.current.abort();
      await runPromise;
    });

    expect(result.current.status).toBe('idle');
  });

  it('reports an error when the stream closes without an answer', async () => {
    streamAgentMock.mockImplementation(async function* (): AsyncGenerator<AgentEvent> {
      yield { type: 'thought', thought: 'Planning a warm-up routine' };
    });
    const { result } = renderHook(() => usePracticeAgent());

    await act(async () => { await result.current.run('Improve timing', 'beginner'); });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/before/i);
  });

  it('still completes normally when an answer arrives', async () => {
    streamAgentMock.mockImplementation(async function* (): AsyncGenerator<AgentEvent> {
      yield { type: 'answer', answer: '# Plan' };
    });
    const { result } = renderHook(() => usePracticeAgent());

    await act(async () => { await result.current.run('Improve timing', 'beginner'); });

    expect(result.current.status).toBe('complete');
    expect(result.current.answer).toBe('# Plan');
  });
});

describe('useChordAI microphone handling', () => {
  const originalMediaDevices = navigator.mediaDevices;
  let stopTrack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stopTrack = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(() => Promise.resolve({ getTracks: () => [{ stop: stopTrack }] })),
        enumerateDevices: vi.fn(() => Promise.resolve([
          { kind: 'audioinput', deviceId: 'mic-1', label: 'USB Mic' },
        ])),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices });
  });

  it('releases the microphone after the mount-time permission probe', async () => {
    const { result } = renderHook(() => useChordAI());
    await waitFor(() => expect(result.current.audioDevices).toHaveLength(1));
    expect(stopTrack).toHaveBeenCalled();
  });
});

describe('api client error messages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('surfaces FastAPI `detail` messages instead of a bare status code', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ detail: 'Session has already ended' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    ))));
    const { endSession } = await vi.importActual<typeof import('../services/api')>('../services/api');
    await expect(endSession('1')).rejects.toThrow('Session has already ended');
  });

  it('reports the HTTP status when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('Internal Server Error', { status: 500 }))));
    const { getBackendStats } = await vi.importActual<typeof import('../services/api')>('../services/api');
    await expect(getBackendStats()).rejects.toThrow('500');
  });

  it('sends the browser timezone offset when fetching stats', async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(() => Promise.resolve(new Response(
      JSON.stringify({ success: false, error: 'x' }), { status: 200 },
    )));
    vi.stubGlobal('fetch', fetchMock);
    const { getBackendStats } = await vi.importActual<typeof import('../services/api')>('../services/api');
    await getBackendStats().catch(() => {});
    expect(fetchMock.mock.calls[0][0]).toContain(`utc_offset_minutes=${-new Date().getTimezoneOffset()}`);
  });
});
