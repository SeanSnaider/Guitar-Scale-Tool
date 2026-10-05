/**
 * NoteCircle.tsx
 *
 * A circular note marker rendered on the fretboard.  Three variants exist
 * (`root`, `scale`, `muted`) each with distinct sizing and colour treatment
 * per the Studio Walnut design system.
 *
 * Features:
 *   - Hover scale-up transform (1.12×, 100 ms)
 *   - Optional amber ring when `isHighlighted` is true
 *   - A brief `note-pulse` animation triggered on click (keyframe defined in index.css)
 *   - All variants use `cursor: pointer` and fire `onClick` when provided
 */

import React, { useState, useCallback } from 'react';

/** Controls the visual treatment of the circle. */
export type NoteVariant = 'root' | 'scale' | 'muted';

/** Props for the NoteCircle component. */
export interface NoteCircleProps {
  /** Chromatic note name (C, C#, D …). */
  note: string;
  /**
   * Text displayed inside the circle.  Pass an empty string for
   * `dots` display mode — the circle is still rendered but unlabelled.
   */
  displayText: string;
  /** Visual variant determining size and colour. */
  variant: NoteVariant;
  /**
   * When true an amber ring (`box-shadow`) is drawn around the circle
   * to highlight a particular interval.
   */
  isHighlighted?: boolean;
  /** Optional click handler forwarded to the underlying button. */
  onClick?: () => void;
  /** Tooltip text shown on hover. */
  title?: string;
}

/** Per-variant dimension and colour constants. */
const VARIANT_STYLES: Record<
  NoteVariant,
  { size: number; background: string; color: string; fontWeight: string; fontSize: number }
> = {
  root: {
    size: 26,
    background: '#EF9F27',
    color: '#1C1714',
    fontWeight: 'bold',
    fontSize: 11,
  },
  scale: {
    size: 22,
    background: '#854F0B',
    color: '#FAEEDA',
    fontWeight: '500',
    fontSize: 10,
  },
  muted: {
    size: 22,
    background: '#2A2320',
    color: '#888780',
    fontWeight: '400',
    fontSize: 10,
  },
};

/**
 * NoteCircle
 *
 * Renders a circular fretboard note marker.  The `variant` prop controls
 * size, background colour, and text colour.  Clicking triggers the optional
 * `onClick` handler and briefly runs the CSS `note-pulse` animation.
 *
 * @param props - {@link NoteCircleProps}
 * @returns The rendered note circle button element.
 */
export default function NoteCircle({
  note,
  displayText,
  variant,
  isHighlighted = false,
  onClick,
  title,
}: NoteCircleProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);

  const styles = VARIANT_STYLES[variant];

  const handleClick = useCallback(() => {
    // Trigger the pulse animation
    setIsPulsing(true);
    window.setTimeout(() => setIsPulsing(false), 100);
    onClick?.();
  }, [onClick]);

  const highlightShadow = isHighlighted ? '0 0 0 2px var(--accent-primary)' : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title ?? `${note}`}
      aria-label={title ?? `${note}`}
      style={{
        width: styles.size,
        height: styles.size,
        borderRadius: '50%',
        background: styles.background,
        color: styles.color,
        fontWeight: styles.fontWeight,
        fontSize: styles.fontSize,
        fontFamily: 'var(--font-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: variant === 'muted' ? '1px solid #444441' : 'none',
        padding: 0,
        lineHeight: 1,
        flexShrink: 0,
        // Hover scale + pulse animation
        transform: isPulsing
          ? 'scale(1)'
          : isHovered
          ? 'scale(1.12)'
          : 'scale(1)',
        animation: isPulsing ? 'note-pulse 100ms ease' : undefined,
        transition: isPulsing ? undefined : 'transform 100ms ease',
        boxShadow: highlightShadow,
        // Ensure the button has no default focus ring (we rely on :focus-visible from global css)
        outline: 'none',
      }}
    >
      {displayText}
    </button>
  );
}
