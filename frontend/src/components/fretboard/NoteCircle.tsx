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
  /**
   * Draws the note hollow (ring + label, no fill) to mark it as outside the
   * selected position. Ignored for the `muted` variant, which is always hollow.
   */
  dimmed?: boolean;
  /** Optional click handler forwarded to the underlying button. */
  onClick?: () => void;
  /** Tooltip text shown on hover. */
  title?: string;
  /** Full accessible name (string, fret, role). Falls back to `title`, then the note. */
  ariaLabel?: string;
  /** Roving tabindex from the parent grid: 0 for the one tabbable note, -1 otherwise. */
  tabIndex?: number;
  /** Grid coordinates, read by the fretboard's arrow-key handler. */
  stringIndex?: number;
  fret?: number;
  /** Called when the note receives focus (keeps the grid's roving position in sync). */
  onFocus?: () => void;
}

/** A border as longhands (see the style block below for why). */
interface BorderSpec {
  width: number;
  style: 'none' | 'solid' | 'dashed';
  color: string;
}

/** Per-variant dimensions and colours, all from the fretboard tokens in index.css. */
const VARIANT_STYLES: Record<
  NoteVariant,
  { size: number; background: string; color: string; fontWeight: string; fontSize: number; border: BorderSpec }
> = {
  root: {
    size: 26,
    background: 'var(--note-root-bg)',
    color: 'var(--note-root-fg)',
    fontWeight: 'bold',
    fontSize: 11,
    border: { width: 0, style: 'none', color: 'transparent' },
  },
  scale: {
    size: 22,
    background: 'var(--note-scale-bg)',
    color: 'var(--note-scale-fg)',
    fontWeight: '500',
    fontSize: 10,
    // The fill alone is 2:1 against the wood; the ring brings the shape to 3.6:1
    border: { width: 1.5, style: 'solid', color: 'var(--note-scale-ring)' },
  },
  muted: {
    size: 22,
    // Opaque wood-coloured fill hides the string line behind the label
    background: 'var(--fretboard-bg)',
    color: 'var(--note-muted-fg)',
    fontWeight: '400',
    fontSize: 10,
    // No ring: non-scale tones are context, so they read as a bare label.
    // That keeps them clearly apart from hollow out-of-position scale notes.
    border: { width: 0, style: 'none', color: 'transparent' },
  },
};

/**
 * Dimmed (outside the selected position) notes are drawn hollow instead of
 * faded, so their labels keep AA contrast: ring + readable label on the wood.
 */
const DIMMED_STYLES: Record<'root' | 'scale', { background: string; color: string; border: BorderSpec }> = {
  root: {
    background: 'var(--fretboard-bg)',
    color: 'var(--accent-primary)',
    border: { width: 1.5, style: 'solid', color: 'var(--accent-primary)' },
  },
  scale: {
    background: 'var(--fretboard-bg)',
    color: 'var(--text-secondary)',
    border: { width: 1.5, style: 'solid', color: 'var(--string-color)' },
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
  dimmed = false,
  onClick,
  title,
  ariaLabel,
  tabIndex,
  stringIndex,
  fret,
  onFocus,
}: NoteCircleProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);

  const styles =
    dimmed && variant !== 'muted'
      ? { ...VARIANT_STYLES[variant], ...DIMMED_STYLES[variant] }
      : VARIANT_STYLES[variant];

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
      // Opts out of the global 44px touch minimum; .note-hit grows the tap
      // area on coarse pointers instead, keeping the drawn circle small.
      data-dense
      className="note-hit"
      onClick={handleClick}
      onFocus={onFocus}
      tabIndex={tabIndex}
      data-string={stringIndex}
      data-fret={fret}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title ?? `${note}`}
      aria-label={ariaLabel ?? title ?? `${note}`}
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
        // Longhands rather than the `border` shorthand: var() inside shorthands
        // isn't parsed by jsdom, and longhands read the same in the browser.
        borderWidth: styles.border.width,
        borderStyle: styles.border.style,
        borderColor: styles.border.color,
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
        // No inline outline: the global :focus-visible ring (pale glow via
        // .note-hit) must be able to show. Inline styles would override it.
      }}
    >
      {displayText}
    </button>
  );
}
