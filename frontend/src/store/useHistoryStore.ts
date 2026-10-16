/**
 * useHistoryStore.ts
 *
 * Practice history kept in this browser: finished ear-training sessions,
 * detected chords, per-scale attempt counts, and saved Coach plans. This replaces the FastAPI
 * backend, so everything here is local-only and capped so localStorage can't
 * grow without bound.
 *
 * Kept separate from useGuitarStore because it's append-only log data with
 * its own retention rules, not app settings.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Most recent sessions kept. */
export const MAX_SESSIONS = 100;
/** Most recent chord detections kept. */
export const MAX_CHORDS = 200;
/** Most recent Coach plans kept. */
export const MAX_PLANS = 20;

/** One finished ear-training session. */
export interface PracticeSession {
  id: string;
  /** Ear-training mode the session ran in ("intervals", "sequence", ...). */
  mode: string;
  /** learnedScaleKey of the scale in use, e.g. "C-major". */
  scaleKey: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  bpm: number;
  /** 0–1, or null when nothing was answered. */
  accuracy: number | null;
}

/** One chord the detector named. */
export interface ChordRecord {
  id: string;
  chord: string;
  root: string;
  quality: string;
  confidence: number;
  detectedAt: string;
}

/** Running attempt counts for one scale (Scales questions and Sequence notes). */
export interface ScaleAttempts {
  total: number;
  correct: number;
  lastAt: string;
}

/** A practice plan the Coach wrote. */
export interface CoachPlan {
  id: string;
  goal: string;
  difficulty: string;
  createdAt: string;
  markdown: string;
  sources: Array<{ url: string; title: string }>;
}

/** Aggregates over the chord log, for the Progress view. */
export interface ChordStats {
  total: number;
  mostCommon: Array<{ chord: string; count: number }>;
}

interface HistoryState {
  sessions: PracticeSession[];
  chords: ChordRecord[];
  scaleAttempts: Record<string, ScaleAttempts>;
  plans: CoachPlan[];
  /** Saves a finished session. Newest first. */
  logSession: (session: Omit<PracticeSession, 'id' | 'endedAt' | 'durationSeconds'> & { endedAt?: string }) => void;
  /** Saves a detection. Newest first. */
  logChord: (chord: Omit<ChordRecord, 'id' | 'detectedAt'>) => void;
  /** Counts one attempt at a scale. */
  recordScaleAttempt: (scaleKey: string, correct: boolean) => void;
  /** Saves a plan, newest first, and returns its id. */
  savePlan: (plan: Omit<CoachPlan, 'id' | 'createdAt'>) => string;
  deletePlan: (id: string) => void;
  clearHistory: () => void;
}

/** Random id that works outside secure contexts (crypto.randomUUID needs HTTPS). */
function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      sessions: [],
      chords: [],
      scaleAttempts: {},
      plans: [],

      logSession: ({ endedAt, ...session }) =>
        set((state) => {
          const end = endedAt ?? new Date().toISOString();
          const durationSeconds = Math.max(0, Math.round((Date.parse(end) - Date.parse(session.startedAt)) / 1000));
          const entry: PracticeSession = { ...session, id: randomId(), endedAt: end, durationSeconds };
          return { sessions: [entry, ...state.sessions].slice(0, MAX_SESSIONS) };
        }),

      logChord: (chord) =>
        set((state) => ({
          chords: [{ ...chord, id: randomId(), detectedAt: new Date().toISOString() }, ...state.chords].slice(
            0,
            MAX_CHORDS,
          ),
        })),

      recordScaleAttempt: (scaleKey, correct) =>
        set((state) => {
          const prev = state.scaleAttempts[scaleKey] ?? { total: 0, correct: 0, lastAt: '' };
          return {
            scaleAttempts: {
              ...state.scaleAttempts,
              [scaleKey]: {
                total: prev.total + 1,
                correct: prev.correct + (correct ? 1 : 0),
                lastAt: new Date().toISOString(),
              },
            },
          };
        }),

      savePlan: (plan) => {
        const id = randomId();
        set((state) => ({
          plans: [{ ...plan, id, createdAt: new Date().toISOString() }, ...state.plans].slice(0, MAX_PLANS),
        }));
        return id;
      },

      deletePlan: (id) => set((state) => ({ plans: state.plans.filter((p) => p.id !== id) })),

      clearHistory: () => set({ sessions: [], chords: [], scaleAttempts: {}, plans: [] }),
    }),
    {
      name: 'scale-teacher-history',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({ sessions: s.sessions, chords: s.chords, scaleAttempts: s.scaleAttempts, plans: s.plans }),
      // Anything malformed in storage falls back to empty rather than crashing a view
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<HistoryState>;
        return {
          ...current,
          sessions: Array.isArray(p.sessions) ? p.sessions.slice(0, MAX_SESSIONS) : [],
          chords: Array.isArray(p.chords) ? p.chords.slice(0, MAX_CHORDS) : [],
          scaleAttempts: p.scaleAttempts && typeof p.scaleAttempts === 'object' ? p.scaleAttempts : {},
          plans: Array.isArray(p.plans) ? p.plans.slice(0, MAX_PLANS) : [],
        };
      },
    },
  ),
);

/**
 * Totals and the most common chords in the log.
 *
 * @param chords - Chord log, any order.
 * @param top - How many of the most common to return.
 */
export function chordStats(chords: ChordRecord[], top = 5): ChordStats {
  const counts = new Map<string, number>();
  for (const c of chords) counts.set(c.chord, (counts.get(c.chord) ?? 0) + 1);
  const mostCommon = [...counts.entries()]
    .map(([chord, count]) => ({ chord, count }))
    .sort((a, b) => b.count - a.count || a.chord.localeCompare(b.chord))
    .slice(0, top);
  return { total: chords.length, mostCommon };
}
