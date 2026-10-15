/**
 * NoteCircle.tsx
 *
 * One note marker on the fretboard.
 *
 * Variants (all from the monochrome tokens):
 *   - root:   accent fill, ink label. The root is one of the two things
 *             orange is allowed to mean.
 *   - scale:  ink fill, white label.
 *   - muted:  a bare label on the board for non-scale tones (no circle), so
 *             they read as context and keep AA contrast.
 *   - dimmed: (root/scale outside the selected position) a hollow ring with a
 *             readable label instead of a faded fill.
 *
 * `isPlaying` draws the playing ring: the other thing orange means. It lands
 * with a short pulse each time playback reaches this note.
 */

import React, { useCallback, useState } from 'react';
import { cn } from '../../ui';
import type { NoteVariant } from './noteSizes';

export type { NoteVariant };


/** Props for the NoteCircle component. */
export interface NoteCircleProps {
  /** Chromatic note name (C, C#, D …). */
  note: string;
  /** Text inside the circle; empty string for `dots` display mode. */
  displayText: string;
  variant: NoteVariant;
  /** Ink ring marking a highlighted interval. */
  isHighlighted?: boolean;
  /** Hollow treatment for notes outside the selected position. Ignored for `muted`. */
  dimmed?: boolean;
  /** This note is sounding right now during scale playback. */
  isPlaying?: boolean;
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


const SIZE_CLASS: Record<NoteVariant, string> = {
  root: 'size-[26px] text-[11px] font-extrabold',
  scale: 'size-6 text-[10.5px] font-bold',
  muted: 'size-6 text-[10.5px] font-medium',
};

function variantClass(variant: NoteVariant, dimmed: boolean): string {
  if (variant === 'muted') return 'bg-board text-muted';
  if (dimmed) {
    // Neutral rings only: an orange ring means "sounding now" and nothing else.
    // An outside root gets a heavier 2px ink ring and label so it stays findable.
    return variant === 'root'
      ? 'bg-board text-ink font-black ring-2 ring-ink ring-inset'
      : 'bg-board text-muted ring-[1.5px] ring-control ring-inset';
  }
  return variant === 'root' ? 'bg-accent text-on-accent' : 'bg-ink text-surface';
}

/**
 * NoteCircle
 *
 * Clicking plays the note (via `onClick`) and runs a brief pulse.
 */
export default function NoteCircle({
  note,
  displayText,
  variant,
  isHighlighted = false,
  dimmed = false,
  isPlaying = false,
  onClick,
  title,
  ariaLabel,
  tabIndex,
  stringIndex,
  fret,
  onFocus,
}: NoteCircleProps): React.ReactElement {
  const [isPulsing, setIsPulsing] = useState(false);

  const handleClick = useCallback(() => {
    setIsPulsing(true);
    window.setTimeout(() => setIsPulsing(false), 120);
    onClick?.();
  }, [onClick]);

  return (
    <button
      type="button"
      // Opts out of the global 44px touch minimum; .note-hit grows the tap
      // area on coarse pointers instead, keeping the drawn circle small.
      data-dense
      data-variant={variant}
      data-dimmed={dimmed && variant !== 'muted' ? '' : undefined}
      data-playing={isPlaying ? '' : undefined}
      onClick={handleClick}
      onFocus={onFocus}
      tabIndex={tabIndex}
      data-string={stringIndex}
      data-fret={fret}
      title={title ?? note}
      aria-label={ariaLabel ?? title ?? note}
      className={cn(
        'note-hit relative flex shrink-0 cursor-pointer items-center justify-center rounded-full leading-none',
        'transition-transform duration-100 hover:scale-110',
        SIZE_CLASS[variant],
        variantClass(variant, dimmed),
        // A box-shadow ring, so it never collides with the focus outline
        isHighlighted && 'shadow-[0_0_0_2px_var(--color-board),0_0_0_3.5px_var(--color-ink)]',
        isPulsing && 'scale-90',
      )}
    >
      {displayText}
      {isPlaying && (
        <span
          aria-hidden="true"
          className="ring-land pointer-events-none absolute -inset-[5px] animate-[ring-land_220ms_cubic-bezier(0.16,1,0.3,1)] rounded-full border-2 border-accent"
        />
      )}
    </button>
  );
}
