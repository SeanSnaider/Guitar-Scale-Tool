/// <reference types="vite/client" />
/**
 * api.ts
 *
 * Typed HTTP client for the Scale Teacher FastAPI backend (optional sync;
 * the app works without it).
 *
 * All requests include an `X-Session-ID` header derived from a UUID
 * stored in localStorage. This identifies the "user" without requiring
 * a full auth system.
 *
 * Base URL is read from VITE_API_URL (defaults to http://localhost:8000).
 */

// ─── Session Identity ─────────────────────────────────────────────────────────

const SESSION_KEY = 'guitar-tool-session-id';

/** Random id without crypto.randomUUID, which only exists in secure contexts (not plain-HTTP LAN URLs). */
function randomId(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto.getRandomValues === 'function') {
      const b = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    }
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

let sessionId: string | null = null;

/**
 * The persistent session id, created lazily on the first request. Storage
 * failures (private mode, blocked storage) fall back to an in-memory id, so
 * importing this module can never take the app down.
 */
function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = randomId();
      localStorage.setItem(SESSION_KEY, sessionId);
    }
  } catch {
    sessionId ??= randomId();
  }
  return sessionId;
}

// ─── Base URL ─────────────────────────────────────────────────────────────────

/** Trailing slashes stripped so `${BASE_URL}/sessions` never becomes `//sessions`. */
const BASE_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000').replace(/\/+$/, '');

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

/** An HTTP error from the backend, with its status code. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Turns a FastAPI error body (`error`, or `detail` as a string or a list) into a message. */
function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as { error?: unknown; detail?: unknown };
    if (typeof b.error === 'string') return b.error;
    if (typeof b.detail === 'string') return b.detail;
    if (Array.isArray(b.detail) && b.detail.length) {
      const first = b.detail[0] as { msg?: string; loc?: unknown[] };
      return [first.loc?.join('.'), first.msg].filter(Boolean).join(': ') || `API error: ${status}`;
    }
  }
  return `API error: ${status}`;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': getSessionId(),
      ...options.headers,
    },
  });

  // Read as text first: error pages from proxies and plain-text 500s aren't
  // JSON, and parsing them blindly would hide the status code.
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) throw new ApiError(errorMessage(body, response.status), response.status);
  if (body === null) throw new ApiError('Empty or non-JSON response from the server', response.status);
  return body as T;
}

/** Throws when a paginated response reports failure, like the other calls do. */
function checkPage<T>(res: PaginatedResponse<T>): PaginatedResponse<T> {
  if (!res.success) throw new Error(res.error ?? 'Request failed');
  return res;
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
  return checkPage(await request<PaginatedResponse<PracticeSession>>(`/sessions?page=${page}&limit=${limit}`));
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
  return checkPage(await request<PaginatedResponse<ChordRecord>>(`/chords?page=${page}&limit=${limit}`));
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
