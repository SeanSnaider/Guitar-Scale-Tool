/**
 * audioEngine.test.ts
 *
 * AudioEngine and Metronome behaviour that only shows up in the scheduled
 * Web Audio graph: run-bus teardown on Stop, init failure handling, iOS
 * resume, volume smoothing, metronome accents, stop cleanup and catch-up.
 * Runs against the recording FakeAudioContext rather than real audio.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { Metronome, accentPattern } from '../audio/Metronome';
import { FakeAudioContext, FakeGain, asCtx, asNode } from './helpers/fakeAudioContext';

let ctx: FakeAudioContext;
let originalCtor: unknown;

/** Install a constructor on window that hands out `make()` and counts calls. */
function installCtor(make: () => FakeAudioContext) {
  const Ctor = vi.fn(function () {
    return make();
  });
  (window as unknown as { AudioContext: unknown }).AudioContext = Ctor;
  return Ctor;
}

/** Let pending promise callbacks (initialize().then(...)) run. */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  originalCtor = window.AudioContext;
  ctx = new FakeAudioContext();
  installCtor(() => ctx);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  (window as unknown as { AudioContext: unknown }).AudioContext = originalCtor;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Gains whose output goes straight into `target`. */
const feeding = (target: FakeGain) => ctx.gains.filter((g) => g.connections.includes(target));

describe('AudioEngine initialization', () => {
  it('does not retry forever when initialize fails, and closes the half-built context', async () => {
    ctx.createDynamicsCompressor = () => {
      throw new Error('no compressor');
    };
    const Ctor = installCtor(() => ctx);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const engine = new AudioEngine();

    engine.playNote('A', 4);
    await flush();
    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);

    // Later calls are no-ops: no new context, no new attempt
    engine.playNote('A', 4);
    engine.scheduleScalePlayback([60, 62], 120);
    engine.startMetronome(120);
    await flush();
    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(await engine.initialize()).toBe(false);
    expect(ctx.oscs).toHaveLength(0);
    err.mockRestore();
  });

  it('plays a note requested before init exactly once after init succeeds', async () => {
    const engine = new AudioEngine();
    engine.playNote('A', 4);
    await flush();
    expect(ctx.oscs).toHaveLength(3); // one GuitarSynth voice = 3 oscillators
  });
});

describe('scale playback run bus', () => {
  it('routes scheduled notes through a per-run bus that fades and disconnects on Stop', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    const noteGain = ctx.gains[1]; // master, note, metronome
    vi.useFakeTimers();

    const before = ctx.gains.length;
    engine.scheduleScalePlayback([60, 62, 64], 120);
    const bus = ctx.gains[before];
    expect(bus.connections).toEqual([noteGain]);
    expect(feeding(bus)).toHaveLength(3); // each note's envelope

    ctx.currentTime = 0.3;
    engine.stopScalePlayback();
    expect(bus.gain.calls).toContainEqual(['cancelScheduledValues', 0.3]);
    const ramp = bus.gain.calls.find((c) => c[0] === 'linearRampToValueAtTime');
    expect(ramp?.[1]).toBe(0);
    expect(ramp?.[2]).toBeGreaterThan(0.3);
    expect(ramp?.[2]).toBeLessThanOrEqual(0.3 + 0.015);
    expect(bus.disconnected).toBe(false); // not until the fade has played

    vi.advanceTimersByTime(100);
    expect(bus.disconnected).toBe(true);
  });

  it('starting a new run releases the previous run instead of stacking it', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    vi.useFakeTimers();

    const first = ctx.gains.length;
    engine.scheduleScalePlayback([60, 62], 120);
    const bus1 = ctx.gains[first];
    const second = ctx.gains.length;
    engine.scheduleScalePlayback([60, 62], 120);
    const bus2 = ctx.gains[second];

    vi.advanceTimersByTime(100);
    expect(bus1.disconnected).toBe(true);
    expect(bus2.disconnected).toBe(false);
  });

  it('interactive note clicks still go straight to the note gain', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    const noteGain = ctx.gains[1];
    engine.playNoteAtPosition(0, 0);
    expect(feeding(noteGain)).toHaveLength(1);
  });

  it('starts on the metronome grid when the metronome runs, else 100 ms ahead', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    vi.useFakeTimers();

    engine.scheduleScalePlayback([60], 120);
    const solo = ctx.oscs.length - 3;
    expect(ctx.oscs[solo].start).toHaveBeenCalledWith(0.1);

    engine.startMetronome(120, [4, 4]); // first click at 0.05, next unqueued at 0.55
    expect(engine.getMetronomeNextBeatTime()).toBeCloseTo(0.55);
    const at = ctx.oscs.length;
    engine.scheduleScalePlayback([60], 120);
    expect(ctx.oscs[at].start.mock.calls[0][0]).toBeCloseTo(0.55);
    engine.stopMetronome();
  });
});

describe('AudioEngine settings and resume', () => {
  it('glides volume changes with setTargetAtTime instead of stepping gain.value', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    ctx.currentTime = 1;
    engine.updateSettings({ masterVolume: 0.2, noteVolume: 0.3, metronomeVolume: 0.4 });
    expect(ctx.gains[0].gain.calls).toContainEqual(['setTargetAtTime', 0.2, 1, 0.01]);
    expect(ctx.gains[1].gain.calls).toContainEqual(['setTargetAtTime', 0.3, 1, 0.01]);
    expect(ctx.gains[2].gain.calls).toContainEqual(['setTargetAtTime', 0.4, 1, 0.01]);
  });

  it('resumes an interrupted context and retries on each gesture until it runs', async () => {
    const engine = new AudioEngine();
    await engine.initialize();

    ctx.setState('interrupted'); // iOS: a call came in
    window.dispatchEvent(new Event('pointerdown'));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('keydown')); // first resume was refused
    expect(ctx.resume).toHaveBeenCalledTimes(2);

    ctx.setState('running');
    window.dispatchEvent(new Event('pointerdown'));
    expect(ctx.resume).toHaveBeenCalledTimes(2);

    // Explicit resume also handles 'interrupted', and never rejects
    ctx.state = 'interrupted';
    ctx.resume.mockRejectedValueOnce(new Error('not allowed'));
    await expect(engine.resume()).resolves.toBeUndefined();
    engine.dispose();
  });

  it('arms gesture resume for a context created suspended', async () => {
    ctx.state = 'suspended';
    const engine = new AudioEngine();
    await engine.initialize();
    window.dispatchEvent(new Event('pointerdown'));
    expect(ctx.resume).toHaveBeenCalled();
    engine.dispose();
  });
});

describe('metronome accents', () => {
  it.each([
    ['4/4', [4, 4], 'S...'],
    ['3/4', [3, 4], 'S..'],
    ['6/8', [6, 8], 'S..M..'],
    ['7/8', [7, 8], 'S.M.M..'],
    ['5/4', [5, 4], 'S..M.'],
  ] as const)('%s', (_name, [beats, unit], expected) => {
    const code = { strong: 'S', medium: 'M', none: '.' } as const;
    expect(accentPattern(beats, unit, true).map((l) => code[l]).join('')).toBe(expected);
  });

  it('no accents when accentFirst is off', () => {
    expect(accentPattern(6, 8, false)).toEqual(Array(6).fill('none'));
  });

  it('plays three distinct click levels over a 6/8 measure', () => {
    vi.useFakeTimers();
    const metro = new Metronome(asCtx(ctx), asNode(ctx.destination));
    metro.start(600, [6, 8]); // 0.1 s per click, so the measure spans 0.6 s
    for (let t = 0; t < 0.6; t += 0.025) {
      ctx.currentTime = t;
      vi.advanceTimersByTime(25);
    }
    metro.stop();
    const freqs = ctx.oscs.slice(0, 6).map((o) => o.frequency.value);
    expect(freqs).toEqual([1000, 800, 800, 900, 800, 800]);
  });
});

describe('metronome stop and catch-up', () => {
  it('stop cancels clicks and beat callbacks that were already scheduled', () => {
    vi.useFakeTimers();
    const metro = new Metronome(asCtx(ctx), asNode(ctx.destination));
    const onBeat = vi.fn();
    metro.onBeat = onBeat;
    metro.start(120, [4, 4]); // queues the first click 50 ms ahead
    expect(ctx.oscs).toHaveLength(1);

    metro.stop();
    expect(ctx.oscs[0].stop).toHaveBeenLastCalledWith(0);
    vi.advanceTimersByTime(1000);
    expect(onBeat).not.toHaveBeenCalled();
    expect(ctx.oscs).toHaveLength(1);
  });

  it('after a main-thread stall it skips missed beats instead of playing them at once', () => {
    vi.useFakeTimers();
    const metro = new Metronome(asCtx(ctx), asNode(ctx.destination));
    metro.start(120, [4, 4]); // grid: 0.05, 0.55, 1.05, ...
    expect(ctx.oscs).toHaveLength(1);

    ctx.currentTime = 2.52; // the tab froze for ~2.5 s
    vi.advanceTimersByTime(25);
    const late = ctx.oscs.slice(1);
    expect(late).toHaveLength(1);
    expect(late[0].start.mock.calls[0][0]).toBeCloseTo(2.55);
    // 2.55 is beat 5 since the start, so beat 1 of the bar: a plain click
    expect(late[0].frequency.value).toBe(800);
    metro.stop();
  });

  it('reports the next beat on the grid, or null when stopped', () => {
    vi.useFakeTimers();
    const metro = new Metronome(asCtx(ctx), asNode(ctx.destination));
    expect(metro.getNextBeatTime()).toBeNull();
    metro.start(120, [4, 4]);
    expect(metro.getNextBeatTime(0.1)).toBeCloseTo(0.55);
    expect(metro.getNextBeatTime(0.6)).toBeCloseTo(1.05);
    metro.stop();
    expect(metro.getNextBeatTime()).toBeNull();
  });
});
