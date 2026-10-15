import type { ReactNode } from 'react';
import { cn } from './cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label; also the accessible name. */
  label: string;
  /**
   * Responsive visible text (e.g. a short word on phones). The accessible
   * name is computed from whatever is visible, so it always matches.
   */
  visibleLabel?: ReactNode;
  hideLabel?: boolean;
  className?: string;
}

/**
 * Switch
 *
 * An on/off control (role="switch") with its label inside the hit area, so
 * the whole thing is one target.
 */
export function Switch({ checked, onChange, label, visibleLabel, hideLabel = false, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      onClick={() => onChange(!checked)}
      className={cn('group inline-flex items-center gap-2 text-[13px] text-muted hover:text-ink', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-150',
          checked ? 'bg-ink' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-surface transition-[left] duration-150',
            checked ? 'left-[14px]' : 'left-0.5',
          )}
        />
      </span>
      {!hideLabel && <span className={cn(checked && 'text-ink')}>{visibleLabel ?? label}</span>}
    </button>
  );
}
