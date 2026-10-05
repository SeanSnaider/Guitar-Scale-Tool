/**
 * ChordDetector.ts
 *
 * Browser-based chord detection using Web Audio API FFT analysis.
 *
 * Algorithm:
 * 1. Collect multiple FFT frames from an AnalyserNode over ~2.5 seconds
 * 2. Convert FFT frequency bins to a 12-bin chroma vector (pitch class profile)
 * 3. Match the chroma vector against chord templates using cosine similarity
 * 4. Return the best-matching chord name and confidence score
 *
 * This approach works well for clean guitar signals captured via a direct
 * audio interface (Focusrite, etc.) or decent built-in microphone.
 */

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

/**
 * Builds a 12-bin chroma vector from a single FFT frame.
 *
 * Steps:
 * - Read float frequency data (dB values) from the AnalyserNode.
 * - For each bin, compute the frequency in Hz.
 * - Skip bins outside guitar range (60 Hz – 5000 Hz).
 * - Skip bins below the noise floor (-80 dB).
 * - Convert dB to linear magnitude and accumulate into the pitch class bucket.
 * - Normalize the resulting vector to [0, 1].
 *
 * @param analyser - Web Audio AnalyserNode with frequency data available.
 * @param sampleRate - Audio context sample rate in Hz.
 * @returns Normalized 12-element chroma vector.
 */
export function buildChromaVector(analyser: AnalyserNode, sampleRate: number): number[] {
  const fftSize = analyser.fftSize;
  const dataArray = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(dataArray);

  const chroma = new Array<number>(12).fill(0);

  for (let i = 0; i < dataArray.length; i++) {
    const freq = i * (sampleRate / fftSize);

    if (freq < 60 || freq > 5000) continue;

    const db = dataArray[i];
    if (db < -80) continue;

    // Convert dB to linear magnitude
    const magnitude = Math.pow(10, db / 20);

    // Convert frequency to MIDI float, then to pitch class
    const midiFloat = 12 * Math.log2(freq / 440) + 69;
    const pitchClass = ((Math.round(midiFloat) % 12) + 12) % 12;

    chroma[pitchClass] += magnitude;
  }

  // Normalize to [0, 1]
  const max = Math.max(...chroma);
  if (max > 0) {
    return chroma.map(v => v / max);
  }
  return chroma;
}

/**
 * Reports whether a chroma vector contains any energy at all.
 *
 * Every spectral bin below the -80 dB gate is ignored, so a quiet room or a
 * muted or wrong input device yields an all-zero vector. Cosine similarity
 * is then 0 for every template, and detectChord would return the first
 * template (C major) as if a chord had been played.
 *
 * @param chromaVector - A 12-element chroma vector.
 * @returns True if at least one pitch class has non-zero energy.
 */
export function hasAudibleSignal(chromaVector: readonly number[]): boolean {
  return chromaVector.some((value) => value > 0);
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
   * Collects multiple FFT frames over a specified duration and returns
   * a time-averaged chroma vector.
   *
   * @param durationMs - Total collection duration in milliseconds.
   * @param intervalMs - Interval between frame captures in milliseconds.
   * @returns Promise resolving to a normalized 12-element chroma vector.
   */
  async collectFrames(durationMs: number, intervalMs: number): Promise<number[]> {
    const accumulated = new Array<number>(12).fill(0);
    let frameCount = 0;

    return new Promise(resolve => {
      const startTime = performance.now();

      const captureFrame = () => {
        const frame = buildChromaVector(this.analyser, this.sampleRate);
        for (let i = 0; i < 12; i++) {
          accumulated[i] += frame[i];
        }
        frameCount++;

        const elapsed = performance.now() - startTime;
        if (elapsed < durationMs) {
          setTimeout(captureFrame, intervalMs);
        } else {
          // Return average chroma vector, normalized
          const avg = accumulated.map(v => v / frameCount);
          const max = Math.max(...avg);
          const normalized = max > 0 ? avg.map(v => v / max) : avg;
          resolve(normalized);
        }
      };

      captureFrame();
    });
  }

  /**
   * Matches a chroma vector against all chord templates using cosine similarity.
   *
   * @param chromaVector - A 12-element normalized chroma vector.
   * @returns The best-matching chord with its root, quality, and confidence score.
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

    return {
      chord,
      confidence: Math.round(bestScore * 100) / 100,
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
