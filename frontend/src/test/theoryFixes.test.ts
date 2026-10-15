/**
 * theoryFixes.test.ts
 *
 * Regression tests for the audit fixes in music theory, positions,
 * spelling, the tab pattern, progress helpers and store persistence.
 */
import { describe, it, expect } from 'vitest';
import {
  SCALES,
  TUNINGS,
  getDiatonicChords,
  getScaleNotes,
  getInterval,
  intervalNameForDegree,
  makeNoteNamer,
  relatedScaleRoot,
  spellScale,
} from '../data/musicTheory';
import { cellFretRange, positionCells, positionCopies, positionCount, positionStart } from '../practice/positions';
import { buildAscendingPattern } from '../practice/scalePattern';
import { effectiveStreak, learnedScaleKey, localDayKey, localDayKeyOffset, parseLearnedScaleKey } from '../store/progress';
import { useGuitarStore } from '../store/useGuitarStore';

const STD = TUNINGS.standard.notes;
const chordNames = (root: string, key: string) => getDiatonicChords(root, key).map((c) => `${c.root}${c.symbol} ${c.degree}`);

describe('getDiatonicChords stacks the scale’s own thirds', () => {
  it('C major: I ii iii IV V vi vii°', () => {
    expect(chordNames('C', 'major')).toEqual(['C I', 'Dm ii', 'Em iii', 'F IV', 'G V', 'Am vi', 'Bdim vii°']);
  });

  it('D Dorian has a minor i and a major IV (not a major I)', () => {
    expect(chordNames('D', 'dorian')).toEqual(['Dm i', 'Em ii', 'F III', 'G IV', 'Am v', 'Bdim vi°', 'C VII']);
  });

  it('harmonic minor has III+ and a major V', () => {
    const chords = getDiatonicChords('C', 'harmonic_minor');
    expect(chords[2]).toMatchObject({ type: 'augmented', degree: 'III+' });
    expect(chords[4]).toMatchObject({ type: 'major', degree: 'V' });
    expect(chords[6]).toMatchObject({ type: 'diminished', degree: 'vii°' });
  });

  it('non-7-note scales return no chord set', () => {
    expect(getDiatonicChords('C', 'major_pentatonic')).toEqual([]);
    expect(getDiatonicChords('C', 'bebop_dominant')).toEqual([]);
  });
});

describe('spelling by key', () => {
  it('F major uses Bb, not A#', () => {
    expect(spellScale('F', 'major')).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
  });

  it('a sharp-named root that reads better flat is shown flat (A# major -> Bb major)', () => {
    expect(spellScale('A#', 'major')).toEqual(['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A']);
  });

  it('every 7-note scale uses one letter per degree in every key', () => {
    for (const [key, scale] of Object.entries(SCALES)) {
      // Skip scales whose own labels reuse a degree number (e.g. enigmatic: b7 and 7)
      const nums = scale.degrees.map((d) => d.replace(/[b#]/g, ''));
      if (scale.intervals.length !== 7 || new Set(nums).size !== 7) continue;
      for (const root of ['C', 'F', 'G', 'D#', 'F#', 'A#']) {
        const letters = spellScale(root, key).map((n) => n[0]);
        expect(new Set(letters).size, `${root} ${key}`).toBe(7);
      }
    }
  });

  it('the namer spells scale tones for the key and keeps the key’s side for others', () => {
    const name = makeNoteNamer('F', 'major');
    expect(name('A#')).toBe('Bb');
    expect(name('C#')).toBe('Db');
  });

  it('flat input is accepted by the note math', () => {
    expect(getScaleNotes('Bb', SCALES.major.intervals)[0]).toBe('A#');
    expect(getInterval('Db', 'C')).toBe(11);
  });
});

describe('interval names follow the degree label', () => {
  it.each([
    ['1', 'Root'],
    ['#2', 'Augmented 2nd'],
    ['b3', 'Minor 3rd'],
    ['b4', 'Diminished 4th'],
    ['#4', 'Augmented 4th'],
    ['b5', 'Diminished 5th'],
    ['#5', 'Augmented 5th'],
    ['bb7', 'Diminished 7th'],
    ['7', 'Major 7th'],
  ])('%s -> %s', (deg, name) => expect(intervalNameForDegree(deg)).toBe(name));
});

describe('related scales move the root when they share the notes', () => {
  it('C major -> relative minor is A', () => expect(relatedScaleRoot('C', 'major', 'minor')).toBe('A'));
  it('D Dorian -> parent major is C', () => expect(relatedScaleRoot('D', 'dorian', 'major')).toBe('C'));
  it('a parallel relationship keeps the root', () =>
    expect(relatedScaleRoot('C', 'major', 'harmonic_minor')).toBe('C'));
});

describe('positions are computed for the actual key', () => {
  it('CAGED position 1 moves with the root (C on low E fret 8 -> frets 8-12)', () => {
    const copies = positionCopies('caged', 1, 'C', SCALES.major.intervals, STD, 24);
    expect(cellFretRange(copies[0])).toEqual({ min: 8, max: 12 });
    // ...and repeats an octave up where it fits
    expect(cellFretRange(copies[1])!.min).toBe(20);
  });

  it('CAGED position 1 for E sits at the nut, with no sliver copy at fret 12 on a 12-fret board', () => {
    const copies = positionCopies('caged', 1, 'E', SCALES.major.intervals, STD, 12);
    expect(copies).toHaveLength(1);
    expect(cellFretRange(copies[0])!.max).toBeLessThanOrEqual(4);
  });

  it('every 3NPS pattern puts exactly three notes on every string', () => {
    for (let id = 1; id <= 7; id++) {
      const copy = positionCopies('3nps', id, 'C', SCALES.major.intervals, STD, 24)[0];
      for (let s = 0; s < 6; s++) {
        const onString = [...copy].filter((k) => k.startsWith(`${s}:`));
        expect(onString.length, `pattern ${id} string ${s}`).toBe(3);
      }
    }
  });

  it('3NPS has one pattern per scale degree (5 for a pentatonic)', () => {
    expect(positionCount('3nps', SCALES.major.intervals)).toBe(7);
    expect(positionCount('3nps', SCALES.minor_pentatonic.intervals)).toBe(5);
    expect(positionCount('caged', SCALES.minor_pentatonic.intervals)).toBe(5);
  });

  it('out-of-range ids mean "all positions"', () => {
    expect(positionCells('3nps', 7, 'C', SCALES.minor_pentatonic.intervals, STD, 24)).toBeNull();
    expect(positionCells('caged', null, 'C', SCALES.major.intervals, STD, 24)).toBeNull();
  });

  it('positionStart finds the lowest-sounding root in the shape', () => {
    const [lowest] = positionCopies('caged', 1, 'C', SCALES.major.intervals, STD, 24);
    expect(positionStart(lowest, 'C', STD)).toEqual({ string: 0, fret: 8 });
  });
});

describe('the tab pattern stays on the drawn board', () => {
  it('never goes past numFrets', () => {
    const p = buildAscendingPattern('D#', SCALES.major.intervals, STD, 12);
    expect(Math.max(...p.map((n) => n.fret))).toBeLessThanOrEqual(12);
  });
});

describe('progress helpers', () => {
  it('learned keys round-trip, and legacy position suffixes are tolerated', () => {
    expect(parseLearnedScaleKey(learnedScaleKey('F#', 'harmonic_minor'))).toEqual({
      root: 'F#',
      scaleKey: 'harmonic_minor',
      position: null,
    });
    expect(parseLearnedScaleKey('C-major-1')).toEqual({ root: 'C', scaleKey: 'major', position: 1 });
  });

  it('day keys use the local calendar', () => {
    const late = new Date(2026, 9, 14, 23, 30); // 11:30pm local, Oct 14
    expect(localDayKey(late)).toBe('2026-10-14');
    expect(localDayKeyOffset(1, late)).toBe('2026-10-13');
  });

  it('a lapsed streak reads 0', () => {
    const now = new Date(2026, 9, 14, 12);
    expect(effectiveStreak({ currentStreak: 5, lastPracticeDate: '2026-10-13' }, now)).toBe(5);
    expect(effectiveStreak({ currentStreak: 5, lastPracticeDate: '2026-10-10' }, now)).toBe(0);
  });
});

describe('store: learned scales and persistence', () => {
  it('markScaleLearned is idempotent (no XP farming)', () => {
    const s = useGuitarStore.getState();
    s.unmarkScaleLearned('C-major');
    const xp0 = useGuitarStore.getState().userStats.xp;
    s.markScaleLearned('C-major');
    s.markScaleLearned('C-major');
    const st = useGuitarStore.getState();
    expect(st.userStats.xp - xp0).toBe(10);
    expect(st.userStats.totalScalesLearned).toBe(st.learnedScales.size);
  });

  it('rehydrates learnedScales as a Set even from an old {} value, folding legacy keys', async () => {
    const persist = (useGuitarStore as unknown as { persist: { rehydrate: () => Promise<void>; getOptions: () => { name: string } } }).persist;
    const name = persist.getOptions().name;
    localStorage.setItem(name, JSON.stringify({ state: { learnedScales: ['C-major-1', 'G-dorian'], numFrets: 99 }, version: 0 }));
    await persist.rehydrate();
    const st = useGuitarStore.getState();
    expect(st.learnedScales instanceof Set).toBe(true);
    expect([...st.learnedScales].sort()).toEqual(['C-major', 'G-dorian']);
    expect(st.numFrets).toBe(24);

    localStorage.setItem(name, JSON.stringify({ state: { learnedScales: {} }, version: 0 }));
    await persist.rehydrate();
    expect(useGuitarStore.getState().learnedScales instanceof Set).toBe(true);
    localStorage.removeItem(name);
  });
});
