/**
 * GuitarSynth.ts
 *
 * Synthesizes guitar-like tones using the Web Audio API.
 *
 * Architecture per note:
 *   Sawtooth osc (fundamental)     ─┐
 *   Sawtooth osc (detuned +5 ¢)   ─┤─► Mix ─► Lowpass filter ─► ADSR gain ─► output
 *   Sine osc (2nd harmonic ×2)     ─┘
 *
 * The detuned oscillator pair produces natural string "beating".
 * The lowpass filter (3 kHz, Q 1.5) mimics string high-frequency rolloff.
 * The ADSR envelope models a plucked string: instant attack, fast decay, quiet sustain.
 */

import { midiToFrequency } from '../data/musicTheory';

/** ADSR envelope values tuned for plucked guitar string timbre. */
const GUITAR_ADSR = {
  attack:  0.002, // seconds — nearly instant pluck
  decay:   0.08,  // fast drop from peak
  sustain: 0.25,  // 25% of peak — string rings quietly
  release: 0.6,   // string rings out
} as const;

/** Lowpass filter settings to soften the harsh sawtooth. */
const FILTER = {
  frequency: 3000, // Hz
  Q:         1.5,
} as const;

/** Time constant (s) for the fade applied when a note is cancelled early. */
const CANCEL_FADE_SECONDS = 0.01;

/** Handle to a scheduled note, allowing it to be silenced before it ends. */
export interface ScheduledNote {
  /**
   * Fade the note out and stop its oscillators at `when` (AudioContext
   * time). Notes that have not started yet never sound.
   *
   * @param when - AudioContext time to cancel at.
   */
  cancel(when: number): void;
}

/**
 * Plucked-string synthesizer. Each playNote call builds a short-lived node
 * graph (three oscillators, a lowpass filter and an ADSR gain) connected to
 * the output node; the oscillators stop themselves when the note ends.
 */
export class GuitarSynth {
  private readonly ctx: AudioContext;
  private readonly output: AudioNode;

  /**
   * @param audioContext - The shared AudioContext.
   * @param outputNode   - Destination node (e.g., a gain node for volume control).
   */
  constructor(audioContext: AudioContext, outputNode: AudioNode) {
    this.ctx = audioContext;
    this.output = outputNode;
  }

  /**
   * Schedule a single note to play at a precise AudioContext time.
   *
   * All timing is done via AudioContext.currentTime — never setTimeout.
   * This guarantees drift-free playback even over long sequences.
   *
   * @param midi      - MIDI note number (e.g., 40 = E2, 64 = E4).
   * @param startTime - AudioContext time (seconds) to begin the note.
   * @param duration  - Total note duration in seconds (sustain + release included).
   * @returns A handle that can silence the note early (e.g. when playback stops).
   */
  playNote(midi: number, startTime: number, duration: number): ScheduledNote {
    const frequency = midiToFrequency(midi);

    // ── Oscillators ──────────────────────────────────────────────────────────
    const osc1 = this.ctx.createOscillator(); // fundamental
    osc1.type = 'sawtooth';
    osc1.frequency.value = frequency;

    const osc2 = this.ctx.createOscillator(); // detuned +5 ¢ for string beating
    osc2.type = 'sawtooth';
    osc2.frequency.value = frequency;
    osc2.detune.value = 5;

    const osc3 = this.ctx.createOscillator(); // 2nd harmonic (octave up), quiet
    osc3.type = 'sine';
    osc3.frequency.value = frequency * 2;

    // ── Level mixing ─────────────────────────────────────────────────────────
    // Kept low so chords (multiple simultaneous notes) don't clip the compressor.
    const osc2Level = this.ctx.createGain();
    osc2Level.gain.value = 0.4; // detuned copy — reduced to avoid summing too hot

    const osc3Level = this.ctx.createGain();
    osc3Level.gain.value = 0.15; // subtle harmonic presence

    // ── Lowpass filter ────────────────────────────────────────────────────────
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = FILTER.frequency;
    filter.Q.value = FILTER.Q;

    // ── ADSR envelope ────────────────────────────────────────────────────────
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, startTime);

    const attackEnd   = startTime + GUITAR_ADSR.attack;
    const decayEnd    = attackEnd + GUITAR_ADSR.decay;
    const sustainEnd  = Math.max(decayEnd, startTime + duration - GUITAR_ADSR.release);
    const releaseEnd  = startTime + duration;

    env.gain.linearRampToValueAtTime(1.0,                  attackEnd);
    env.gain.exponentialRampToValueAtTime(GUITAR_ADSR.sustain, decayEnd);
    env.gain.setValueAtTime(GUITAR_ADSR.sustain,           sustainEnd);
    env.gain.exponentialRampToValueAtTime(0.001,           releaseEnd);

    // ── Signal graph ──────────────────────────────────────────────────────────
    osc1.connect(filter);
    osc2.connect(osc2Level);
    osc2Level.connect(filter);
    osc3.connect(osc3Level);
    osc3Level.connect(filter);
    filter.connect(env);
    env.connect(this.output);

    // ── Scheduling ───────────────────────────────────────────────────────────
    const stopTime = releaseEnd + 0.05; // small tail buffer
    osc1.start(startTime); osc1.stop(stopTime);
    osc2.start(startTime); osc2.stop(stopTime);
    osc3.start(startTime); osc3.stop(stopTime);

    return {
      cancel: (when: number) => {
        env.gain.cancelScheduledValues(when);
        env.gain.setTargetAtTime(0, when, CANCEL_FADE_SECONDS);
        const cancelStop = Math.min(stopTime, when + CANCEL_FADE_SECONDS * 5);
        for (const osc of [osc1, osc2, osc3]) osc.stop(cancelStop);
      },
    };
  }
}
