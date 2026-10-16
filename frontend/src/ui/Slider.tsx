import { useId } from 'react';
import { cn } from './cn';

export interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Formats the visible readout, e.g. (v) => `${v}%`. */
  format?: (value: number) => string;
  /** Spoken value; defaults to the formatted readout. */
  valueText?: (value: number) => string;
  className?: string;
}

/**
 * Slider
 *
 * A labelled native range input with a mono readout on the right.
 */
export function Slider({ label, value, onChange, min, max, step = 1, format = String, valueText, className }: SliderProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs text-muted">
          {label}
        </label>
        <span aria-hidden="true" className="tabular font-mono text-xs text-ink">
          {format(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={(valueText ?? format)(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
      />
    </div>
  );
}
