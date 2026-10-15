/**
 * ProgressDashboard.tsx
 *
 * Displays backend-synced progress data alongside local store statistics.
 * Sections include an overview (XP, level, streaks, practice time), a learned
 * scales browser filtered by category, session history, and chord detection logs.
 *
 * Data sources:
 * - Remote: FastAPI backend via src/services/api.ts (sessions, chord history,
 *   scale mastery, aggregated stats)
 * - Local: useGuitarStore (learnedScales Set, userStats, setSelectedScale,
 *   setActiveTab)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { useGuitarStore } from '../store/useGuitarStore';
import { effectiveStreak, parseLearnedScaleKey } from '../store/progress';
import { SCALES, SCALE_CATEGORIES, spellScale, type ScaleCategory } from '../data/musicTheory';
import {
  listSessions,
  listChords,
  getAllMastery,
  getChordStats,
  getBackendStats,
  type PracticeSession,
  type ChordRecord,
  type ScaleMastery,
  type ChordStats,
  type BackendUserStats,
} from '../services/api';
import { Button, Chip, Notice, Panel, SegmentedControl, PageTitle } from '../ui';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats an ISO date string as a short local date string.
 *
 * @param iso - ISO 8601 date string, or null.
 * @returns Human-readable local date, or "—" if null.
 */
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

/**
 * Formats a duration in seconds as "Xm Ys".
 *
 * @param seconds - Duration in seconds, or null for an in-progress session.
 */
function formatDuration(seconds: number | null): string {
  if (seconds == null) return 'In progress';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Formats a confidence score (0–1) as a percentage string.
 *
 * @param confidence - Score from 0 to 1.
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** fetch() rejects with a TypeError ("Failed to fetch" / "Load failed" / "NetworkError…") when the server is unreachable. */
function isNetworkError(message: string): boolean {
  return /failed to fetch|load failed|networkerror|network request failed/i.test(message);
}

/** Number set in the stat face with a smaller muted unit after it ("12 hr"). */
function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-0.5 mr-1.5 text-[13px] font-medium text-muted last:mr-0">{children}</span>;
}

/**
 * Practice time as "X hr Y min" (or "Y min" under an hour), with the units
 * set small so the figure fits a 2-up tile on a phone.
 */
function PracticeTime({ totalMinutes }: { totalMinutes: number }) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return (
    <>
      {hours > 0 && (
        <>
          {hours}
          <Unit>hr</Unit>
        </>
      )}
      {minutes}
      <Unit>min</Unit>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** One figure in the overview ledger. */
interface LedgerItemProps {
  label: string;
  value: ReactNode;
  sub?: string;
}

/**
 * LedgerItem: one column of the overview ledger row: a large regular
 * tabular numeral over its label, separated from its neighbours by hairlines
 * rather than boxed as a card.
 */
function LedgerItem({ label, value, sub }: LedgerItemProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-5 py-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular text-[36px] leading-none font-normal tracking-[-0.03em] text-ink md:text-[40px]">{value}</dd>
      {sub && <dd className="tabular text-xs text-muted">{sub}</dd>}
    </div>
  );
}

/** Props for the level / XP row. */
interface XpBarProps {
  xp: number;
  level: number;
}

/** XpBar renders the level badge and XP progress bar toward the next level. */
function XpBar({ xp, level }: XpBarProps) {
  const XP_PER_LEVEL = 100;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const progress = (xpIntoLevel / XP_PER_LEVEL) * 100;

  return (
    <Panel as="div">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="tabular flex size-12 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xl font-bold text-surface"
        >
          {level}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-sm font-bold">Level {level}</span>
            <span className="tabular font-mono text-xs text-muted">
              {xpIntoLevel} / {XP_PER_LEVEL} XP
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="XP toward next level"
            aria-valuemin={0}
            aria-valuemax={XP_PER_LEVEL}
            aria-valuenow={xpIntoLevel}
            className="h-1.5 overflow-hidden rounded-full bg-sunken"
          >
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-[400ms] ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-muted">
            <span className="tabular font-mono">{XP_PER_LEVEL - xpIntoLevel}</span> XP to next level
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** A neutral, non-interactive tag (achievements, most-common chords). */
function Tag({ children }: { children: ReactNode }) {
  return (
    <li className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-sunken px-2.5 text-[13px]">
      {children}
    </li>
  );
}

/** Empty state: one muted sentence on a panel. */
function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <Panel as="div">
      <p className="text-[13px] text-muted">{children}</p>
    </Panel>
  );
}

// ─── Tab navigation ───────────────────────────────────────────────────────────

type DashTab = 'overview' | 'learned' | 'sessions' | 'chords' | 'scales';

const DASH_TABS: ReadonlyArray<{ value: DashTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'learned', label: 'Learned' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'chords', label: 'Chords' },
  { value: 'scales', label: 'Scales' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ProgressDashboard component.
 *
 * Fetches backend data on mount and renders a tabbed progress view:
 * - Overview: XP / level, practice time, streak stats
 * - Learned: filterable list of scales marked learned in the local store
 * - Sessions: recent practice session history
 * - Chords: chord detection log and frequency stats
 * - Scales: backend-tracked mastery progress per scale
 *
 * Falls back gracefully when the backend is unavailable.
 */
export default function ProgressDashboard() {
  // ---- Remote data ----
  const [backendStats, setBackendStats] = useState<BackendUserStats | null>(null);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [chords, setChords] = useState<ChordRecord[]>([]);
  const [chordStats, setChordStats] = useState<ChordStats | null>(null);
  const [mastery, setMastery] = useState<ScaleMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Local store ----
  const userStats = useGuitarStore((s) => s.userStats);
  const learnedScales = useGuitarStore((s) => s.learnedScales);
  const sequenceMastery = useGuitarStore((s) => s.sequenceMastery);
  const setSelectedScale = useGuitarStore((s) => s.setSelectedScale);
  const setSelectedRoot = useGuitarStore((s) => s.setSelectedRoot);
  const setActiveTab = useGuitarStore((s) => s.setActiveTab);

  // ---- Local UI state ----
  const [activeTab, setDashTab] = useState<DashTab>('overview');
  const [learnedCategoryFilter, setLearnedCategoryFilter] = useState<ScaleCategory | 'all'>('all');

  /** Mirrors `loading` so a re-entrant Refresh can be ignored synchronously. */
  const loadingRef = useRef(false);

  /** Fetch all remote data in parallel. */
  const fetchAll = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const [statsData, sessionsData, chordsData, chordStatsData, masteryData] = await Promise.all([
        getBackendStats(),
        listSessions(1, 20),
        listChords(1, 50),
        getChordStats(),
        getAllMastery(),
      ]);
      setBackendStats(statsData);
      setSessions(sessionsData.data);
      setChords(chordsData.data);
      setChordStats(chordStatsData);
      setMastery(masteryData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load progress data';
      setError(msg);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Loads a learned scale (root and scale) onto the fretboard and switches
   * to the Fretboard tab.
   *
   * @param root     - The scale's root note.
   * @param scaleKey - The SCALES registry key to activate.
   */
  const handlePracticeScale = (root: string, scaleKey: string) => {
    setSelectedRoot(root);
    setSelectedScale(scaleKey);
    setActiveTab('fretboard');
  };

  // ---- Derived: learned scale entries from the local store Set ----
  // Keys are learnedScaleKey(root, scaleKey) ("C-major"); legacy keys carry a
  // trailing position ("C-major-1"). parseLearnedScaleKey handles both.
  const learnedScaleEntries = Array.from(learnedScales).flatMap((key) => {
    const parsed = parseLearnedScaleKey(key);
    const scaleData = parsed ? SCALES[parsed.scaleKey] : undefined;
    if (!parsed || !scaleData) return [];
    return [{ storeKey: key, root: parsed.root, scaleKey: parsed.scaleKey, position: parsed.position, scaleData }];
  });

  const streak = effectiveStreak(userStats);

  const filteredLearnedScales =
    learnedCategoryFilter === 'all'
      ? learnedScaleEntries
      : learnedScaleEntries.filter((e) => e.scaleData?.category === learnedCategoryFilter);

  /**
   * Mastery rows: this browser's Sequence progress first (the source of
   * truth, works without the server), then any server rows for other scales.
   */
  const scaleLabel = (key: string) => {
    const parsed = parseLearnedScaleKey(key);
    const scale = parsed ? SCALES[parsed.scaleKey] : undefined;
    return parsed && scale ? `${spellScale(parsed.root, parsed.scaleKey)[0] ?? parsed.root} ${scale.name}` : key;
  };
  const localKeys = new Set([...Object.keys(sequenceMastery), ...learnedScales]);
  const masteryRows: Array<{
    id: string;
    label: string;
    is_learned: boolean;
    consecutive_correct: number;
    total_attempts: number | null;
    learned_at: string | null;
  }> = [
    ...[...localKeys].map((key) => ({
      id: `local-${key}`,
      label: scaleLabel(key),
      is_learned: learnedScales.has(key),
      consecutive_correct: Math.min(3, sequenceMastery[key] ?? 0),
      total_attempts: null,
      learned_at: null,
    })),
    ...mastery
      .filter((m) => !localKeys.has(m.scale_key))
      .map((m) => ({
        id: String(m.id),
        label: scaleLabel(m.scale_key),
        is_learned: m.is_learned,
        consecutive_correct: m.consecutive_correct,
        total_attempts: m.total_attempts,
        learned_at: m.learned_at,
      })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <PageTitle>Progress</PageTitle>
        <Button
          variant="ghost"
          size="sm"
          icon={RotateCcw}
          // aria-disabled, not disabled: the button keeps focus while it loads
          onClick={() => void fetchAll()}
          aria-disabled={loading || undefined}
          aria-busy={loading}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <p role="status" className="py-8 text-center text-sm text-muted">
          Loading progress data...
        </p>
      ) : (
        <>
          {/* Sync notice (non-blocking). The server is optional and being phased
              out, so an unreachable server is an expected state, not an alarm. */}
          {error && (
            <Notice tone="info">
              {isNetworkError(error)
                ? 'Showing progress saved in this browser. Session history and chord stats come from the sync server, which isn’t available right now.'
                : `Couldn’t load synced progress (${error}). Showing progress saved in this browser.`}
            </Notice>
          )}

          {/* Scrolls sideways on phones rather than squeezing the segments */}
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl
              ariaLabel="Progress section"
              options={DASH_TABS}
              value={activeTab}
              onChange={setDashTab}
            />
          </div>

          {/* ── Overview ── */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-4">
              <XpBar xp={userStats.xp} level={userStats.level} />

              <dl className="grid grid-cols-2 divide-line rounded-panel border border-line bg-surface max-md:[&>*:nth-child(-n+2)]:border-b max-md:[&>*:nth-child(odd)]:border-r max-md:[&>*]:border-line md:grid-cols-4 md:divide-x">
                <LedgerItem label="Practice time" value={<PracticeTime totalMinutes={userStats.totalPracticeMinutes} />} />
                <LedgerItem label="Scales learned" value={userStats.totalScalesLearned} />
                <LedgerItem
                  label="Current streak"
                  value={
                    <>
                      {streak}
                      <Unit>d</Unit>
                    </>
                  }
                  sub={`Best: ${userStats.longestStreak} days`}
                />
                <LedgerItem label="Total XP" value={userStats.xp} />
              </dl>

              {backendStats && (
                <>
                  <Panel title="Synced history">
                    <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
                      <div className="flex items-baseline gap-2">
                        <dt className="text-muted">Sessions</dt>
                        <dd className="tabular font-mono font-bold">{sessions.length}</dd>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <dt className="text-muted">Last practice</dt>
                        <dd className="tabular font-mono font-bold">{formatDate(backendStats.last_practice_date)}</dd>
                      </div>
                    </dl>
                  </Panel>

                  {backendStats.achievements.length > 0 && (
                    <Panel title="Achievements">
                      <ul className="flex flex-wrap gap-1.5">
                        {backendStats.achievements.map((a) => (
                          <Tag key={a}>{a.replace(/_/g, ' ')}</Tag>
                        ))}
                      </ul>
                    </Panel>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Learned scales ── */}
          {activeTab === 'learned' && (
            <div className="flex flex-col gap-4">
              <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
                <Chip pressed={learnedCategoryFilter === 'all'} onClick={() => setLearnedCategoryFilter('all')}>
                  All
                </Chip>
                {SCALE_CATEGORIES.map((cat) => {
                  const isActive = learnedCategoryFilter === cat.id;
                  return (
                    <Chip
                      key={cat.id}
                      pressed={isActive}
                      onClick={() => setLearnedCategoryFilter(isActive ? 'all' : cat.id)}
                    >
                      {cat.name}
                    </Chip>
                  );
                })}
              </div>

              {filteredLearnedScales.length === 0 ? (
                <EmptyPanel>
                  {learnedScaleEntries.length === 0
                    ? 'No learned scales yet. A scale is learned after 3 clean runs in a row in Sequence practice (Ear training) at 120 BPM.'
                    : 'No learned scales in this category.'}
                </EmptyPanel>
              ) : (
                <>
                  <Panel title="Learned scales" subtitle={String(filteredLearnedScales.length)} flush>
                    <ul className="border-t border-line">
                      {filteredLearnedScales.map((entry) => {
                        const name = `${entry.root} ${entry.scaleData?.name ?? entry.scaleKey}`;
                        return (
                          <li
                            key={entry.storeKey}
                            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-bold">{name}</div>
                              <div className="mt-0.5 text-xs text-muted">
                                {entry.position != null && (
                                  <>
                                    Position <span className="tabular font-mono">{entry.position}</span> ·{' '}
                                  </>
                                )}
                                {entry.scaleData?.category ?? 'unknown'}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              aria-label={`Practice ${name}`}
                              onClick={() => handlePracticeScale(entry.root, entry.scaleKey)}
                            >
                              Practice
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </Panel>

                  <Panel title="Time to learn" flush>
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="border-y border-line">
                          {['Scale', 'Root', 'Time to learn'].map((col) => (
                            <th key={col} scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted first:pl-5 last:pr-5">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLearnedScales.map((entry) => (
                          <tr key={entry.storeKey} className="border-b border-line last:border-b-0">
                            <td className="py-2.5 pr-3 pl-5">{entry.scaleData?.name ?? entry.scaleKey}</td>
                            <td className="px-3 py-2.5">{entry.root}</td>
                            <td className="py-2.5 pr-5 pl-3 text-muted">Tracked from next session</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Panel>
                </>
              )}
            </div>
          )}

          {/* ── Sessions ── */}
          {activeTab === 'sessions' &&
            (sessions.length === 0 ? (
              <EmptyPanel>No practice sessions recorded yet. Start practicing to see your history here.</EmptyPanel>
            ) : (
              <Panel title="Sessions" subtitle={String(sessions.length)} flush>
                <ul className="border-t border-line">
                  {sessions.map((session) => (
                    <li key={session.id} className="border-b border-line px-5 py-3 last:border-b-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="tabular font-mono text-[13px] font-bold">{formatDate(session.started_at)}</span>
                        <span className="tabular font-mono text-xs text-muted">
                          {formatDuration(session.duration_seconds)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span>
                          <span className="tabular font-mono">{session.bpm}</span> BPM
                        </span>
                        {session.accuracy != null && (
                          <span>
                            <span className="tabular font-mono">{Math.round(session.accuracy * 100)}%</span> accuracy
                          </span>
                        )}
                        {session.scales_practiced.length > 0 && <span>{session.scales_practiced.join(', ')}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}

          {/* ── Chords ── */}
          {activeTab === 'chords' && (
            <div className="flex flex-col gap-4">
              {chordStats && chordStats.total_detections > 0 && (
                <Panel title="Detection summary">
                  <p className="text-[13px]">
                    <span className="text-muted">Total detections</span>{' '}
                    <span className="tabular font-mono font-bold">{chordStats.total_detections}</span>
                  </p>
                  <p className="mt-3 mb-2 text-xs text-muted">Most common</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {chordStats.most_common.slice(0, 5).map((item) => (
                      <Tag key={item.chord}>
                        <span className="font-bold">{item.chord}</span>
                        <span className="tabular font-mono text-xs text-muted">x{item.count}</span>
                      </Tag>
                    ))}
                  </ul>
                </Panel>
              )}

              {chords.length === 0 ? (
                <EmptyPanel>No chords detected yet. Use ChordAI to detect chords from your microphone.</EmptyPanel>
              ) : (
                <Panel title="Detection log" subtitle={String(chords.length)} flush>
                  {/* Focusable so keyboard users can scroll the capped list */}
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="Chord detection log"
                    className="max-h-80 overflow-y-auto border-t border-line"
                  >
                    <ul>
                      {chords.map((chord) => (
                        <li
                          key={chord.id}
                          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-2.5 last:border-b-0"
                        >
                          <div className="flex items-baseline gap-2.5">
                            <span className="text-sm font-bold">{chord.chord}</span>
                            <span className="text-xs text-muted">{chord.quality}</span>
                          </div>
                          <div className="tabular flex gap-3 font-mono text-xs text-muted">
                            <span>{formatConfidence(chord.confidence)}</span>
                            <span>{formatDate(chord.detected_at)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Panel>
              )}
            </div>
          )}

          {/* ── Scale mastery (backend) ── */}
          {activeTab === 'scales' &&
            (masteryRows.length === 0 ? (
              <EmptyPanel>
                No scales practiced yet. Complete the sequence exercise at 120 BPM to start tracking mastery.
              </EmptyPanel>
            ) : (
              <Panel title="Scale mastery" flush>
                <ul className="border-t border-line">
                  {masteryRows.map((m) => (
                    <li key={m.id} className="border-b border-line px-5 py-3.5 last:border-b-0">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-bold break-all">{m.label}</span>
                        {m.is_learned ? (
                          <span className="rounded-full bg-correct-soft px-2 py-0.5 text-xs font-bold text-correct">
                            Learned
                          </span>
                        ) : (
                          <span className="tabular rounded-full bg-sunken px-2 py-0.5 font-mono text-xs text-muted">
                            {m.consecutive_correct}/3
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
                        {m.total_attempts !== null && (
                          <span>
                            <span className="tabular font-mono">{m.total_attempts}</span> attempts
                          </span>
                        )}
                        {m.learned_at && (
                          <span>
                            Learned <span className="tabular font-mono">{formatDate(m.learned_at)}</span>
                          </span>
                        )}
                      </div>

                      {!m.is_learned && (
                        <>
                          {/* Decorative: the caption below states the same count */}
                          <div aria-hidden="true" className="mt-2.5 h-1 overflow-hidden rounded-full bg-sunken">
                            <div
                              className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out"
                              style={{ width: `${(m.consecutive_correct / 3) * 100}%` }}
                            />
                          </div>
                          <div className="mt-1.5 text-xs text-muted">
                            <span className="tabular font-mono">{m.consecutive_correct}</span> consecutive correct at
                            120 BPM or higher
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
        </>
      )}
    </div>
  );
}
