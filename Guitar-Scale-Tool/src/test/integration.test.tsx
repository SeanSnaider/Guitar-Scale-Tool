/**
 * integration.test.tsx
 *
 * Integration tests that exercise the real Zustand store (no mocking) together
 * with musicTheory utility functions.  These tests validate end-to-end state
 * flow without rendering complex UI components — allowing fast, deterministic
 * tests that verify business logic across the store + data layer boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGuitarStore } from '../store/useGuitarStore';
import {
  getScaleNotes,
  searchScales,
  SCALES,
} from '../data/musicTheory';

// ─────────────────────────────────────────────────────────────────────────────
// Reset store to default values before each test
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useGuitarStore.setState({
    selectedRoot: 'C',
    selectedScale: 'major',
    displayMode: 'notes',
    showNonScaleNotes: true,
    positionSystem: 'caged',
    selectedPosition: 1,
    numFrets: 24,
    highlightedIntervals: [],
    isPlayingScale: false,
    currentPlayingNote: null,
    customScales: [],
    userStats: {
      totalScalesLearned: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalPracticeMinutes: 0,
      lastPracticeDate: null,
      xp: 0,
      level: 1,
      achievements: [],
    },
    learnedScales: new Set<string>(),
    rewardedScales: [] as string[],
    practiceMode: 'none',
    speedTrainerBpm: 60,
    speedTrainerIncrement: 5,
    activePanel: 'fretboard',
    scaleSearchQuery: '',
    selectedCategory: null,
    lastClickedNote: null,
    earTrainingMode: 'intervals',
    earTrainingScore: 0,
    earTrainingTotal: 0,
    earTrainingAnswers: [],
    activeTab: 'fretboard',
    isAudioShelfOpen: false,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Default state validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Store default state', () => {
  it('initialises with selectedRoot = "C"', () => {
    expect(useGuitarStore.getState().selectedRoot).toBe('C');
  });

  it('initialises with selectedScale = "major"', () => {
    expect(useGuitarStore.getState().selectedScale).toBe('major');
  });

  it('initialises with displayMode = "notes"', () => {
    expect(useGuitarStore.getState().displayMode).toBe('notes');
  });

  it('initialises with positionSystem = "caged"', () => {
    expect(useGuitarStore.getState().positionSystem).toBe('caged');
  });

  it('initialises with numFrets = 24', () => {
    expect(useGuitarStore.getState().numFrets).toBe(24);
  });

  it('initialises with an empty learnedScales Set', () => {
    expect(useGuitarStore.getState().learnedScales.size).toBe(0);
  });

  it('initialises with xp = 0', () => {
    expect(useGuitarStore.getState().userStats.xp).toBe(0);
  });

  it('initialises with level = 1', () => {
    expect(useGuitarStore.getState().userStats.level).toBe(1);
  });

  it('initialises with activeTab = "fretboard"', () => {
    expect(useGuitarStore.getState().activeTab).toBe('fretboard');
  });

  it('initialises with isAudioShelfOpen = false', () => {
    expect(useGuitarStore.getState().isAudioShelfOpen).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Store mutations
// ─────────────────────────────────────────────────────────────────────────────

describe('Store root update', () => {
  it('setting selectedRoot to "A" persists in state', () => {
    useGuitarStore.getState().setSelectedRoot('A');
    expect(useGuitarStore.getState().selectedRoot).toBe('A');
  });

  it('scale notes derived from store root are correct', () => {
    useGuitarStore.getState().setSelectedRoot('A');
    const root = useGuitarStore.getState().selectedRoot;
    const scale = useGuitarStore.getState().selectedScale;
    const intervals = SCALES[scale]?.intervals ?? [];
    const notes = getScaleNotes(root, intervals);
    // A major: A B C# D E F# G#
    expect(notes[0]).toBe('A');
    expect(notes[2]).toBe('C#');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scale search integration
// ─────────────────────────────────────────────────────────────────────────────

describe('Scale search via store + musicTheory', () => {
  it('searching "pent" returns pentatonic scales from the SCALES object', () => {
    useGuitarStore.getState().setScaleSearchQuery('pent');
    const query = useGuitarStore.getState().scaleSearchQuery;
    const results = searchScales(query);
    const keys = results.map((r) => r.key);
    expect(keys).toContain('major_pentatonic');
    expect(keys).toContain('minor_pentatonic');
  });

  it('clearing the search query causes searchScales to return empty array', () => {
    useGuitarStore.getState().setScaleSearchQuery('');
    const query = useGuitarStore.getState().scaleSearchQuery;
    expect(searchScales(query)).toEqual([]);
  });

  it('searching "blues" returns blues scales', () => {
    useGuitarStore.getState().setScaleSearchQuery('blues');
    const query = useGuitarStore.getState().scaleSearchQuery;
    const results = searchScales(query);
    expect(results.map((r) => r.key)).toContain('blues');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-action sequences
// ─────────────────────────────────────────────────────────────────────────────

describe('Sequential store actions', () => {
  it('setting root then scale then position all commit correctly', () => {
    const { setSelectedRoot, setSelectedScale, setSelectedPosition } = useGuitarStore.getState();
    setSelectedRoot('E');
    setSelectedScale('minor_pentatonic');
    setSelectedPosition(3);

    const state = useGuitarStore.getState();
    expect(state.selectedRoot).toBe('E');
    expect(state.selectedScale).toBe('minor_pentatonic');
    expect(state.selectedPosition).toBe(3);
  });

  it('toggling display mode multiple times ends on the last value', () => {
    const { setDisplayMode } = useGuitarStore.getState();
    setDisplayMode('dots');
    setDisplayMode('intervals');
    setDisplayMode('patterns');
    expect(useGuitarStore.getState().displayMode).toBe('patterns');
  });

  it('adding XP and then resetting streak leaves XP unchanged', () => {
    useGuitarStore.getState().addXP(50);
    useGuitarStore.getState().resetStreak();
    // XP should still be 50 — resetStreak only affects currentStreak
    expect(useGuitarStore.getState().userStats.xp).toBe(50);
    expect(useGuitarStore.getState().userStats.currentStreak).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// learnedScales Set persistence across toggles
// ─────────────────────────────────────────────────────────────────────────────

describe('learnedScales Set integration', () => {
  it('toggling different scale keys accumulates independently', () => {
    useGuitarStore.getState().toggleLearnedScale('C-major');
    useGuitarStore.getState().toggleLearnedScale('A-minor');
    useGuitarStore.getState().toggleLearnedScale('G-major');

    const { learnedScales } = useGuitarStore.getState();
    expect(learnedScales.has('C-major')).toBe(true);
    expect(learnedScales.has('A-minor')).toBe(true);
    expect(learnedScales.has('G-major')).toBe(true);
    expect(learnedScales.size).toBe(3);
  });

  it('toggling C-major twice then A-minor once → only A-minor remains', () => {
    useGuitarStore.getState().toggleLearnedScale('C-major');
    useGuitarStore.getState().toggleLearnedScale('A-minor');
    useGuitarStore.getState().toggleLearnedScale('C-major'); // un-learn

    const { learnedScales } = useGuitarStore.getState();
    expect(learnedScales.has('C-major')).toBe(false);
    expect(learnedScales.has('A-minor')).toBe(true);
    expect(learnedScales.size).toBe(1);
  });

  it('isScaleLearned reflects current Set state correctly', () => {
    useGuitarStore.getState().toggleLearnedScale('D-dorian');
    expect(useGuitarStore.getState().isScaleLearned('D-dorian')).toBe(true);
    useGuitarStore.getState().toggleLearnedScale('D-dorian');
    expect(useGuitarStore.getState().isScaleLearned('D-dorian')).toBe(false);
  });

  it('learning a scale via toggle awards XP while unlearning does not deduct it', () => {
    const xpBefore = useGuitarStore.getState().userStats.xp;
    useGuitarStore.getState().toggleLearnedScale('B-minor');
    const xpAfterLearn = useGuitarStore.getState().userStats.xp;
    expect(xpAfterLearn).toBeGreaterThan(xpBefore);

    useGuitarStore.getState().toggleLearnedScale('B-minor'); // un-learn
    const xpAfterUnlearn = useGuitarStore.getState().userStats.xp;
    expect(xpAfterUnlearn).toBe(xpAfterLearn); // no deduction
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gamification XP + level integration
// ─────────────────────────────────────────────────────────────────────────────

describe('XP and level progression', () => {
  it('XP accumulates across addXP and toggleLearnedScale calls', () => {
    useGuitarStore.getState().addXP(90);
    useGuitarStore.getState().toggleLearnedScale('C-major'); // awards 10 XP
    expect(useGuitarStore.getState().userStats.xp).toBe(100);
    expect(useGuitarStore.getState().userStats.level).toBe(2);
  });

  it('addPracticeMinutes accumulates across multiple calls', () => {
    useGuitarStore.getState().addPracticeMinutes(10);
    useGuitarStore.getState().addPracticeMinutes(20);
    useGuitarStore.getState().addPracticeMinutes(5);
    expect(useGuitarStore.getState().userStats.totalPracticeMinutes).toBe(35);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// musicTheory pure function cross-checks
// ─────────────────────────────────────────────────────────────────────────────

describe('musicTheory cross-checks with store state', () => {
  it('C major scale notes match SCALES major intervals', () => {
    const scale = SCALES['major'];
    const notes = getScaleNotes('C', scale.intervals);
    expect(notes).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('after setting root to "D", derived D major scale is correct', () => {
    useGuitarStore.getState().setSelectedRoot('D');
    useGuitarStore.getState().setSelectedScale('major');
    const { selectedRoot, selectedScale } = useGuitarStore.getState();
    const notes = getScaleNotes(selectedRoot, SCALES[selectedScale].intervals);
    expect(notes).toEqual(['D', 'E', 'F#', 'G', 'A', 'B', 'C#']);
  });

  it('after setting scale to "dorian", intervals from SCALES.dorian are [0,2,3,5,7,9,10]', () => {
    useGuitarStore.getState().setSelectedScale('dorian');
    const scale = useGuitarStore.getState().selectedScale;
    expect(SCALES[scale].intervals).toEqual([0, 2, 3, 5, 7, 9, 10]);
  });
});
