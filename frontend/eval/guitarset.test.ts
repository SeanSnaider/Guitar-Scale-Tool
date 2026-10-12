/**
 * guitarset.test.ts
 *
 * Real-audio accuracy benchmark for ChordDetector on GuitarSet
 * (Xi et al., ISMIR 2018; CC BY 4.0; https://zenodo.org/records/3371780).
 * GuitarSet has 180 "comp" recordings: 6 players x 5 styles x 3 progressions
 * x 2 tempos. Each has two chord annotations over the same segments:
 *   - lead-sheet chords the player was told to play (maj, min, 7, hdim7)
 *   - performed chords transcribed from what they actually played, which
 *     include voicing choices like maj7, power chords, and extensions
 * Both are scored. Performed scoring only uses segments whose label is a
 * plain chord in the detector's vocabulary (inversions allowed, since the
 * detector only sees pitch classes).
 *
 * Protocol, chosen to mirror the app:
 *   - For every lead-sheet chord segment, start a fresh emulated AnalyserNode
 *     at the chord onset and run collectFrames(durationMs, 100) + detectChord.
 *   - durationMs = min(2500, segment length) so no frame reads the next chord.
 *   - Audio is the mono mic recording at its native 44.1 kHz and level.
 *
 * Skipped unless the dataset is present:
 *   GUITARSET_ANN=/path/to/annotation GUITARSET_AUDIO=/path/to/audio_mono-mic \
 *     npx vitest run eval/guitarset.test.ts --silent=false --reporter=verbose
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ChordDetector } from '../src/audio/ChordDetector';
import { createEmulatedAnalyser } from '../src/test/helpers/analyserEmulator';

const ANN_DIR = process.env.GUITARSET_ANN ?? '';
const AUDIO_DIR = process.env.GUITARSET_AUDIO ?? '';
const AUDIO_SUFFIX = process.env.GUITARSET_SUFFIX ?? '_mic.wav';
const haveData = existsSync(ANN_DIR) && existsSync(AUDIO_DIR);

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** GuitarSet lead-sheet qualities -> ChordDetector quality names. hdim7 has no template. */
const GT_QUALITY: Record<string, string | null> = {
  maj: 'major',
  min: 'minor',
  '7': 'dominant7',
  hdim7: null,
};

/** Performed-chord qualities that map exactly onto a detector template. */
const PERFORMED_QUALITY: Record<string, string> = {
  maj: 'major',
  min: 'minor',
  '7': 'dominant7',
  maj7: 'major7',
  min7: 'minor7',
  dim: 'diminished',
  aug: 'augmented',
  sus2: 'sus2',
  sus4: 'sus4',
};

/** MIREX "majmin" reduction. Anything else counts as neither. */
const MAJMIN: Record<string, 'maj' | 'min'> = {
  major: 'maj',
  dominant7: 'maj',
  major7: 'maj',
  minor: 'min',
  minor7: 'min',
};

/** Minimal WAV reader: mono or multichannel PCM16/24/32 or float32, first channel. */
function readWav(path: string): { samples: Float32Array; sampleRate: number } {
  const buf = readFileSync(path);
  let offset = 12;
  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
      if (format === 0xfffe) format = buf.readUInt16LE(body + 24);
    } else if (id === 'data') {
      const bytes = bits / 8;
      const frames = Math.floor(size / (bytes * channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        const p = body + i * bytes * channels;
        if (format === 3 && bits === 32) samples[i] = buf.readFloatLE(p);
        else if (bits === 16) samples[i] = buf.readInt16LE(p) / 32768;
        else if (bits === 24) samples[i] = buf.readIntLE(p, 3) / 8388608;
        else if (bits === 32) samples[i] = buf.readInt32LE(p) / 2147483648;
        else throw new Error(`Unsupported WAV format ${format}/${bits} in ${path}`);
      }
      return { samples, sampleRate };
    }
    offset = body + size + (size % 2);
  }
  throw new Error(`No data chunk in ${path}`);
}

interface Segment {
  time: number;
  duration: number;
  value: string;
}

/**
 * GuitarSet JAMS files hold two "chord" annotations over identical segments:
 * the first is the lead sheet, the second is the performed transcription.
 */
function chordAnnotations(jamsPath: string): { leadSheet: Segment[]; performed: Segment[] } {
  const jams = JSON.parse(readFileSync(jamsPath, 'utf8'));
  const chords = jams.annotations.filter((a: { namespace: string }) => a.namespace === 'chord');
  return { leadSheet: chords[0].data, performed: chords[1].data };
}

/** "D#:maj7/3" -> { root: "D#", quality: "maj7" }. GuitarSet uses sharps. */
function parseLabel(label: string): { root: string; quality: string } {
  const [root, rest] = label.split(':');
  const quality = rest.split('/')[0];
  if (!NOTE_NAMES.includes(root)) throw new Error(`Unexpected root in ${label}`);
  return { root, quality };
}

class Tally {
  hit = 0;
  total = 0;
  add(ok: boolean) {
    this.total++;
    if (ok) this.hit++;
  }
  toString() {
    return `${this.hit}/${this.total} (${((100 * this.hit) / Math.max(1, this.total)).toFixed(1)}%)`;
  }
}

describe.skipIf(!haveData)('ChordDetector on GuitarSet comp recordings', () => {
  beforeAll(() => vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] }));
  afterAll(() => vi.useRealTimers());

  it('reports accuracy against lead-sheet chords', async () => {
    const exact = new Tally();
    const majmin = new Tally();
    const root = new Tally();
    const hdimRoot = new Tally();
    const perfExact = new Tally();
    const perfMajmin = new Tally();
    const byStyle: Record<string, Tally> = {};
    const byQuality: Record<string, Tally> = {};
    const confusions: Record<string, number> = {};
    let files = 0;

    const jamsFiles = readdirSync(ANN_DIR).filter(f => f.endsWith('_comp.jams')).sort();
    for (const jf of jamsFiles) {
      const base = jf.replace(/\.jams$/, '');
      const wavPath = join(AUDIO_DIR, base + AUDIO_SUFFIX);
      if (!existsSync(wavPath)) throw new Error(`Missing audio for ${base}: ${wavPath}`);
      const { samples, sampleRate } = readWav(wavPath);
      files++;
      // e.g. "00_BN1-129-Eb_comp" -> "BN"
      const style = base.split('_')[1].replace(/[0-9].*$/, '');

      const { leadSheet, performed } = chordAnnotations(join(ANN_DIR, jf));
      for (const [i, seg] of leadSheet.entries()) {
        const gt = parseLabel(seg.value);
        const durationMs = Math.min(2500, Math.floor((seg.duration * 1000) / 100) * 100);
        const analyser = createEmulatedAnalyser({
          signal: samples,
          sampleRate,
          startSample: Math.round(seg.time * sampleRate),
          startTimeMs: performance.now(),
        });
        const detector = new ChordDetector(analyser, sampleRate);
        const pending = detector.collectFrames(durationMs, 100);
        await vi.runAllTimersAsync();
        const pred = detector.detectChord(await pending);

        const perf = parseLabel(performed[i].value);
        const perfQuality = PERFORMED_QUALITY[perf.quality];
        if (perfQuality) {
          const perfRootOk = pred.root === perf.root;
          perfExact.add(perfRootOk && pred.quality === perfQuality);
          if (MAJMIN[perfQuality]) perfMajmin.add(perfRootOk && MAJMIN[pred.quality] === MAJMIN[perfQuality]);
        }

        const rootOk = pred.root === gt.root;
        const mappedQuality = GT_QUALITY[gt.quality];
        if (mappedQuality === undefined) throw new Error(`Unmapped quality ${seg.value}`);

        if (mappedQuality === null) {
          hdimRoot.add(rootOk);
          continue;
        }
        const exactOk = rootOk && pred.quality === mappedQuality;
        exact.add(exactOk);
        root.add(rootOk);
        majmin.add(rootOk && MAJMIN[pred.quality] === MAJMIN[mappedQuality]);
        (byStyle[style] ??= new Tally()).add(exactOk);
        (byQuality[mappedQuality] ??= new Tally()).add(exactOk);
        if (!exactOk) {
          const key = rootOk ? `${mappedQuality} -> ${pred.quality} (root ok)` : `${mappedQuality}: wrong root`;
          confusions[key] = (confusions[key] ?? 0) + 1;
        }
      }
    }

    console.log(
      [
        `GuitarSet (${files} comp recordings, audio suffix ${AUDIO_SUFFIX})`,
        `Segments with an in-vocabulary lead-sheet chord (maj/min/7): ${exact.total}`,
        `  exact (root + quality): ${exact}`,
        `  majmin (MIREX):         ${majmin}`,
        `  root only:              ${root}`,
        `hdim7 segments (no template, excluded above), root correct: ${hdimRoot}`,
        `Against performed chords (plain in-vocabulary labels only):`,
        `  exact (root + quality): ${perfExact}`,
        `  majmin (MIREX):         ${perfMajmin}`,
        'Exact by style:',
        ...Object.entries(byStyle).map(([k, v]) => `  ${k.padEnd(6)} ${v}`),
        'Exact by lead-sheet quality:',
        ...Object.entries(byQuality).map(([k, v]) => `  ${k.padEnd(10)} ${v}`),
        'Most common errors:',
        ...Object.entries(confusions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([k, v]) => `  ${String(v).padStart(4)}  ${k}`),
      ].join('\n'),
    );

    expect(files).toBe(180);
  }, 1_800_000);
});
