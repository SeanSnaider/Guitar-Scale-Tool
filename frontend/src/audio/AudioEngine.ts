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
 *   interactive notes ─────────────┐
 *   scale run bus (one per run) ───┴─► noteGain ─┐
 *   Metronome clicks ─────────────► metronomeGain ┴─► masterGain ─► compressor ─► destination
 */

import {
  stringFretToMidi,
  getNoteFrequency,
  STANDARD_TUNING,
} from '../data/musicTheory';
import { GuitarSynth } from './GuitarSynth';
import { Metronome } from './Metronome';
import type { AccentLevel } from './Metronome';

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

/**
 * Fade (s) applied to a scale run's bus on Stop before it is disconnected.
 * Long enough to avoid a click from cutting a sounding note, short enough
 * that Stop feels instant.
 */
const RUN_FADE_S = 0.012;

/**
 * Smoothing time constant (s) for volume changes. setTargetAtTime approaches
 * the target exponentially, ~95% of the way after 3 time constants (30 ms),
 * which removes the zipper noise of stepping gain.value directly.
 */
const VOLUME_SMOOTHING_S = 0.01;

/** Minimum lead (s) between scheduling a scale run and its first note. */
const SCALE_START_LEAD_S = 0.1;

/** Minimum lead (s) when lining a run up with the metronome's next beat. */
const METRONOME_ALIGN_LEAD_S = 0.05;

/** Safari's Audio Session API (navigator.audioSession), not yet in lib.dom. */
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

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
  /**
   * Set when initialize() failed (no Web Audio, constructor threw). Cached so
   * every later call is a cheap no-op instead of retrying forever.
   */
  private initFailed = false;
  /** In-flight initialization promise — prevents double AudioContext creation. */
  private _initializingPromise: Promise<boolean> | null = null;
  /** Whether the resume-on-next-gesture listeners are attached. */
  private gestureResumeArmed = false;

  // Scale playback state
  private scheduledBeats: ScheduledBeat[] = [];
  private beatDuration: number = 0.5;   // seconds, stored for end-detection
  private rafHandle: number | null = null;
  private scaleIsPlaying = false;
  /**
   * Gain node every note of the current scale run is routed through. Notes
   * are all scheduled up front and keep no handle, so this bus is the only
   * way to silence a run: fade it out and disconnect it on Stop.
   */
  private runBus: GainNode | null = null;

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
   * Called each metronome beat with (beatIndex, isAccent, accentLevel).
   * Wire this in your component for visual beat feedback.
   */
  public onMetronomeBeat: ((beat: number, isAccent: boolean, level: AccentLevel) => void) | null = null;

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
    if (this.initFailed) return false;
    // If already initializing, return the in-flight promise to avoid double AudioContext.
    if (this._initializingPromise) return this._initializingPromise;

    this._initializingPromise = (async () => {
      try {
        // iOS: the default 'auto' session is muted by the ring/silent switch.
        // 'playback' makes this behave like a music app. Guarded: only Safari
        // 16.4+ has navigator.audioSession.
        const session = (navigator as AudioSessionNavigator).audioSession;
        if (session) {
          try {
            session.type = 'playback';
          } catch {
            /* unsupported value; keep the default */
          }
        }

        // Older Safari only exposes the prefixed constructor
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new Ctor();
        const ctx = this.audioContext;
        // A context can be suspended or (iOS) 'interrupted' by a call, Siri or
        // another app at any time. Resuming only works from a user gesture, so
        // whenever it leaves 'running', retry on the next pointer/key press.
        ctx.onstatechange = () => this.onContextStateChange();

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

        this.metronome.onBeat = (beat, isAccent, level) => {
          if (this.onMetronomeBeat) this.onMetronomeBeat(beat, isAccent, level);
        };

        this.isInitialized = true;
        // Created outside a gesture (or before one finished) it starts
        // suspended, and no statechange fires for the initial state.
        this.onContextStateChange();
        return true;
      } catch (error) {
        console.error('AudioEngine: failed to initialize AudioContext:', error);
        // Don't leak a half-built context (browsers cap how many can exist).
        const half = this.audioContext;
        if (half) {
          half.onstatechange = null;
          half.close().catch(() => {});
        }
        this.audioContext  = null;
        this.masterGain    = null;
        this.noteGain      = null;
        this.metronomeGain = null;
        this.guitarSynth   = null;
        this.metronome     = null;
        this.initFailed    = true;
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

    const ctx = this.audioContext;
    if (!ctx) return; // initialize() reads this.settings when it builds the graph
    // Glide to the new level rather than stepping it (stepping is audible as
    // zipper noise while a volume slider is dragged).
    const now = ctx.currentTime;
    this.masterGain?.gain.setTargetAtTime(this.settings.masterVolume, now, VOLUME_SMOOTHING_S);
    this.noteGain?.gain.setTargetAtTime(this.settings.noteVolume, now, VOLUME_SMOOTHING_S);
    this.metronomeGain?.gain.setTargetAtTime(this.settings.metronomeVolume, now, VOLUME_SMOOTHING_S);
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
    if (!this.whenReady(() => this.playNote(note, octave, duration))) return;
    if (!this.audioContext || !this.guitarSynth) return;
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
    if (!this.whenReady(() => this.playNoteAtPosition(stringIndex, fret, tuning, duration))) return;
    if (!this.audioContext || !this.guitarSynth) return;
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
   * Each run gets its own bus (a GainNode into noteGain) so stopping or
   * restarting can silence notes that are already scheduled.
   *
   * When the metronome is running the first note lands on its next beat, so
   * the scale and the click share one grid; otherwise playback starts after a
   * 100 ms head start.
   *
   * @param midiNotes - Ordered array of MIDI note numbers to play.
   * @param bpm       - Playback tempo in beats per minute.
   */
  scheduleScalePlayback(midiNotes: number[], bpm: number): void {
    if (!this.whenReady(() => this.scheduleScalePlayback(midiNotes, bpm))) return;
    const ctx = this.audioContext;
    const synth = this.guitarSynth;
    const out = this.noteGain;
    if (!ctx || !synth || !out) return;
    this.ensureRunning();
    this.stopScalePlayback(); // fades out and cuts any previous run

    this.beatDuration = 60 / bpm;
    const now = ctx.currentTime;
    const startTime =
      this.metronome?.getNextBeatTime(now + METRONOME_ALIGN_LEAD_S) ?? now + SCALE_START_LEAD_S;

    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(out);
    this.runBus = bus;

    this.scheduledBeats = midiNotes.map((midi, i) => {
      const audioTime = startTime + i * this.beatDuration;
      synth.playNote(midi, audioTime, this.beatDuration * 0.85, bus);
      return { index: i, audioTime };
    });

    this.scaleIsPlaying = true;
    this.rafHandle = requestAnimationFrame(() => this.updatePlayhead());
  }

  /**
   * Stop scale playback: silence the run (sounding and still-scheduled notes)
   * and cancel the rAF loop. Fires onScaleNotePlay(-1) to clear any
   * highlighted note.
   */
  stopScalePlayback(): void {
    this.scaleIsPlaying = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.runBus) {
      this.releaseRunBus(this.runBus);
      this.runBus = null;
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
    if (!this.whenReady(() => this.startMetronome(bpm, timeSignature, accentFirst))) return;
    if (!this.metronome) return;
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
   * AudioContext time of the metronome's next beat at or after `notBefore`,
   * or null when the metronome is stopped.
   */
  getMetronomeNextBeatTime(notBefore?: number): number | null {
    return this.metronome?.getNextBeatTime(notBefore) ?? null;
  }

  /**
   * Play a single metronome click immediately (for preview / tap-tempo).
   *
   * @param isAccent - Use the accent pitch/volume.
   */
  playClick(isAccent = false): void {
    if (!this.whenReady(() => this.playClick(isAccent))) return;
    if (!this.audioContext || !this.metronomeGain) return;
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

  /**
   * Resume the AudioContext if it is suspended or (iOS Safari) interrupted.
   * Never rejects; a refused resume is retried on the next user gesture.
   */
  async resume(): Promise<void> {
    const ctx = this.audioContext;
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    try {
      await ctx.resume();
    } catch {
      /* not allowed outside a gesture; onContextStateChange re-arms */
    }
  }

  /** Release all resources. Call when the app unmounts. */
  dispose(): void {
    this.stopMetronome();
    this.stopScalePlayback();
    this.disarmGestureResume();

    if (this.audioContext) {
      this.audioContext.onstatechange = null;
      this.audioContext.close().catch(() => {});
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
   * Run `retry` once the engine is ready. Returns true when it already is
   * (the caller carries on). Otherwise starts initialization, re-invokes
   * `retry` only if it succeeds, and returns false. After a failed init it
   * returns false without retrying, so a broken Web Audio can't loop.
   */
  private whenReady(retry: () => void): boolean {
    if (this.isInitialized && this.audioContext) return true;
    if (this.initFailed) return false;
    void this.initialize().then((ok) => {
      if (ok) retry();
    });
    return false;
  }

  /**
   * Resume the AudioContext if it isn't running: 'suspended' after page load
   * or a tab switch, or 'interrupted' on iOS after a call or Siri. Called
   * before any audio output. A rejected resume (no user activation) is
   * swallowed; the gesture listeners retry it.
   */
  private ensureRunning(): void {
    const ctx = this.audioContext;
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    ctx.resume().catch(() => {});
  }

  /** Arm or disarm the resume-on-gesture listeners to match the context state. */
  private onContextStateChange(): void {
    const state = this.audioContext?.state;
    if (state === undefined || state === 'running' || state === 'closed') {
      this.disarmGestureResume();
    } else {
      this.armGestureResume();
    }
  }

  /** Retry resume on every pointer/key press until the context runs again. */
  private readonly resumeOnGesture = (): void => this.ensureRunning();

  private armGestureResume(): void {
    if (this.gestureResumeArmed || typeof window === 'undefined') return;
    this.gestureResumeArmed = true;
    // Capture phase so a handler that stops propagation can't block it.
    window.addEventListener('pointerdown', this.resumeOnGesture, true);
    window.addEventListener('keydown', this.resumeOnGesture, true);
  }

  private disarmGestureResume(): void {
    if (!this.gestureResumeArmed) return;
    this.gestureResumeArmed = false;
    window.removeEventListener('pointerdown', this.resumeOnGesture, true);
    window.removeEventListener('keydown', this.resumeOnGesture, true);
  }

  /**
   * Fade a finished or abandoned run's bus to silence, then disconnect it,
   * which cuts every note of that run still scheduled in the future. The
   * linear ramp avoids the click of an instant cut on a sounding note.
   */
  private releaseRunBus(bus: GainNode): void {
    const ctx = this.audioContext;
    if (ctx) {
      const now = ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0, now + RUN_FADE_S);
    }
    // Disconnect after the ramp has played out (a little slack for the
    // wall clock vs. the audio clock). Harmless if the context closed.
    window.setTimeout(() => {
      try {
        bus.disconnect();
      } catch {
        /* already disconnected */
      }
    }, RUN_FADE_S * 1000 + 40);
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
