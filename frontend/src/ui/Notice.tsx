import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { cn } from './cn';

export type NoticeTone = 'info' | 'error' | 'success';

export interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  /** Renders a Dismiss button. */
  onDismiss?: () => void;
  className?: string;
}

const TONE: Record<NoticeTone, { box: string; icon: typeof Info; iconClass: string }> = {
  info: { box: 'border-line bg-sunken', icon: Info, iconClass: 'text-muted' },
  error: { box: 'border-incorrect/30 bg-incorrect-soft', icon: CircleAlert, iconClass: 'text-incorrect' },
  success: { box: 'border-correct/30 bg-correct-soft', icon: CircleCheck, iconClass: 'text-correct' },
};

/**
 * Notice
 *
 * Inline message next to the thing it's about. Errors use role="alert" so
 * they're announced immediately; info and success use role="status".
 */
export function Notice({ tone = 'info', title, children, onDismiss, className }: NoticeProps) {
  const t = TONE[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-control border px-3.5 py-3 text-[13px] leading-relaxed text-ink', t.box, className)}
    >
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" className={cn('mt-0.5 shrink-0', t.iconClass)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        <div className="text-ink/85">{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs text-muted underline underline-offset-2 hover:text-ink"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
