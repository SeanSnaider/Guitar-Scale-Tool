/**
 * ProgressDashboard.tsx
 *
 * Displays backend-synced progress data alongside local store statistics.
 * Sections include an overview (XP, level, streaks, practice time), a learned
 * scales browser filtered by category, session history, and chord detection logs.
 *
 * Styling: Studio Walnut theme — dark surfaces, amber accents, Georgia headings.
 *
 * Data sources:
 * - Remote: FastAPI backend via src/services/api.ts (sessions, chord history,
 *   scale mastery, aggregated stats)
 * - Local: useGuitarStore (learnedScales Set, userStats, setSelectedScale,
 *   setActiveTab)
 */

import { useEffect, useState, useCallback } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { SCALES, SCALE_CATEGORIES, type ScaleCategory } from '../data/musicTheory';
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
 * Formats a total-minutes value into "X hr Y min".
 *
 * @param totalMinutes - Total practice time in minutes.
 */
function formatPracticeTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours} hr ${minutes} min`;
}

/**
 * Formats a confidence score (0–1) as a percentage string.
 *
 * @param confidence - Score from 0 to 1.
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

// ─── Shared card style ────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  borderRadius: '8px',
  padding: '16px',
  border: '1px solid var(--border-subtle)',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Props for a single statistic tile. */
interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
}

/**
 * StatTile renders a single metric with an amber value, a label, and an
 * optional sub-label.
 *
 * @param label - Metric display name.
 * @param value - Primary value to show in large amber text.
 * @param sub - Optional secondary note shown below the label.
 */
function StatTile({ label, value, sub }: StatTileProps) {
  return (
    <div
      style={{
        ...cardStyle,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--accent-primary)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
      {sub && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7, marginTop: '2px' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/** Props for the XP progress bar section. */
interface XpBarProps {
  xp: number;
  level: number;
}

/**
 * XpBar renders the level badge and XP progress bar toward the next level.
 *
 * @param xp - Current total XP.
 * @param level - Current player level.
 */
function XpBar({ xp, level }: XpBarProps) {
  const XP_PER_LEVEL = 100;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const progress = (xpIntoLevel / XP_PER_LEVEL) * 100;

  return (
    <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '16px' }}>
      {/* Level badge */}
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#1C1714',
            fontFamily: 'var(--font-display)',
          }}
        >
          {level}
        </span>
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--text-body)' }}>
            Level {level}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {xpIntoLevel} / {XP_PER_LEVEL} XP
          </span>
        </div>
        <div
          style={{
            height: '6px',
            background: 'var(--bg-primary)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--accent-primary)',
              borderRadius: '3px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {XP_PER_LEVEL - xpIntoLevel} XP to next level
        </div>
      </div>
    </div>
  );
}

// ─── Tab navigation type ──────────────────────────────────────────────────────

type DashTab = 'overview' | 'learned' | 'sessions' | 'chords' | 'scales';

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ProgressDashboard component.
 *
 * Fetches backend data on mount and renders a tabbed progress view:
 * - Overview: XP / level, practice time, streak stats
 * - Learned Scales: filterable list of scales marked learned in the local store
 * - Sessions: recent practice session history
 * - Chords: chord detection log and frequency stats
 * - Scale Mastery: backend-tracked mastery progress per scale
 *
 * Falls back gracefully when the backend is unavailable.
 *
 * @returns The rendered progress dashboard panel.
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
  const { userStats, learnedScales, setSelectedScale, setActiveTab } = useGuitarStore();

  // ---- Local UI state ----
  const [activeTab, setDashTab] = useState<DashTab>('overview');
  const [learnedCategoryFilter, setLearnedCategoryFilter] = useState<ScaleCategory | 'all'>('all');

  /** Fetch all remote data in parallel. */
  const fetchAll = useCallback(async () => {
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Loads a scale onto the fretboard and switches to the Fretboard tab.
   *
   * @param scaleKey - The SCALES registry key to activate.
   */
  const handlePracticeScale = (scaleKey: string) => {
    setSelectedScale(scaleKey);
    setActiveTab('fretboard');
  };

  // ---- Derived: learned scale entries from the local store Set ----
  const learnedScaleEntries = Array.from(learnedScales).map((key) => {
    // Key format: "root-scaleKey-position" e.g. "C-major-1"
    const parts = key.split('-');
    const root = parts[0] ?? '';
    const scaleKey = parts.slice(1, -1).join('-');
    const position = parts[parts.length - 1] ?? '';
    const scaleData = SCALES[scaleKey];
    return { storeKey: key, root, scaleKey, position, scaleData };
  }).filter((e) => e.scaleData !== undefined);

  const filteredLearnedScales =
    learnedCategoryFilter === 'all'
      ? learnedScaleEntries
      : learnedScaleEntries.filter((e) => e.scaleData?.category === learnedCategoryFilter);

  // ---- Loading / error states ----
  if (loading) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        Loading progress data...
      </div>
    );
  }

  // ---- Tab button style helper ----
  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 4px',
    fontSize: '12px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
    background: isActive ? 'var(--accent-primary)' : 'transparent',
    color: isActive ? '#1C1714' : 'var(--text-muted)',
    fontWeight: isActive ? 600 : 400,
    textTransform: 'capitalize' as const,
  });

  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        padding: '24px',
        maxWidth: '900px',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Page heading */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            fontWeight: 400,
            color: 'var(--accent-glow)',
            margin: 0,
          }}
        >
          Your Progress
        </h2>
        <button
          onClick={fetchAll}
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Backend error notice (non-blocking) */}
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            color: 'var(--incorrect)',
            marginBottom: '16px',
          }}
        >
          {error.includes('Failed to fetch')
            ? 'Backend not reachable — showing local data only. Start the server: cd backend && uvicorn app.main:app --reload'
            : error}
        </div>
      )}

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--bg-elevated)',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '20px',
        }}
      >
        {(['overview', 'learned', 'sessions', 'chords', 'scales'] as DashTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setDashTab(tab)}
            style={tabButtonStyle(activeTab === tab)}
          >
            {tab === 'learned' ? 'Learned' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* XP / Level */}
          <XpBar xp={userStats.xp} level={userStats.level} />

          {/* Stat grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '12px',
            }}
          >
            <StatTile
              label="Practice Time"
              value={formatPracticeTime(userStats.totalPracticeMinutes)}
            />
            <StatTile
              label="Scales Learned"
              value={userStats.totalScalesLearned}
            />
            <StatTile
              label="Current Streak"
              value={`${userStats.currentStreak}d`}
              sub={`Best: ${userStats.longestStreak}d`}
            />
            <StatTile
              label="Total XP"
              value={userStats.xp}
            />
          </div>

          {/* Backend-sourced extras */}
          {backendStats && (
            <>
              <div
                style={{
                  ...cardStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  Backend Stats
                </div>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-body)' }}>
                    Sessions:{' '}
                    <strong style={{ color: 'var(--accent-primary)' }}>
                      {sessions.length}
                    </strong>
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-body)' }}>
                    Last practice:{' '}
                    <strong style={{ color: 'var(--accent-primary)' }}>
                      {formatDate(backendStats.last_practice_date)}
                    </strong>
                  </span>
                </div>
              </div>

              {backendStats.achievements.length > 0 && (
                <div style={cardStyle}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: '10px',
                    }}
                  >
                    Achievements
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {backendStats.achievements.map((a) => (
                      <span
                        key={a}
                        style={{
                          padding: '3px 10px',
                          background: 'rgba(239,159,39,0.15)',
                          color: 'var(--accent-primary)',
                          fontSize: '12px',
                          borderRadius: '12px',
                          border: '1px solid rgba(239,159,39,0.3)',
                        }}
                      >
                        {a.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Learned Scales Tab ── */}
      {activeTab === 'learned' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Category filter */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              onClick={() => setLearnedCategoryFilter('all')}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                background: learnedCategoryFilter === 'all' ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: learnedCategoryFilter === 'all' ? '#1C1714' : 'var(--text-secondary)',
                fontWeight: learnedCategoryFilter === 'all' ? 600 : 400,
              }}
            >
              All
            </button>
            {SCALE_CATEGORIES.map((cat) => {
              const isActive = learnedCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() =>
                    setLearnedCategoryFilter(isActive ? 'all' : cat.id)
                  }
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: isActive ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                    color: isActive ? '#1C1714' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Learned scale list */}
          {filteredLearnedScales.length === 0 ? (
            <div
              style={{
                ...cardStyle,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '14px',
                padding: '40px 16px',
              }}
            >
              {learnedScaleEntries.length === 0
                ? 'No scales marked as learned yet. Use the Practice tab to mark scales as learned.'
                : 'No learned scales in this category.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredLearnedScales.map((entry) => (
                <div
                  key={entry.storeKey}
                  style={{
                    ...cardStyle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-body)',
                      }}
                    >
                      {entry.root} {entry.scaleData?.name ?? entry.scaleKey}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      Position {entry.position} — {entry.scaleData?.category ?? 'unknown'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                      }}
                    >
                      Tracked from next session
                    </span>
                    <button
                      onClick={() => handlePracticeScale(entry.scaleKey)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Practice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Time-to-learn table header note */}
          {filteredLearnedScales.length > 0 && (
            <div
              style={{
                ...cardStyle,
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '12px',
                }}
              >
                Time to Learn
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Scale', 'Root', 'Time to Learn'].map((col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: 'left',
                          color: 'var(--text-muted)',
                          fontWeight: 500,
                          paddingBottom: '8px',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLearnedScales.map((entry) => (
                    <tr key={entry.storeKey}>
                      <td
                        style={{
                          color: 'var(--text-body)',
                          padding: '8px 0 4px',
                        }}
                      >
                        {entry.scaleData?.name ?? entry.scaleKey}
                      </td>
                      <td style={{ color: 'var(--text-body)', padding: '8px 8px 4px 0' }}>
                        {entry.root}
                      </td>
                      <td
                        style={{
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                          padding: '8px 0 4px',
                        }}
                      >
                        Tracked from next session
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Sessions Tab ── */}
      {activeTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sessions.length === 0 ? (
            <div
              style={{
                ...cardStyle,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '14px',
                padding: '40px 16px',
              }}
            >
              No practice sessions recorded yet. Start practicing to see your history here.
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} style={cardStyle}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-body)' }}>
                    {formatDate(session.started_at)}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatDuration(session.duration_seconds)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {session.bpm} BPM
                  </span>
                  {session.accuracy != null && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {Math.round(session.accuracy * 100)}% accuracy
                    </span>
                  )}
                  {session.scales_practiced.length > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {session.scales_practiced.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Chords Tab ── */}
      {activeTab === 'chords' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {chordStats && chordStats.total_detections > 0 && (
            <div style={cardStyle}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '10px',
                }}
              >
                Detection Summary
              </div>
              <div style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--text-body)' }}>
                Total detections:{' '}
                <strong style={{ color: 'var(--accent-primary)' }}>
                  {chordStats.total_detections}
                </strong>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Most common
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {chordStats.most_common.slice(0, 5).map((item) => (
                  <span
                    key={item.chord}
                    style={{
                      padding: '3px 10px',
                      background: 'rgba(239,159,39,0.15)',
                      color: 'var(--accent-primary)',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid rgba(239,159,39,0.3)',
                    }}
                  >
                    {item.chord} x{item.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {chords.length === 0 ? (
            <div
              style={{
                ...cardStyle,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '14px',
                padding: '40px 16px',
              }}
            >
              No chords detected yet. Use ChordAI to detect chords from your microphone.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: '320px',
                overflowY: 'auto',
              }}
            >
              {chords.map((chord) => (
                <div
                  key={chord.id}
                  style={{
                    ...cardStyle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                      }}
                    >
                      {chord.chord}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {chord.quality}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>{formatConfidence(chord.confidence)}</span>
                    <span>{formatDate(chord.detected_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Scale Mastery Tab (backend) ── */}
      {activeTab === 'scales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mastery.length === 0 ? (
            <div
              style={{
                ...cardStyle,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '14px',
                padding: '40px 16px',
              }}
            >
              No scales practiced yet. Complete the sequence exercise at 120 BPM to start tracking mastery.
            </div>
          ) : (
            mastery.map((m) => (
              <div key={m.id} style={cardStyle}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-body)' }}>
                    {m.scale_key}
                  </span>
                  {m.is_learned ? (
                    <span
                      style={{
                        fontSize: '11px',
                        background: 'rgba(76,175,80,0.15)',
                        color: 'var(--correct)',
                        border: '1px solid rgba(76,175,80,0.3)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                      }}
                    >
                      Learned
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '11px',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-subtle)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                      }}
                    >
                      {m.consecutive_correct}/3
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>{m.total_attempts} attempts</span>
                  {m.learned_at && <span>Learned {formatDate(m.learned_at)}</span>}
                </div>

                {!m.is_learned && (
                  <>
                    <div
                      style={{
                        height: '4px',
                        background: 'var(--bg-primary)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginTop: '4px',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${(m.consecutive_correct / 3) * 100}%`,
                          background: 'var(--accent-primary)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {m.consecutive_correct} consecutive correct at 120 BPM or higher
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
