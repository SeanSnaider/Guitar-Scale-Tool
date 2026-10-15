/**
 * chordDetectorRobustness.test.ts
 *
 * Behaviour checks for ChordDetector on inputs that are not chords: silence,
 * mains hum, and hum before the strum. Runs the real collectFrames(2500, 100)
 * path through the emulated AnalyserNode at 48 kHz, the usual browser rate.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ChordDetector, FRAME_GATE_DBFS, MIN_CONFIDENCE } from '../audio/ChordDetector';
import { createEmulatedAnalyser } from './helpers/analyserEmulator';

const SAMPLE_RATE = 48000;
const SECONDS = 3;

/** Frequency of a MIDI note in Hz (A4 = 69 = 440 Hz). */
const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Sum of sines, each [frequency Hz, peak amplitude], sampled at SAMPLE_RATE. */
function tones(partials: [number, number][], seconds = SECONDS): Float32Array {
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  for (const [freq, amp] of partials) {
    const w = (2 * Math.PI * freq) / SAMPLE_RATE;
    for (let n = 0; n < out.length; n++) out[n] += amp * Math.sin(w * n);
  }
  return out;
}

/**
 * Mains hum: 60 Hz plus harmonics 2..12 falling off as 1/n, the rough shape
 * of hum picked up by a guitar cable or single-coil pickup.
 */
function hum(level: number, seconds = SECONDS): Float32Array {
  return tones(
    Array.from({ length: 12 }, (_, i): [number, number] => [60 * (i + 1), level / (i + 1)]),
    seconds,
  );
}

/** C major triad voiced C3 E3 G3 C4, each note with its octave harmonic. */
function cMajorTriad(seconds = SECONDS): Float32Array {
  const notes = [48, 52, 55, 60];
  return tones(
    notes.flatMap((m): [number, number][] => [
      [midiToHz(m), 0.08],
      [2 * midiToHz(m), 0.04],
    ]),
    seconds,
  );
}

async function listen(signal: Float32Array) {
  const analyser = createEmulatedAnalyser({
    signal,
    sampleRate: SAMPLE_RATE,
    startSample: 0,
    startTimeMs: performance.now(),
  });
  const detector = new ChordDetector(analyser, SAMPLE_RATE);
  const pending = detector.collectFrames(2500, 100);
  await vi.runAllTimersAsync();
  const chroma = await pending;
  return { chroma, result: detector.detectChord(chroma) };
}

describe('ChordDetector robustness', () => {
  beforeAll(() => vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] }));
  afterAll(() => vi.useRealTimers());

  it('returns an all-zero chroma for silence', async () => {
    const { chroma, result } = await listen(new Float32Array(SECONDS * SAMPLE_RATE));
    expect(chroma).toEqual(new Array(12).fill(0));
    expect(result.confidence).toBe(0);
    expect(result.confident).toBe(false);
  });

  it('returns an all-zero chroma for hum below the energy gate', async () => {
    // 60 Hz fundamental at ~-63 dBFS peak: its partials clear the per-bin
    // noise floor, but the frame level (~-66 dBFS RMS) is under the gate.
    expect(FRAME_GATE_DBFS).toBeGreaterThan(-66);
    const { chroma } = await listen(hum(7e-4));
    expect(chroma.every(v => v === 0)).toBe(true);
  });

  it('does not report a confident chord for audible 60 Hz hum', async () => {
    // Fundamental at ~-30 dBFS: loud enough to pass the gate, so this checks
    // that hum does not score like a chord against the templates.
    const { chroma, result } = await listen(hum(0.03));
    expect(chroma.some(v => v > 0)).toBe(true);
    expect(result.confidence).toBeLessThan(MIN_CONFIDENCE);
    expect(result.confident).toBe(false);
  });

  it('detects a clean C major triad as a confident C', async () => {
    const { result } = await listen(cMajorTriad());
    expect(result.chord).toBe('C');
    expect(result.root).toBe('C');
    expect(result.quality).toBe('major');
    expect(result.confident).toBe(true);
  });

  it('is not pulled off the chord by hum heard before the strum', async () => {
    // First 1.3 s is hum only (about half the frames), then the triad starts
    // ~26 dB louder. Loudness weighting should let the chord win.
    const humOnly = hum(0.003);
    const chord = cMajorTriad();
    const onset = Math.round(1.3 * SAMPLE_RATE);
    const signal = new Float32Array(humOnly.length);
    for (let n = 0; n < signal.length; n++) signal[n] = humOnly[n] + (n >= onset ? chord[n - onset] : 0);
    const { result } = await listen(signal);
    expect(result.chord).toBe('C');
  });
});
