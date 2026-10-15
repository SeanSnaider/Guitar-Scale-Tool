/**
 * ProgressBar.tsx
 *
 * The question counter and segmented progress track for an ear-training
 * session. Each of the thin segments encodes one question: answered
 * correctly, answered incorrectly, the one being asked now, or not reached.
 *
 * The segments are decorative (aria-hidden); the progressbar's
 * aria-valuetext carries the same information as one sentence. Right and
 * wrong differ by shape as well as hue: correct is a filled bar, incorrect a
 * hollow outlined bar.
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
  incorrect: 'border-[1.5px] border-incorrect bg-transparent',
  current: 'bg-ink',
  done: 'bg-ink',
  future: 'bg-line-strong',
};

/**
 * ProgressBar
 *
 * Renders "Question N of M" above a row of thin segments. Correct answers
 * are filled green, incorrect ones a hollow red outline, the active question
 * is ink, and unreached questions stay a neutral hairline grey.
 *
 * @param props - {@link ProgressBarProps}
 * @returns The rendered progress bar element.
 */
export default function ProgressBar({
  total,
  current,
  answers,
}: ProgressBarProps): React.ReactElement {
  const correctCount = answers.filter((a) => a === 'correct').length;
  const incorrectCount = answers.filter((a) => a === 'incorrect').length;

  return (
    <div
      className="w-full"
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuetext={`Question ${current + 1} of ${total}, ${correctCount} correct, ${incorrectCount} incorrect`}
      aria-label="Session progress"
    >
      <p className="mb-2 text-xs text-muted">
        Question{' '}
        <span className="tabular font-mono text-ink">
          {current + 1}
        </span>{' '}
        of <span className="font-mono">{total}</span>
      </p>

      <div aria-hidden="true" className="flex w-full gap-1">
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
              data-state={state}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                SEGMENT[state],
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
