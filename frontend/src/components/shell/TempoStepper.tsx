import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../ui';

export const MIN_BPM = 20;
export const MAX_BPM = 300;

const clamp = (n: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n)));

/**
 * TempoStepper
 *
 * − [80 BPM] + with a typeable value. Typing commits on blur or Enter and is
 * clamped to 20-300; the arrow keys step by 1 (Shift by 10).
 *
 * At the limits the step buttons are aria-disabled rather than disabled: a
 * disabled button drops keyboard focus to <body> the moment it is reached.
 */
export function TempoStepper({ bpm, onChange, className }: { bpm: number; onChange: (bpm: number) => void; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (Number.isFinite(n) && draft.trim() !== '') onChange(clamp(n));
    setDraft(null);
  };

  const atMin = bpm <= MIN_BPM;
  const atMax = bpm >= MAX_BPM;
  // data-dense: 36px wide x full bar height is a comfortable touch target and
  // keeps the transport on one row at 360px (the global 44px min-width would not)
  const stepBtn =
    'flex h-full w-8 pointer-coarse:w-9 items-center justify-center text-muted hover:bg-sunken hover:text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted';

  return (
    <div
      role="group"
      aria-label="Tempo"
      className={cn('flex h-9 items-stretch overflow-hidden rounded-control border border-control bg-surface pointer-coarse:h-11', className)}
    >
      <button type="button" data-dense aria-label="Slower" onClick={() => !atMin && onChange(clamp(bpm - 1))} aria-disabled={atMin || undefined} className={stepBtn}>
        <Minus size={14} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <label className="flex items-center gap-1 border-x border-line px-2.5 max-sm:px-1.5">
        <span className="sr-only">Beats per minute</span>
        <input
          type="text"
          inputMode="numeric"
          role="spinbutton"
          value={draft ?? String(bpm)}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
              setDraft(null);
              onChange(clamp(bpm + delta));
            }
          }}
          aria-valuenow={bpm}
          aria-valuemin={MIN_BPM}
          aria-valuemax={MAX_BPM}
          aria-valuetext={`${bpm} BPM`}
          className="tabular w-9 bg-transparent text-right font-mono text-sm text-ink outline-none"
        />
        <span aria-hidden="true" className="text-[11px] text-muted max-sm:hidden">BPM</span>
      </label>
      <button type="button" data-dense aria-label="Faster" onClick={() => !atMax && onChange(clamp(bpm + 1))} aria-disabled={atMax || undefined} className={stepBtn}>
        <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}
