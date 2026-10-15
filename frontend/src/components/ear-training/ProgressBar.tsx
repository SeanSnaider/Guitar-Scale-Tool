/**
 * ProgressBar.tsx
 *
 * Displays the current question number and a segmented progress track for an
 * ear-training session. Each segment visually encodes whether a question was
 * answered correctly, incorrectly, is currently active (pending), or has not
 * been reached yet.
 *
 * Designed to sit at the top of the EarTrainingView session screen and
 * consumes only Studio Walnut CSS custom-property tokens for all colours.
 */

import React from 'react';

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
   * 'correct' | 'incorrect' = answered; 'pending' = active question;
   * indices beyond `current` are rendered as future/unreached slots.
   */
  answers: Array<AnswerStatus>;
}

/**
 * ProgressBar
 *
 * Renders a "Question N of M" label above a row of thin coloured segments.
 * The segment colours follow the Studio Walnut palette:
 *   - correct   → --correct  (#4CAF50)
 *   - incorrect → --incorrect (#EF4444)
 *   - pending   → --accent-primary with a subtle CSS pulse animation
 *   - future    → --bg-elevated (dark grey placeholder)
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
      style={{
        width: '100%',
        paddingBottom: 8,
      }}
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Question ${current + 1} of ${total}`}
    >
      {/* Label */}
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          margin: '0 0 6px 0',
          letterSpacing: '0.02em',
        }}
      >
        Question {current + 1} of {total}
      </p>

      {/* Segment track */}
      <div
        style={{
          display: 'flex',
          gap: 3,
          width: '100%',
        }}
      >
        {Array.from({ length: total }, (_, i) => {
          const status: AnswerStatus | 'future' =
            i < answers.length ? answers[i] : 'future';

          const isPending = status === 'pending';

          let background: string;
          if (status === 'correct') {
            background = 'var(--correct)';
          } else if (status === 'incorrect') {
            background = 'var(--incorrect)';
          } else if (isPending) {
            background = 'var(--accent-primary)';
          } else {
            background = 'var(--bg-elevated)';
          }

          return (
            <div
              key={i}
              className="motion-loop"
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background,
                transition: 'background 300ms ease',
                animation: isPending ? 'ear-pulse 1.2s ease-in-out infinite' : undefined,
              }}
              aria-label={
                status === 'future'
                  ? `Question ${i + 1}: upcoming`
                  : `Question ${i + 1}: ${status}`
              }
            />
          );
        })}
      </div>

      {/*
       * Keyframe injection: we add the pulse animation inline so this
       * component is fully self-contained and requires no global CSS file.
       */}
      <style>{`
        @keyframes ear-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
