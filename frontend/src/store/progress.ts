/**
 * progress.ts
 *
 * Pure helpers for progress bookkeeping shared by the store and the views:
 * the learned-scale key format and local-calendar practice days.
 */

/** Key for a learned scale: "<root>-<scaleKey>", e.g. "C-major", "F#-harmonic_minor". */
export function learnedScaleKey(root: string, scaleKey: string): string {
  return `${root}-${scaleKey}`;
}

/**
 * Parses a learned-scale key. Accepts the current "<root>-<scaleKey>" form and
 * the legacy "<root>-<scaleKey>-<position>" form (a trailing all-digit part).
 * Scale keys may themselves contain hyphens, so only the first part is the root.
 */
export function parseLearnedScaleKey(key: string): { root: string; scaleKey: string; position: number | null } | null {
  const parts = key.split('-');
  if (parts.length < 2 || !parts[0]) return null;
  const [root, ...rest] = parts;
  let position: number | null = null;
  if (rest.length > 1 && /^\d+$/.test(rest[rest.length - 1])) position = Number(rest.pop());
  const scaleKey = rest.join('-');
  return scaleKey ? { root, scaleKey, position } : null;
}

/** "YYYY-MM-DD" for a date in the user's local calendar (not UTC). */
export function localDayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The local day key `days` days before `d`. */
export function localDayKeyOffset(days: number, d: Date = new Date()): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate() - days);
  return localDayKey(copy);
}

/**
 * The streak to display: a stored streak only counts if the last practice was
 * today or yesterday; otherwise it has lapsed and reads 0.
 */
export function effectiveStreak(stats: { currentStreak: number; lastPracticeDate: string | null }, now: Date = new Date()): number {
  const last = stats.lastPracticeDate;
  if (!last) return 0;
  return last === localDayKey(now) || last === localDayKeyOffset(1, now) ? stats.currentStreak : 0;
}
