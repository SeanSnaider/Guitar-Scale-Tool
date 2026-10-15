import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * PageTitle
 *
 * A view's display heading: the one large, heavy piece of type on a screen,
 * so every view has a clear typographic anchor. Renders an h2 (the app shell
 * owns the sr-only h1).
 */
export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        'text-[32px] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance text-ink md:text-[40px]',
        className,
      )}
    >
      {children}
    </h2>
  );
}
