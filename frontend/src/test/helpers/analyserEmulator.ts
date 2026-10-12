/**
 * analyserEmulator.ts
 *
 * A software stand-in for the Web Audio AnalyserNode, so ChordDetector can be
 * fed real or synthesized audio inside Vitest (jsdom has no Web Audio).
 *
 * Follows the Web Audio spec's "FFT windowing and smoothing over time":
 *   1. Take the most recent fftSize samples.
 *   2. Apply a Blackman window (alpha = 0.16):
 *        w[n] = 0.42 - 0.5 cos(2πn/N) + 0.08 cos(4πn/N)
 *   3. FFT, scaled by 1/N:  X[k] = (1/N) Σ x[n] w[n] e^(-2πikn/N)
 *   4. Smooth over calls:   X̂[k] = τ X̂_prev[k] + (1 - τ) |X[k]|   (τ = 0.8 default)
 *   5. Convert to dB:       Y[k] = 20 log10 X̂[k]
 *
 * The "current time" is read from performance.now(), so under Vitest fake
 * timers ChordDetector.collectFrames() reads exactly the windows it would in
 * the browser.
 */

/** In-place iterative radix-2 FFT. re/im length must be a power of two. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + len / 2] = aRe - bRe;
        im[i + k + len / 2] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

export interface EmulatedAnalyserOptions {
  /** Mono samples in [-1, 1]. */
  signal: Float32Array;
  sampleRate: number;
  /**
   * Index into `signal` where the node starts listening (performance.now() ===
   * startTimeMs). Earlier samples are never seen, as with a fresh AnalyserNode.
   */
  startSample: number;
  /** performance.now() value at which listening starts. */
  startTimeMs: number;
  fftSize?: number;
  smoothingTimeConstant?: number;
}

/**
 * Creates an object that satisfies the parts of AnalyserNode that
 * ChordDetector touches: fftSize, frequencyBinCount, getFloatFrequencyData.
 */
export function createEmulatedAnalyser(opts: EmulatedAnalyserOptions): AnalyserNode {
  const fftSize = opts.fftSize ?? 8192;
  const tau = opts.smoothingTimeConstant ?? 0.8;
  const binCount = fftSize / 2;

  const blackman = new Float64Array(fftSize);
  for (let n = 0; n < fftSize; n++) {
    blackman[n] =
      0.42 - 0.5 * Math.cos((2 * Math.PI * n) / fftSize) + 0.08 * Math.cos((4 * Math.PI * n) / fftSize);
  }

  // Smoothed magnitudes persist across calls, starting at zero like a fresh node.
  const smoothed = new Float64Array(binCount);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);

  const getFloatFrequencyData = (out: Float32Array) => {
    const elapsedMs = performance.now() - opts.startTimeMs;
    const end = opts.startSample + Math.round((elapsedMs / 1000) * opts.sampleRate);
    const start = end - fftSize;

    for (let n = 0; n < fftSize; n++) {
      const idx = start + n;
      // A freshly created node has only heard audio since startSample; anything
      // earlier (or past the end of the signal) is silence.
      const x = idx >= opts.startSample && idx < opts.signal.length ? opts.signal[idx] : 0;
      re[n] = x * blackman[n];
      im[n] = 0;
    }
    fft(re, im);

    for (let k = 0; k < binCount && k < out.length; k++) {
      const mag = Math.hypot(re[k], im[k]) / fftSize;
      smoothed[k] = tau * smoothed[k] + (1 - tau) * mag;
      out[k] = 20 * Math.log10(smoothed[k]);
    }
  };

  return {
    fftSize,
    frequencyBinCount: binCount,
    getFloatFrequencyData,
  } as unknown as AnalyserNode;
}
