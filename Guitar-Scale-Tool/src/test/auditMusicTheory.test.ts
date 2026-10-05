/**
 * auditMusicTheory.test.ts
 *
 * Regression tests for music-theory defects found during the repository
 * audit: diatonic chord qualities for modes and non-major/minor scales,
 * the deprecated getNoteOctave helper, octave assignment for ascending
 * playback, relative-scale root resolution, and parsing of learned-scale
 * store keys.
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_NOTES,
  CHORD_TYPES,
  SCALES,
  getDiatonicChords,
  getNoteOctave,
  getAscendingOctaves,
  resolveRelatedScaleRoot,
} from '../data/musicTheory';
import { parseLearnedScaleKey } from '../store/learnedScaleKey';

describe('getDiatonicChords', () => {
  it('keeps the standard major-key harmony', () => {
    const chords = getDiatonicChords('C', 'major');
    expect(chords.map((c) => `${c.root}:${c.type}:${c.degree}`)).toEqual([
      'C:major:I', 'D:minor:ii', 'E:minor:iii', 'F:major:IV',
      'G:major:V', 'A:minor:vi', 'B:diminished:vii°',
    ]);
    expect(chords.map((c) => c.seventh)).toEqual([
      'major7', 'minor7', 'minor7', 'major7', 'dominant7', 'minor7', 'half_diminished',
    ]);
  });

  it('derives Dorian qualities from the mode itself, not the minor table', () => {
    const chords = getDiatonicChords('D', 'dorian');
    expect(chords.map((c) => `${c.root}:${c.type}:${c.degree}`)).toEqual([
      'D:minor:i', 'E:minor:ii', 'F:major:III', 'G:major:IV',
      'A:minor:v', 'B:diminished:vi°', 'C:major:VII',
    ]);
  });

  it('gives harmonic minor its major V and augmented III', () => {
    const chords = getDiatonicChords('A', 'harmonic_minor');
    expect(chords.map((c) => `${c.root}:${c.type}:${c.degree}`)).toEqual([
      'A:minor:i', 'B:diminished:ii°', 'C:augmented:III+', 'D:minor:iv',
      'E:major:V', 'F:major:VI', 'G#:diminished:vii°',
    ]);
  });

  it('harmonises a pentatonic scale with its parent scale instead of mislabelling it', () => {
    expect(getDiatonicChords('A', 'minor_pentatonic')).toEqual(getDiatonicChords('A', 'minor'));
  });

  it('never returns a chord type that the player cannot voice or play', () => {
    for (const [scaleKey, scale] of Object.entries(SCALES)) {
      if (scale.intervals.length !== 7) continue;
      for (const root of ALL_NOTES) {
        for (const chord of getDiatonicChords(root, scaleKey)) {
          expect(CHORD_TYPES[chord.type], `${root} ${scaleKey} ${chord.degree}`).toBeDefined();
        }
      }
    }
  });
});

describe('getNoteOctave', () => {
  it.each([
    [0, 0, 2], // open low E = E2
    [0, 8, 3], // low E string fret 8 = C3 (was reported as octave 4)
    [0, 12, 3], // E3
    [1, 3, 3], // A string fret 3 = C3
    [5, 0, 4], // open high e = E4
  ])('string %i fret %i is in octave %i', (stringIndex, fret, octave) => {
    expect(getNoteOctave(stringIndex, fret)).toBe(octave);
  });
});

describe('getAscendingOctaves', () => {
  it('moves to the next octave when the scale passes C', () => {
    expect(getAscendingOctaves(['A', 'B', 'C', 'D', 'E'], 3)).toEqual([
      { note: 'A', octave: 3 }, { note: 'B', octave: 3 },
      { note: 'C', octave: 4 }, { note: 'D', octave: 4 }, { note: 'E', octave: 4 },
    ]);
  });

  it('keeps root-position chords with the root lowest', () => {
    expect(getAscendingOctaves(['G', 'B', 'D'], 3)).toEqual([
      { note: 'G', octave: 3 }, { note: 'B', octave: 3 }, { note: 'D', octave: 4 },
    ]);
  });
});

describe('resolveRelatedScaleRoot', () => {
  it.each([
    ['C', 'major', 'minor', 'Relative minor', 'A'],
    ['A', 'minor', 'major', 'Relative major', 'C'],
    ['C', 'major_pentatonic', 'minor_pentatonic', 'Relative pentatonic', 'A'],
    ['D', 'dorian', 'major', 'Parent major (2nd mode)', 'C'],
    ['A', 'harmonic_minor', 'phrygian_dominant', '5th mode of this scale', 'E'],
    ['E', 'phrygian_dominant', 'harmonic_minor', 'Parent scale', 'A'],
    ['A', 'minor_pentatonic', 'minor', 'Parent scale', 'A'],
    ['C', 'major', 'mixolydian', 'Parallel mode (b7)', 'C'],
    ['C', 'major', 'major_pentatonic', 'Pentatonic subset', 'C'],
  ])('%s %s → %s (%s) uses root %s', (root, from, to, relationship, expected) => {
    expect(resolveRelatedScaleRoot(root, from, { key: to, label: to, relationship })).toBe(expected);
  });
});

describe('parseLearnedScaleKey', () => {
  it('parses the root-scale keys written by Ear Training', () => {
    expect(parseLearnedScaleKey('C#-minor_pentatonic')).toEqual({
      root: 'C#', scaleKey: 'minor_pentatonic', position: null,
    });
  });

  it('still parses legacy root-scale-position keys', () => {
    expect(parseLearnedScaleKey('C-major-1')).toEqual({ root: 'C', scaleKey: 'major', position: '1' });
  });

  it('rejects keys for unknown scales', () => {
    expect(parseLearnedScaleKey('C-not_a_scale')).toBeNull();
  });
});
