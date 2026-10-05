/**
 * FooterInfoBar.tsx
 *
 * A horizontal info + playback bar rendered below the fretboard / tablature area.
 *
 * Left side:
 *   A play/stop button that sequences through the current scale notes by
 *   calling `audioEngine.playNote(note, 4)` with 250 ms between notes via
 *   `setTimeout`.  While playing, the button shows "Stop" and a square icon.
 *
 * Right side:
 *   Scale name in Georgia serif 16 px amber, followed by the scale notes
 *   joined with " – " in `--text-secondary` 14 px.
 *
 * State is read from `useGuitarStore`.  Scale notes are derived from the
 * selected root + scale using `getScaleNotes` and `SCALES` from musicTheory.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';
import { getAscendingOctaves, getScaleNotes, SCALES } from '../data/musicTheory';

/** Delay between consecutive notes during scale playback (ms). */
const NOTE_INTERVAL_MS = 250;

/** Octave of the root note for footer playback (guitar-friendly register). */
const PLAYBACK_START_OCTAVE = 3;

/**
 * FooterInfoBar
 *
 * Renders a compact bar below the fretboard with scale playback controls and
 * contextual scale information.  Clicking "Play" schedules each scale note
 * via `setTimeout`; clicking "Stop" aborts the playback sequence.
 *
 * @returns The rendered footer bar element.
 */
export default function FooterInfoBar(): React.ReactElement {
  const {
    selectedRoot,
    selectedScale,
    isPlayingScale,
    setIsPlayingScale,
  } = useGuitarStore();

  const scale = SCALES[selectedScale];
  const scaleNotes = useMemo(
    () => (scale ? getScaleNotes(selectedRoot, scale.intervals) : []),
    [selectedRoot, scale],
  );
  const scaleName = scale ? `${selectedRoot} ${scale.name}` : selectedRoot;

  /** Refs to all pending setTimeout handles so we can cancel them on stop. */
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  /** Cancel all in-flight playback timers. */
  const cancelPlayback = useCallback(() => {
    for (const id of timeoutRefs.current) {
      clearTimeout(id);
    }
    timeoutRefs.current = [];
    setIsPlayingScale(false);
  }, [setIsPlayingScale]);

  // Cancel pending notes if the footer unmounts mid-playback (e.g. on a tab
  // switch); otherwise the remaining notes keep sounding.
  useEffect(() => () => {
    for (const id of timeoutRefs.current) clearTimeout(id);
  }, []);

  /** Schedule each scale note at 250 ms intervals using setTimeout. */
  const startPlayback = useCallback(() => {
    if (scaleNotes.length === 0) return;

    setIsPlayingScale(true);
    timeoutRefs.current = [];

    // Play each note sequentially as an ascending line (octave rises past B)
    getAscendingOctaves(scaleNotes, PLAYBACK_START_OCTAVE).forEach(({ note, octave }, index) => {
      const handle = setTimeout(() => {
        audioEngine.playNote(note, octave);
      }, index * NOTE_INTERVAL_MS);
      timeoutRefs.current.push(handle);
    });

    // Mark playback as finished after all notes have sounded
    const finishHandle = setTimeout(() => {
      setIsPlayingScale(false);
      timeoutRefs.current = [];
    }, scaleNotes.length * NOTE_INTERVAL_MS + 300);
    timeoutRefs.current.push(finishHandle);
  }, [scaleNotes, setIsPlayingScale]);

  const handlePlayStop = useCallback(() => {
    if (isPlayingScale) {
      cancelPlayback();
    } else {
      startPlayback();
    }
  }, [isPlayingScale, cancelPlayback, startPlayback]);

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
            {/* Stop icon: two rectangles */}
            <rect x="3" y="3" width="4" height="12" rx="1" />
            <rect x="11" y="3" width="4" height="12" rx="1" />
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
