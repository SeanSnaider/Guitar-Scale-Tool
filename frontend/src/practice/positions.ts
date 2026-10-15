/**
 * positions.ts
 *
 * Which fretboard cells belong to a scale position, computed for the actual
 * root and tuning. (The old code used fixed fret windows, so "Position 1"
 * was frets 0-4 in every key.)
 *
 * - CAGED: five overlapping shapes defined as fret windows relative to the
 *   root on the lowest string (CAGED_POSITIONS), moved to the key and
 *   repeated every 12 frets so the shape shows up wherever it fits.
 * - 3NPS: pattern k starts on scale degree k on the lowest string and takes
 *   three consecutive scale tones per string, assigned by pitch, so every
 *   string gets exactly three notes. One pattern per scale degree.
 *
 * Cells are keyed "string:fret" with the store's string order (0 = lowest).
 */
import { ALL_NOTES, CAGED_POSITIONS, getScaleNotes, stringFretToMidi, toSharpName } from '../data/musicTheory';
import type { PositionSystem } from '../store/useGuitarStore';

export const cellKey = (string: number, fret: number) => `${string}:${fret}`;

/** How many positions a system offers for a scale. */
export function positionCount(system: PositionSystem, intervals: number[]): number {
  return system === 'caged' ? CAGED_POSITIONS.length : intervals.length;
}

/** Fret of the root on the lowest string, 0-11. */
function rootFretOnLowString(root: string, tuning: readonly number[]): number {
  const rootPc = ALL_NOTES.indexOf(toSharpName(root) as (typeof ALL_NOTES)[number]);
  return (rootPc - tuning[0] + 12) % 12;
}

/** One copy of the CAGED shape per 12 frets that is at least half on the board. */
function cagedCopies(id: number, root: string, intervals: number[], tuning: readonly number[], numFrets: number): Set<string>[] {
  const pos = CAGED_POSITIONS.find((p) => p.id === id);
  if (!pos) return [];
  const scale = new Set(getScaleNotes(root, intervals));
  const r = rootFretOnLowString(root, tuning);
  const span = pos.endFret - pos.startFret;
  const copies: Set<string>[] = [];
  for (let shift = -12; r + pos.startFret + shift <= numFrets; shift += 12) {
    const lo = r + pos.startFret + shift;
    const hi = Math.min(numFrets, lo + span);
    // Skip slivers: a copy mostly below the nut or past the last fret
    if (lo < 0 || hi - lo < span / 2) continue;
    const cells = new Set<string>();
    for (let s = 0; s < tuning.length; s++) {
      for (let f = lo; f <= hi; f++) {
        if (scale.has(ALL_NOTES[(tuning[s] + f) % 12])) cells.add(cellKey(s, f));
      }
    }
    copies.push(cells);
  }
  return copies;
}

/** One full copy of the 3NPS pattern per 12 frets that fits on the board. */
function threeNpsCopies(id: number, root: string, intervals: number[], tuning: readonly number[], numFrets: number): Set<string>[] {
  const n = intervals.length;
  if (id < 1 || id > n) return [];
  const open = tuning.map((_, s) => stringFretToMidi(s, 0, tuning));
  const rootFret = rootFretOnLowString(root, tuning);
  // Starting pitch: degree (id-1) at its lowest fret on the lowest string
  const start = open[0] + ((rootFret + intervals[id - 1]) % 12);

  // Ascending scale pitches from `start`, three per string, low to high
  const pitches: number[] = [];
  let degree = id - 1;
  let pitch = start;
  while (pitches.length < tuning.length * 3) {
    pitches.push(pitch);
    const next = (degree + 1) % n;
    pitch += ((intervals[next] - intervals[degree] + 12) % 12) || 12;
    degree = next;
  }
  const layout = pitches.map((p, i) => ({ s: Math.floor(i / 3), f: p - open[Math.floor(i / 3)] }));

  // Lift the shape an octave if any fret went below the nut, then take every
  // 12-fret copy that fits completely on the board.
  const base = Math.min(...layout.map((c) => c.f)) < 0 ? 12 : 0;
  const copies: Set<string>[] = [];
  for (let shift = base; Math.max(...layout.map((c) => c.f + shift)) <= numFrets; shift += 12) {
    copies.push(new Set(layout.map((c) => cellKey(c.s, c.f + shift))));
  }
  return copies;
}

/**
 * Every copy of position `id` on the board, lowest first (the shape repeats
 * each octave). Empty for "all positions" (id null) or an id the system
 * doesn't have for this scale.
 */
export function positionCopies(
  system: PositionSystem,
  id: number | null,
  root: string,
  intervals: number[],
  tuning: readonly number[],
  numFrets: number,
): Set<string>[] {
  if (id === null || id < 1 || id > positionCount(system, intervals)) return [];
  return system === 'caged'
    ? cagedCopies(id, root, intervals, tuning, numFrets)
    : threeNpsCopies(id, root, intervals, tuning, numFrets);
}

/**
 * All "string:fret" cells of position `id` (every copy), or null for "all
 * positions" (id null) or an id the system doesn't have for this scale.
 */
export function positionCells(
  system: PositionSystem,
  id: number | null,
  root: string,
  intervals: number[],
  tuning: readonly number[],
  numFrets: number,
): Set<string> | null {
  if (id === null || id < 1 || id > positionCount(system, intervals)) return null;
  const all = new Set<string>();
  for (const copy of positionCopies(system, id, root, intervals, tuning, numFrets)) copy.forEach((k) => all.add(k));
  return all;
}

/** Lowest and highest fret of a cell set (for "frets 8-12" captions). */
export function cellFretRange(cells: Set<string>): { min: number; max: number } | null {
  if (cells.size === 0) return null;
  const frets = [...cells].map((k) => Number(k.split(':')[1]));
  return { min: Math.min(...frets), max: Math.max(...frets) };
}

/**
 * Where to start playing a position: the lowest-sounding root among its
 * cells, by pitch. Null if the position contains no root.
 */
export function positionStart(cells: Set<string>, root: string, tuning: readonly number[]): { string: number; fret: number } | null {
  const rootSharp = toSharpName(root);
  let best: { string: number; fret: number; midi: number } | null = null;
  for (const k of cells) {
    const [s, f] = k.split(':').map(Number);
    if (ALL_NOTES[(tuning[s] + f) % 12] !== rootSharp) continue;
    const midi = stringFretToMidi(s, f, tuning);
    if (!best || midi < best.midi) best = { string: s, fret: f, midi };
  }
  return best && { string: best.string, fret: best.fret };
}
