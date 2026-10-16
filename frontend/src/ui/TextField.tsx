import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  /** Visually hide the label (it stays the accessible name). */
  hideLabel?: boolean;
  /** Help text under the field, linked via aria-describedby. */
  hint?: ReactNode;
  /** Element inside the right edge of the field (e.g. a Show button). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * TextField
 *
 * A labelled text input. The label is always a real <label>, even when
 * hidden, so placeholder text is never the only name a field has.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel = false, hint, trailing, className, id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-xs text-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          aria-describedby={hint ? hintId : undefined}
          className={cn(
            'h-9 w-full rounded-control border border-control bg-surface px-3 text-sm text-ink placeholder:text-muted',
            'hover:border-ink disabled:opacity-50',
            trailing ? 'pr-16' : undefined,
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
});
