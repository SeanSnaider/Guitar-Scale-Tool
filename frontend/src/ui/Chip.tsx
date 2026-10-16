import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Pressed state; announced via aria-pressed. */
  pressed: boolean;
  children: ReactNode;
  mono?: boolean;
}

/**
 * Chip
 *
 * A toggle pill for filters and pick-one-of-many sets that wrap (genres,
 * scale categories). Pressed chips go solid ink; the accent stays reserved
 * for roots and what's playing.
 */
export function Chip({ pressed, mono = false, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        'inline-flex h-8 items-center rounded-full border px-3 text-[13px] whitespace-nowrap',
        'transition-[background-color,color,border-color] duration-150',
        mono && 'font-mono text-xs',
        pressed
          ? 'border-ink bg-ink font-bold text-surface'
          : 'border-line-strong bg-surface text-muted hover:border-control hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
