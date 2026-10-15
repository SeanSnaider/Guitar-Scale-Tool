/**
 * SegmentedToggle.tsx
 *
 * A horizontal row of pill buttons that behaves like an exclusive radio group.
 * Follows the Studio Walnut design system: the selected segment is filled with
 * the amber accent colour; inactive segments are transparent with muted text
 * that brightens to `--accent-glow` on hover.
 *
 * Usage:
 *   <SegmentedToggle
 *     options={[
 *       { value: 'dots',      label: 'Dots' },
 *       { value: 'notes',     label: 'Notes' },
 *       { value: 'intervals', label: 'Intervals' },
 *     ]}
 *     value={displayMode}
 *     onChange={setDisplayMode}
 *   />
 */

import React, { useState } from 'react';

/** A single segment option. */
export interface SegmentOption {
  value: string;
  label: string;
}

/** Props for the SegmentedToggle component. */
export interface SegmentedToggleProps {
  /** All available segments. */
  options: SegmentOption[];
  /** Currently active value. */
  value: string;
  /** Called when the user activates a different segment. */
  onChange: (value: string) => void;
  /** Optional extra class names applied to the outer container. */
  className?: string;
  /** Accessible name for the group, e.g. "Display mode" or "Exercise type". */
  ariaLabel?: string;
}

/**
 * SegmentedToggle
 *
 * Renders an inline-flex row of buttons inside a rounded pill container.
 * Active segment is filled amber; inactive segments are transparent with
 * a hover glow effect tracked via per-button hover state.
 *
 * @param props - {@link SegmentedToggleProps}
 * @returns The rendered segmented toggle element.
 */
export default function SegmentedToggle({
  options,
  value,
  onChange,
  className = '',
  ariaLabel = 'Options',
}: SegmentedToggleProps): React.ReactElement {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);

  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-elevated)',
        borderRadius: 8,
        padding: 2,
        display: 'inline-flex',
        border: '1px solid var(--border-subtle)',
      }}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        const isHovered = hoveredValue === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            onMouseEnter={() => setHoveredValue(opt.value)}
            onMouseLeave={() => setHoveredValue(null)}
            aria-pressed={isActive}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              fontWeight: isActive ? 600 : 400,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              background: isActive ? 'var(--accent-primary)' : 'transparent',
              color: isActive
                ? 'var(--on-accent)'
                : isHovered
                ? 'var(--accent-glow)'
                : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
