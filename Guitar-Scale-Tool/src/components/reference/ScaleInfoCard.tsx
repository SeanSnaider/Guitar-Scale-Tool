/**
 * ScaleInfoCard.tsx
 *
 * Renders the primary scale information card for the Reference Panel.
 * Displays the scale name, category badge, description, interval formula,
 * and a legend explaining the NoteCircle colour scheme (root vs scale tone).
 *
 * Styled with Studio Walnut CSS custom properties — no hardcoded hex values.
 */

import React from 'react';
import { SCALES } from '../../data/musicTheory';

// ---- Types ----------------------------------------------------------------

/**
 * Props for ScaleInfoCard.
 */
interface ScaleInfoCardProps {
  /** Scale root note, e.g. "A". */
  root: string;
  /** Key in the SCALES map, e.g. "minor_pentatonic". */
  scaleKey: string;
}

// ---- Component ------------------------------------------------------------

/**
 * ScaleInfoCard
 *
 * Renders a card containing the core identity of the currently selected scale:
 * full name, category badge, prose description, degree formula, and a
 * root/scale-tone legend matching the fretboard colour scheme.
 *
 * @param props.root     - The root note (e.g. "A").
 * @param props.scaleKey - The SCALES key (e.g. "minor_pentatonic").
 * @returns The rendered scale info card element.
 */
function ScaleInfoCard({ root, scaleKey }: ScaleInfoCardProps): React.ReactElement {
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

  const fullName = `${root} ${scale.name}`;
  const formulaString = scale.degrees.join('  ');

  return (
    <div style={cardStyle}>
      {/* Scale name */}
      <h2 style={nameStyle}>{fullName}</h2>

      {/* Category badge */}
      <span style={badgeStyle}>{scale.category}</span>

      {/* Description */}
      {scale.description && (
        <p style={descriptionStyle}>{scale.description}</p>
      )}

      {/* Interval formula row */}
      <div style={formulaRowStyle}>
        <span style={formulaLabelStyle}>Formula:</span>
        <span style={formulaValueStyle}>{formulaString}</span>
      </div>

      {/* Legend */}
      <div style={legendRowStyle}>
        <LegendItem dotColor="var(--accent-primary)" label="Root" />
        <LegendItem dotColor="var(--bg-elevated)" label="Scale tone" dotBorder />
      </div>
    </div>
  );
}

// ---- Sub-component --------------------------------------------------------

/**
 * LegendItem
 *
 * A small dot + label pair used in the scale-tone legend.
 *
 * @param props.dotColor   - CSS colour value for the dot.
 * @param props.label      - Text to display beside the dot.
 * @param props.dotBorder  - When true, adds a border on the dot (for the scale-tone entry).
 * @returns The rendered legend item.
 */
function LegendItem({
  dotColor,
  label,
  dotBorder = false,
}: {
  dotColor: string;
  label: string;
  dotBorder?: boolean;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span
        style={{
          display: 'inline-block',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: dotColor,
          border: dotBorder ? '1px solid var(--border-input)' : 'none',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
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
  gap: '8px',
};

/** Scale name heading: Georgia serif, amber-glow colour. */
const nameStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'Georgia, serif',
  fontSize: '20px',
  fontWeight: 'normal',
  color: 'var(--accent-glow)',
  lineHeight: 1.2,
};

/** Category badge: small pill with muted text. */
const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  alignSelf: 'flex-start',
  background: 'var(--bg-elevated)',
  color: 'var(--text-muted)',
  fontSize: '11px',
  padding: '2px 8px',
  borderRadius: '20px',
  border: '1px solid var(--border-subtle)',
  textTransform: 'capitalize',
};

/** Description paragraph. */
const descriptionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
};

/** Row containing the "Formula:" label and degree string. */
const formulaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '4px',
};

/** "Formula:" label. */
const formulaLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  flexShrink: 0,
};

/** Degree string in monospace, amber-glow. */
const formulaValueStyle: React.CSSProperties = {
  fontSize: '14px',
  fontFamily: "'Courier New', Courier, monospace",
  color: 'var(--accent-glow)',
  letterSpacing: '0.05em',
};

/** Row containing the legend items. */
const legendRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  marginTop: '4px',
};

export default ScaleInfoCard;
