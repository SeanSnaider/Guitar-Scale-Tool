/**
 * ChordDetector.ts
 *
 * Browser-based chord detection using Web Audio API FFT analysis.
 *
 * Algorithm:
 * 1. Collect multiple FFT frames from an AnalyserNode over ~2.5 seconds.
 * 2. Fold each frame's in-band FFT bins into 12 pitch classes (raw linear
 *    magnitudes), skipping frames below an energy gate.
 * 3. Sum the raw frame chromas, so loud frames count more than quiet ones,
 *    and normalize once at the end.
 * 4. Match the chroma vector against chord templates using cosine similarity
 *    and report the best match, its score, and whether the score clears
 *    MIN_CONFIDENCE.
 *
 * This approach works well for clean guitar signals captured via a direct
 * audio interface (Focusrite, etc.) or decent built-in microphone.
 */

/**
 * Lowest frequency folded into the chroma, in Hz.
 *
 * Below ~100 Hz a semitone is narrower than an FFT bin (fs/fftSize = 5.86 Hz
 * at 48 kHz / 8192; D2-D#2 is 4.4 Hz apart), so with nearest-semitone
 * rounding some pitch classes get no bin at all in the lowest octave (at
 * 48 kHz no bin centre falls inside D2's 71.3-75.6 Hz range). Two fixes were
 * measured on the synthetic strum suite: raising this cut to 100 Hz, and
 * splitting each bin between its two neighbouring semitones (see
 * addBinToChroma). Across two seeds at 44.1 and 48 kHz, interpolation had
 * consistently better root accuracy (+2 to +9 of 180) and equal exact
 * accuracy (within 2 of 180 either way), and kept constant mains hum less
 * chord-like (lower template scores). So the cut stays at 60 Hz, just under
 * low E (82.4 Hz) with room for drop tunings. Interpolation only softens
 * the gap: the Blackman main lobe is still ~±3 bins wide here, so the lowest
 * octave stays smeared and low notes are mostly identified through their
 * octave harmonics.
 */
const LOW_CUT_HZ = 60;

/**
 * Highest frequency folded into the chroma, in Hz.
 *
 * Guitar chord fundamentals rarely go past ~1 kHz (high E, 20th fret, is
 * 1047 Hz), so above 1.5 kHz the spectrum is upper harmonics and pick noise.
 * Harmonics land on non-chord pitch classes (3rd harmonic of the third is
 * the major 7th, 3rd harmonic of the fifth is the 9th), which pulls template
 * matching toward maj7/sus2. With per-frame normalization (the old 5 kHz
 * design) the clean, decaying tail frames diluted this; once frames are
 * weighted by loudness the bright attack dominates, and at 5 kHz the
 * synthetic suite fell from 69/180 to 53/180. Cutting at 1.5 kHz brings it
 * to 78/180, and held up with a different seed and at 48 kHz.
 */
const HIGH_CUT_HZ = 1500;

/**
 * Per-bin noise floor in dB (AnalyserNode scaling). Bins quieter than this are
 * ignored. For reference, white noise at -40 dBFS RMS through an 8192-point
 * Blackman FFT sits around -84 dB per bin, so broadband hiss mostly drops out
 * here; tonal content (strings, hum) passes once a partial's amplitude is
 * above roughly -66 dBFS.
 */
const BIN_FLOOR_DB = -80;

/**
 * Mean of the squared Blackman window, (1/N) Σ w[n]²
 * = 0.42² + 0.5²/2 + 0.08²/2 ≈ 0.3047. Used to turn summed bin power back
 * into a time-domain level (see frameLevelDb).
 */
const BLACKMAN_MEAN_SQUARE = 0.42 * 0.42 + (0.5 * 0.5) / 2 + (0.08 * 0.08) / 2;

/**
 * Frame energy gate, in dBFS RMS of the in-band content (see frameLevelDb).
 * Frames quieter than this are skipped entirely; if every frame is skipped,
 * collectFrames returns an all-zero chroma ("didn't hear anything").
 *
 * A strum peaking at -6 dBFS measures about -29 dBFS on this scale at its
 * loudest frame and decays to about -72 dBFS after 2.5 s (synthetic suite),
 * so -60 dBFS accepts a strum played ~30 dB quieter than that. Moving the
 * gate anywhere from -70 to -55 dBFS did not change the synthetic score,
 * because loudness weighting already makes quiet tail frames nearly
 * irrelevant; the gate's real job is rejecting room noise and low-level hum
 * before the guitar is played.
 */
export const FRAME_GATE_DBFS = -60;

/**
 * Minimum template score for a detection to count as confident.
 *
 * Cosine similarity has a high floor: a perfectly flat chroma (pure noise)
 * already scores 4/(√12·2) ≈ 0.58 against a four-note template, and the best
 * of the 108 templates against random chroma vectors has a median of
 * 0.74-0.79 (uniform / exponential magnitudes). Measured through the full
 * pipeline: white noise scores ~0.62, constant 50/60 Hz hum with typical
 * harmonic profiles (1/n, 1/n², 1/√n, odd-dominant, first three harmonics)
 * scores 0.66-0.76. Correct detections in the synthetic strum suite have a
 * median of 0.88 and 72 of 78 score >= 0.80. 0.80 sits above all of the noise
 * and typical hum, and keeps ~92% of correct synthetic detections. Known gap:
 * harsh buzz (strong even harmonics, or 8 equal-strength harmonics) still
 * reaches 0.78-0.81, because cosine-to-template cannot tell a steady buzz
 * from a chord. Re-check against real recordings (eval/guitarset.test.ts),
 * where scores are likely to run lower than on synthetic strums.
 */
export const MIN_CONFIDENCE = 0.8;

/** The 12 chromatic pitch class names, starting from C. */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * Base chord templates with root note at index 0.
 * Each template is a 12-element binary vector where 1 indicates
 * a chord tone and 0 indicates a non-chord tone.
 */
const CHORD_TEMPLATES: Record<string, number[]> = {
  major:      [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
  minor:      [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  dominant7:  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  major7:     [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
  minor7:     [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
  diminished: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
  augmented:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  sus2:       [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  sus4:       [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
};

/**
 * Human-readable suffixes for each chord quality.
 * An empty string means the suffix is omitted (e.g., "C" for C major).
 */
const CHORD_SUFFIXES: Record<string, string> = {
  major:      '',
  minor:      'm',
  dominant7:  '7',
  major7:     'maj7',
  minor7:     'm7',
  diminished: 'dim',
  augmented:  'aug',
  sus2:       'sus2',
  sus4:       'sus4',
};

/** Represents a single chord template entry used for matching. */
interface ChordTemplate {
  root: string;
  quality: string;
  template: number[];
}

/** Result returned by chord detection. */
export interface ChordDetectionResult {
  /** Full chord name, e.g. "Am7". */
  chord: string;
  /** Cosine similarity score, 0 to 1. Higher is more confident. */
  confidence: number;
  /** True when confidence >= MIN_CONFIDENCE, i.e. the match beats what noise and hum score. */
  confident: boolean;
  /** Root note name, e.g. "A". */
  root: string;
  /** Chord quality name, e.g. "minor7". */
  quality: string;
}

/**
 * Computes the cosine similarity between two numeric vectors.
 *
 * @param a - First vector.
 * @param b - Second vector, must be same length as a.
 * @returns Similarity score in [0, 1], or 0 if either vector is zero-length.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Builds all chord templates by rotating each base template for all 12 roots.
 *
 * For root r, the template for pitch class p is:
 *   baseTemplate[(p - r + 12) % 12]
 *
 * @returns Array of all chord templates across all roots and qualities.
 */
function buildAllTemplates(): ChordTemplate[] {
  const templates: ChordTemplate[] = [];

  for (const [quality, base] of Object.entries(CHORD_TEMPLATES)) {
    for (let root = 0; root < 12; root++) {
      const rotated = Array.from({ length: 12 }, (_, p) => base[(p - root + 12) % 12]);
      templates.push({
        root: NOTE_NAMES[root],
        quality,
        template: rotated,
      });
    }
  }

  return templates;
}

/** Pre-built collection of all chord templates for all roots and qualities. */
const ALL_TEMPLATES = buildAllTemplates();

/** One analysed FFT frame: raw (unnormalized) chroma plus its level. */
interface FrameAnalysis {
  /** Summed linear bin magnitudes per pitch class, not normalized. */
  chroma: number[];
  /** In-band level in dBFS RMS (see frameLevelDb); -Infinity if nothing passed the floor. */
  levelDb: number;
}

/**
 * Adds one bin's magnitude to the chroma, split between the two nearest
 * semitones.
 *
 * With m = 12·log2(f/440) + 69 (fractional MIDI note), lo = floor(m) and
 * frac = m - lo, the bin contributes (1 - frac) to pitch class lo and frac to
 * lo + 1: a triangular kernel one semitone wide. A bin exactly on a note goes
 * entirely to that note; a bin halfway between two notes is shared equally.
 * Nearest-semitone rounding instead drops the whole bin into one class, which
 * starves any pitch class that has no bin centre inside its ±50 cent range
 * (common below ~100 Hz, where bins are wider than semitones).
 */
function addBinToChroma(chroma: number[], freq: number, magnitude: number): void {
  const midiFloat = 12 * Math.log2(freq / 440) + 69;
  const lo = Math.floor(midiFloat);
  const frac = midiFloat - lo;
  chroma[((lo % 12) + 12) % 12] += magnitude * (1 - frac);
  chroma[(((lo + 1) % 12) + 12) % 12] += magnitude * frac;
}

/**
 * In-band level of a frame in dBFS RMS, from the bins that passed the floor.
 *
 * The AnalyserNode computes X[k] = (1/N) Σ x[n]·w[n]·e^(-2πikn/N). Parseval
 * for the unscaled DFT gives Σ_k |N·X[k]|² = N·Σ_n |x[n]·w[n]|², so
 * Σ over all N bins of |X[k]|² = (1/N)·Σ_n |x[n]·w[n]|² ≈ σ²·mean(w²) for a
 * stationary signal of mean power σ². For a real signal the
 * positive-frequency half holds half of it, so
 *   σ² ≈ 2·Σ_{k<N/2} |X[k]|² / mean(w²).
 * A full-scale sine (σ² = 1/2) reads -3 dBFS. This is approximate: the node
 * smooths magnitudes (not powers) over time, and only bins inside the band
 * and above BIN_FLOOR_DB are counted.
 */
function frameLevelDb(bandPower: number): number {
  if (bandPower <= 0) return -Infinity;
  return 10 * Math.log10((2 * bandPower) / BLACKMAN_MEAN_SQUARE);
}

/**
 * Folds one frame of AnalyserNode dB data into a raw 12-bin chroma.
 *
 * Steps:
 * - Skip bins outside LOW_CUT_HZ..HIGH_CUT_HZ and bins below BIN_FLOOR_DB.
 * - Convert dB to linear magnitude (10^(dB/20)) and split it between the two
 *   nearest pitch classes (addBinToChroma).
 * - Track the summed power of those bins for the energy gate.
 */
function analyzeFrame(dbData: Float32Array, sampleRate: number, fftSize: number): FrameAnalysis {
  const chroma = new Array<number>(12).fill(0);
  const binHz = sampleRate / fftSize;
  let bandPower = 0;

  for (let i = 0; i < dbData.length; i++) {
    const freq = i * binHz;
    if (freq < LOW_CUT_HZ || freq > HIGH_CUT_HZ) continue;

    const db = dbData[i];
    if (db < BIN_FLOOR_DB) continue;

    const magnitude = Math.pow(10, db / 20);
    bandPower += magnitude * magnitude;
    addBinToChroma(chroma, freq, magnitude);
  }

  return { chroma, levelDb: frameLevelDb(bandPower) };
}

/** Scales a vector so its largest element is 1; an all-zero vector stays zero. */
function normalizeToMax(v: number[]): number[] {
  const max = Math.max(...v);
  return max > 0 ? v.map(x => x / max) : v.map(() => 0);
}

/**
 * Builds a normalized 12-bin chroma vector from a single FFT frame.
 * Single-frame helper; collectFrames uses the raw frame data instead so it
 * can gate and loudness-weight frames before normalizing.
 *
 * @param analyser - Web Audio AnalyserNode with frequency data available.
 * @param sampleRate - Audio context sample rate in Hz.
 * @returns 12-element chroma vector scaled to a maximum of 1 (all zero if
 *   no bin passed the floor).
 */
export function buildChromaVector(analyser: AnalyserNode, sampleRate: number): number[] {
  const dataArray = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(dataArray);
  return normalizeToMax(analyzeFrame(dataArray, sampleRate, analyser.fftSize).chroma);
}

/**
 * Detects chords from guitar audio using FFT-based chromagram analysis.
 *
 * Usage:
 * ```ts
 * const detector = new ChordDetector(analyserNode, audioContext.sampleRate);
 * const result = await detector.detect(2500);
 * console.log(result.chord, result.confidence);
 * ```
 */
export class ChordDetector {
  private readonly analyser: AnalyserNode;
  private readonly sampleRate: number;

  /**
   * Creates a new ChordDetector.
   *
   * @param analyser - A connected Web Audio AnalyserNode (fftSize should be 8192+).
   * @param sampleRate - The AudioContext sample rate.
   */
  constructor(analyser: AnalyserNode, sampleRate: number) {
    this.analyser = analyser;
    this.sampleRate = sampleRate;
  }

  /**
   * Collects FFT frames over a specified duration and returns their combined
   * chroma vector.
   *
   * Aggregation: each frame's raw chroma (linear magnitudes, not normalized)
   * is summed, and the sum is normalized once at the end. A frame therefore
   * counts in proportion to its loudness: the ringing strum dominates and a
   * near-silent or hum-only frame adds almost nothing. (Normalizing every
   * frame first, as this used to, gave a frame of background hum the same
   * vote as the strum itself.) Frames whose in-band level is below
   * FRAME_GATE_DBFS are skipped outright.
   *
   * @param durationMs - Total collection duration in milliseconds.
   * @param intervalMs - Interval between frame captures in milliseconds.
   * @returns Promise resolving to a 12-element chroma vector scaled to a
   *   maximum of 1, or all zeros if no frame passed the energy gate (nothing
   *   was heard).
   */
  async collectFrames(durationMs: number, intervalMs: number): Promise<number[]> {
    const accumulated = new Array<number>(12).fill(0);
    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    let framesUsed = 0;

    return new Promise(resolve => {
      const startTime = performance.now();

      const captureFrame = () => {
        this.analyser.getFloatFrequencyData(dataArray);
        const frame = analyzeFrame(dataArray, this.sampleRate, this.analyser.fftSize);
        if (frame.levelDb >= FRAME_GATE_DBFS) {
          for (let i = 0; i < 12; i++) {
            accumulated[i] += frame.chroma[i];
          }
          framesUsed++;
        }

        const elapsed = performance.now() - startTime;
        if (elapsed < durationMs) {
          setTimeout(captureFrame, intervalMs);
        } else {
          // No frame cleared the gate: return all zeros so callers can report
          // "didn't hear anything" instead of matching noise to a chord.
          resolve(framesUsed > 0 ? normalizeToMax(accumulated) : new Array<number>(12).fill(0));
        }
      };

      captureFrame();
    });
  }

  /**
   * Matches a chroma vector against all chord templates using cosine similarity.
   *
   * @param chromaVector - A 12-element normalized chroma vector.
   * @returns The best-matching chord with its root, quality, confidence score,
   *   and whether that score reaches MIN_CONFIDENCE. An all-zero chroma scores
   *   0 and is never confident.
   */
  detectChord(chromaVector: number[]): ChordDetectionResult {
    let bestScore = -1;
    let bestTemplate: ChordTemplate = ALL_TEMPLATES[0];

    for (const template of ALL_TEMPLATES) {
      const score = cosineSimilarity(chromaVector, template.template);
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    }

    const suffix = CHORD_SUFFIXES[bestTemplate.quality] ?? '';
    const chord = `${bestTemplate.root}${suffix}`;

    // Rounded to two decimals for display; `confident` uses the same rounded
    // value so a result shown as 80% is always flagged confident.
    const confidence = Math.round(bestScore * 100) / 100;

    return {
      chord,
      confidence,
      confident: confidence >= MIN_CONFIDENCE,
      root: bestTemplate.root,
      quality: bestTemplate.quality,
    };
  }

  /**
   * Convenience method: collects audio frames and returns a detected chord.
   *
   * @param durationMs - How long to listen for, in milliseconds (default 2500).
   * @returns Promise resolving to a chord detection result.
   */
  async detect(durationMs = 2500): Promise<ChordDetectionResult> {
    const chroma = await this.collectFrames(durationMs, 100);
    return this.detectChord(chroma);
  }
}
