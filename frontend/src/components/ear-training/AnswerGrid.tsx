/**
 * AnswerGrid.tsx
 *
 * A 2-column grid of answer cards used in the ear-training session screen.
 * Cards are tappable until an answer is submitted; once answered, the correct
 * card turns green with a check, the selected wrong card turns red with a
 * cross, and all other cards are dimmed.
 */

import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../../ui';

/** A single answer option displayed as a card. */
export interface AnswerOption {
  /** Internal value compared against `correctAnswer`. */
  value: string;
  /** Primary display text rendered in the card. */
  label: string;
  /** Optional smaller secondary text rendered below the label. */
  subtitle?: string;
}

/** Props for the AnswerGrid component. */
export interface AnswerGridProps {
  /** All answer options — typically 4 items in a 2×2 layout. */
  options: AnswerOption[];
  /** The value that represents a correct answer. */
  correctAnswer: string;
  /**
   * Called immediately when the user taps a card.
   * The parent component is responsible for scheduling the next question.
   */
  onAnswer: (value: string) => void;
  /**
   * null  = question has not been answered yet.
   * 'correct' | 'incorrect' = user has answered; feedback is shown.
   */
  result: 'correct' | 'incorrect' | null;
  /** The option value the user selected, or null if unanswered. */
  selectedAnswer: string | null;
  /**
   * When true, all cards are non-interactive.
   * Set to true after the user answers and during the advance delay.
   */
  disabled: boolean;
}

/**
 * AnswerGrid
 *
 * Renders the answer cards in a 2-column grid (one column on very narrow
 * phones). Feedback colours always pair with an icon so the result never
 * relies on colour alone.
 *
 * @param props - {@link AnswerGridProps}
 * @returns The rendered answer grid element.
 */
export default function AnswerGrid({
  options,
  correctAnswer,
  onAnswer,
  result,
  selectedAnswer,
  disabled,
}: AnswerGridProps): React.ReactElement {
  const answered = result !== null;

  return (
    <div
      className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2"
      role="group"
      aria-label="Answer options"
    >
      {options.map((option) => {
        const isCorrect = option.value === correctAnswer;
        const isSelected = option.value === selectedAnswer;
        const showCorrect = answered && isCorrect;
        const showWrong = answered && isSelected && !isCorrect;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (!disabled) onAnswer(option.value);
            }}
            disabled={disabled}
            aria-label={`${option.label}${option.subtitle ? `, ${option.subtitle}` : ''}`}
            aria-pressed={isSelected}
            className={cn(
              'relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-control border px-3 py-3.5 text-center',
              'transition-[background-color,border-color,opacity] duration-300',
              'disabled:cursor-default',
              showCorrect
                ? 'border-correct bg-correct-soft'
                : showWrong
                  ? 'border-incorrect bg-incorrect-soft'
                  : 'border-line bg-surface enabled:hover:border-control',
              answered && !showCorrect && !showWrong && 'opacity-50',
            )}
          >
            {showCorrect && (
              <Check
                size={16}
                strokeWidth={2.5}
                aria-hidden="true"
                className="absolute top-2 right-2 text-correct"
              />
            )}
            {showWrong && (
              <X
                size={16}
                strokeWidth={2.5}
                aria-hidden="true"
                className="absolute top-2 right-2 text-incorrect"
              />
            )}

            <span className="px-4 text-[15px] leading-tight font-bold text-ink">{option.label}</span>

            {option.subtitle && (
              <span className="text-xs leading-tight text-muted">{option.subtitle}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
