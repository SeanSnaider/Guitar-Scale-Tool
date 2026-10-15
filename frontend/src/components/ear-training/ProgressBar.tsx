/**
 * ProgressBar.tsx
 *
 * The question counter and segmented progress track for an ear-training
 * session. Each of the thin segments encodes one question: answered
 * correctly, answered incorrectly, the one being asked now, or not reached.
 */

import React from 'react';
import { cn } from '../../ui';

/** Status of a single question slot in the progress track. */
export type AnswerStatus = 'correct' | 'incorrect' | 'pending';

/** Props for the ProgressBar component. */
export interface ProgressBarProps {
  /** Total number of questions in the session. */
  total: number;
  /** Zero-based index of the question the user is currently answering. */
  current: number;
  /**
   * Per-question result array.  Length should equal `total`.
   * 'correct' | 'incorrect' = answered; 'pending' = not answered yet.
   */
  answers: Array<AnswerStatus>;
}

type SegmentState = 'correct' | 'incorrect' | 'current' | 'done' | 'future';

const SEGMENT: Record<SegmentState, string> = {
  correct: 'bg-correct',
  incorrect: 'bg-incorrect',
  current: 'bg-ink',
  done: 'bg-ink',
  future: 'bg-line-strong',
};

/**
 * ProgressBar
 *
 * Renders "Question N of M" above a row of thin segments. Answered segments
 * fill with the correct/incorrect colour, the active question is the accent,
 * and unreached questions stay a neutral hairline grey.
 *
 * @param props - {@link ProgressBarProps}
 * @returns The rendered progress bar element.
 */
export default function ProgressBar({
  total,
  current,
  answers,
}: ProgressBarProps): React.ReactElement {
  return (
    <div
      className="w-full"
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Question ${current + 1} of ${total}`}
    >
      <p className="mb-2 text-xs text-muted">
        Question{' '}
        <span className="tabular font-mono text-ink">
          {current + 1}
        </span>{' '}
        of <span className="font-mono">{total}</span>
      </p>

      <div className="flex w-full gap-1">
        {Array.from({ length: total }, (_, i) => {
          const status = answers[i] ?? 'pending';
          // The store pads unreached slots with 'pending', so position
          // relative to `current` decides current vs. future.
          let state: SegmentState;
          if (status === 'correct' || status === 'incorrect') state = status;
          else if (i === current) state = 'current';
          else if (i < current) state = 'done';
          else state = 'future';

          return (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                SEGMENT[state],
              )}
              aria-label={
                state === 'future'
                  ? `Question ${i + 1}: upcoming`
                  : `Question ${i + 1}: ${state === 'current' || state === 'done' ? 'pending' : state}`
              }
            />
          );
        })}
      </div>
    </div>
  );
}
