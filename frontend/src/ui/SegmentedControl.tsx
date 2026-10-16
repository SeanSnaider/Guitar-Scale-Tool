import type { ReactNode } from 'react';
import { cn } from './cn';

export interface SegmentOption<V extends string = string> {
  value: V;
  label: ReactNode;
  /** Accessible name when `label` isn't plain text (or needs more context). */
  ariaLabel?: string;
}

export interface SegmentedControlProps<V extends string = string> {
  options: ReadonlyArray<SegmentOption<V>>;
  value: V | null;
  onChange: (value: V) => void;
  /** Names the group for screen readers, e.g. "Display mode". */
  ariaLabel: string;
  /** `mono` sets labels in the mono face (position numbers, time values). */
  mono?: boolean;
  size?: 'sm' | 'md';
  /** Stretch segments to fill the container width. */
  block?: boolean;
  className?: string;
}

/**
 * SegmentedControl
 *
 * A row of mutually exclusive options on a sunken track; the selected one is
 * a raised white segment. Each segment is a toggle button with aria-pressed,
 * grouped and named via role="group".
 */
export function SegmentedControl<V extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  mono = false,
  size = 'md',
  block = false,
  className,
}: SegmentedControlProps<V>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex gap-0.5 rounded-control border border-line bg-sunken p-0.5',
        // On touch the segments grow to 44px, so the track sizes to them
        size === 'sm' ? 'h-8' : 'h-9',
        'pointer-coarse:h-auto',
        block && 'flex w-full',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            aria-label={opt.ariaLabel}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center justify-center rounded-[5px] px-2.5 text-[13px] whitespace-nowrap',
              'transition-[background-color,color,box-shadow] duration-150',
              mono && 'min-w-7 font-mono text-xs',
              block && 'flex-1',
              active
                ? 'bg-surface font-bold text-ink shadow-[0_0_0_1px_var(--color-line)]'
                : 'text-muted hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
