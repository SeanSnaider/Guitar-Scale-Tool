/**
 * AudioEngine.ts
 *
 * Central audio coordinator for the Guitar Scale Tool.
 *
 * Responsibilities:
 *   - Own the single shared AudioContext and master gain graph.
 *   - Delegate note synthesis to GuitarSynth (drift-free, MIDI-based).
 *   - Delegate metronome to Metronome (look-ahead scheduler).
 *   - Provide scheduleScalePlayback for Guitar-Pro-style tablature playback
 *     driven by AudioContext.currentTime rather than setTimeout.
 *   - Expose a minimal backward-compatible public API so existing component
 *     call-sites (Fretboard, Tablature, PracticeMode) continue to work.
 *
 * Gain graph:
 *   GuitarSynth output ─┐
 *   Metronome output   ─┤─► masterGain ─► AudioContext.destination
 *   (other sources)    ─┘
 */

import {
  stringFretToMidi,
  getNoteFrequency,
  STANDARD_TUNING,
} from '../data/musicTheory';
import { GuitarSynth } from './GuitarSynth';
import { Metronome } from './Metronome';

/** Public audio settings exposed to the UI. */
export interface AudioSettings {
  masterVolume: number;
  noteVolume: number;
  metronomeVolume: number;
  /** Default sustain length (seconds) for interactive note clicks. */
  sustainLength: number;
  attackTime: number;   // kept for API compat; GuitarSynth uses fixed ADSR
  releaseTime: number;  // kept for API compat
}

/** Info about a note being played (returned by some helpers). */
export interface NoteInfo {
  note: string;
  octave: number;
  frequency: number;
  stringIndex?: number;
  fret?: number;
}

/** Internal record of a pre-scheduled scale beat. */
interface ScheduledBeat {
  index: number;
  audioTime: number; // AudioContext time when this note plays
}

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noteGain: GainNode | null = null;
  private metronomeGain: GainNode | null = null;

  private guitarSynth: GuitarSynth | null = null;
  private metronome: Metronome | null = null;

  private isInitialized = false;
  /** In-flight initialization promise — prevents double AudioContext creation. */
  private _initializingPromise: Promise<boolean> | null = null;

  // Scale playback state
  private scheduledBeats: ScheduledBeat[] = [];
  private beatDuration: number = 0.5;   // seconds, stored for end-detection
  private rafHandle: number | null = null;
  private scaleIsPlaying = false;

  private settings: AudioSettings = {
    masterVolume:    0.7,
    noteVolume:      0.8,
    metronomeVolume: 0.6,
    sustainLength:   1.5,
    attackTime:      0.02,
    releaseTime:     0.3,
  };

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /**
   * Called each metronome beat with (beatIndex, isAccent).
   * Wire this in your component for visual beat feedback.
   */
  public onMetronomeBeat: ((beat: number, isAccent: boolean) => void) | null = null;

  /**
   * Called by requestAnimationFrame during scale playback with the current
   * beat index (-1 when stopped / finished).
   * Wire this to highlight the active note in Tablature and Fretboard.
   */
  public onScaleNotePlay: ((noteIndex: number) => void) | null = null;

  // ── Initialization ─────────────────────────────────────────────────────────

  /**
   * Initialize the AudioContext and gain graph.
   * Must be called after a user gesture (browser autoplay policy).
   *
   * @returns true on success, false on failure.
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    // If already initializing, return the in-flight promise to avoid double AudioContext.
    if (this._initializingPromise) return this._initializingPromise;

    this._initializingPromise = (async () => {
      try {
        // Older Safari only exposes the prefixed constructor
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new Ctor();

        // Dynamics compressor → destination (prevents clipping when chords/multiple notes play)
        const compressor = this.audioContext.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.knee.value = 10;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        compressor.connect(this.audioContext.destination);

        // Master gain → compressor
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.settings.masterVolume;
        this.masterGain.connect(compressor);

        // Note gain → master
        this.noteGain = this.audioContext.createGain();
        this.noteGain.gain.value = this.settings.noteVolume;
        this.noteGain.connect(this.masterGain);

        // Metronome gain → master
        this.metronomeGain = this.audioContext.createGain();
        this.metronomeGain.gain.value = this.settings.metronomeVolume;
        this.metronomeGain.connect(this.masterGain);

        // Subsystems
        this.guitarSynth = new GuitarSynth(this.audioContext, this.noteGain);
        this.metronome   = new Metronome(this.audioContext, this.metronomeGain);

        this.metronome.onBeat = (beat, isAccent) => {
          if (this.onMetronomeBeat) this.onMetronomeBeat(beat, isAccent);
        };

        this.isInitialized = true;
        return true;
      } catch (error) {
        console.error('AudioEngine: failed to initialize AudioContext:', error);
        return false;
      } finally {
        this._initializingPromise = null;
      }
    })();

    return this._initializingPromise;
  }

  /**
   * Update audio settings and apply gain changes immediately.
   */
  updateSettings(newSettings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    if (this.masterGain)    this.masterGain.gain.value    = this.settings.masterVolume;
    if (this.noteGain)      this.noteGain.gain.value      = this.settings.noteVolume;
    if (this.metronomeGain) this.metronomeGain.gain.value = this.settings.metronomeVolume;
  }

  // ── Note Playback ──────────────────────────────────────────────────────────

  /**
   * Play a note by name + octave (backward-compatible API).
   * Converts to MIDI internally so frequencies are always accurate.
   *
   * @param note     - Note name, e.g. "A", "C#".
   * @param octave   - Octave number (4 = middle octave).
   * @param duration - Sustain length in seconds. Defaults to audioSettings.sustainLength.
   */
  playNote(note: string, octave: number = 4, duration?: number): void {
    if (!this.audioContext || !this.guitarSynth) {
      this.initialize().then(() => this.playNote(note, octave, duration));
      return;
    }
    this.ensureRunning();

    // Derive MIDI from frequency so we stay on the same formula as stringFretToMidi
    const freq = getNoteFrequency(note, octave);
    if (freq === 0) return;
    const midi = Math.round(69 + 12 * Math.log2(freq / 440));

    this.guitarSynth.playNote(
      midi,
      this.audioContext.currentTime,
      duration ?? this.settings.sustainLength
    );
  }

  /**
   * Play the note at a fretboard position using the correct MIDI calculation.
   * Fixes the octave-disagreement bug present in the original implementation.
   *
   * @param stringIndex - 0 = lowest string, 5 = highest (standard 6-string).
   * @param fret        - Fret number (0 = open string).
   * @param tuning      - Note indices per string; defaults to standard tuning.
   * @param duration    - Sustain length in seconds.
   */
  playNoteAtPosition(
    stringIndex: number,
    fret: number,
    tuning: readonly number[] = STANDARD_TUNING,
    duration?: number
  ): void {
    if (!this.audioContext || !this.guitarSynth) {
      this.initialize().then(() => this.playNoteAtPosition(stringIndex, fret, tuning, duration));
      return;
    }
    this.ensureRunning();

    const midi = stringFretToMidi(stringIndex, fret, tuning);
    this.guitarSynth.playNote(
      midi,
      this.audioContext.currentTime,
      duration ?? this.settings.sustainLength
    );
  }

  // ── Scale Playback ─────────────────────────────────────────────────────────

  /**
   * Pre-schedule an entire scale through the AudioContext look-ahead clock.
   *
   * All notes are scheduled before any of them play. A requestAnimationFrame
   * loop then reads AudioContext.currentTime to drive the visual playhead
   * (onScaleNotePlay callback) without any setTimeout drift.
   *
   * @param midiNotes - Ordered array of MIDI note numbers to play.
   * @param bpm       - Playback tempo in beats per minute.
   */
  scheduleScalePlayback(midiNotes: number[], bpm: number): void {
    if (!this.audioContext || !this.guitarSynth) {
      this.initialize().then(() => this.scheduleScalePlayback(midiNotes, bpm));
      return;
    }
    this.ensureRunning();
    this.stopScalePlayback();

    this.beatDuration = 60 / bpm;
    const startTime = this.audioContext.currentTime + 0.1; // 100 ms head start

    this.scheduledBeats = midiNotes.map((midi, i) => {
      const audioTime = startTime + i * this.beatDuration;
      this.guitarSynth!.playNote(midi, audioTime, this.beatDuration * 0.85);
      return { index: i, audioTime };
    });

    this.scaleIsPlaying = true;
    this.rafHandle = requestAnimationFrame(() => this.updatePlayhead());
  }

  /**
   * Stop scale playback and cancel the rAF loop.
   * Fires onScaleNotePlay(-1) to clear any highlighted note.
   */
  stopScalePlayback(): void {
    this.scaleIsPlaying = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.scheduledBeats = [];
    if (this.onScaleNotePlay) this.onScaleNotePlay(-1);
  }

  /**
   * Legacy wrapper kept for call-sites that still use playScale().
   * Converts note names + octaves to MIDI and delegates to scheduleScalePlayback.
   *
   * @deprecated Prefer scheduleScalePlayback with pre-computed MIDI arrays.
   */
  async playScale(
    _rootNote: string,
    _scaleKey: string,
    _direction: 'ascending' | 'descending' | 'both' = 'ascending',
    _bpm: number = 120,
    _startOctave: number = 3
  ): Promise<void> {
    // No-op stub — Tablature now drives playback via scheduleScalePlayback.
    // Kept so any remaining call-sites don't throw at runtime.
  }

  // ── Metronome ──────────────────────────────────────────────────────────────

  /**
   * Start the metronome with look-ahead scheduling (drift-free).
   *
   * @param bpm           - Beats per minute.
   * @param timeSignature - [beatsPerMeasure, noteValue], e.g. [4, 4].
   * @param accentFirst   - Accent the first beat of each measure.
   */
  startMetronome(
    bpm: number,
    timeSignature: [number, number] = [4, 4],
    accentFirst = true
  ): void {
    if (!this.metronome) {
      this.initialize().then(() => this.startMetronome(bpm, timeSignature, accentFirst));
      return;
    }
    this.ensureRunning();
    this.metronome.start(bpm, timeSignature, accentFirst);
  }

  /** Stop the metronome. Safe to call when already stopped. */
  stopMetronome(): void {
    this.metronome?.stop();
  }

  /** Update BPM while the metronome is running. */
  updateMetronomeBpm(bpm: number): void {
    this.metronome?.setBpm(bpm);
  }

  /** Returns true if the metronome is currently running. */
  isMetronomeRunning(): boolean {
    return this.metronome?.isActive() ?? false;
  }

  /**
   * Play a single metronome click immediately (for preview / tap-tempo).
   *
   * @param isAccent - Use the accent pitch/volume.
   */
  playClick(isAccent = false): void {
    if (!this.audioContext || !this.metronomeGain) {
      this.initialize().then(() => this.playClick(isAccent));
      return;
    }
    this.ensureRunning();

    const osc  = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.value = isAccent ? 1000 : 800;
    osc.connect(gain);
    gain.connect(this.metronomeGain);

    const now = this.audioContext.currentTime;
    gain.gain.setValueAtTime(isAccent ? 0.8 : 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // ── State ──────────────────────────────────────────────────────────────────

  /** Returns the AudioContext state, or 'uninitialized' if not yet created. */
  getState(): AudioContextState | 'uninitialized' {
    return this.audioContext?.state ?? 'uninitialized';
  }

  /** Resume a suspended AudioContext (needed after the browser suspends it). */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /** Release all resources. Call when the app unmounts. */
  dispose(): void {
    this.stopMetronome();
    this.stopScalePlayback();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.masterGain    = null;
    this.noteGain      = null;
    this.metronomeGain = null;
    this.guitarSynth   = null;
    this.metronome     = null;
    this.isInitialized = false;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Resume the AudioContext if the browser suspended it (common after page load
   * or tab switch). Called before any audio output.
   */
  private ensureRunning(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * requestAnimationFrame loop that reads AudioContext.currentTime and fires
   * onScaleNotePlay with the index of the note currently under the playhead.
   *
   * Uses the AudioContext clock (not Date.now) so it stays perfectly in sync
   * with the pre-scheduled audio events.
   */
  private updatePlayhead(): void {
    if (!this.scaleIsPlaying || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Find the last beat whose scheduled time has passed
    let currentBeat = -1;
    for (const beat of this.scheduledBeats) {
      if (beat.audioTime <= now) currentBeat = beat.index;
      else break;
    }

    if (this.onScaleNotePlay) this.onScaleNotePlay(currentBeat);

    // Stop when the last note's sustain has ended
    const last = this.scheduledBeats[this.scheduledBeats.length - 1];
    if (last && now > last.audioTime + this.beatDuration) {
      this.stopScalePlayback();
      return;
    }

    this.rafHandle = requestAnimationFrame(() => this.updatePlayhead());
  }
}

/** Singleton instance shared across the entire application. */
export const audioEngine = new AudioEngine();

/** Also export the class for testing or creating isolated instances. */
export { AudioEngine };
