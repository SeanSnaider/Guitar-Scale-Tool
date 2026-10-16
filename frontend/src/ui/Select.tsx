import { useId, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
  /** Options sharing a group render under one <optgroup>. */
  group?: string;
}

export interface SelectProps {
  label: string;
  /** Visually hide the label (it stays the accessible name). */
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  size?: 'sm' | 'md';
  className?: string;
  selectClassName?: string;
}

/**
 * Select
 *
 * A labelled native <select>. Native keeps the platform picker on phones and
 * full keyboard behaviour everywhere; only the closed state is styled.
 */
export function Select({
  label,
  hideLabel = false,
  value,
  onChange,
  options,
  size = 'md',
  className,
  selectClassName,
}: SelectProps) {
  const id = useId();

  // Preserve first-seen order of groups; ungrouped options stay at the top.
  const groups = useMemo(() => {
    const map = new Map<string | undefined, SelectOption[]>();
    for (const opt of options) {
      const list = map.get(opt.group) ?? [];
      list.push(opt);
      map.set(opt.group, list);
    }
    return Array.from(map.entries());
  }, [options]);

  const renderOption = (opt: SelectOption) => (
    <option key={opt.value} value={opt.value}>
      {opt.label}
    </option>
  );

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-xs text-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full cursor-pointer appearance-none rounded-control border border-control bg-surface pr-8 pl-2.5 text-ink',
            size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-sm',
            'hover:border-ink',
            selectClassName,
          )}
        >
          {groups.map(([group, opts]) =>
            group ? (
              <optgroup key={group} label={group}>
                {opts.map(renderOption)}
              </optgroup>
            ) : (
              opts.map(renderOption)
            ),
          )}
        </select>
        <ChevronDown
          size={14}
          strokeWidth={2.25}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );
}
