/**
 * IntervalsList.tsx
 *
 * Renders a card listing each note in the currently selected scale alongside
 * its interval name relative to the root (e.g. "E → Perfect 5th").
 *
 * The root note is rendered in amber (--accent-primary) for visual consistency
 * with the fretboard NoteCircle colour scheme. All other notes use --text-body.
 *
 * Styled with Studio Walnut CSS custom properties — no hardcoded hex values.
 */

import React from 'react';
import {
  SCALES,
  getScaleNotes,
  getInterval,
  getIntervalName,
} from '../../data/musicTheory';

// ---- Types ----------------------------------------------------------------

/**
 * Props for IntervalsList.
 */
interface IntervalsListProps {
  /** Scale root note, e.g. "A". */
  root: string;
  /** Key in the SCALES map, e.g. "minor_pentatonic". */
  scaleKey: string;
}

// ---- Component ------------------------------------------------------------

/**
 * IntervalsList
 *
 * Renders each note of the selected scale with its corresponding interval
 * name. The root note is highlighted in amber to match the fretboard.
 *
 * @param props.root     - The root note (e.g. "A").
 * @param props.scaleKey - The SCALES key (e.g. "minor_pentatonic").
 * @returns The rendered intervals list card element.
 */
function IntervalsList({ root, scaleKey }: IntervalsListProps): React.ReactElement {
  const scale = SCALES[scaleKey];

  if (!scale) {
    return (
      <div style={cardStyle}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Scale not found: {scaleKey}
        </p>
      </div>
    );
  }

  const notes = getScaleNotes(root, scale.intervals);

  return (
    <div style={cardStyle}>
      {/* Section title */}
      <p style={titleStyle}>Intervals</p>

      {/* Note rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {notes.map((note, index) => {
          const semitones = getInterval(root, note);
          const intervalName = getIntervalName(semitones);
          const isRoot = index === 0;

          return (
            <div key={`${note}-${index}`} style={rowStyle}>
              {/* Note name */}
              <span
                style={{
                  ...noteStyle,
                  color: isRoot ? 'var(--accent-primary)' : 'var(--text-body)',
                  fontWeight: isRoot ? 600 : 400,
                }}
              >
                {note}
              </span>

              {/* Degree badge */}
              <span style={degreeStyle}>{scale.degrees[index]}</span>

              {/* Interval name */}
              <span style={intervalStyle}>{intervalName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Styles ---------------------------------------------------------------

/** Shared card container style — matches the Studio Walnut elevated surface. */
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  borderRadius: '8px',
  padding: '16px',
  border: '1px solid var(--border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

/** Section title. */
const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
};

/** Each note row: note + degree + interval name. */
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '4px 0',
  borderBottom: '1px solid var(--border-subtle)',
};

/** Note name column — fixed minimum width for alignment. */
const noteStyle: React.CSSProperties = {
  fontSize: '14px',
  minWidth: '28px',
  fontFamily: "'Courier New', Courier, monospace",
};

/** Degree badge (e.g. b3, #4). */
const degreeStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  minWidth: '28px',
  fontFamily: "'Courier New', Courier, monospace",
};

/** Interval name column. */
const intervalStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-muted)',
  flex: 1,
};

export default IntervalsList;
