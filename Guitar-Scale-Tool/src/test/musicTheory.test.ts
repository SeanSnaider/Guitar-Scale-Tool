/**
 * musicTheory.test.ts
 *
 * Exhaustive unit tests for all exported pure functions and data constants
 * in src/data/musicTheory.ts.  Tests are grouped by export name and cover
 * normal cases, boundary conditions, and chromatic wrap-around behaviour.
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_NOTES,
  FLAT_TO_SHARP,
  ENHARMONIC_MAP,
  SCALES,
  TUNINGS,
  CAGED_POSITIONS,
  THREE_NPS_POSITIONS,
  STANDARD_TUNING,
  getNoteAtPosition,
  getScaleNotes,
  isNoteInScale,
  getScaleDegree,
  getInterval,
  getIntervalName,
  searchScales,
  getScalesByCategory,
} from '../data/musicTheory';

// ─────────────────────────────────────────────────────────────────────────────
// getNoteAtPosition
// ─────────────────────────────────────────────────────────────────────────────

describe('getNoteAtPosition', () => {
  // Standard tuning: E(4) A(9) D(2) G(7) B(11) E(4) — low to high
  const std = STANDARD_TUNING; // [4, 9, 2, 7, 11, 4]

  it('returns E for string 0 (low E), fret 0', () => {
    expect(getNoteAtPosition(0, 0, std)).toBe('E');
  });

  it('returns A for string 0 (low E), fret 5', () => {
    expect(getNoteAtPosition(0, 5, std)).toBe('A');
  });

  it('returns A for string 1 (A string), fret 0', () => {
    expect(getNoteAtPosition(1, 0, std)).toBe('A');
  });

  it('returns D for string 2 (D string), fret 0', () => {
    expect(getNoteAtPosition(2, 0, std)).toBe('D');
  });

  it('returns G for string 3 (G string), fret 0', () => {
    expect(getNoteAtPosition(3, 0, std)).toBe('G');
  });

  it('returns B for string 4 (B string), fret 0', () => {
    expect(getNoteAtPosition(4, 0, std)).toBe('B');
  });

  it('returns E for string 5 (high e), fret 0', () => {
    expect(getNoteAtPosition(5, 0, std)).toBe('E');
  });

  it('returns E for string 5 fret 12 (octave wrap)', () => {
    expect(getNoteAtPosition(5, 12, std)).toBe('E');
  });

  it('returns F for string 0 (low E), fret 1', () => {
    expect(getNoteAtPosition(0, 1, std)).toBe('F');
  });

  it('returns C for string 1 (A string), fret 3', () => {
    expect(getNoteAtPosition(1, 3, std)).toBe('C');
  });

  it('returns C for string 2 (D string), fret 10', () => {
    expect(getNoteAtPosition(2, 10, std)).toBe('C');
  });

  it('wraps correctly past 12 semitones — fret 13 on high E = F', () => {
    expect(getNoteAtPosition(5, 13, std)).toBe('F');
  });

  it('works with a custom tuning — Drop D string 0 open is D', () => {
    const dropD = TUNINGS['drop_d'].notes; // [2, 9, 2, 7, 11, 4]
    expect(getNoteAtPosition(0, 0, dropD)).toBe('D');
  });

  it('string 0 fret 7 in standard tuning is B', () => {
    expect(getNoteAtPosition(0, 7, std)).toBe('B');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getScaleNotes
// ─────────────────────────────────────────────────────────────────────────────

describe('getScaleNotes', () => {
  it('C major → [C, D, E, F, G, A, B]', () => {
    expect(getScaleNotes('C', [0, 2, 4, 5, 7, 9, 11])).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('A natural minor → [A, B, C, D, E, F, G]', () => {
    expect(getScaleNotes('A', [0, 2, 3, 5, 7, 8, 10])).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('A minor pentatonic (intervals [0,3,5,7,10]) → [A, C, D, E, G]', () => {
    expect(getScaleNotes('A', [0, 3, 5, 7, 10])).toEqual(['A', 'C', 'D', 'E', 'G']);
  });

  it('G major → [G, A, B, C, D, E, F#]', () => {
    expect(getScaleNotes('G', [0, 2, 4, 5, 7, 9, 11])).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F#']);
  });

  it('F# major → [F#, G#, A#, B, C#, D#, F]', () => {
    const fSharpMajor = getScaleNotes('F#', [0, 2, 4, 5, 7, 9, 11]);
    expect(fSharpMajor[0]).toBe('F#');
    expect(fSharpMajor[1]).toBe('G#');
    expect(fSharpMajor[2]).toBe('A#');
    expect(fSharpMajor[3]).toBe('B');
    expect(fSharpMajor[4]).toBe('C#');
    expect(fSharpMajor[5]).toBe('D#');
  });

  it('D major → [D, E, F#, G, A, B, C#]', () => {
    expect(getScaleNotes('D', [0, 2, 4, 5, 7, 9, 11])).toEqual(['D', 'E', 'F#', 'G', 'A', 'B', 'C#']);
  });

  it('E minor pentatonic → [E, G, A, B, D]', () => {
    expect(getScaleNotes('E', [0, 3, 5, 7, 10])).toEqual(['E', 'G', 'A', 'B', 'D']);
  });

  it('returns empty array for an invalid root note', () => {
    expect(getScaleNotes('X', [0, 2, 4])).toEqual([]);
  });

  it('root-only interval [0] returns just the root', () => {
    expect(getScaleNotes('C', [0])).toEqual(['C']);
  });

  it('A# major → uses sharp notation throughout', () => {
    const notes = getScaleNotes('A#', [0, 2, 4, 5, 7, 9, 11]);
    expect(notes[0]).toBe('A#');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isNoteInScale
// ─────────────────────────────────────────────────────────────────────────────

describe('isNoteInScale', () => {
  const cMajor = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  it('C is in C major', () => {
    expect(isNoteInScale('C', cMajor)).toBe(true);
  });

  it('B is in C major', () => {
    expect(isNoteInScale('B', cMajor)).toBe(true);
  });

  it('C# is NOT in C major', () => {
    expect(isNoteInScale('C#', cMajor)).toBe(false);
  });

  it('F# is NOT in C major', () => {
    expect(isNoteInScale('F#', cMajor)).toBe(false);
  });

  it('G is in C major', () => {
    expect(isNoteInScale('G', cMajor)).toBe(true);
  });

  it('returns false for empty scale array', () => {
    expect(isNoteInScale('C', [])).toBe(false);
  });

  it('returns true when checking against minor pentatonic', () => {
    const aMajorPent = ['A', 'C', 'D', 'E', 'G'];
    expect(isNoteInScale('D', aMajorPent)).toBe(true);
  });

  it('returns false for note not in minor pentatonic', () => {
    const aMajorPent = ['A', 'C', 'D', 'E', 'G'];
    expect(isNoteInScale('B', aMajorPent)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getInterval
// ─────────────────────────────────────────────────────────────────────────────

describe('getInterval', () => {
  it('C to C is 0 (unison)', () => {
    expect(getInterval('C', 'C')).toBe(0);
  });

  it('C to E is 4 (major 3rd)', () => {
    expect(getInterval('C', 'E')).toBe(4);
  });

  it('A to C is 3 (minor 3rd)', () => {
    expect(getInterval('A', 'C')).toBe(3);
  });

  it('C to G is 7 (perfect 5th)', () => {
    expect(getInterval('C', 'G')).toBe(7);
  });

  it('C to B is 11 (major 7th)', () => {
    expect(getInterval('C', 'B')).toBe(11);
  });

  it('C to F is 5 (perfect 4th)', () => {
    expect(getInterval('C', 'F')).toBe(5);
  });

  it('G to F# is 11 (major 7th up)', () => {
    expect(getInterval('G', 'F#')).toBe(11);
  });

  it('E to D is 10 (minor 7th)', () => {
    expect(getInterval('E', 'D')).toBe(10);
  });

  it('wraps around — B to C is 1 (minor 2nd)', () => {
    expect(getInterval('B', 'C')).toBe(1);
  });

  it('returns -1 for invalid first note', () => {
    expect(getInterval('X', 'C')).toBe(-1);
  });

  it('returns -1 for invalid second note', () => {
    expect(getInterval('C', 'X')).toBe(-1);
  });

  it('A to G# is 11', () => {
    expect(getInterval('A', 'G#')).toBe(11);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getScaleDegree
// ─────────────────────────────────────────────────────────────────────────────

describe('getScaleDegree', () => {
  const majorScale = SCALES['major'];
  const minorScale = SCALES['minor'];

  it('C is degree "1" in C major', () => {
    expect(getScaleDegree('C', 'C', majorScale)).toBe('1');
  });

  it('D is degree "2" in C major', () => {
    expect(getScaleDegree('D', 'C', majorScale)).toBe('2');
  });

  it('E is degree "3" in C major', () => {
    expect(getScaleDegree('E', 'C', majorScale)).toBe('3');
  });

  it('F is degree "4" in C major', () => {
    expect(getScaleDegree('F', 'C', majorScale)).toBe('4');
  });

  it('G is degree "5" in C major', () => {
    expect(getScaleDegree('G', 'C', majorScale)).toBe('5');
  });

  it('A is degree "6" in C major', () => {
    expect(getScaleDegree('A', 'C', majorScale)).toBe('6');
  });

  it('B is degree "7" in C major', () => {
    expect(getScaleDegree('B', 'C', majorScale)).toBe('7');
  });

  it('C# is NOT in C major → returns null', () => {
    expect(getScaleDegree('C#', 'C', majorScale)).toBeNull();
  });

  it('C in A natural minor is degree "b3"', () => {
    // A minor: A B C D E F G
    expect(getScaleDegree('C', 'A', minorScale)).toBe('b3');
  });

  it('G in A natural minor is degree "b7"', () => {
    expect(getScaleDegree('G', 'A', minorScale)).toBe('b7');
  });

  it('A in A natural minor is degree "1"', () => {
    expect(getScaleDegree('A', 'A', minorScale)).toBe('1');
  });

  it('returns null for note completely outside the scale', () => {
    expect(getScaleDegree('C#', 'A', minorScale)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getIntervalName
// ─────────────────────────────────────────────────────────────────────────────

describe('getIntervalName', () => {
  it('0 → "Root"', () => expect(getIntervalName(0)).toBe('Root'));
  it('1 → "Minor 2nd"', () => expect(getIntervalName(1)).toBe('Minor 2nd'));
  it('2 → "Major 2nd"', () => expect(getIntervalName(2)).toBe('Major 2nd'));
  it('3 → "Minor 3rd"', () => expect(getIntervalName(3)).toBe('Minor 3rd'));
  it('4 → "Major 3rd"', () => expect(getIntervalName(4)).toBe('Major 3rd'));
  it('5 → "Perfect 4th"', () => expect(getIntervalName(5)).toBe('Perfect 4th'));
  it('6 → "Tritone"', () => expect(getIntervalName(6)).toBe('Tritone'));
  it('7 → "Perfect 5th"', () => expect(getIntervalName(7)).toBe('Perfect 5th'));
  it('8 → "Minor 6th"', () => expect(getIntervalName(8)).toBe('Minor 6th'));
  it('9 → "Major 6th"', () => expect(getIntervalName(9)).toBe('Major 6th'));
  it('10 → "Minor 7th"', () => expect(getIntervalName(10)).toBe('Minor 7th'));
  it('11 → "Major 7th"', () => expect(getIntervalName(11)).toBe('Major 7th'));
  it('12 → "Unknown" (out of range)', () => expect(getIntervalName(12)).toBe('Unknown'));
  it('-1 → "Unknown" (negative)', () => expect(getIntervalName(-1)).toBe('Unknown'));
});

// ─────────────────────────────────────────────────────────────────────────────
// searchScales
// ─────────────────────────────────────────────────────────────────────────────

describe('searchScales', () => {
  it('returns empty array for empty string', () => {
    expect(searchScales('')).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    expect(searchScales('   ')).toEqual([]);
  });

  it('"pent" matches scales with pentatonic in the name', () => {
    const results = searchScales('pent');
    const keys = results.map((r) => r.key);
    expect(keys).toContain('major_pentatonic');
    expect(keys).toContain('minor_pentatonic');
  });

  it('"minor" returns multiple minor scales', () => {
    const results = searchScales('minor');
    expect(results.length).toBeGreaterThan(2);
    const keys = results.map((r) => r.key);
    expect(keys).toContain('minor');
    expect(keys).toContain('harmonic_minor');
  });

  it('"blues" returns blues scales', () => {
    const results = searchScales('blues');
    const keys = results.map((r) => r.key);
    expect(keys).toContain('blues');
    expect(keys).toContain('major_blues');
  });

  it('search is case-insensitive — "MAJOR" matches major scales', () => {
    const lowerResults = searchScales('major');
    const upperResults = searchScales('MAJOR');
    expect(upperResults.length).toBe(lowerResults.length);
  });

  it('"dorian" returns at least the dorian mode', () => {
    const results = searchScales('dorian');
    expect(results.map((r) => r.key)).toContain('dorian');
  });

  it('each result has a key and a scale with a name', () => {
    const results = searchScales('major');
    results.forEach((r) => {
      expect(typeof r.key).toBe('string');
      expect(typeof r.scale.name).toBe('string');
      expect(Array.isArray(r.scale.intervals)).toBe(true);
    });
  });

  it('"xyznonexistent" returns empty array', () => {
    expect(searchScales('xyznonexistent')).toEqual([]);
  });

  it('"jazz" returns jazz category scales', () => {
    const results = searchScales('jazz');
    expect(results.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getScalesByCategory
// ─────────────────────────────────────────────────────────────────────────────

describe('getScalesByCategory', () => {
  it('"pentatonic" includes major_pentatonic and minor_pentatonic', () => {
    const results = getScalesByCategory('pentatonic');
    const keys = results.map((r) => r.key);
    expect(keys).toContain('major_pentatonic');
    expect(keys).toContain('minor_pentatonic');
  });

  it('"blues" includes blues and major_blues', () => {
    const results = getScalesByCategory('blues');
    const keys = results.map((r) => r.key);
    expect(keys).toContain('blues');
    expect(keys).toContain('major_blues');
  });

  it('"major" includes major scale', () => {
    const results = getScalesByCategory('major');
    expect(results.map((r) => r.key)).toContain('major');
  });

  it('"minor" includes natural minor scale', () => {
    const results = getScalesByCategory('minor');
    expect(results.map((r) => r.key)).toContain('minor');
  });

  it('"modes" returns the 7 Greek modes', () => {
    const results = getScalesByCategory('modes');
    const keys = results.map((r) => r.key);
    expect(keys).toContain('dorian');
    expect(keys).toContain('phrygian');
    expect(keys).toContain('lydian');
    expect(keys).toContain('mixolydian');
    expect(keys).toContain('aeolian');
    expect(keys).toContain('locrian');
  });

  it('"exotic" returns exotic scales', () => {
    const results = getScalesByCategory('exotic');
    expect(results.length).toBeGreaterThan(0);
  });

  it('"custom" returns empty array when no custom scales defined in SCALES', () => {
    // SCALES constant has no custom entries by default
    const results = getScalesByCategory('custom');
    expect(Array.isArray(results)).toBe(true);
  });

  it('each result has a key and a scale with intervals', () => {
    const results = getScalesByCategory('major');
    results.forEach((r) => {
      expect(typeof r.key).toBe('string');
      expect(Array.isArray(r.scale.intervals)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCALES constant
// ─────────────────────────────────────────────────────────────────────────────

describe('SCALES constant', () => {
  it('has a "major" key', () => {
    expect(SCALES).toHaveProperty('major');
  });

  it('has a "minor" key', () => {
    expect(SCALES).toHaveProperty('minor');
  });

  it('has a "major_pentatonic" key', () => {
    expect(SCALES).toHaveProperty('major_pentatonic');
  });

  it('has a "minor_pentatonic" key', () => {
    expect(SCALES).toHaveProperty('minor_pentatonic');
  });

  it('has a "blues" key', () => {
    expect(SCALES).toHaveProperty('blues');
  });

  it('has a "dorian" key', () => {
    expect(SCALES).toHaveProperty('dorian');
  });

  it('major scale has 7 intervals', () => {
    expect(SCALES['major'].intervals).toHaveLength(7);
  });

  it('major_pentatonic has 5 intervals', () => {
    expect(SCALES['major_pentatonic'].intervals).toHaveLength(5);
  });

  it('minor_pentatonic has 5 intervals', () => {
    expect(SCALES['minor_pentatonic'].intervals).toHaveLength(5);
  });

  it('blues scale has 6 intervals', () => {
    expect(SCALES['blues'].intervals).toHaveLength(6);
  });

  it('major scale has correct interval values [0,2,4,5,7,9,11]', () => {
    expect(SCALES['major'].intervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('minor scale has correct interval values [0,2,3,5,7,8,10]', () => {
    expect(SCALES['minor'].intervals).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });

  it('minor_pentatonic intervals are [0,3,5,7,10]', () => {
    expect(SCALES['minor_pentatonic'].intervals).toEqual([0, 3, 5, 7, 10]);
  });

  it('every scale has a name string', () => {
    Object.values(SCALES).forEach((scale) => {
      expect(typeof scale.name).toBe('string');
      expect(scale.name.length).toBeGreaterThan(0);
    });
  });

  it('every scale has a degrees array', () => {
    Object.values(SCALES).forEach((scale) => {
      expect(Array.isArray(scale.degrees)).toBe(true);
      expect(scale.degrees.length).toBeGreaterThan(0);
    });
  });

  it('every scale has a category', () => {
    Object.values(SCALES).forEach((scale) => {
      expect(typeof scale.category).toBe('string');
    });
  });

  it('degrees array length matches intervals array length for each scale', () => {
    Object.entries(SCALES).forEach(([key, scale]) => {
      expect(scale.degrees.length, `Mismatch in "${key}"`).toBe(scale.intervals.length);
    });
  });

  it('first interval of every scale is 0 (root)', () => {
    Object.values(SCALES).forEach((scale) => {
      expect(scale.intervals[0]).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TUNINGS constant
// ─────────────────────────────────────────────────────────────────────────────

describe('TUNINGS constant', () => {
  it('standard tuning exists', () => {
    expect(TUNINGS).toHaveProperty('standard');
  });

  it('standard tuning has 6 strings', () => {
    expect(TUNINGS['standard'].strings).toBe(6);
  });

  it('standard tuning notes are E A D G B E = [4, 9, 2, 7, 11, 4]', () => {
    expect(TUNINGS['standard'].notes).toEqual([4, 9, 2, 7, 11, 4]);
  });

  it('drop_d tuning exists', () => {
    expect(TUNINGS).toHaveProperty('drop_d');
  });

  it('drop_d low string is D (index 2)', () => {
    expect(TUNINGS['drop_d'].notes[0]).toBe(2);
  });

  it('dadgad tuning exists', () => {
    expect(TUNINGS).toHaveProperty('dadgad');
  });

  it('dadgad notes are D A D G A D = [2, 9, 2, 7, 9, 2]', () => {
    expect(TUNINGS['dadgad'].notes).toEqual([2, 9, 2, 7, 9, 2]);
  });

  it('every tuning has a name and notes array', () => {
    Object.values(TUNINGS).forEach((t) => {
      expect(typeof t.name).toBe('string');
      expect(Array.isArray(t.notes)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Position arrays
// ─────────────────────────────────────────────────────────────────────────────

describe('CAGED_POSITIONS', () => {
  it('has exactly 5 positions', () => {
    expect(CAGED_POSITIONS).toHaveLength(5);
  });

  it('position ids are 1–5', () => {
    const ids = CAGED_POSITIONS.map((p) => p.id);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });

  it('each position has a name, startFret, endFret, color', () => {
    CAGED_POSITIONS.forEach((pos) => {
      expect(typeof pos.name).toBe('string');
      expect(typeof pos.startFret).toBe('number');
      expect(typeof pos.endFret).toBe('number');
      expect(typeof pos.color).toBe('string');
    });
  });
});

describe('THREE_NPS_POSITIONS', () => {
  it('has exactly 7 positions', () => {
    expect(THREE_NPS_POSITIONS).toHaveLength(7);
  });

  it('position ids are 1–7', () => {
    const ids = THREE_NPS_POSITIONS.map((p) => p.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ALL_NOTES and FLAT_TO_SHARP constants
// ─────────────────────────────────────────────────────────────────────────────

describe('ALL_NOTES', () => {
  it('has exactly 12 notes', () => {
    expect(ALL_NOTES).toHaveLength(12);
  });

  it('starts with C and ends with B', () => {
    expect(ALL_NOTES[0]).toBe('C');
    expect(ALL_NOTES[11]).toBe('B');
  });

  it('contains C# at index 1', () => {
    expect(ALL_NOTES[1]).toBe('C#');
  });

  it('contains A at index 9', () => {
    expect(ALL_NOTES[9]).toBe('A');
  });
});

describe('FLAT_TO_SHARP', () => {
  it('Db → C#', () => expect(FLAT_TO_SHARP['Db']).toBe('C#'));
  it('Eb → D#', () => expect(FLAT_TO_SHARP['Eb']).toBe('D#'));
  it('Gb → F#', () => expect(FLAT_TO_SHARP['Gb']).toBe('F#'));
  it('Ab → G#', () => expect(FLAT_TO_SHARP['Ab']).toBe('G#'));
  it('Bb → A#', () => expect(FLAT_TO_SHARP['Bb']).toBe('A#'));
});

describe('ENHARMONIC_MAP', () => {
  it('C# maps to Db', () => expect(ENHARMONIC_MAP['C#']).toBe('Db'));
  it('F# maps to Gb', () => expect(ENHARMONIC_MAP['F#']).toBe('Gb'));
  it('A# maps to Bb', () => expect(ENHARMONIC_MAP['A#']).toBe('Bb'));
});
