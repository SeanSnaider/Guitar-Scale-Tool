/**
 * chordDetectorAccuracy.test.ts
 *
 * Measures ChordDetector accuracy end to end on synthesized guitar strums:
 * Karplus-Strong plucked strings -> emulated AnalyserNode (fftSize 8192,
 * default smoothing) -> collectFrames(2500, 100) -> detectChord().
 * The listen duration and frame interval match useChordAI.ts.
 *
 * Every chord is a real playable voicing (E-shape and A-shape barre forms)
 * across all 12 roots. This is a regression floor, not a real-world accuracy
 * claim: synthetic strings are cleaner than a real guitar through a real mic.
 * For real recordings see eval/guitarset.test.ts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ChordDetector, buildChromaVector } from '../audio/ChordDetector';
import { createEmulatedAnalyser } from './helpers/analyserEmulator';

const SAMPLE_RATE = 44100;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Standard tuning, low E to high E, as MIDI note numbers. */
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64];

/** Chord tones as semitones above the root, for checking the voicings themselves. */
const QUALITY_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dominant7: [0, 4, 7, 10],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

type Shape = (number | null)[];

/** Fret offsets from the barre fret, low E to high E. null = muted string. */
const E_SHAPES: Record<string, Shape> = {
  major: [0, 2, 2, 1, 0, 0],
  minor: [0, 2, 2, 0, 0, 0],
  dominant7: [0, 2, 0, 1, 0, 0],
  major7: [0, null, 1, 1, 0, null],
  minor7: [0, 2, 0, 0, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
};

const A_SHAPES: Record<string, Shape> = {
  major: [null, 0, 2, 2, 2, 0],
  minor: [null, 0, 2, 2, 1, 0],
  dominant7: [null, 0, 2, 0, 2, 0],
  major7: [null, 0, 2, 1, 2, 0],
  minor7: [null, 0, 2, 0, 1, 0],
  sus2: [null, 0, 2, 2, 0, 0],
  sus4: [null, 0, 2, 2, 3, 0],
  diminished: [null, 0, 1, 2, 1, null],
  augmented: [null, 0, 3, 2, 2, 1],
};

interface Case {
  label: string;
  rootPc: number;
  quality: string;
  midiNotes: number[];
}

function buildCases(): Case[] {
  const cases: Case[] = [];
  const add = (shapes: Record<string, Shape>, rootString: number, shapeName: string) => {
    for (const [quality, shape] of Object.entries(shapes)) {
      for (let rootPc = 0; rootPc < 12; rootPc++) {
        const barre = (rootPc - (OPEN_STRINGS[rootString] % 12) + 12) % 12;
        const midiNotes = shape.flatMap((off, s) => (off === null ? [] : [OPEN_STRINGS[s] + barre + off]));
        cases.push({ label: `${NOTE_NAMES[rootPc]} ${quality} (${shapeName}, fret ${barre})`, rootPc, quality, midiNotes });
      }
    }
  };
  add(E_SHAPES, 0, 'E-shape');
  add(A_SHAPES, 1, 'A-shape');
  return cases;
}

/** Deterministic PRNG (mulberry32) so the benchmark is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Karplus-Strong plucked string: a noise burst circulating in a delay line,
 * with a two-tap average (a lowpass) in the feedback loop so high harmonics
 * decay faster than low ones, like a real string.
 *
 * The two-tap average adds half a sample of delay, so the loop length is
 * N + 0.5 and N = fs/f - 0.5. The loop gain per period is chosen so every
 * string has the same T60 (time to fall 60 dB): rho^(f * T60) = 10^-3.
 */
function pluck(out: Float32Array, start: number, freq: number, gain: number, rand: () => number): void {
  const period = Math.max(2, Math.round(SAMPLE_RATE / freq - 0.5));
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = rand() * 2 - 1;
  const t60Seconds = 3;
  const decay = Math.pow(10, -3 / (t60Seconds * freq));
  let idx = 0;
  for (let n = start; n < out.length; n++) {
    const next = (idx + 1) % period;
    const y = line[idx];
    out[n] += gain * y;
    line[idx] = decay * 0.5 * (y + line[next]);
    idx = next;
  }
}

/** Downward strum: strings sounded ~12 ms apart with random per-string level. */
function renderStrum(midiNotes: number[], seed: number, seconds = 3): { signal: Float32Array; onset: number } {
  const rand = mulberry32(seed);
  const onset = Math.round(0.05 * SAMPLE_RATE);
  const signal = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  midiNotes.forEach((midi, i) => {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const start = onset + Math.round(i * 0.012 * SAMPLE_RATE);
    pluck(signal, start, freq, 0.6 + 0.4 * rand(), rand);
  });
  // Normalize to a -6 dBFS peak and add a low noise floor (~-60 dBFS).
  let peak = 0;
  for (const v of signal) peak = Math.max(peak, Math.abs(v));
  for (let n = 0; n < signal.length; n++) {
    signal[n] = (signal[n] / peak) * 0.5 + (rand() * 2 - 1) * 0.001;
  }
  return { signal, onset };
}

async function detect(signal: Float32Array, startSample: number) {
  const analyser = createEmulatedAnalyser({
    signal,
    sampleRate: SAMPLE_RATE,
    startSample,
    startTimeMs: performance.now(),
  });
  const detector = new ChordDetector(analyser, SAMPLE_RATE);
  const pending = detector.collectFrames(2500, 100);
  await vi.runAllTimersAsync();
  return detector.detectChord(await pending);
}

describe('analyser emulator', () => {
  beforeAll(() => vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] }));
  afterAll(() => vi.useRealTimers());

  it('puts a 440 Hz sine in the A pitch class', () => {
    const signal = new Float32Array(SAMPLE_RATE);
    for (let n = 0; n < signal.length; n++) signal[n] = 0.5 * Math.sin((2 * Math.PI * 440 * n) / SAMPLE_RATE);
    const analyser = createEmulatedAnalyser({
      signal,
      sampleRate: SAMPLE_RATE,
      startSample: 0,
      // Pretend the node has been listening for 1 s so its window is full.
      startTimeMs: performance.now() - 1000,
    });
    const chroma = buildChromaVector(analyser, SAMPLE_RATE);
    expect(chroma.indexOf(1)).toBe(9);
  });
});

describe('ChordDetector accuracy on synthesized strums', () => {
  beforeAll(() => vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] }));
  afterAll(() => vi.useRealTimers());

  const cases = buildCases();

  it('uses voicings that actually spell the intended chord', () => {
    for (const c of cases) {
      const pcs = new Set(c.midiNotes.map(m => m % 12));
      const expected = new Set(QUALITY_INTERVALS[c.quality].map(i => (c.rootPc + i) % 12));
      expect(pcs, c.label).toEqual(expected);
    }
  });

  it('identifies root and quality at or above the baseline', async () => {
    let exact = 0;
    let rootOnly = 0;
    const perQuality: Record<string, { hit: number; total: number }> = {};
    const misses: string[] = [];

    for (const [i, c] of cases.entries()) {
      const { signal, onset } = renderStrum(c.midiNotes, 1000 + i);
      const result = await detect(signal, onset);
      const expectedChord = { root: NOTE_NAMES[c.rootPc], quality: c.quality };

      const q = (perQuality[c.quality] ??= { hit: 0, total: 0 });
      q.total++;
      if (result.root === expectedChord.root) rootOnly++;
      if (result.root === expectedChord.root && result.quality === expectedChord.quality) {
        exact++;
        q.hit++;
      } else {
        misses.push(`${c.label} -> ${result.chord}`);
      }
    }

    const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;
    console.log(
      [
        `Synthetic chord accuracy: ${exact}/${cases.length} exact (${pct(exact, cases.length)}), ` +
          `root ${rootOnly}/${cases.length} (${pct(rootOnly, cases.length)})`,
        ...Object.entries(perQuality).map(([k, v]) => `  ${k.padEnd(11)} ${v.hit}/${v.total}`),
        `Misses (${misses.length}):`,
        ...misses.map(m => `  ${m}`),
      ].join('\n'),
    );

    // Regression floor: the measured baseline (69/180 = 38.3% on 2026-10-12).
    // The synthesis is seeded, so this is deterministic. Raise it when the
    // detector improves; never lower it to make a change pass.
    expect(exact).toBeGreaterThanOrEqual(69);
  }, 120_000);
});
