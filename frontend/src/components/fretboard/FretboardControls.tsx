/**
 * FretboardControls.tsx
 *
 * Full-width horizontal control bar for the Fretboard tab.  Replaces the
 * old vertical sidebar Controls.tsx with a compact, two-row layout that
 * keeps the fretboard the primary visual focus.
 *
 * Row 1 (always visible):
 *   - Root Note dropdown
 *   - Scale Type dropdown (grouped by category)
 *   - Tuning dropdown
 *   - Divider
 *   - Display mode SegmentedToggle (Dots / Notes / Intervals / Patterns)
 *   - "Show muted" checkbox
 *   - "Frets: N" label + range input
 *
 * Row 2 (position controls):
 *   - Position system toggle (CAGED / 3NPS)
 *   - Position number buttons (All, 1-5 or 1-7)
 *
 * All state is read from and written to `useGuitarStore`.
 * On screens narrower than 768 px the three dropdowns stack vertically.
 */

import React, { useId, useMemo } from 'react';
import { useGuitarStore } from '../../store/useGuitarStore';
import {
  ALL_NOTES,
  SCALES,
  TUNINGS,
} from '../../data/musicTheory';
import Dropdown from '../ui/Dropdown';
import SegmentedToggle from '../ui/SegmentedToggle';

/** Display mode options shown in the segmented toggle. */
const DISPLAY_MODE_OPTIONS = [
  { value: 'dots',      label: 'Dots' },
  { value: 'notes',     label: 'Notes' },
  { value: 'intervals', label: 'Intervals' },
  { value: 'patterns',  label: 'Patterns' },
] as const;

/**
 * FretboardControls
 *
 * Renders the horizontal control bar above the fretboard.  Uses the Studio
 * Walnut design tokens exclusively — no Tailwind class names for colours so
 * the tokens can be changed globally without touching this file.
 *
 * @returns The rendered control bar element.
 */
export default function FretboardControls(): React.ReactElement {
  const {
    selectedRoot,
    setSelectedRoot,
    selectedScale,
    setSelectedScale,
    currentTuning,
    setCurrentTuning,
    displayMode,
    setDisplayMode,
    showNonScaleNotes,
    setShowNonScaleNotes,
    numFrets,
    setNumFrets,
    positionSystem,
    setPositionSystem,
    selectedPosition,
    setSelectedPosition,
  } = useGuitarStore();

  // ── Dropdown option arrays ─────────────────────────────────────────────────

  /** Root note options — all 12 chromatic notes */
  const rootOptions = useMemo(
    () => ALL_NOTES.map((n) => ({ value: n, label: n })),
    []
  );

  /** Scale options grouped by their `category` field */
  const scaleOptions = useMemo(
    () =>
      Object.entries(SCALES).map(([key, scale]) => ({
        value: key,
        label: scale.name,
        group: scale.category.charAt(0).toUpperCase() + scale.category.slice(1),
      })),
    []
  );

  /** Tuning options */
  const tuningOptions = useMemo(
    () =>
      Object.entries(TUNINGS).map(([key, tuning]) => ({
        value: key,
        label: tuning.name,
      })),
    []
  );

  /** Resolve the current tuning key from its notes fingerprint */
  const currentTuningKey = useMemo(
    () =>
      Object.keys(TUNINGS).find(
        (k) => TUNINGS[k].notes.join(',') === currentTuning.notes.join(',')
      ) ?? 'standard',
    [currentTuning]
  );

  /** How many position buttons to render (5 for CAGED, 7 for 3NPS) */
  const positionCount = positionSystem === 'caged' ? 5 : 7;

  // ── Shared button factory ─────────────────────────────────────────────────

  /** Amber-filled active button style, transparent inactive. */
  const positionBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'var(--font-body)',
    fontWeight: active ? 600 : 400,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
    color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
    transition: 'all 150ms ease',
  });

  const fretsId = useId();
  const positionLabelId = useId();

  const sysBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'var(--font-body)',
    fontWeight: active ? 600 : 400,
    border: '1px solid ' + (active ? 'var(--accent-primary)' : 'var(--border-subtle)'),
    cursor: 'pointer',
    background: active ? 'var(--accent-primary)' : 'transparent',
    color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
    transition: 'all 150ms ease',
  });

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* ── Row 1: dropdowns + display options ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Left group: three dropdowns */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}
        >
          <Dropdown
            label="Root Note"
            value={selectedRoot}
            onChange={setSelectedRoot}
            options={rootOptions}
            className="dropdown-root"
          />
          <Dropdown
            label="Scale Type"
            value={selectedScale}
            onChange={setSelectedScale}
            options={scaleOptions}
          />
          <Dropdown
            label="Tuning"
            value={currentTuningKey}
            onChange={(key) => setCurrentTuning(TUNINGS[key])}
            options={tuningOptions}
          />
        </div>

        {/* Centre divider: only once both groups fit on one line */}
        <div
          className="hidden xl:block"
          style={{
            width: 1,
            background: 'var(--border-subtle)',
            height: 32,
            margin: '0 4px',
            flexShrink: 0,
            alignSelf: 'center',
          }}
          aria-hidden="true"
        />

        {/* Right group: display mode + muted toggle + frets */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Display
            </span>
            <SegmentedToggle
              ariaLabel="Display mode"
              options={[...DISPLAY_MODE_OPTIONS]}
              value={displayMode}
              onChange={(v) => setDisplayMode(v as typeof displayMode)}
            />
          </div>

          {/* Show muted notes checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text-secondary)',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={showNonScaleNotes}
              onChange={(e) => setShowNonScaleNotes(e.target.checked)}
              style={{
                width: 14,
                height: 14,
                accentColor: 'var(--accent-primary)',
                cursor: 'pointer',
              }}
            />
            Muted notes
          </label>

          {/* Frets range */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 100,
            }}
          >
            <label
              htmlFor={fretsId}
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Frets: {numFrets}
            </label>
            <input
              id={fretsId}
              type="range"
              min={12}
              max={24}
              value={numFrets}
              onChange={(e) => setNumFrets(parseInt(e.target.value, 10))}
              style={{
                accentColor: 'var(--accent-primary)',
                cursor: 'pointer',
                width: '100%',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Row 2: position system + position buttons ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          id={positionLabelId}
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginRight: 2,
          }}
        >
          Position:
        </span>

        {/* CAGED / 3NPS toggle */}
        <div
          role="group"
          aria-label="Position system"
          style={{ display: 'flex', gap: 6 }}
        >
          <button
            type="button"
            onClick={() => { setPositionSystem('caged'); setSelectedPosition(1); }}
            aria-pressed={positionSystem === 'caged'}
            style={sysBtnStyle(positionSystem === 'caged')}
          >
            CAGED
          </button>
          <button
            type="button"
            onClick={() => { setPositionSystem('3nps'); setSelectedPosition(1); }}
            aria-pressed={positionSystem === '3nps'}
            style={sysBtnStyle(positionSystem === '3nps')}
          >
            3NPS
          </button>
        </div>

        {/* Divider: hidden on phones, where the position buttons wrap below */}
        <div
          className="hidden sm:block"
          style={{
            width: 1,
            background: 'var(--border-subtle)',
            height: 20,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />

        {/* All + numbered position buttons */}
        <div
          role="group"
          aria-labelledby={positionLabelId}
          style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
        >
          <button
            type="button"
            onClick={() => setSelectedPosition(null)}
            aria-pressed={selectedPosition === null}
            aria-label="All positions"
            style={positionBtnStyle(selectedPosition === null)}
          >
            All
          </button>
          {Array.from({ length: positionCount }, (_, i) => i + 1).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setSelectedPosition(pos)}
              aria-pressed={selectedPosition === pos}
              aria-label={`Position ${pos}`}
              style={positionBtnStyle(selectedPosition === pos)}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
