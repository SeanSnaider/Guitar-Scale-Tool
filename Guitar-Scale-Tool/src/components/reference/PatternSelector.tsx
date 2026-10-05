/**
 * PatternSelector.tsx
 *
 * Renders the scale-pattern selection card for the Reference Panel.
 *
 * Provides two controls:
 *  1. A segmented CAGED / 3NPS toggle that switches the position system.
 *  2. A row of numbered position buttons ("All" + 1–5 for CAGED, 1–7 for 3NPS).
 *
 * All state is read from and written to the global Zustand store — this
 * component carries no local state beyond hover tracking for button styling.
 *
 * Styled with Studio Walnut CSS custom properties — no hardcoded hex values.
 */

import React from 'react';
import { useGuitarStore, PositionSystem } from '../../store/useGuitarStore';

// ---- Constants ------------------------------------------------------------

/** Number of positions available in each system. */
const POSITION_COUNTS: Record<PositionSystem, number> = {
  caged: 5,
  '3nps': 7,
};

// ---- Component ------------------------------------------------------------

/**
 * PatternSelector
 *
 * Reads positionSystem, selectedPosition, setPositionSystem, and
 * setSelectedPosition from the global store and renders a CAGED/3NPS toggle
 * plus numbered position buttons.
 *
 * No props — all data flows through the Zustand store.
 *
 * @returns The rendered pattern selector card element.
 */
function PatternSelector(): React.ReactElement {
  const positionSystem = useGuitarStore((state) => state.positionSystem);
  const setPositionSystem = useGuitarStore((state) => state.setPositionSystem);
  const selectedPosition = useGuitarStore((state) => state.selectedPosition);
  const setSelectedPosition = useGuitarStore((state) => state.setSelectedPosition);

  const positionCount = POSITION_COUNTS[positionSystem];
  const positions = Array.from({ length: positionCount }, (_, i) => i + 1);

  /**
   * Handles system toggle: switches between CAGED and 3NPS and resets the
   * selected position so the UI stays consistent.
   */
  const handleSystemChange = (system: PositionSystem) => {
    setPositionSystem(system);
    setSelectedPosition(1);
  };

  /**
   * Handles a position button click.
   * Passing null deselects all positions ("All").
   */
  const handlePositionClick = (pos: number | null) => {
    setSelectedPosition(pos);
  };

  return (
    <div style={cardStyle}>
      {/* Section title */}
      <p style={titleStyle}>Patterns</p>

      {/* CAGED / 3NPS segmented toggle */}
      <div style={toggleRowStyle}>
        <SystemButton
          label="CAGED"
          active={positionSystem === 'caged'}
          onClick={() => handleSystemChange('caged')}
        />
        <SystemButton
          label="3NPS"
          active={positionSystem === '3nps'}
          onClick={() => handleSystemChange('3nps')}
        />
      </div>

      {/* Position buttons */}
      <div style={positionRowStyle}>
        {/* "All" button — clears the position selection */}
        <PositionButton
          label="All"
          active={selectedPosition === null}
          onClick={() => handlePositionClick(null)}
        />

        {positions.map((pos) => (
          <PositionButton
            key={pos}
            label={String(pos)}
            active={selectedPosition === pos}
            onClick={() => handlePositionClick(pos)}
          />
        ))}
      </div>

      {/* Instructional subtitle */}
      <p style={subtitleStyle}>Select a pattern to highlight on the fretboard</p>
    </div>
  );
}

// ---- Sub-components -------------------------------------------------------

/**
 * SystemButton
 *
 * One segment of the CAGED / 3NPS toggle.
 *
 * @param props.label  - Text to display (e.g. "CAGED" or "3NPS").
 * @param props.active - Whether this segment is currently selected.
 * @param props.onClick - Callback when the segment is clicked.
 * @returns The rendered segment button.
 */
function SystemButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '6px 0',
        fontSize: '12px',
        fontWeight: active ? 600 : 400,
        border: '1px solid var(--border-input)',
        borderRadius: '4px',
        cursor: 'pointer',
        color: active ? 'var(--bg-primary)' : 'var(--text-muted)',
        background: active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}

/**
 * PositionButton
 *
 * A single numbered (or "All") position selector button.
 *
 * @param props.label   - Display text (e.g. "1" through "7", or "All").
 * @param props.active  - Whether this position is currently selected.
 * @param props.onClick - Callback when the button is clicked.
 * @returns The rendered position button.
 */
function PositionButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        minWidth: '32px',
        padding: '5px 8px',
        fontSize: '12px',
        fontWeight: active ? 600 : 400,
        border: '1px solid var(--border-input)',
        borderRadius: '4px',
        cursor: 'pointer',
        color: active ? 'var(--bg-primary)' : 'var(--text-muted)',
        background: active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
    >
      {label}
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

/** Row holding the CAGED / 3NPS segmented toggle buttons. */
const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
};

/** Row holding the "All" + numbered position buttons. */
const positionRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
};

/** Instructional note below the buttons. */
const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '11px',
  color: 'var(--text-muted)',
};

export default PatternSelector;
