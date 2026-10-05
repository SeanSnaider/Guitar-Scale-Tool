/**
 * scalePositions.test.ts
 *
 * Tests for key-relative CAGED / 3NPS position windows. The static
 * CAGED_POSITIONS table is a set of C-major fret windows; positions must
 * instead follow the selected root and scale.
 */

import { describe, it, expect } from 'vitest';
import {
  CAGED_POSITIONS,
  STANDARD_TUNING,
  getScalePositions,
  isFretInPosition,
} from '../data/musicTheory';

/** Start frets of each position, in position order. */
const starts = (system: 'caged' | '3nps', root: string, scaleKey: string): number[] =>
  getScalePositions(system, root, scaleKey, STANDARD_TUNING).map((p) => p.startFret);

describe('getScalePositions (CAGED)', () => {
  it('puts A minor pentatonic box 1 around the root on fret 5', () => {
    const [box1] = getScalePositions('caged', 'A', 'minor_pentatonic', STANDARD_TUNING);
    expect(box1.startFret).toBe(4);
    expect(box1.endFret).toBe(8);
    for (const fret of [5, 7, 8]) expect(isFretInPosition(fret, box1)).toBe(true);
  });

  it('lays the five pentatonic boxes out along the scale degrees', () => {
    // A C D E G on the low E string: frets 5, 8, 10, 12(0), 15(3)
    expect(starts('caged', 'A', 'minor_pentatonic')).toEqual([4, 7, 9, 11, 2]);
  });

  it('starts at the nut when the root is the open low string', () => {
    expect(starts('caged', 'E', 'minor_pentatonic')[0]).toBe(0);
  });

  it('moves every position when the key changes', () => {
    const inA = starts('caged', 'A', 'minor_pentatonic');
    const inB = starts('caged', 'B', 'minor_pentatonic');
    expect(inB).toEqual(inA.map((fret) => (fret + 2) % 12));
  });

  it('anchors seven-note scales on the E shape at the root', () => {
    // C on the low E string is fret 8, so the E-shape box is frets 7-11.
    expect(starts('caged', 'C', 'major')).toEqual([7, 9, 0, 2, 4]);
  });

  it('keeps ids, names and colours from the static table', () => {
    const positions = getScalePositions('caged', 'G', 'major', STANDARD_TUNING);
    expect(positions.map(({ id, name, color }) => ({ id, name, color }))).toEqual(
      CAGED_POSITIONS.map(({ id, name, color }) => ({ id, name, color })),
    );
  });
});

describe('getScalePositions (3NPS)', () => {
  it('starts pattern k on scale degree k for seven-note scales', () => {
    // A natural minor degrees on the low E string: 5 7 8 10 12 13 15
    expect(starts('3nps', 'A', 'minor')).toEqual([5, 7, 8, 10, 0, 1, 3]);
  });
});

describe('isFretInPosition', () => {
  it('matches the same box an octave higher', () => {
    const [box1] = getScalePositions('caged', 'A', 'minor_pentatonic', STANDARD_TUNING);
    expect(isFretInPosition(17, box1)).toBe(true); // 17 - 12 = 5
    expect(isFretInPosition(10, box1)).toBe(false);
  });
});
