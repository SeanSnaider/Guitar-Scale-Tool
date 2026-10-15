/**
 * useGuitarStore.ts
 *
 * Central Zustand store for the Guitar Scale Tool application.
 * Manages all global state including scale selection, display options,
 * audio settings, gamification, ear training, and navigation.
 *
 * Persistent state is serialised to localStorage via the `persist`
 * middleware.  Transient UI state (e.g. isAudioShelfOpen) is excluded
 * from persistence so it always starts fresh on page load.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { learnedScaleKey, localDayKey, localDayKeyOffset, parseLearnedScaleKey } from './progress';
import { TUNINGS } from '../data/musicTheory';

/** Fretboard display modes — how notes are labelled on the fretboard. */
export type DisplayMode = 'dots' | 'notes' | 'intervals' | 'patterns';

export type PositionSystem = 'caged' | '3nps';
export type PlaybackDirection = 'ascending' | 'descending' | 'both';

/** A guitar tuning definition: string names as chromatic indices (low → high). */
export interface Tuning {
  name: string;
  /** Chromatic index (0 = C) for each string, low to high. */
  notes: number[];
  /** Total number of strings. */
  strings: number;
}

/** A user-defined custom scale stored alongside the built-in scale library. */
export interface CustomScale {
  id: string;
  name: string;
  intervals: number[];
  degrees: string[];
  category: 'custom';
  createdAt: number;
}

/** Definition of a gamification achievement. */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  requirement: {
    type: 'scales_learned' | 'streak_days' | 'practice_minutes' | 'positions_mastered';
    count: number;
  };
}

/** Persisted player statistics used for the progress dashboard. */
export interface UserStats {
  totalScalesLearned: number;
  currentStreak: number;
  longestStreak: number;
  totalPracticeMinutes: number;
  lastPracticeDate: string | null;
  xp: number;
  level: number;
  /** IDs of unlocked achievements. */
  achievements: string[];
}

/** Global metronome configuration. */
export interface MetronomeSettings {
  bpm: number;
  /** [beats, noteValue] — e.g. [4, 4] for common time. */
  timeSignature: [number, number];
  isPlaying: boolean;
  accentFirst: boolean;
  volume: number;
}

/** Audio engine parameter settings. */
export interface AudioSettings {
  masterVolume: number;
  noteVolume: number;
  metronomeVolume: number;
  /** Note sustain in seconds. */
  sustainLength: number;
  attackTime: number;
  releaseTime: number;
}

/** A single interval highlight toggle entry. */
export interface HighlightedInterval {
  /** Semitones from root. */
  interval: number;
  enabled: boolean;
}

/**
 * GuitarState
 *
 * Full shape of the global Zustand store.  All state slices and their
 * corresponding setter / action functions are declared here.
 */
export interface GuitarState {
  // ---- Scale Selection ----
  selectedRoot: string;
  setSelectedRoot: (root: string) => void;
  selectedScale: string;
  setSelectedScale: (scale: string) => void;

  // ---- Display Options ----
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  showNonScaleNotes: boolean;
  setShowNonScaleNotes: (show: boolean) => void;

  // ---- Position System ----
  positionSystem: PositionSystem;
  setPositionSystem: (system: PositionSystem) => void;
  selectedPosition: number | null;
  setSelectedPosition: (position: number | null) => void;

  // ---- Fretboard Settings ----
  numFrets: number;
  setNumFrets: (frets: number) => void;
  currentTuning: Tuning;
  setCurrentTuning: (tuning: Tuning) => void;

  // ---- Interval Highlighting ----
  /** Semitone values of intervals that are currently highlighted. */
  highlightedIntervals: number[];
  setHighlightedIntervals: (intervals: number[]) => void;
  toggleInterval: (interval: number) => void;

  // ---- Audio ----
  audioSettings: AudioSettings;
  setAudioSettings: (settings: Partial<AudioSettings>) => void;
  isPlayingScale: boolean;
  setIsPlayingScale: (playing: boolean) => void;
  playbackDirection: PlaybackDirection;
  setPlaybackDirection: (direction: PlaybackDirection) => void;
  /** Index in the current scale sequence that is actively sounding. */
  currentPlayingNote: number | null;
  setCurrentPlayingNote: (note: number | null) => void;

  // ---- Metronome ----
  metronome: MetronomeSettings;
  setMetronome: (settings: Partial<MetronomeSettings>) => void;
  toggleMetronome: () => void;

  // ---- Custom Scales ----
  customScales: CustomScale[];
  addCustomScale: (scale: Omit<CustomScale, 'id' | 'createdAt'>) => void;
  removeCustomScale: (id: string) => void;
  updateCustomScale: (id: string, updates: Partial<CustomScale>) => void;

  // ---- Gamification ----
  userStats: UserStats;
  addXP: (amount: number) => void;
  /**
   * Records practice today (local calendar): continues the streak if the last
   * practice was yesterday, starts a new one otherwise. Idempotent per day.
   */
  recordPracticeDay: () => void;
  /** @deprecated Alias of recordPracticeDay. */
  incrementStreak: () => void;
  resetStreak: () => void;
  unlockAchievement: (achievementId: string) => void;
  addPracticeMinutes: (minutes: number) => void;
  incrementScalesLearned: () => void;

  // ---- Progress ----
  /** Keys from learnedScaleKey(root, scaleKey) ("C-major"); see store/progress.ts. */
  learnedScales: Set<string>;
  /** Adds a learned scale. Idempotent: XP and the counter only move the first time. */
  markScaleLearned: (key: string) => void;
  /** Removes a learned scale (no XP change). */
  unmarkScaleLearned: (key: string) => void;
  /** @deprecated Prefer markScaleLearned / unmarkScaleLearned. */
  toggleLearnedScale: (key: string) => void;
  isScaleLearned: (key: string) => boolean;
  /**
   * Sequence-mode mastery: consecutive correct full runs at >= 120 BPM per
   * learned-scale key. Tracked locally so mastery works without the server.
   */
  sequenceMastery: Record<string, number>;
  setSequenceMastery: (key: string, consecutiveCorrect: number) => void;

  // ---- Practice Mode ----
  practiceMode: 'none' | 'speed_trainer' | 'quiz';
  setPracticeMode: (mode: 'none' | 'speed_trainer' | 'quiz') => void;
  speedTrainerBpm: number;
  setSpeedTrainerBpm: (bpm: number) => void;
  speedTrainerIncrement: number;
  setSpeedTrainerIncrement: (increment: number) => void;

  // ---- UI State ----
  activePanel: 'fretboard' | 'tablature' | 'chords' | 'composition' | 'practice';
  setActivePanel: (panel: 'fretboard' | 'tablature' | 'chords' | 'composition' | 'practice') => void;

  // ---- Scale Browser Navigation ----
  scaleSearchQuery: string;
  setScaleSearchQuery: (query: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;

  // ---- Sequence Exercise Wiring ----
  lastClickedNote: string | null;
  setLastClickedNote: (note: string | null) => void;

  // ---- Ear Training ----
  earTrainingMode: 'intervals' | 'notes' | 'scales';
  setEarTrainingMode: (mode: 'intervals' | 'notes' | 'scales') => void;
  earTrainingScore: number;
  earTrainingTotal: number;
  setEarTrainingScore: (score: number) => void;
  setEarTrainingTotal: (total: number) => void;
  earTrainingAnswers: Array<'correct' | 'incorrect' | 'pending'>;
  setEarTrainingAnswers: (answers: Array<'correct' | 'incorrect' | 'pending'>) => void;

  // ---- Navigation ----
  /**
   * Current view. The app shows five destinations: 'fretboard' (Practice),
   * 'ear-training', 'chordai', 'library' and 'progress'. 'scales' and
   * 'chords' open the Library on that section, and 'reference' opens
   * Practice (its content lives in the Practice side column). The legacy
   * ids stay valid so persisted state from older versions still loads.
   */
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  // ---- Sound settings popover ----
  /** Whether the transport bar's sound settings panel is open. */
  isAudioShelfOpen: boolean;
  setIsAudioShelfOpen: (open: boolean) => void;

  // ---- Playback position (transient) ----
  /**
   * The fretboard position sounding right now during scale playback, so the
   * fretboard can draw the playing ring in step with the tablature. Uses the
   * store's string order (0 = lowest string). Null when nothing is playing.
   */
  playingPosition: { string: number; fret: number } | null;
  /** Index into the current tab pattern of the sounding note; -1 when idle. */
  playingIndex: number;
  setPlaying: (index: number, pos: { string: number; fret: number } | null) => void;
}

export type TabId =
  | 'fretboard'
  | 'library'
  | 'scales'
  | 'chords'
  | 'ear-training'
  | 'reference'
  | 'progress'
  | 'chordai';

// ---- Default values ----

const DEFAULT_TUNING: Tuning = {
  name: 'Standard',
  notes: [4, 9, 2, 7, 11, 4], // E A D G B E
  strings: 6,
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.7,
  noteVolume: 0.8,
  metronomeVolume: 0.6,
  sustainLength: 1.5,
  attackTime: 0.02,
  releaseTime: 0.3,
};

const DEFAULT_METRONOME: MetronomeSettings = {
  bpm: 80,
  timeSignature: [4, 4],
  isPlaying: false,
  accentFirst: true,
  volume: 0.6,
};

const DEFAULT_USER_STATS: UserStats = {
  totalScalesLearned: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalPracticeMinutes: 0,
  lastPracticeDate: null,
  xp: 0,
  level: 1,
  achievements: [],
};

/** XP required per level (linear). */
const XP_PER_LEVEL = 100;

/**
 * useGuitarStore
 *
 * The single global store for the entire Guitar Scale Tool UI.
 * Access individual slices via the selector hooks exported below
 * to minimise unnecessary re-renders.
 */
export const useGuitarStore = create<GuitarState>()(
  persist(
    (set, get) => ({
      // ---- Scale Selection ----
      selectedRoot: 'C',
      setSelectedRoot: (root) => set({ selectedRoot: root }),
      selectedScale: 'major',
      setSelectedScale: (scale) => set({ selectedScale: scale }),

      // ---- Display Options ----
      displayMode: 'notes',
      setDisplayMode: (mode) => set({ displayMode: mode }),
      // Off by default: the first screen shows the scale, not a chromatic chart
      showNonScaleNotes: false,
      setShowNonScaleNotes: (show) => set({ showNonScaleNotes: show }),

      // ---- Position System ----
      positionSystem: 'caged',
      setPositionSystem: (system) => set({ positionSystem: system }),
      selectedPosition: 1,
      setSelectedPosition: (position) => set({ selectedPosition: position }),

      // ---- Fretboard Settings ----
      numFrets: 24,
      setNumFrets: (frets) => set({ numFrets: Math.min(Math.max(frets, 12), 24) }),
      currentTuning: DEFAULT_TUNING,
      setCurrentTuning: (tuning) => set({ currentTuning: tuning }),

      // ---- Interval Highlighting ----
      highlightedIntervals: [],
      setHighlightedIntervals: (intervals) => set({ highlightedIntervals: intervals }),
      toggleInterval: (interval) => {
        const current = get().highlightedIntervals;
        if (current.includes(interval)) {
          set({ highlightedIntervals: current.filter((i) => i !== interval) });
        } else {
          set({ highlightedIntervals: [...current, interval] });
        }
      },

      // ---- Audio ----
      audioSettings: DEFAULT_AUDIO_SETTINGS,
      setAudioSettings: (settings) =>
        set((state) => ({ audioSettings: { ...state.audioSettings, ...settings } })),
      isPlayingScale: false,
      setIsPlayingScale: (playing) => set({ isPlayingScale: playing }),
      playbackDirection: 'ascending',
      setPlaybackDirection: (direction) => set({ playbackDirection: direction }),
      currentPlayingNote: null,
      setCurrentPlayingNote: (note) => set({ currentPlayingNote: note }),

      // ---- Metronome ----
      metronome: DEFAULT_METRONOME,
      setMetronome: (settings) =>
        set((state) => ({ metronome: { ...state.metronome, ...settings } })),
      toggleMetronome: () =>
        set((state) => ({
          metronome: { ...state.metronome, isPlaying: !state.metronome.isPlaying },
        })),

      // ---- Custom Scales ----
      customScales: [],
      addCustomScale: (scale) =>
        set((state) => ({
          customScales: [
            ...state.customScales,
            {
              ...scale,
              id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              createdAt: Date.now(),
            },
          ],
        })),
      removeCustomScale: (id) =>
        set((state) => ({
          customScales: state.customScales.filter((s) => s.id !== id),
        })),
      updateCustomScale: (id, updates) =>
        set((state) => ({
          customScales: state.customScales.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      // ---- Gamification ----
      userStats: DEFAULT_USER_STATS,
      addXP: (amount) =>
        set((state) => {
          const newXP = state.userStats.xp + amount;
          const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;
          return { userStats: { ...state.userStats, xp: newXP, level: newLevel } };
        }),
      recordPracticeDay: () =>
        set((state) => {
          const today = localDayKey();
          const last = state.userStats.lastPracticeDate;
          if (last === today) return state;
          const newStreak = last === localDayKeyOffset(1) ? state.userStats.currentStreak + 1 : 1;
          return {
            userStats: {
              ...state.userStats,
              currentStreak: newStreak,
              longestStreak: Math.max(newStreak, state.userStats.longestStreak),
              lastPracticeDate: today,
            },
          };
        }),
      incrementStreak: () => get().recordPracticeDay(),
      resetStreak: () =>
        set((state) => ({
          userStats: { ...state.userStats, currentStreak: 0 },
        })),
      unlockAchievement: (achievementId) =>
        set((state) => {
          if (state.userStats.achievements.includes(achievementId)) return state;
          return {
            userStats: {
              ...state.userStats,
              achievements: [...state.userStats.achievements, achievementId],
            },
          };
        }),
      addPracticeMinutes: (minutes) =>
        set((state) => ({
          userStats: {
            ...state.userStats,
            totalPracticeMinutes: state.userStats.totalPracticeMinutes + minutes,
          },
        })),
      incrementScalesLearned: () =>
        set((state) => ({
          userStats: {
            ...state.userStats,
            totalScalesLearned: state.userStats.totalScalesLearned + 1,
          },
        })),

      // ---- Progress ----
      learnedScales: new Set<string>(),
      markScaleLearned: (key) => {
        if (get().learnedScales.has(key)) return;
        set((state) => {
          const learned = new Set(state.learnedScales);
          learned.add(key);
          return {
            learnedScales: learned,
            userStats: { ...state.userStats, totalScalesLearned: learned.size },
          };
        });
        get().addXP(10);
      },
      unmarkScaleLearned: (key) =>
        set((state) => {
          if (!state.learnedScales.has(key)) return state;
          const learned = new Set(state.learnedScales);
          learned.delete(key);
          return {
            learnedScales: learned,
            userStats: { ...state.userStats, totalScalesLearned: learned.size },
          };
        }),
      toggleLearnedScale: (key) =>
        get().learnedScales.has(key) ? get().unmarkScaleLearned(key) : get().markScaleLearned(key),
      isScaleLearned: (key) => get().learnedScales.has(key),
      sequenceMastery: {},
      setSequenceMastery: (key, consecutiveCorrect) =>
        set((state) => ({ sequenceMastery: { ...state.sequenceMastery, [key]: consecutiveCorrect } })),

      // ---- Practice Mode ----
      practiceMode: 'none',
      setPracticeMode: (mode) => set({ practiceMode: mode }),
      speedTrainerBpm: 60,
      setSpeedTrainerBpm: (bpm) => set({ speedTrainerBpm: bpm }),
      speedTrainerIncrement: 5,
      setSpeedTrainerIncrement: (increment) => set({ speedTrainerIncrement: increment }),

      // ---- UI State ----
      activePanel: 'fretboard',
      setActivePanel: (panel) => set({ activePanel: panel }),

      // ---- Scale Browser Navigation ----
      scaleSearchQuery: '',
      setScaleSearchQuery: (query) => set({ scaleSearchQuery: query }),
      selectedCategory: null,
      setSelectedCategory: (category) => set({ selectedCategory: category }),

      // ---- Sequence Exercise Wiring ----
      lastClickedNote: null,
      setLastClickedNote: (note) => set({ lastClickedNote: note }),

      // ---- Ear Training ----
      earTrainingMode: 'intervals',
      setEarTrainingMode: (mode) => set({ earTrainingMode: mode }),
      earTrainingScore: 0,
      earTrainingTotal: 0,
      setEarTrainingScore: (score) => set({ earTrainingScore: score }),
      setEarTrainingTotal: (total) => set({ earTrainingTotal: total }),
      earTrainingAnswers: [],
      setEarTrainingAnswers: (answers) => set({ earTrainingAnswers: answers }),

      // ---- Navigation ----
      activeTab: 'fretboard',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // ---- Sound settings popover ----
      isAudioShelfOpen: false,
      setIsAudioShelfOpen: (open) => set({ isAudioShelfOpen: open }),

      // ---- Playback position ----
      playingPosition: null,
      playingIndex: -1,
      setPlaying: (index, pos) => set({ playingIndex: index, playingPosition: pos }),
    }),
    {
      name: 'guitar-scale-tool-storage',
      storage: createJSONStorage(() => localStorage),
      /**
       * Only persist the subset of state that should survive a page reload.
       * Transient UI state (isAudioShelfOpen, earTraining session data) is
       * intentionally excluded so it always resets on load.
       */
      partialize: (state) => ({
        selectedRoot: state.selectedRoot,
        selectedScale: state.selectedScale,
        displayMode: state.displayMode,
        showNonScaleNotes: state.showNonScaleNotes,
        positionSystem: state.positionSystem,
        numFrets: state.numFrets,
        currentTuning: state.currentTuning,
        audioSettings: state.audioSettings,
        // Never persist the playing state — always start stopped
        metronome: { ...state.metronome, isPlaying: false },
        customScales: state.customScales,
        userStats: state.userStats,
        // Convert Set → Array for JSON serialisation
        learnedScales: Array.from(state.learnedScales),
        speedTrainerBpm: state.speedTrainerBpm,
        speedTrainerIncrement: state.speedTrainerIncrement,
        activeTab: state.activeTab,
        earTrainingMode: state.earTrainingMode,
        sequenceMastery: state.sequenceMastery,
      }),
      version: 1,
      // v0 (no version) -> v1: nothing to transform; mergePersisted() below
      // validates and normalises every field on every load.
      migrate: (persisted) => persisted as GuitarState,
      merge: (persisted, current) => mergePersisted(persisted, current),
    }
  )
);

// ========================================
// Persistence merge
// ========================================

/**
 * Merges persisted state over the defaults safely:
 * - nested settings objects are deep-merged, so fields added in later
 *   versions get their defaults instead of becoming undefined (NaN gains);
 * - learnedScales always becomes a Set (JSON gives an array, or {} for an
 *   old serialised Set), and legacy "root-scale-position" keys are folded
 *   to "root-scale";
 * - numFrets is clamped to the slider range and the tuning is checked
 *   against the known tunings (notes length must match the string count).
 */
function mergePersisted(persisted: unknown, current: GuitarState): GuitarState {
  if (!persisted || typeof persisted !== 'object') return current;
  const p = persisted as Partial<GuitarState> & { learnedScales?: unknown };

  const learnedRaw = Array.isArray(p.learnedScales) ? (p.learnedScales as unknown[]) : [];
  const learned = new Set<string>();
  for (const k of learnedRaw) {
    if (typeof k !== 'string') continue;
    const parsed = parseLearnedScaleKey(k);
    if (parsed) learned.add(learnedScaleKey(parsed.root, parsed.scaleKey));
  }

  const tuning = p.currentTuning;
  const validTuning =
    tuning &&
    Array.isArray(tuning.notes) &&
    tuning.notes.length === tuning.strings &&
    Object.values(TUNINGS).some((t) => t.notes.join(',') === tuning.notes.join(','));

  const numFrets = typeof p.numFrets === 'number' ? Math.min(24, Math.max(12, Math.round(p.numFrets))) : current.numFrets;
  const userStats = { ...current.userStats, ...(p.userStats ?? {}) };

  return {
    ...current,
    ...p,
    audioSettings: { ...current.audioSettings, ...(p.audioSettings ?? {}) },
    metronome: { ...current.metronome, ...(p.metronome ?? {}), isPlaying: false },
    userStats: { ...userStats, totalScalesLearned: learned.size },
    learnedScales: learned,
    sequenceMastery: { ...(p.sequenceMastery ?? {}) },
    currentTuning: validTuning ? (tuning as GuitarState['currentTuning']) : current.currentTuning,
    numFrets,
  };
}
