/**
 * TabStrip.tsx
 *
 * Phones only: the scale pattern as a single scrolling line (string name over
 * fret number) directly under the fretboard, so the board and the tab are in
 * view together while the scale plays. The sounding note is the orange cell
 * and is kept scrolled into view (instantly under reduced motion). Root frets
 * are underlined and say "(root)" to screen readers, so they don't rely on
 * colour alone. The full six-line Tablature panel follows further down.
 */
import { useEffect, useRef } from 'react';
import { useGuitarStore } from '../../store/useGuitarStore';
import { ALL_NOTES } from '../../data/musicTheory';
import { useScalePattern } from '../../practice/useScalePattern';
import { cn } from '../../ui';

export default function TabStrip() {
  const tuning = useGuitarStore((s) => s.currentTuning);
  const playingIndex = useGuitarStore((s) => s.playingIndex);
  const { pattern } = useScalePattern();
  const listRef = useRef<HTMLOListElement>(null);

  // Tab order: index 0 = highest string
  const names = [...tuning.notes.map((n) => ALL_NOTES[n])].reverse();

  // Keep the sounding cell visible by scrolling the strip itself (not the page)
  useEffect(() => {
    const list = listRef.current;
    if (!list || playingIndex < 0) return;
    const cell = list.children[playingIndex] as HTMLElement | undefined;
    if (!cell) return;
    const target = cell.offsetLeft - list.clientWidth / 2 + cell.offsetWidth / 2;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    list.scrollTo?.({ left: Math.max(0, target), behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [playingIndex]);

  return (
    <ol
      ref={listRef}
      aria-label="Scale pattern, in playing order"
      className="mt-3 flex gap-1 overflow-x-auto overscroll-x-contain pb-1 md:hidden"
    >
      {pattern.map((n, i) => {
        const playing = i === playingIndex;
        return (
          <li
            key={i}
            aria-current={playing ? 'step' : undefined}
            className={cn(
              // relative: keeps the sr-only "(root)" text inside the scrolling strip;
              // without it the absolutely positioned span escapes and widens the page
              'relative flex min-w-9 shrink-0 flex-col items-center rounded-[6px] border px-1.5 py-1 font-mono',
              playing ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface',
            )}
          >
            <span className={cn('text-[10px]', playing ? 'text-on-accent' : 'text-muted')}>{names[n.string]}</span>
            <span
              className={cn(
                'tabular text-sm font-bold',
                n.isRoot && 'underline decoration-2 underline-offset-2',
                !playing && n.isRoot && 'text-accent-ink',
              )}
            >
              {n.fret}
              {n.isRoot && <span className="sr-only"> (root)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
