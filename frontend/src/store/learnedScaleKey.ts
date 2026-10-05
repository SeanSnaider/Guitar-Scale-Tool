/**
 * learnedScaleKey.ts
 *
 * Parsing for the keys stored in useGuitarStore's `learnedScales` set.
 *
 * Ear Training and Practice Mode store keys as `${root}-${scaleKey}`
 * (e.g. "C#-minor_pentatonic"). Older builds documented a
 * `${root}-${scaleKey}-${position}` form ("C-major-1"), so both are
 * accepted. Scale keys use underscores, never hyphens, which keeps the
 * format unambiguous.
 */

import { SCALES } from '../data/musicTheory';

/** A learned-scale store key broken into its parts. */
export interface LearnedScaleKeyParts {
  /** Root note, e.g. "C#". */
  root: string;
  /** Key into SCALES, e.g. "minor_pentatonic". */
  scaleKey: string;
  /** Position number from the legacy format, or null when absent. */
  position: string | null;
}

/**
 * Parses a learned-scale store key.
 *
 * @param key - A key from the `learnedScales` set.
 * @returns The parsed parts, or null if the key does not name a known scale.
 */
export function parseLearnedScaleKey(key: string): LearnedScaleKeyParts | null {
  const [root, scaleKey, position, ...rest] = key.split('-');
  if (!root || !scaleKey || rest.length > 0 || !SCALES[scaleKey]) return null;
  if (position !== undefined && !/^\d+$/.test(position)) return null;
  return { root, scaleKey, position: position ?? null };
}
