/**
 * FooterInfoBar.tsx
 *
 * A horizontal info + playback bar rendered below the fretboard / tablature area.
 *
 * Left side:
 *   A play/stop button for the scale. It toggles the shared `isPlayingScale`
 *   flag, so it drives the same BPM-synced player as the Tablature's Play
 *   button (Tablature owns the audio scheduling and the playhead).
 *
 * Right side:
 *   Scale name in Georgia serif 16 px amber, followed by the scale notes
 *   joined with " – " in `--text-secondary` 14 px.
 *
 * State is read from `useGuitarStore`.  Scale notes are derived from the
 * selected root + scale using `getScaleNotes` and `SCALES` from musicTheory.
 */

import React from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { getScaleNotes, SCALES } from '../data/musicTheory';

/**
 * FooterInfoBar
 *
 * Renders a compact bar below the fretboard with the scale play/stop toggle
 * and contextual scale information.
 *
 * @returns The rendered footer bar element.
 */
export default function FooterInfoBar(): React.ReactElement {
  const { selectedRoot, selectedScale, isPlayingScale, setIsPlayingScale } = useGuitarStore();

  const scale = SCALES[selectedScale];
  const scaleNotes = scale ? getScaleNotes(selectedRoot, scale.intervals) : [];
  const scaleName = scale ? `${selectedRoot} ${scale.name}` : selectedRoot;

  const handlePlayStop = () => setIsPlayingScale(!isPlayingScale);

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* ── Left: play/stop button ──────────────────────────────────────── */}
      <button
        type="button"
        onClick={handlePlayStop}
        aria-keyshortcuts="Space"
        aria-label={isPlayingScale ? 'Stop scale playback' : 'Play scale'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          color: 'var(--accent-primary)',
        }}
      >
        {/* Play triangle or Stop square SVG */}
        {isPlayingScale ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="var(--accent-primary)"
            aria-hidden="true"
          >
            {/* Stop icon: a square */}
            <rect x="4" y="4" width="10" height="10" rx="1.5" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="var(--accent-primary)"
            aria-hidden="true"
          >
            {/* Play icon: triangle */}
            <polygon points="4,2 16,9 4,16" />
          </svg>
        )}
        <span
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {isPlayingScale ? 'Stop' : 'Play scale'}
        </span>
      </button>

      {/* ── Right: scale name + note list ────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        {/* Scale name — Georgia serif, amber */}
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            color: 'var(--accent-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          {scaleName}
        </span>

        {scaleNotes.length > 0 && (
          <>
            {/* Divider */}
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>|</span>

            {/* Note list */}
            <span
              style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {scaleNotes.join(' \u2013 ')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
