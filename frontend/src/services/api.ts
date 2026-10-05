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

/**
 * Generates a random v4 UUID.
 *
 * `crypto.randomUUID` only exists in secure contexts (HTTPS or localhost);
 * opening the dev server by LAN IP (e.g. from a phone) would otherwise crash
 * the whole app at import time. `crypto.getRandomValues` works everywhere.
 *
 * @returns A UUID string such as "3b241101-e2bb-4255-8caf-4136c566a962".
 */
function generateUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const SESSION_KEY = 'guitar-tool-session-id';

/**
 * Returns the persistent session ID, creating one if it doesn't exist yet.
 */
function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateUuid();
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

/**
 * Pulls a human-readable message out of an error response body.
 *
 * Handles this API's `{ error }` envelope, FastAPI's `{ detail: string }`
 * (HTTPException) and `{ detail: [{ msg }] }` (422 validation errors).
 *
 * @param body - Parsed JSON body, or null if it was not JSON.
 * @returns The message, or undefined if none could be found.
 */
function extractErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const { error, detail } = body as { error?: unknown; detail?: unknown };
  if (typeof error === 'string') return error;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === 'object' ? (item as { msg?: unknown }).msg : undefined))
      .filter((msg): msg is string => typeof msg === 'string');
    if (messages.length > 0) return messages.join('; ');
  }
  return undefined;
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
      'X-Session-ID': SESSION_ID,
      ...options.headers,
    },
  });

  // Error bodies are not always JSON (e.g. a plain-text 500 from a proxy),
  // so parse defensively and fall back to the status code.
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (response.ok) throw new Error(`API error: invalid JSON from ${path}`);
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(data) ?? `API error: ${response.status}`);
  }

  return data as T;
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
 *
 * Sends the browser's UTC offset so the backend buckets practice days (and
 * therefore streaks) by the user's local midnight rather than UTC.
 */
export async function getBackendStats(): Promise<BackendUserStats> {
  // getTimezoneOffset() is UTC minus local; the API expects local minus UTC.
  const utcOffsetMinutes = -new Date().getTimezoneOffset();
  const res = await request<ApiResponse<BackendUserStats>>(
    `/stats?utc_offset_minutes=${utcOffsetMinutes}`,
  );
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to fetch stats');
  return res.data;
}
