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

/**
 * How strongly a beat is accented. 'strong' is the downbeat of the measure,
 * 'medium' starts a later beat group (beat 4 of 6/8, say), 'none' is a plain
 * click.
 */
export type AccentLevel = 'strong' | 'medium' | 'none';

/**
 * Callback fired each beat for visual feedback (e.g., flashing the beat indicator).
 * `isAccent` is true only for the strong downbeat; `level` gives the full accent.
 */
export type MetronomeBeatCallback = (beat: number, isAccent: boolean, level: AccentLevel) => void;

/** How far ahead (ms) to pre-schedule clicks. Larger = more robust but more latency. */
const LOOKAHEAD_MS = 100.0;

/** How often (ms) to run the scheduler check. Must be < LOOKAHEAD_MS. */
const SCHEDULE_INTERVAL_MS = 25.0;

/**
 * Delay (s) before the first click after start(). Gives the scheduler a
 * clean, slightly-future first beat, so the catch-up check below never
 * mistakes the very first beat for a missed one if currentTime ticks forward
 * between start() and the first scheduler pass.
 */
const START_DELAY_S = 0.05;

/** Pitch and peak level of each click type. */
const CLICK: Record<AccentLevel, { freq: number; gain: number }> = {
  strong: { freq: 1000, gain: 0.8 },
  medium: { freq: 900, gain: 0.65 },
  none: { freq: 800, gain: 0.5 },
};

/**
 * How a measure splits into beat groups. BPM always counts the denominator
 * unit (eighths in 6/8 and 7/8), so the clicks stay one per written beat and
 * the grouping is shown with accents instead:
 *   - compound meters (6/8, 9/8, 12/8): groups of three
 *   - 5: 3 + 2
 *   - 7: 2 + 2 + 3
 *   - anything else: one group (a single downbeat accent)
 */
function beatGroups(beats: number, noteValue: number): number[] {
  if (noteValue === 8 && beats > 3 && beats % 3 === 0) return Array(beats / 3).fill(3);
  if (beats === 5) return [3, 2];
  if (beats === 7) return [2, 2, 3];
  return [beats];
}

/**
 * Accent level for every beat of a measure.
 *
 * @param beats       - Beats per measure (time signature numerator).
 * @param noteValue   - Beat unit (time signature denominator).
 * @param accentFirst - When false every beat is a plain click.
 * @returns One level per beat: 'strong' on the downbeat, 'medium' at the
 *          start of each later group, 'none' elsewhere.
 */
export function accentPattern(beats: number, noteValue: number, accentFirst: boolean): AccentLevel[] {
  const levels: AccentLevel[] = Array(Math.max(1, beats)).fill('none');
  if (!accentFirst) return levels;
  let at = 0;
  for (const size of beatGroups(beats, noteValue)) {
    if (at < levels.length) levels[at] = at === 0 ? 'strong' : 'medium';
    at += size;
  }
  return levels;
}

export class Metronome {
  private readonly ctx: AudioContext;
  private readonly output: AudioNode;

  private bpm: number = 120;
  private beatsPerMeasure: number = 4;
  private accents: AccentLevel[] = accentPattern(4, 4, true);

  private nextBeatTime: number = 0;   // AudioContext time of the next scheduled beat
  private currentBeat: number = 0;    // Beat counter within the measure (0-based)
  private timerID: number | null = null;
  private running: boolean = false;

  /**
   * Clicks and beat callbacks that are scheduled but may not have happened
   * yet. The look-ahead puts up to ~100 ms of clicks in the future, so stop()
   * has to cancel them, or a restart (or meter change) flams against them and
   * a stale beat dot lights up after stopping.
   */
  private readonly pendingClicks = new Set<OscillatorNode>();
  private readonly pendingBeatTimers = new Set<number>();

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
   * @param bpm           - Clicks per minute of the beat unit (the denominator).
   * @param timeSignature - [beatsPerMeasure, noteValue], e.g. [4, 4] for 4/4.
   * @param accentFirst   - Whether to accent the downbeat (and the beat groups).
   */
  start(bpm: number, timeSignature: [number, number] = [4, 4], accentFirst = true): void {
    this.stop();

    this.bpm = bpm;
    this.beatsPerMeasure = Math.max(1, timeSignature[0]);
    this.accents = accentPattern(timeSignature[0], timeSignature[1], accentFirst);
    this.currentBeat = 0;
    this.nextBeatTime = this.ctx.currentTime + START_DELAY_S;
    this.running = true;

    this.schedulerLoop();
  }

  /**
   * Stop the metronome and cancel every click and beat callback that was
   * already scheduled. Safe to call when already stopped.
   */
  stop(): void {
    this.running = false;
    if (this.timerID !== null) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
    for (const osc of this.pendingClicks) {
      // stop(0) before a future start() means the click never sounds.
      // Older engines throw on a second stop(); the click is moot either way.
      try {
        osc.stop(0);
      } catch {
        /* already stopped */
      }
      osc.disconnect();
    }
    this.pendingClicks.clear();
    for (const id of this.pendingBeatTimers) clearTimeout(id);
    this.pendingBeatTimers.clear();
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
   * The first beat-grid time at or after `notBefore`, for lining other
   * playback up with the click. Starts from the next beat the scheduler has
   * not yet queued and steps forward in whole beats at the current tempo.
   *
   * @param notBefore - Earliest acceptable AudioContext time.
   * @returns The AudioContext time of that beat, or null when stopped.
   */
  getNextBeatTime(notBefore: number = this.ctx.currentTime): number | null {
    if (!this.running) return null;
    const beat = 60 / this.bpm;
    const behind = notBefore - this.nextBeatTime;
    return behind > 0 ? this.nextBeatTime + Math.ceil(behind / beat) * beat : this.nextBeatTime;
  }

  /**
   * Schedule all beats that fall within the look-ahead window, then
   * set a setTimeout to check again after SCHEDULE_INTERVAL_MS.
   */
  private schedulerLoop(): void {
    if (!this.running) return;

    const now = this.ctx.currentTime;

    // Catch-up: if the main thread stalled (a long task, a backgrounded tab)
    // the next beat may already be in the past. Scheduling it, and every
    // other missed beat, at a past time makes them all sound at once. Jump
    // to the first grid point after now instead, keeping the bar position.
    if (this.nextBeatTime < now) {
      const beat = 60 / this.bpm;
      const missed = Math.ceil((now - this.nextBeatTime) / beat);
      this.nextBeatTime += missed * beat;
      this.currentBeat = (this.currentBeat + missed) % this.beatsPerMeasure;
    }

    const windowEnd = now + LOOKAHEAD_MS / 1000;

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
    const level = this.accents[beat] ?? 'none';
    const click = CLICK[level];

    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = click.freq;

    osc.connect(gain);
    gain.connect(this.output);

    gain.gain.setValueAtTime(click.gain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.06);
    this.pendingClicks.add(osc);
    osc.onended = () => this.pendingClicks.delete(osc);

    // Fire visual callback aligned with the audio time
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    const id = window.setTimeout(() => {
      this.pendingBeatTimers.delete(id);
      if (this.onBeat) this.onBeat(beat, level === 'strong', level);
    }, delayMs);
    this.pendingBeatTimers.add(id);
  }

  /** Advance beat counter and move nextBeatTime forward by one beat duration. */
  private advanceBeat(): void {
    this.nextBeatTime += 60 / this.bpm;
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerMeasure;
  }
}
