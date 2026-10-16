/**
 * theoryTool.ts
 *
 * The Coach's music_theory_lookup tool. FretAgent shipped its own small
 * theory tables (13 scales, a fixed major/minor chord-quality table that gave
 * Dorian a minor IV); this answers from the app's own engine instead, so the
 * Coach and the fretboard can never disagree: all 48 scales, chords built by
 * stacking the scale's thirds, notes spelled for the key, and CAGED windows
 * computed for the player's actual tuning.
 */

import {
  ALL_NOTES,
  CHORD_TYPES,
  SCALES,
  getDiatonicChords,
  intervalNameForDegree,
  makeNoteNamer,
  spellScale,
  toSharpName,
} from '../data/musicTheory';
import { cellFretRange, positionCopies } from '../practice/positions';

/** Arguments the model passes (already validated by the caller). */
export interface TheoryQuery {
  query_type: 'scale_info' | 'chord_progression' | 'intervals' | 'chord_info';
  key?: string;
  scale?: string;
  chord?: string;
}

/** The player's tuning, low string first, as chromatic indices plus a name. */
export interface TuningContext {
  name: string;
  notes: readonly number[];
}

export const QUERY_TYPES: TheoryQuery['query_type'][] = ['scale_info', 'chord_progression', 'intervals', 'chord_info'];

/** Names the model is likely to use that aren't registry keys. */
const SCALE_ALIASES: Record<string, string> = {
  natural_minor: 'minor',
  aeolian_minor: 'minor',
  pentatonic_minor: 'minor_pentatonic',
  pentatonic_major: 'major_pentatonic',
  minor_blues: 'blues',
  diminished: 'diminished_whole_half',
  altered: 'super_locrian',
  phrygian_major: 'phrygian_dominant',
  byzantine: 'double_harmonic',
  hirajoshi: 'japanese_hirajoshi',
};

/** Chord suffixes the model may write, mapped to CHORD_TYPES keys. */
const CHORD_SUFFIXES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CHORD_TYPES).map(([key, def]) => [def.symbol, key])),
  maj: 'major',
  M: 'major',
  min: 'minor',
  '-': 'minor',
  M7: 'major7',
  Δ: 'major7',
  min7: 'minor7',
  '-7': 'minor7',
  ø: 'half_diminished',
  ø7: 'half_diminished',
  '°': 'diminished',
  '°7': 'diminished7',
  '+': 'augmented',
};

/**
 * Resolves whatever the model called a scale to a registry key.
 *
 * @param raw - "dorian", "Natural Minor", "minor_pentatonic", ...
 * @returns A SCALES key, or null.
 */
export function resolveScaleKey(raw: string | undefined): string | null {
  if (!raw) return 'major';
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/_scale$|_mode$/, '');
  if (SCALES[k]) return k;
  if (SCALE_ALIASES[k]) return SCALE_ALIASES[k];
  const byName = Object.entries(SCALES).find(([, s]) => s.name.toLowerCase().replace(/[\s-]+/g, '_').startsWith(k));
  return byName?.[0] ?? null;
}

/** Normalises "bb", "F#", "Db" to a root the theory functions accept, or null. */
function resolveRoot(raw: string | undefined): string | null {
  const m = /^([A-Ga-g])([#b]?)$/.exec((raw ?? 'C').trim());
  if (!m) return null;
  const sharp = toSharpName(m[1].toUpperCase() + m[2]);
  return (ALL_NOTES as readonly string[]).includes(sharp) ? sharp : null;
}

/** "Standard"-style string labels for a tuning, low string first ("E A D G B e"). */
function stringLabels(tuning: TuningContext): string[] {
  return tuning.notes.map((pc, i) => {
    const n = ALL_NOTES[pc];
    return i === tuning.notes.length - 1 ? n.toLowerCase() : n;
  });
}

function scaleInfo(root: string, scaleKey: string, tuning: TuningContext) {
  const scale = SCALES[scaleKey];
  const name = makeNoteNamer(root, scaleKey);
  const spelled = spellScale(root, scaleKey);
  const pcs = new Set(scale.intervals.map((iv) => (ALL_NOTES.indexOf(root as (typeof ALL_NOTES)[number]) + iv) % 12));
  const labels = stringLabels(tuning);

  // Frets 0-12 on each string that land on a scale tone
  const frets: Record<string, number[]> = {};
  tuning.notes.forEach((open, s) => {
    frets[`${s + 1}:${labels[s]}`] = Array.from({ length: 13 }, (_, f) => f).filter((f) => pcs.has((open + f) % 12));
  });

  // CAGED windows for this key and tuning (lowest copy of each shape)
  const caged = [1, 2, 3, 4, 5].map((id) => {
    const range = cellFretRange(positionCopies('caged', id, root, scale.intervals, tuning.notes, 24)[0] ?? new Set());
    return { position: id, frets: range ? `${range.min}-${range.max}` : null };
  });

  return {
    name: `${spelled[0]} ${scale.name}`,
    tuning: tuning.name,
    notes: spelled,
    degrees: scale.degrees,
    intervals: scale.degrees.map(intervalNameForDegree),
    category: scale.category,
    description: scale.description,
    common_uses: scale.commonUses,
    frets_by_string_low_to_high: frets,
    caged_positions: caged,
    diatonic_chords: getDiatonicChords(root, scaleKey).map((c) => `${name(c.root)}${c.symbol} (${c.degree})`),
  };
}

function chordProgression(root: string, scaleKey: string) {
  const chords = getDiatonicChords(root, scaleKey);
  if (chords.length === 0) {
    return {
      error: `${SCALES[scaleKey].name} has ${SCALES[scaleKey].intervals.length} notes, so it has no stacked-thirds chord set. Use a 7-note scale or mode.`,
    };
  }
  const name = makeNoteNamer(root, scaleKey);
  const label = (i: number) => `${name(chords[i].root)}${chords[i].symbol}`;
  const seventh = (i: number) => {
    const t = chords[i].seventh;
    return t === 'other' ? null : `${name(chords[i].root)}${CHORD_TYPES[t].symbol}`;
  };
  const prog = (title: string, degrees: number[]) => ({
    name: title,
    numerals: degrees.map((d) => chords[d].degree).join(' - '),
    chords: degrees.map(label),
  });
  return {
    key: `${spellScale(root, scaleKey)[0]} ${SCALES[scaleKey].name}`,
    chords: chords.map((c, i) => ({ degree: c.degree, triad: label(i), seventh: seventh(i), quality: c.type })),
    common_progressions: [
      prog('1-4-5-1', [0, 3, 4, 0]),
      prog('1-5-6-4', [0, 4, 5, 3]),
      prog('2-5-1', [1, 4, 0]),
      prog('1-6-4-5', [0, 5, 3, 4]),
    ],
  };
}

function intervals(root: string) {
  const r = ALL_NOTES.indexOf(root as (typeof ALL_NOTES)[number]);
  const shorthand = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  return {
    key: root,
    intervals: shorthand.map((deg, semitones) => ({
      semitones,
      shorthand: deg,
      name: intervalNameForDegree(deg),
      note: ALL_NOTES[(r + semitones) % 12],
    })),
  };
}

function chordInfo(chord: string) {
  const m = /^([A-G][#b]?)(.*)$/.exec(chord.trim());
  if (!m) return { error: `Can't parse chord "${chord}". Use a name like Am7, Cmaj7 or F#dim.` };
  const root = resolveRoot(m[1]);
  const type = CHORD_SUFFIXES[m[2]];
  if (!root || !type) return { error: `Unknown chord "${chord}".` };
  const def = CHORD_TYPES[type];
  const r = ALL_NOTES.indexOf(root as (typeof ALL_NOTES)[number]);
  return {
    chord,
    name: `${m[1]} ${def.name}`,
    notes: def.intervals.map((iv) => ALL_NOTES[(r + iv) % 12]),
    semitones: def.intervals,
  };
}

/**
 * Runs one music_theory_lookup call.
 *
 * @param q - Validated tool input.
 * @param tuning - The player's current tuning (fret data is for this tuning).
 * @returns A JSON-serialisable result; failures come back as `{ error }` so
 *   the model can correct itself.
 */
export function musicTheoryLookup(q: TheoryQuery, tuning: TuningContext): object {
  if (q.query_type === 'chord_info') return chordInfo(q.chord ?? q.key ?? '');

  const root = resolveRoot(q.key);
  if (!root) return { error: `Unknown key "${q.key}". Use a note name like A, C#, or Bb.` };
  if (q.query_type === 'intervals') return intervals(root);

  const scaleKey = resolveScaleKey(q.scale);
  if (!scaleKey) {
    return { error: `Unknown scale "${q.scale}". Known scales: ${Object.keys(SCALES).join(', ')}.` };
  }
  return q.query_type === 'scale_info' ? scaleInfo(root, scaleKey, tuning) : chordProgression(root, scaleKey);
}
