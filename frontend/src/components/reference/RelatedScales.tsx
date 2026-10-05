/**
 * RelatedScales.tsx
 *
 * Renders a card listing scales that are musically related to the currently
 * selected scale. Each entry shows a display label and the musical relationship
 * (e.g. "Relative minor", "Pentatonic subset").
 *
 * Clicking an entry switches the app to that scale (keeping the current root)
 * and, on desktop viewports (≥ 1024 px), navigates back to the fretboard tab
 * so the user can immediately see the new scale on the neck.
 *
 * Styled with Studio Walnut CSS custom properties — no hardcoded hex values.
 */

import React, { useCallback } from 'react';
import { SCALES, resolveRelatedScaleRoot, type RelatedScaleRef } from '../../data/musicTheory';
import { useGuitarStore } from '../../store/useGuitarStore';

// ---- Types ----------------------------------------------------------------

/**
 * Props for RelatedScales.
 */
interface RelatedScalesProps {
  /** Key in the SCALES map, e.g. "minor_pentatonic". */
  scaleKey: string;
  /** Current root note, e.g. "A". */
  root: string;
}

// ---- Component ------------------------------------------------------------

/**
 * RelatedScales
 *
 * Displays a clickable list of related scales. Clicking an item immediately
 * applies the new scale and navigates to the fretboard on desktop. Parallel
 * relationships keep the root; relative ones move to the root that shares
 * the same notes (C major -> "Relative minor" -> A minor).
 *
 * @param props.scaleKey - The SCALES key for the active scale.
 * @param props.root     - The current root note.
 * @returns The rendered related scales card element.
 */
function RelatedScales({ scaleKey, root }: RelatedScalesProps): React.ReactElement {
  const setSelectedScale = useGuitarStore((state) => state.setSelectedScale);
  const setSelectedRoot = useGuitarStore((state) => state.setSelectedRoot);
  const setActiveTab = useGuitarStore((state) => state.setActiveTab);

  const scale = SCALES[scaleKey];
  const relatedScales = scale?.relatedScales ?? [];

  /**
   * Handles a click on a related scale button.
   * Switches the scale, and on desktop also navigates to the fretboard tab.
   */
  const handleRelatedClick = useCallback(
    (related: RelatedScaleRef) => {
      setSelectedRoot(resolveRelatedScaleRoot(root, scaleKey, related));
      setSelectedScale(related.key);
      // On desktop (≥ 1024 px) navigate to the fretboard for immediate feedback
      if (window.innerWidth >= 1024) {
        setActiveTab('fretboard');
      }
    },
    [root, scaleKey, setSelectedRoot, setSelectedScale, setActiveTab]
  );

  return (
    <div style={cardStyle}>
      {/* Section title */}
      <p style={titleStyle}>Related Scales</p>

      {relatedScales.length === 0 ? (
        <p style={emptyStyle}>No related scales defined</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {relatedScales.map((rel) => (
            <RelatedScaleButton
              key={rel.key}
              label={rel.label}
              relationship={rel.relationship}
              onClick={() => handleRelatedClick(rel)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Sub-component --------------------------------------------------------

/**
 * RelatedScaleButton
 *
 * A single clickable entry in the related scales list.
 * Displays the scale name and its musical relationship to the active scale.
 *
 * @param props.label        - Human-readable scale name (e.g. "Natural Minor").
 * @param props.relationship - Relationship description (e.g. "Relative major").
 * @param props.onClick      - Callback fired when the button is activated.
 * @returns The rendered button element.
 */
function RelatedScaleButton({
  label,
  relationship,
  onClick,
}: {
  label: string;
  relationship: string;
  onClick: () => void;
}): React.ReactElement {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '2px',
        padding: '8px 10px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        background: isHovered ? 'var(--bg-primary)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <span style={scaleLabelStyle}>{label}</span>
      <span style={relationshipStyle}>{relationship}</span>
    </button>
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

/** Shown when there are no related scales defined. */
const emptyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: 'var(--text-muted)',
  fontStyle: 'italic',
};

/** Scale label — amber-glow, 14px. */
const scaleLabelStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--accent-glow)',
  fontWeight: 500,
};

/** Relationship description — muted, 12px. */
const relationshipStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-muted)',
};

export default RelatedScales;
