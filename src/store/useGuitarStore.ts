import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';
export type DisplayMode = 'dots' | 'notes' | 'intervals';
export type PositionSystem = 'caged' | '3nps';
export type PlaybackDirection = 'ascending' | 'descending' | 'both';

export interface Tuning {
  name: string;
  notes: number[]; // Index into ALL_NOTES for each string (low to high)
  strings: number; // Number of strings
}

export interface CustomScale {
  id: string;
  name: string;
  intervals: number[];
  degrees: string[];
  category: 'custom';
  createdAt: number;
}

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

export interface UserStats {
  totalScalesLearned: number;
  currentStreak: number;
  longestStreak: number;
  totalPracticeMinutes: number;
  lastPracticeDate: string | null;
  xp: number;
  level: number;
  achievements: string[]; // Achievement IDs
}

export interface MetronomeSettings {
  bpm: number;
  timeSignature: [number, number]; // [beats, noteValue] e.g., [4, 4] for 4/4
  isPlaying: boolean;
  accentFirst: boolean;
  volume: number;
}

export interface AudioSettings {
  masterVolume: number;
  noteVolume: number;
  metronomeVolume: number;
  sustainLength: number; // seconds
  attackTime: number;
  releaseTime: number;
}

export interface HighlightedInterval {
  interval: number; // semitones from root
  enabled: boolean;
}

export interface GuitarState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Scale Selection
  selectedRoot: string;
  setSelectedRoot: (root: string) => void;
  selectedScale: string;
  setSelectedScale: (scale: string) => void;

  // Display Options
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  showNonScaleNotes: boolean;
  setShowNonScaleNotes: (show: boolean) => void;

  // Position System
  positionSystem: PositionSystem;
  setPositionSystem: (system: PositionSystem) => void;
  selectedPosition: number | null;
  setSelectedPosition: (position: number | null) => void;

  // Fretboard Settings
  numFrets: number;
  setNumFrets: (frets: number) => void;
  currentTuning: Tuning;
  setCurrentTuning: (tuning: Tuning) => void;

  // Interval Highlighting
  highlightedIntervals: number[]; // Array of interval semitones to highlight
  setHighlightedIntervals: (intervals: number[]) => void;
  toggleInterval: (interval: number) => void;

  // Audio
  audioSettings: AudioSettings;
  setAudioSettings: (settings: Partial<AudioSettings>) => void;
  isPlayingScale: boolean;
  setIsPlayingScale: (playing: boolean) => void;
  playbackDirection: PlaybackDirection;
  setPlaybackDirection: (direction: PlaybackDirection) => void;
  currentPlayingNote: number | null; // Index in scale being played
  setCurrentPlayingNote: (note: number | null) => void;

  // Metronome
  metronome: MetronomeSettings;
  setMetronome: (settings: Partial<MetronomeSettings>) => void;
  toggleMetronome: () => void;

  // Custom Scales
  customScales: CustomScale[];
  addCustomScale: (scale: Omit<CustomScale, 'id' | 'createdAt'>) => void;
  removeCustomScale: (id: string) => void;
  updateCustomScale: (id: string, updates: Partial<CustomScale>) => void;

  // Gamification
  userStats: UserStats;
  addXP: (amount: number) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
  unlockAchievement: (achievementId: string) => void;
  addPracticeMinutes: (minutes: number) => void;
  incrementScalesLearned: () => void;

  // Progress
  learnedScales: Set<string>; // Format: "root-scale-position"
  toggleLearnedScale: (key: string) => void;
  isScaleLearned: (key: string) => boolean;

  // Practice Mode
  practiceMode: 'none' | 'speed_trainer' | 'quiz';
  setPracticeMode: (mode: 'none' | 'speed_trainer' | 'quiz') => void;
  speedTrainerBpm: number;
  setSpeedTrainerBpm: (bpm: number) => void;
  speedTrainerIncrement: number;
  setSpeedTrainerIncrement: (increment: number) => void;

  // UI State
  isBackendConnected: boolean;
  setIsBackendConnected: (connected: boolean) => void;
  activePanel: 'fretboard' | 'tablature' | 'chords' | 'composition' | 'practice';
  setActivePanel: (panel: 'fretboard' | 'tablature' | 'chords' | 'composition' | 'practice') => void;

  // Navigation
  scaleSearchQuery: string;
  setScaleSearchQuery: (query: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
}

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

// XP required for each level (cumulative)
const XP_PER_LEVEL = 100;

export const useGuitarStore = create<GuitarState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Scale Selection
      selectedRoot: 'C',
      setSelectedRoot: (root) => set({ selectedRoot: root }),
      selectedScale: 'major',
      setSelectedScale: (scale) => set({ selectedScale: scale }),

      // Display Options
      displayMode: 'notes',
      setDisplayMode: (mode) => set({ displayMode: mode }),
      showNonScaleNotes: true,
      setShowNonScaleNotes: (show) => set({ showNonScaleNotes: show }),

      // Position System
      positionSystem: 'caged',
      setPositionSystem: (system) => set({ positionSystem: system }),
      selectedPosition: 1,
      setSelectedPosition: (position) => set({ selectedPosition: position }),

      // Fretboard Settings
      numFrets: 24,
      setNumFrets: (frets) => set({ numFrets: Math.min(Math.max(frets, 12), 24) }),
      currentTuning: DEFAULT_TUNING,
      setCurrentTuning: (tuning) => set({ currentTuning: tuning }),

      // Interval Highlighting
      highlightedIntervals: [],
      setHighlightedIntervals: (intervals) => set({ highlightedIntervals: intervals }),
      toggleInterval: (interval) => {
        const current = get().highlightedIntervals;
        if (current.includes(interval)) {
          set({ highlightedIntervals: current.filter(i => i !== interval) });
        } else {
          set({ highlightedIntervals: [...current, interval] });
        }
      },

      // Audio
      audioSettings: DEFAULT_AUDIO_SETTINGS,
      setAudioSettings: (settings) => set((state) => ({
        audioSettings: { ...state.audioSettings, ...settings }
      })),
      isPlayingScale: false,
      setIsPlayingScale: (playing) => set({ isPlayingScale: playing }),
      playbackDirection: 'ascending',
      setPlaybackDirection: (direction) => set({ playbackDirection: direction }),
      currentPlayingNote: null,
      setCurrentPlayingNote: (note) => set({ currentPlayingNote: note }),

      // Metronome
      metronome: DEFAULT_METRONOME,
      setMetronome: (settings) => set((state) => ({
        metronome: { ...state.metronome, ...settings }
      })),
      toggleMetronome: () => set((state) => ({
        metronome: { ...state.metronome, isPlaying: !state.metronome.isPlaying }
      })),

      // Custom Scales
      customScales: [],
      addCustomScale: (scale) => set((state) => ({
        customScales: [
          ...state.customScales,
          {
            ...scale,
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: Date.now(),
          }
        ]
      })),
      removeCustomScale: (id) => set((state) => ({
        customScales: state.customScales.filter(s => s.id !== id)
      })),
      updateCustomScale: (id, updates) => set((state) => ({
        customScales: state.customScales.map(s =>
          s.id === id ? { ...s, ...updates } : s
        )
      })),

      // Gamification
      userStats: DEFAULT_USER_STATS,
      addXP: (amount) => set((state) => {
        const newXP = state.userStats.xp + amount;
        const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;
        return {
          userStats: {
            ...state.userStats,
            xp: newXP,
            level: newLevel,
          }
        };
      }),
      incrementStreak: () => set((state) => {
        const today = new Date().toISOString().split('T')[0];
        const lastDate = state.userStats.lastPracticeDate;

        // Check if this is a consecutive day
        let newStreak = state.userStats.currentStreak;
        if (lastDate) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (lastDate === yesterdayStr) {
            newStreak += 1;
          } else if (lastDate !== today) {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }

        return {
          userStats: {
            ...state.userStats,
            currentStreak: newStreak,
            longestStreak: Math.max(newStreak, state.userStats.longestStreak),
            lastPracticeDate: today,
          }
        };
      }),
      resetStreak: () => set((state) => ({
        userStats: { ...state.userStats, currentStreak: 0 }
      })),
      unlockAchievement: (achievementId) => set((state) => {
        if (state.userStats.achievements.includes(achievementId)) return state;
        return {
          userStats: {
            ...state.userStats,
            achievements: [...state.userStats.achievements, achievementId],
          }
        };
      }),
      addPracticeMinutes: (minutes) => set((state) => ({
        userStats: {
          ...state.userStats,
          totalPracticeMinutes: state.userStats.totalPracticeMinutes + minutes,
        }
      })),
      incrementScalesLearned: () => set((state) => ({
        userStats: {
          ...state.userStats,
          totalScalesLearned: state.userStats.totalScalesLearned + 1,
        }
      })),

      // Progress
      learnedScales: new Set<string>(),
      toggleLearnedScale: (key) => set((state) => {
        const newSet = new Set(state.learnedScales);
        if (newSet.has(key)) {
          newSet.delete(key);
        } else {
          newSet.add(key);
          // Award XP for learning a new scale
          get().addXP(10);
          get().incrementScalesLearned();
        }
        return { learnedScales: newSet };
      }),
      isScaleLearned: (key) => get().learnedScales.has(key),

      // Practice Mode
      practiceMode: 'none',
      setPracticeMode: (mode) => set({ practiceMode: mode }),
      speedTrainerBpm: 60,
      setSpeedTrainerBpm: (bpm) => set({ speedTrainerBpm: bpm }),
      speedTrainerIncrement: 5,
      setSpeedTrainerIncrement: (increment) => set({ speedTrainerIncrement: increment }),

      // UI State
      isBackendConnected: true,
      setIsBackendConnected: (connected) => set({ isBackendConnected: connected }),
      activePanel: 'fretboard',
      setActivePanel: (panel) => set({ activePanel: panel }),

      // Navigation
      scaleSearchQuery: '',
      setScaleSearchQuery: (query) => set({ scaleSearchQuery: query }),
      selectedCategory: null,
      setSelectedCategory: (category) => set({ selectedCategory: category }),
    }),
    {
      name: 'guitar-scale-tool-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these values
        theme: state.theme,
        selectedRoot: state.selectedRoot,
        selectedScale: state.selectedScale,
        displayMode: state.displayMode,
        showNonScaleNotes: state.showNonScaleNotes,
        positionSystem: state.positionSystem,
        numFrets: state.numFrets,
        currentTuning: state.currentTuning,
        audioSettings: state.audioSettings,
        metronome: { ...state.metronome, isPlaying: false }, // Don't persist playing state
        customScales: state.customScales,
        userStats: state.userStats,
        learnedScales: Array.from(state.learnedScales), // Convert Set to Array for JSON
        speedTrainerBpm: state.speedTrainerBpm,
        speedTrainerIncrement: state.speedTrainerIncrement,
      }),
      onRehydrateStorage: () => (state) => {
        // Convert learnedScales back to Set after rehydration
        if (state && Array.isArray(state.learnedScales)) {
          state.learnedScales = new Set(state.learnedScales as unknown as string[]);
        }
      },
    }
  )
);

export const useTheme = () => useGuitarStore((state) => state.theme);
export const useSelectedScale = () => useGuitarStore((state) => ({
  root: state.selectedRoot,
  scale: state.selectedScale,
}));
export const useDisplayOptions = () => useGuitarStore((state) => ({
  displayMode: state.displayMode,
  showNonScaleNotes: state.showNonScaleNotes,
}));
export const useMetronome = () => useGuitarStore((state) => state.metronome);
export const useUserStats = () => useGuitarStore((state) => state.userStats);
