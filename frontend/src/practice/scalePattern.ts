/**
 * scalePattern.ts
 *
 * Pure functions that turn (root, scale, tuning, direction) into the
 * three-notes-per-string pattern the Tablature shows and the transport plays.
 * Shared so the display and the audio can never disagree.
 */
import {
  getNoteAtPosition,
  getScaleNotes,
  isNoteInScale,
  stringFretToMidi,
} from '../data/musicTheory';
import type { PlaybackDirection } from '../store/useGuitarStore';

export interface TabNote {
  /** Tab order: 0 = highest string (top line of the tab). */
  string: number;
  fret: number;
  note: string;
  isRoot: boolean;
}

/** Lowest fret where the root appears, scanning from the lowest string up. */
function findLowestRoot(rootNote: string, tuning: number[], maxFret = 12) {
  for (let stringIdx = 0; stringIdx < tuning.length; stringIdx++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      if (getNoteAtPosition(stringIdx, fret, tuning) === rootNote) return { string: stringIdx, fret };
    }
  }
  return null;
}

/**
 * Three notes per string, low string to high, starting at the lowest root.
 * Returned in ascending playing order.
 */
export function buildAscendingPattern(rootNote: string, intervals: number[], tuning: number[]): TabNote[] {
  const scaleNotes = getScaleNotes(rootNote, intervals);
  const lowestRoot = findLowestRoot(rootNote, tuning);
  const startFret = lowestRoot ? lowestRoot.fret : 0;
  const maxFret = startFret + 15;
  const pattern: TabNote[] = [];

  for (let stringIdx = 0; stringIdx < tuning.length; stringIdx++) {
    const tabString = tuning.length - 1 - stringIdx;
    let notesOnString = 0;
    for (let fret = startFret; fret <= maxFret && notesOnString < 3; fret++) {
      const note = getNoteAtPosition(stringIdx, fret, tuning);
      if (isNoteInScale(note, scaleNotes)) {
        pattern.push({ string: tabString, fret, note, isRoot: note === rootNote });
        notesOnString++;
      }
    }
  }
  // Lowest string first, then by fret
  return pattern.sort((a, b) => (b.string !== a.string ? b.string - a.string : a.fret - b.fret));
}

/** Applies the playback direction ('both' skips the repeated top note). */
export function orderPattern(ascending: TabNote[], direction: PlaybackDirection): TabNote[] {
  const descending = [...ascending].reverse();
  if (direction === 'ascending') return ascending;
  if (direction === 'descending') return descending;
  return [...ascending, ...descending.slice(1)];
}

/** MIDI note numbers for a pattern, for the audio engine's scheduler. */
export function patternToMidi(pattern: TabNote[], tuning: number[]): number[] {
  return pattern.map((n) => stringFretToMidi(tuning.length - 1 - n.string, n.fret, tuning));
}

/** Semitone gap → step name (W = whole, H = half, larger gaps in semitones). */
const STEP_NAME: Record<number, string> = { 1: 'H', 2: 'W', 3: 'W+H', 4: '2W' };

/** The scale's steps between consecutive degrees, closing back to the octave. */
export function stepPattern(intervals: number[]): string[] {
  return intervals.map((iv, i) => {
    const next = i + 1 < intervals.length ? intervals[i + 1] : 12;
    const gap = next - iv;
    return STEP_NAME[gap] ?? `${gap}`;
  });
}
