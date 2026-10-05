/**
 * Metronome.ts
 *
 * Drift-free metronome using the Web Audio API look-ahead scheduler pattern.
 *
 * The key insight: JavaScript's setTimeout/setInterval can drift by 10–20 ms
 * per tick. The Web Audio API clock (AudioContext.currentTime) is sample-accurate.
 * This class bridges both: it uses setTimeout only to trigger scheduling checks,
 * and schedules the actual click sounds ahead of time using AudioContext.currentTime.
 *
 * Technique based on Chris Wilson's "A Tale of Two Clocks":
 * https://www.html5rocks.com/en/tutorials/audio/scheduling/
 *
 * Usage:
 *   const metro = new Metronome(audioContext, outputGainNode);
 *   metro.onBeat = (beat, isAccent) => updateVisual(beat);
 *   metro.start(120, [4, 4]);
 *   metro.stop();
 */

/** Callback fired each beat for visual feedback (e.g., flashing the beat indicator). */
export type MetronomeBeatCallback = (beat: number, isAccent: boolean) => void;

/** How far ahead (ms) to pre-schedule clicks. Larger = more robust but more latency. */
const LOOKAHEAD_MS = 100.0;

/** How often (ms) to run the scheduler check. Must be < LOOKAHEAD_MS. */
const SCHEDULE_INTERVAL_MS = 25.0;

export class Metronome {
  private readonly ctx: AudioContext;
  private readonly output: AudioNode;

  private bpm: number = 120;
  private beatsPerMeasure: number = 4;
  private accentFirst: boolean = true;

  private nextBeatTime: number = 0;   // AudioContext time of the next scheduled beat
  private currentBeat: number = 0;    // Beat counter within the measure (0-based)
  private timerID: number | null = null;
  private running: boolean = false;

  /** Optional visual-feedback callback. Called at the AudioContext-scheduled time via setTimeout. */
  public onBeat: MetronomeBeatCallback | null = null;

  /**
   * @param audioContext - Shared AudioContext (must be running / not suspended).
   * @param outputNode   - Destination for click sounds (e.g., a volume gain node).
   */
  constructor(audioContext: AudioContext, outputNode: AudioNode) {
    this.ctx = audioContext;
    this.output = outputNode;
  }

  /**
   * Start the metronome.
   *
   * Stops any currently running metronome first (safe to call while running).
   *
   * @param bpm           - Beats per minute.
   * @param timeSignature - [beatsPerMeasure, noteValue], e.g. [4, 4] for 4/4.
   * @param accentFirst   - Whether beat 0 plays at a higher pitch/volume.
   */
  start(bpm: number, timeSignature: [number, number] = [4, 4], accentFirst = true): void {
    this.stop();

    this.bpm = bpm;
    this.beatsPerMeasure = timeSignature[0];
    this.accentFirst = accentFirst;
    this.currentBeat = 0;
    this.nextBeatTime = this.ctx.currentTime;
    this.running = true;

    this.schedulerLoop();
  }

  /** Stop the metronome. Safe to call when already stopped. */
  stop(): void {
    this.running = false;
    if (this.timerID !== null) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  /**
   * Update BPM while the metronome is running.
   * Takes effect on the next scheduling window.
   */
  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  /** Returns true if the metronome is currently running. */
  isActive(): boolean {
    return this.running;
  }

  /**
   * Schedule all beats that fall within the look-ahead window, then
   * set a setTimeout to check again after SCHEDULE_INTERVAL_MS.
   */
  private schedulerLoop(): void {
    if (!this.running) return;

    const now = this.ctx.currentTime;
    const windowEnd = now + LOOKAHEAD_MS / 1000;

    // If the main thread stalled (background-tab throttling, a long task)
    // the next beat may already be in the past. Skip the missed beats rather
    // than scheduling them all at once, which plays as a burst of clicks.
    if (this.nextBeatTime < now) this.nextBeatTime = now;

    while (this.nextBeatTime < windowEnd) {
      this.scheduleClick(this.nextBeatTime, this.currentBeat);
      this.advanceBeat();
    }

    this.timerID = window.setTimeout(() => this.schedulerLoop(), SCHEDULE_INTERVAL_MS);
  }

  /**
   * Schedule a single metronome click using AudioContext timing.
   * Also fires the onBeat callback at the correct wall-clock time via setTimeout.
   *
   * @param time - AudioContext time to play the click.
   * @param beat - Beat index within the measure (0 = downbeat).
   */
  private scheduleClick(time: number, beat: number): void {
    const isAccent = this.accentFirst && beat === 0;

    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = isAccent ? 1000 : 800;

    osc.connect(gain);
    gain.connect(this.output);

    gain.gain.setValueAtTime(isAccent ? 0.8 : 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.06);

    // Fire visual callback aligned with the audio time
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => {
      // Guard against beats scheduled just before stop() was called.
      if (this.running && this.onBeat) this.onBeat(beat, isAccent);
    }, delayMs);
  }

  /** Advance beat counter and move nextBeatTime forward by one beat duration. */
  private advanceBeat(): void {
    this.nextBeatTime += 60 / this.bpm;
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerMeasure;
  }
}
