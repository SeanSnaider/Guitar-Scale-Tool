/// <reference types="vite/client" />
/**
 * api.ts
 *
 * Typed HTTP client for the Guitar Learning Tool FastAPI backend.
 *
 * All requests include an `X-Session-ID` header derived from a UUID
 * stored in localStorage. This identifies the "user" without requiring
 * a full auth system.
 *
 * Base URL is read from VITE_API_URL (defaults to http://localhost:8000).
 */

// ─── Session Identity ─────────────────────────────────────────────────────────

const SESSION_KEY = 'guitar-tool-session-id';

/**
 * Returns the persistent session ID, creating one if it doesn't exist yet.
 */
function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const SESSION_ID = getOrCreateSessionId();

// ─── Base URL ─────────────────────────────────────────────────────────────────

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { total: number; page: number; limit: number };
  error?: string;
}

export interface PracticeSession {
  id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  scales_practiced: string[];
  bpm: number;
  accuracy: number | null;
}

export interface ScaleAttempt {
  correct: boolean;
  bpm: number;
  attempted_at: string;
  practice_session_id: string | null;
}

export interface ScaleMastery {
  id: string;
  scale_key: string;
  attempts: ScaleAttempt[];
  consecutive_correct: number;
  is_learned: boolean;
  learned_at: string | null;
  total_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface ScaleAttemptResult {
  mastery: ScaleMastery;
  just_learned: boolean;
}

export interface ChordRecord {
  id: string;
  chord: string;
  confidence: number;
  root: string;
  quality: string;
  detected_at: string;
  practice_session_id: string | null;
}

export interface ChordStats {
  most_common: Array<{ chord: string; count: number }>;
  detection_by_quality: Array<{ quality: string; count: number; avg_confidence: number }>;
  total_detections: number;
}

export interface BackendUserStats {
  total_scales_learned: number;
  current_streak: number;
  longest_streak: number;
  total_practice_minutes: number;
  last_practice_date: string | null;
  xp: number;
  level: number;
  achievements: string[];
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': SESSION_ID,
      ...options.headers,
    },
  });

  const data = await response.json() as T;

  if (!response.ok) {
    const errData = data as { error?: string };
    throw new Error(errData.error ?? `API error: ${response.status}`);
  }

  return data;
}

// ─── Practice Sessions ────────────────────────────────────────────────────────

/**
 * Starts a new practice session on the backend.
 *
 * @param scalesPracticed - List of scale keys being practiced (e.g. ["C-major"]).
 * @param bpm - Current metronome BPM.
 * @returns The created session document.
 */
export async function startSession(
  scalesPracticed: string[] = [],
  bpm = 120,
): Promise<PracticeSession> {
  const res = await request<ApiResponse<PracticeSession>>('/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ scales_practiced: scalesPracticed, bpm }),
  });
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to start session');
  return res.data;
}

/**
 * Ends an existing practice session and computes duration.
 *
 * @param practiceSessionId - The session's `id` field (not session_id).
 * @param accuracy - Optional 0–1 accuracy score for the session.
 * @returns The updated session document.
 */
export async function endSession(
  practiceSessionId: string,
  accuracy?: number,
): Promise<PracticeSession> {
  const res = await request<ApiResponse<PracticeSession>>(
    `/sessions/${practiceSessionId}/end`,
    {
      method: 'POST',
      body: JSON.stringify({ accuracy: accuracy ?? null }),
    },
  );
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to end session');
  return res.data;
}

/**
 * Lists practice sessions, most recent first.
 *
 * @param page - 1-based page number.
 * @param limit - Items per page.
 */
export async function listSessions(
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<PracticeSession>> {
  return request<PaginatedResponse<PracticeSession>>(
    `/sessions?page=${page}&limit=${limit}`,
  );
}

// ─── Scale Mastery ────────────────────────────────────────────────────────────

/**
 * Records a scale practice attempt.
 *
 * The backend applies the mastery rule: 3 consecutive correct attempts
 * at BPM >= 120 marks the scale as learned.
 *
 * @param scaleKey - Scale identifier, e.g. "C-major" or "C-major-1".
 * @param bpm - BPM at which the scale was attempted.
 * @param correct - Whether the scale was played correctly.
 * @param practiceSessionId - ID of the current practice session, if any.
 * @returns The updated mastery state and whether this attempt just earned "learned".
 */
export async function recordScaleAttempt(
  scaleKey: string,
  bpm: number,
  correct: boolean,
  practiceSessionId?: string,
): Promise<ScaleAttemptResult> {
  const res = await request<ApiResponse<ScaleAttemptResult>>('/scales/attempt', {
    method: 'POST',
    body: JSON.stringify({
      scale_key: scaleKey,
      bpm,
      correct,
      practice_session_id: practiceSessionId ?? null,
    }),
  });
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to record attempt');
  return res.data;
}

/**
 * Returns mastery status for all scales the user has practiced.
 */
export async function getAllMastery(): Promise<ScaleMastery[]> {
  const res = await request<ApiResponse<ScaleMastery[]>>('/scales/mastery');
  if (!res.success) throw new Error(res.error ?? 'Failed to fetch mastery');
  return res.data ?? [];
}

/**
 * Returns only the scales the user has fully learned.
 */
export async function getLearnedScales(): Promise<ScaleMastery[]> {
  const res = await request<ApiResponse<ScaleMastery[]>>('/scales/learned');
  if (!res.success) throw new Error(res.error ?? 'Failed to fetch learned scales');
  return res.data ?? [];
}

// ─── Chord History ────────────────────────────────────────────────────────────

/**
 * Saves a detected chord to the backend history.
 *
 * @param chord - Full chord name, e.g. "Am7".
 * @param confidence - Detection confidence 0–1.
 * @param root - Root note, e.g. "A".
 * @param quality - Chord quality, e.g. "minor7".
 * @param practiceSessionId - ID of the current practice session, if any.
 */
export async function recordChord(
  chord: string,
  confidence: number,
  root: string,
  quality: string,
  practiceSessionId?: string,
): Promise<ChordRecord> {
  const res = await request<ApiResponse<ChordRecord>>('/chords', {
    method: 'POST',
    body: JSON.stringify({
      chord,
      confidence,
      root,
      quality,
      practice_session_id: practiceSessionId ?? null,
    }),
  });
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to record chord');
  return res.data;
}

/**
 * Lists chord detection history, most recent first.
 *
 * @param page - 1-based page number.
 * @param limit - Items per page.
 */
export async function listChords(
  page = 1,
  limit = 50,
): Promise<PaginatedResponse<ChordRecord>> {
  return request<PaginatedResponse<ChordRecord>>(
    `/chords?page=${page}&limit=${limit}`,
  );
}

/**
 * Returns aggregated chord detection stats (most common, by quality).
 */
export async function getChordStats(): Promise<ChordStats> {
  const res = await request<ApiResponse<ChordStats>>('/chords/stats');
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to fetch chord stats');
  return res.data;
}

// ─── User Stats ───────────────────────────────────────────────────────────────

/**
 * Returns aggregated user stats from the backend (learned scales, streaks, XP, etc.).
 */
export async function getBackendStats(): Promise<BackendUserStats> {
  const res = await request<ApiResponse<BackendUserStats>>('/stats');
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to fetch stats');
  return res.data;
}
