import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Panel heading (rendered as an h2 unless `headingLevel` says otherwise). */
  title?: ReactNode;
  /** Muted text set inline after the title. */
  subtitle?: ReactNode;
  /** Controls or legend aligned to the right of the header. */
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  /** `flush` removes body padding (for edge-to-edge content like tables). */
  flush?: boolean;
  as?: 'section' | 'div' | 'aside';
  children?: ReactNode;
}

/**
 * Panel
 *
 * The white, hairline-bordered surface every work area sits on. Panels never
 * nest: inside a panel, group with spacing and dividers instead.
 */
export function Panel({
  title,
  subtitle,
  actions,
  headingLevel = 2,
  flush = false,
  as: Tag = 'section',
  className,
  children,
  ...rest
}: PanelProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const hasHeader = title || actions;
  return (
    <Tag className={cn('rounded-panel border border-line bg-surface', className)} {...rest}>
      {hasHeader && (
        <header className={cn('flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2', flush ? 'px-5 pt-4 pb-3' : 'px-5 pt-4')}>
          {title && (
            <Heading className="text-[15px] font-bold tracking-[-0.01em] text-ink">
              {title}
              {subtitle && <span className="ml-2 text-[13px] font-medium tracking-normal text-muted">{subtitle}</span>}
            </Heading>
          )}
          {actions && <div className="flex flex-wrap items-center gap-3 max-sm:w-full">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && (hasHeader ? 'px-5 pt-3 pb-5' : 'p-5'))}>{children}</div>
    </Tag>
  );
}
