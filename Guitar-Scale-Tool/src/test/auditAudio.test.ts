/**
 * auditAudio.test.ts
 *
 * Regression tests for Web Audio defects found during the repository audit:
 *  - stopping scale playback left every pre-scheduled note sounding;
 *  - the playhead reported "stopped" (-1) during the 100 ms lead-in, which
 *    flipped Tablature's Play button back to "Play" while audio played;
 *  - a failed AudioContext initialisation retried forever on microtasks;
 *  - the metronome burst-played every missed beat after a main-thread stall
 *    and fired onBeat callbacks after stop();
 *  - silent microphone input was "detected" as a C major chord.
 *
 * Uses a small fake AudioContext whose clock the test controls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { Metronome } from '../audio/Metronome';
import { ChordDetector, hasAudibleSignal } from '../audio/ChordDetector';

/** A fake AudioParam that records automation calls. */
function fakeParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

/** Fake oscillator that records its start/stop times. */
interface FakeOscillator {
  type: string;
  frequency: ReturnType<typeof fakeParam>;
  detune: ReturnType<typeof fakeParam>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

/** Builds a fake AudioContext with a controllable clock and node log. */
function createFakeContext() {
  const oscillators: FakeOscillator[] = [];
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const ctx = {
    currentTime: 0,
    state: 'running',
    sampleRate: 44100,
    destination: node(),
    oscillators,
    createOscillator: vi.fn(() => {
      const osc: FakeOscillator = {
        type: 'sine',
        frequency: fakeParam(),
        detune: fakeParam(),
        ...node(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => ({ ...node(), gain: fakeParam() })),
    createBiquadFilter: vi.fn(() => ({ ...node(), type: 'lowpass', frequency: fakeParam(), Q: fakeParam() })),
    createDynamicsCompressor: vi.fn(() => ({
      ...node(),
      threshold: fakeParam(), knee: fakeParam(), ratio: fakeParam(), attack: fakeParam(), release: fakeParam(),
    })),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
  return ctx;
}

type FakeContext = ReturnType<typeof createFakeContext>;

/** Returns the time passed to the most recent stop() call on an oscillator. */
function lastStopTime(osc: FakeOscillator): number {
  const calls = osc.stop.mock.calls;
  return calls[calls.length - 1][0] as number;
}

let ctx: FakeContext;
let frames: FrameRequestCallback[];

/** The AudioContext mock installed by test/setup.ts (writable, not configurable). */
const setupAudioContext = window.AudioContext;

/**
 * Replaces window.AudioContext. setup.ts defines it as a non-configurable
 * property, so vi.stubGlobal cannot be used; plain assignment works.
 *
 * @param ctor - Constructor to install.
 */
function setAudioContext(ctor: unknown): void {
  window.AudioContext = ctor as typeof AudioContext;
}

beforeEach(() => {
  ctx = createFakeContext();
  frames = [];
  setAudioContext(vi.fn(function FakeAudioContext() { return ctx; }));
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => frames.push(cb)));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  setAudioContext(setupAudioContext);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('AudioEngine scale playback', () => {
  it('silences already-scheduled notes when playback is stopped', async () => {
    const engine = new AudioEngine();
    await engine.initialize();

    engine.scheduleScalePlayback([60, 62, 64, 65, 67, 69, 71, 72], 60);
    expect(ctx.oscillators.length).toBeGreaterThan(0);

    ctx.currentTime = 1.2; // a little past the second note
    engine.stopScalePlayback();

    for (const osc of ctx.oscillators) {
      expect(lastStopTime(osc)).toBeLessThanOrEqual(ctx.currentTime + 0.1);
    }
  });

  it('does not report "stopped" while waiting for the first note', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    const onNote = vi.fn();
    engine.onScaleNotePlay = onNote;

    engine.scheduleScalePlayback([60, 62, 64], 120);
    ctx.currentTime = 0.05; // inside the 100 ms lead-in
    frames.shift()?.(0);

    expect(onNote).not.toHaveBeenCalledWith(-1);
  });

  it('still reports -1 when playback is explicitly stopped', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    const onNote = vi.fn();
    engine.onScaleNotePlay = onNote;

    engine.scheduleScalePlayback([60, 62, 64], 120);
    engine.stopScalePlayback();

    expect(onNote).toHaveBeenLastCalledWith(-1);
  });
});

describe('AudioEngine initialisation failure', () => {
  it('gives up after one failed attempt instead of retrying forever', async () => {
    setAudioContext(vi.fn(function BrokenAudioContext() {
      throw new Error('AudioContext not supported');
    }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const engine = new AudioEngine();
    let attempts = 0;
    const realInitialize = engine.initialize.bind(engine);
    vi.spyOn(engine, 'initialize').mockImplementation(() => {
      attempts++;
      // Safety valve so the original bug cannot hang the test runner.
      if (attempts > 25) return new Promise<boolean>(() => {});
      return realInitialize();
    });

    engine.playNote('A', 4);
    for (let i = 0; i < 100; i++) await Promise.resolve();

    expect(attempts).toBe(1);
  });
});

describe('Metronome', () => {
  it('resynchronises after a stall instead of burst-playing missed beats', () => {
    vi.useFakeTimers();
    const metronome = new Metronome(ctx as unknown as AudioContext, ctx.destination as unknown as AudioNode);
    metronome.start(120);

    ctx.currentTime = 5; // the main thread was blocked for 5 s
    vi.advanceTimersByTime(25);

    const lateClicks = ctx.oscillators.filter((osc) => (osc.start.mock.calls[0][0] as number) < 5);
    // Only the beats scheduled before the stall may lie in the past.
    const beforeStall = ctx.oscillators.filter((osc) => (osc.start.mock.calls[0][0] as number) < 0.1);
    expect(lateClicks.length).toBe(beforeStall.length);
    metronome.stop();
  });

  it('does not fire beat callbacks after stop()', () => {
    vi.useFakeTimers();
    const metronome = new Metronome(ctx as unknown as AudioContext, ctx.destination as unknown as AudioNode);
    const onBeat = vi.fn();
    metronome.onBeat = onBeat;

    metronome.start(120);
    metronome.stop();
    vi.advanceTimersByTime(1000);

    expect(onBeat).not.toHaveBeenCalled();
  });
});

describe('ChordDetector silence handling', () => {
  it('treats an all-zero chroma vector as silence', () => {
    expect(hasAudibleSignal(new Array(12).fill(0))).toBe(false);
  });

  it('treats a real chroma vector as signal', () => {
    const cMajor = [1, 0, 0, 0, 0.8, 0, 0, 0.9, 0, 0, 0, 0];
    expect(hasAudibleSignal(cMajor)).toBe(true);
    const detector = new ChordDetector({} as AnalyserNode, 44100);
    expect(detector.detectChord(cMajor).chord).toBe('C');
  });
});
