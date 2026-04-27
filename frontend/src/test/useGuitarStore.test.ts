/**
 * useGuitarStore.test.ts
 *
 * Unit tests for the Zustand global store defined in src/store/useGuitarStore.ts.
 * Every exported action and derived getter is exercised.  State is reset between
 * tests via useGuitarStore.setState to prevent cross-test contamination.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGuitarStore } from '../store/useGuitarStore';

/** Snapshot of the initial default state values that we reset to before each test. */
const INITIAL_STATE_PATCH = {
  selectedRoot: 'C',
  selectedScale: 'major',
  displayMode: 'notes' as const,
  showNonScaleNotes: true,
  positionSystem: 'caged' as const,
  selectedPosition: 1 as number | null,
  numFrets: 24,
  highlightedIntervals: [] as number[],
  isPlayingScale: false,
  playbackDirection: 'ascending' as const,
  currentPlayingNote: null as number | null,
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
  practiceMode: 'none' as const,
  speedTrainerBpm: 60,
  speedTrainerIncrement: 5,
  activePanel: 'fretboard' as const,
  scaleSearchQuery: '',
  selectedCategory: null as string | null,
  lastClickedNote: null as string | null,
  earTrainingMode: 'intervals' as const,
  earTrainingScore: 0,
  earTrainingTotal: 0,
  earTrainingAnswers: [],
  activeTab: 'fretboard' as const,
  isAudioShelfOpen: false,
};

beforeEach(() => {
  useGuitarStore.setState(INITIAL_STATE_PATCH);
});

// ─────────────────────────────────────────────────────────────────────────────
// Scale selection
// ─────────────────────────────────────────────────────────────────────────────

describe('setSelectedRoot', () => {
  it('updates selectedRoot to the given note', () => {
    useGuitarStore.getState().setSelectedRoot('G');
    expect(useGuitarStore.getState().selectedRoot).toBe('G');
  });

  it('accepts sharp notes', () => {
    useGuitarStore.getState().setSelectedRoot('F#');
    expect(useGuitarStore.getState().selectedRoot).toBe('F#');
  });
});

describe('setSelectedScale', () => {
  it('updates selectedScale to the given key', () => {
    useGuitarStore.getState().setSelectedScale('dorian');
    expect(useGuitarStore.getState().selectedScale).toBe('dorian');
  });

  it('can be set to minor_pentatonic', () => {
    useGuitarStore.getState().setSelectedScale('minor_pentatonic');
    expect(useGuitarStore.getState().selectedScale).toBe('minor_pentatonic');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Display options
// ─────────────────────────────────────────────────────────────────────────────

describe('setDisplayMode', () => {
  it('sets displayMode to "intervals"', () => {
    useGuitarStore.getState().setDisplayMode('intervals');
    expect(useGuitarStore.getState().displayMode).toBe('intervals');
  });

  it('sets displayMode to "patterns"', () => {
    useGuitarStore.getState().setDisplayMode('patterns');
    expect(useGuitarStore.getState().displayMode).toBe('patterns');
  });

  it('sets displayMode to "dots"', () => {
    useGuitarStore.getState().setDisplayMode('dots');
    expect(useGuitarStore.getState().displayMode).toBe('dots');
  });

  it('sets displayMode to "notes"', () => {
    useGuitarStore.getState().setDisplayMode('notes');
    expect(useGuitarStore.getState().displayMode).toBe('notes');
  });
});

describe('setShowNonScaleNotes', () => {
  it('sets showNonScaleNotes to false', () => {
    useGuitarStore.getState().setShowNonScaleNotes(false);
    expect(useGuitarStore.getState().showNonScaleNotes).toBe(false);
  });

  it('sets showNonScaleNotes back to true', () => {
    useGuitarStore.getState().setShowNonScaleNotes(false);
    useGuitarStore.getState().setShowNonScaleNotes(true);
    expect(useGuitarStore.getState().showNonScaleNotes).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Position system
// ─────────────────────────────────────────────────────────────────────────────

describe('setPositionSystem', () => {
  it('sets positionSystem to "3nps"', () => {
    useGuitarStore.getState().setPositionSystem('3nps');
    expect(useGuitarStore.getState().positionSystem).toBe('3nps');
  });

  it('sets positionSystem back to "caged"', () => {
    useGuitarStore.getState().setPositionSystem('3nps');
    useGuitarStore.getState().setPositionSystem('caged');
    expect(useGuitarStore.getState().positionSystem).toBe('caged');
  });
});

describe('setSelectedPosition', () => {
  it('sets selectedPosition to a numeric value', () => {
    useGuitarStore.getState().setSelectedPosition(3);
    expect(useGuitarStore.getState().selectedPosition).toBe(3);
  });

  it('sets selectedPosition to null (All positions)', () => {
    useGuitarStore.getState().setSelectedPosition(null);
    expect(useGuitarStore.getState().selectedPosition).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fretboard settings
// ─────────────────────────────────────────────────────────────────────────────

describe('setNumFrets', () => {
  it('sets numFrets to 18 (within range)', () => {
    useGuitarStore.getState().setNumFrets(18);
    expect(useGuitarStore.getState().numFrets).toBe(18);
  });

  it('clamps numFrets to 12 when value is below min (5)', () => {
    useGuitarStore.getState().setNumFrets(5);
    expect(useGuitarStore.getState().numFrets).toBe(12);
  });

  it('clamps numFrets to 24 when value exceeds max (30)', () => {
    useGuitarStore.getState().setNumFrets(30);
    expect(useGuitarStore.getState().numFrets).toBe(24);
  });

  it('sets numFrets to exactly 12 (boundary minimum)', () => {
    useGuitarStore.getState().setNumFrets(12);
    expect(useGuitarStore.getState().numFrets).toBe(12);
  });

  it('sets numFrets to exactly 24 (boundary maximum)', () => {
    useGuitarStore.getState().setNumFrets(24);
    expect(useGuitarStore.getState().numFrets).toBe(24);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Interval highlighting
// ─────────────────────────────────────────────────────────────────────────────

describe('toggleInterval', () => {
  it('adds interval 7 when not present', () => {
    useGuitarStore.getState().toggleInterval(7);
    expect(useGuitarStore.getState().highlightedIntervals).toContain(7);
  });

  it('removes interval 7 when toggled twice', () => {
    useGuitarStore.getState().toggleInterval(7);
    useGuitarStore.getState().toggleInterval(7);
    expect(useGuitarStore.getState().highlightedIntervals).not.toContain(7);
  });

  it('can hold multiple distinct intervals', () => {
    useGuitarStore.getState().toggleInterval(3);
    useGuitarStore.getState().toggleInterval(7);
    const intervals = useGuitarStore.getState().highlightedIntervals;
    expect(intervals).toContain(3);
    expect(intervals).toContain(7);
  });

  it('removing one interval preserves others', () => {
    useGuitarStore.getState().toggleInterval(3);
    useGuitarStore.getState().toggleInterval(7);
    useGuitarStore.getState().toggleInterval(3); // remove 3
    const intervals = useGuitarStore.getState().highlightedIntervals;
    expect(intervals).not.toContain(3);
    expect(intervals).toContain(7);
  });
});

describe('setHighlightedIntervals', () => {
  it('replaces the intervals array entirely', () => {
    useGuitarStore.getState().setHighlightedIntervals([0, 4, 7]);
    expect(useGuitarStore.getState().highlightedIntervals).toEqual([0, 4, 7]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gamification — XP and level
// ─────────────────────────────────────────────────────────────────────────────

describe('addXP', () => {
  it('increases xp by the given amount', () => {
    useGuitarStore.getState().addXP(100);
    expect(useGuitarStore.getState().userStats.xp).toBe(100);
  });

  it('accumulates XP across multiple calls', () => {
    useGuitarStore.getState().addXP(50);
    useGuitarStore.getState().addXP(50);
    expect(useGuitarStore.getState().userStats.xp).toBe(100);
  });

  it('increases level after 100 XP (threshold = 100 per level)', () => {
    useGuitarStore.getState().addXP(100);
    expect(useGuitarStore.getState().userStats.level).toBe(2);
  });

  it('level remains 1 below 100 XP', () => {
    useGuitarStore.getState().addXP(99);
    expect(useGuitarStore.getState().userStats.level).toBe(1);
  });

  it('level 3 at 200 XP', () => {
    useGuitarStore.getState().addXP(200);
    expect(useGuitarStore.getState().userStats.level).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gamification — streak
// ─────────────────────────────────────────────────────────────────────────────

describe('incrementStreak', () => {
  it('sets currentStreak to 1 on first call (no prior date)', () => {
    useGuitarStore.getState().incrementStreak();
    expect(useGuitarStore.getState().userStats.currentStreak).toBe(1);
  });

  it('sets longestStreak to at least 1 after first increment', () => {
    useGuitarStore.getState().incrementStreak();
    expect(useGuitarStore.getState().userStats.longestStreak).toBeGreaterThanOrEqual(1);
  });

  it('sets lastPracticeDate to today (ISO string)', () => {
    useGuitarStore.getState().incrementStreak();
    const today = new Date().toISOString().split('T')[0];
    expect(useGuitarStore.getState().userStats.lastPracticeDate).toBe(today);
  });

  it('calling again same day does not change the streak (already marked today)', () => {
    useGuitarStore.getState().incrementStreak();
    const streakAfterFirst = useGuitarStore.getState().userStats.currentStreak;
    useGuitarStore.getState().incrementStreak(); // same day
    expect(useGuitarStore.getState().userStats.currentStreak).toBe(streakAfterFirst);
  });
});

describe('resetStreak', () => {
  it('resets currentStreak to 0', () => {
    useGuitarStore.getState().incrementStreak();
    useGuitarStore.getState().resetStreak();
    expect(useGuitarStore.getState().userStats.currentStreak).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gamification — practice minutes
// ─────────────────────────────────────────────────────────────────────────────

describe('addPracticeMinutes', () => {
  it('increases totalPracticeMinutes by the given amount', () => {
    useGuitarStore.getState().addPracticeMinutes(30);
    expect(useGuitarStore.getState().userStats.totalPracticeMinutes).toBe(30);
  });

  it('accumulates across multiple calls', () => {
    useGuitarStore.getState().addPracticeMinutes(15);
    useGuitarStore.getState().addPracticeMinutes(15);
    expect(useGuitarStore.getState().userStats.totalPracticeMinutes).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gamification — achievements
// ─────────────────────────────────────────────────────────────────────────────

describe('unlockAchievement', () => {
  it('adds an achievement id', () => {
    useGuitarStore.getState().unlockAchievement('first_scale');
    expect(useGuitarStore.getState().userStats.achievements).toContain('first_scale');
  });

  it('does not duplicate an achievement if unlocked twice', () => {
    useGuitarStore.getState().unlockAchievement('first_scale');
    useGuitarStore.getState().unlockAchievement('first_scale');
    const ach = useGuitarStore.getState().userStats.achievements;
    expect(ach.filter((a) => a === 'first_scale')).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Progress — learned scales
// ─────────────────────────────────────────────────────────────────────────────

describe('toggleLearnedScale', () => {
  it('adds a scale key to learnedScales', () => {
    useGuitarStore.getState().toggleLearnedScale('C-major');
    expect(useGuitarStore.getState().learnedScales.has('C-major')).toBe(true);
  });

  it('removes a scale key when toggled twice', () => {
    useGuitarStore.getState().toggleLearnedScale('C-major');
    useGuitarStore.getState().toggleLearnedScale('C-major');
    expect(useGuitarStore.getState().learnedScales.has('C-major')).toBe(false);
  });

  it('awards XP when learning a new scale', () => {
    const xpBefore = useGuitarStore.getState().userStats.xp;
    useGuitarStore.getState().toggleLearnedScale('G-major');
    expect(useGuitarStore.getState().userStats.xp).toBeGreaterThan(xpBefore);
  });

  it('does not double-award XP when un-learning a scale', () => {
    useGuitarStore.getState().toggleLearnedScale('G-major'); // learn
    const xpAfterLearn = useGuitarStore.getState().userStats.xp;
    useGuitarStore.getState().toggleLearnedScale('G-major'); // un-learn
    expect(useGuitarStore.getState().userStats.xp).toBe(xpAfterLearn);
  });
});

describe('isScaleLearned', () => {
  it('returns false before learning a scale', () => {
    expect(useGuitarStore.getState().isScaleLearned('C-major')).toBe(false);
  });

  it('returns true after learning a scale', () => {
    useGuitarStore.getState().toggleLearnedScale('C-major');
    expect(useGuitarStore.getState().isScaleLearned('C-major')).toBe(true);
  });

  it('returns false after un-learning a scale', () => {
    useGuitarStore.getState().toggleLearnedScale('C-major');
    useGuitarStore.getState().toggleLearnedScale('C-major');
    expect(useGuitarStore.getState().isScaleLearned('C-major')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────────

describe('setActiveTab', () => {
  it('sets activeTab to "scales"', () => {
    useGuitarStore.getState().setActiveTab('scales');
    expect(useGuitarStore.getState().activeTab).toBe('scales');
  });

  it('sets activeTab to "ear-training"', () => {
    useGuitarStore.getState().setActiveTab('ear-training');
    expect(useGuitarStore.getState().activeTab).toBe('ear-training');
  });

  it('sets activeTab to "chords"', () => {
    useGuitarStore.getState().setActiveTab('chords');
    expect(useGuitarStore.getState().activeTab).toBe('chords');
  });

  it('sets activeTab to "progress"', () => {
    useGuitarStore.getState().setActiveTab('progress');
    expect(useGuitarStore.getState().activeTab).toBe('progress');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Audio shelf
// ─────────────────────────────────────────────────────────────────────────────

describe('setIsAudioShelfOpen', () => {
  it('sets isAudioShelfOpen to true', () => {
    useGuitarStore.getState().setIsAudioShelfOpen(true);
    expect(useGuitarStore.getState().isAudioShelfOpen).toBe(true);
  });

  it('sets isAudioShelfOpen back to false', () => {
    useGuitarStore.getState().setIsAudioShelfOpen(true);
    useGuitarStore.getState().setIsAudioShelfOpen(false);
    expect(useGuitarStore.getState().isAudioShelfOpen).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ear training
// ─────────────────────────────────────────────────────────────────────────────

describe('setEarTrainingMode', () => {
  it('sets earTrainingMode to "notes"', () => {
    useGuitarStore.getState().setEarTrainingMode('notes');
    expect(useGuitarStore.getState().earTrainingMode).toBe('notes');
  });

  it('sets earTrainingMode to "scales"', () => {
    useGuitarStore.getState().setEarTrainingMode('scales');
    expect(useGuitarStore.getState().earTrainingMode).toBe('scales');
  });
});

describe('setEarTrainingScore', () => {
  it('sets earTrainingScore to 7', () => {
    useGuitarStore.getState().setEarTrainingScore(7);
    expect(useGuitarStore.getState().earTrainingScore).toBe(7);
  });

  it('sets earTrainingScore to 0', () => {
    useGuitarStore.getState().setEarTrainingScore(7);
    useGuitarStore.getState().setEarTrainingScore(0);
    expect(useGuitarStore.getState().earTrainingScore).toBe(0);
  });
});

describe('setEarTrainingTotal', () => {
  it('sets earTrainingTotal', () => {
    useGuitarStore.getState().setEarTrainingTotal(10);
    expect(useGuitarStore.getState().earTrainingTotal).toBe(10);
  });
});

describe('setEarTrainingAnswers', () => {
  it('sets earTrainingAnswers array', () => {
    useGuitarStore.getState().setEarTrainingAnswers(['correct', 'incorrect', 'pending']);
    expect(useGuitarStore.getState().earTrainingAnswers).toEqual(['correct', 'incorrect', 'pending']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Metronome
// ─────────────────────────────────────────────────────────────────────────────

describe('toggleMetronome', () => {
  beforeEach(() => {
    // Ensure metronome starts in a known state (not playing)
    useGuitarStore.getState().setMetronome({ isPlaying: false });
  });

  it('toggles isPlaying from false to true', () => {
    useGuitarStore.getState().toggleMetronome();
    expect(useGuitarStore.getState().metronome.isPlaying).toBe(true);
  });

  it('toggles isPlaying back to false', () => {
    useGuitarStore.getState().toggleMetronome(); // false → true
    useGuitarStore.getState().toggleMetronome(); // true → false
    expect(useGuitarStore.getState().metronome.isPlaying).toBe(false);
  });
});

describe('setMetronome', () => {
  it('partially updates the metronome settings', () => {
    useGuitarStore.getState().setMetronome({ bpm: 120 });
    expect(useGuitarStore.getState().metronome.bpm).toBe(120);
  });

  it('preserves other metronome fields when doing a partial update', () => {
    const originalVolume = useGuitarStore.getState().metronome.volume;
    useGuitarStore.getState().setMetronome({ bpm: 140 });
    expect(useGuitarStore.getState().metronome.volume).toBe(originalVolume);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom scales
// ─────────────────────────────────────────────────────────────────────────────

describe('addCustomScale', () => {
  it('adds a custom scale with auto-generated id and createdAt', () => {
    useGuitarStore.getState().addCustomScale({
      name: 'My Scale',
      intervals: [0, 2, 4, 7, 9],
      degrees: ['1', '2', '3', '5', '6'],
      category: 'custom',
    });
    const scales = useGuitarStore.getState().customScales;
    expect(scales).toHaveLength(1);
    expect(scales[0].name).toBe('My Scale');
    expect(typeof scales[0].id).toBe('string');
    expect(typeof scales[0].createdAt).toBe('number');
  });
});

describe('removeCustomScale', () => {
  it('removes the scale with the given id', () => {
    useGuitarStore.getState().addCustomScale({
      name: 'Temp Scale',
      intervals: [0, 3, 7],
      degrees: ['1', 'b3', '5'],
      category: 'custom',
    });
    const id = useGuitarStore.getState().customScales[0].id;
    useGuitarStore.getState().removeCustomScale(id);
    expect(useGuitarStore.getState().customScales).toHaveLength(0);
  });
});

describe('updateCustomScale', () => {
  it('updates specific fields of a custom scale by id', () => {
    useGuitarStore.getState().addCustomScale({
      name: 'Old Name',
      intervals: [0, 2],
      degrees: ['1', '2'],
      category: 'custom',
    });
    const id = useGuitarStore.getState().customScales[0].id;
    useGuitarStore.getState().updateCustomScale(id, { name: 'New Name' });
    expect(useGuitarStore.getState().customScales[0].name).toBe('New Name');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Miscellaneous actions
// ─────────────────────────────────────────────────────────────────────────────

describe('setPracticeMode', () => {
  it('sets practiceMode to "speed_trainer"', () => {
    useGuitarStore.getState().setPracticeMode('speed_trainer');
    expect(useGuitarStore.getState().practiceMode).toBe('speed_trainer');
  });

  it('sets practiceMode back to "none"', () => {
    useGuitarStore.getState().setPracticeMode('quiz');
    useGuitarStore.getState().setPracticeMode('none');
    expect(useGuitarStore.getState().practiceMode).toBe('none');
  });
});

describe('setActivePanel', () => {
  it('sets activePanel to "tablature"', () => {
    useGuitarStore.getState().setActivePanel('tablature');
    expect(useGuitarStore.getState().activePanel).toBe('tablature');
  });
});

describe('setScaleSearchQuery', () => {
  it('sets scaleSearchQuery', () => {
    useGuitarStore.getState().setScaleSearchQuery('pent');
    expect(useGuitarStore.getState().scaleSearchQuery).toBe('pent');
  });
});

describe('setSelectedCategory', () => {
  it('sets selectedCategory to a category string', () => {
    useGuitarStore.getState().setSelectedCategory('pentatonic');
    expect(useGuitarStore.getState().selectedCategory).toBe('pentatonic');
  });

  it('can be cleared to null', () => {
    useGuitarStore.getState().setSelectedCategory('blues');
    useGuitarStore.getState().setSelectedCategory(null);
    expect(useGuitarStore.getState().selectedCategory).toBeNull();
  });
});

describe('setPlaybackDirection', () => {
  it('sets playbackDirection to "descending"', () => {
    useGuitarStore.getState().setPlaybackDirection('descending');
    expect(useGuitarStore.getState().playbackDirection).toBe('descending');
  });

  it('sets playbackDirection to "both"', () => {
    useGuitarStore.getState().setPlaybackDirection('both');
    expect(useGuitarStore.getState().playbackDirection).toBe('both');
  });
});

describe('setIsPlayingScale', () => {
  it('sets isPlayingScale to true', () => {
    useGuitarStore.getState().setIsPlayingScale(true);
    expect(useGuitarStore.getState().isPlayingScale).toBe(true);
  });
});

describe('setCurrentPlayingNote', () => {
  it('sets currentPlayingNote to an index', () => {
    useGuitarStore.getState().setCurrentPlayingNote(2);
    expect(useGuitarStore.getState().currentPlayingNote).toBe(2);
  });

  it('clears currentPlayingNote to null', () => {
    useGuitarStore.getState().setCurrentPlayingNote(2);
    useGuitarStore.getState().setCurrentPlayingNote(null);
    expect(useGuitarStore.getState().currentPlayingNote).toBeNull();
  });
});

describe('setLastClickedNote', () => {
  it('sets lastClickedNote to a note string', () => {
    useGuitarStore.getState().setLastClickedNote('C#');
    expect(useGuitarStore.getState().lastClickedNote).toBe('C#');
  });
});

describe('setSpeedTrainerBpm', () => {
  it('sets speedTrainerBpm', () => {
    useGuitarStore.getState().setSpeedTrainerBpm(120);
    expect(useGuitarStore.getState().speedTrainerBpm).toBe(120);
  });
});

describe('setSpeedTrainerIncrement', () => {
  it('sets speedTrainerIncrement', () => {
    useGuitarStore.getState().setSpeedTrainerIncrement(10);
    expect(useGuitarStore.getState().speedTrainerIncrement).toBe(10);
  });
});

describe('incrementScalesLearned', () => {
  it('increments totalScalesLearned by 1', () => {
    useGuitarStore.getState().incrementScalesLearned();
    expect(useGuitarStore.getState().userStats.totalScalesLearned).toBe(1);
  });

  it('accumulates correctly over multiple calls', () => {
    useGuitarStore.getState().incrementScalesLearned();
    useGuitarStore.getState().incrementScalesLearned();
    expect(useGuitarStore.getState().userStats.totalScalesLearned).toBe(2);
  });
});
