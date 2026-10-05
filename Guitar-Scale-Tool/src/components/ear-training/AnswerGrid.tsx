/**
 * AnswerGrid.tsx
 *
 * A 2-column grid of answer option cards used in the ear-training session
 * screen. Cards are tappable until an answer is submitted; once answered,
 * the correct card turns green, the selected wrong card turns red, and all
 * other cards are dimmed.
 *
 * Visual transitions are 150 ms for hover state and 300 ms for result
 * feedback colours, following the Studio Walnut motion spec.
 *
 * All colours are derived from Studio Walnut CSS custom-property tokens.
 */

import React, { useState } from 'react';

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
   * When true, all cards are non-interactive (pointer-events disabled).
   * Set to true after the user answers and during the advance delay.
   */
  disabled: boolean;
}

/**
 * AnswerGrid
 *
 * Renders four answer cards in a responsive 2-column grid.  Before an answer
 * is submitted every card is interactive with a subtle hover effect.  After
 * submission the correct card is highlighted green, the wrong selection is
 * highlighted red, and the remaining cards are dimmed to 50% opacity.
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
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}
      role="group"
      aria-label="Answer options"
    >
      {options.map((option) => {
        const isCorrect = option.value === correctAnswer;
        const isSelected = option.value === selectedAnswer;
        const isHovered = hoveredValue === option.value;
        const answered = result !== null;

        /*
         * Compute card background and border colour.
         * Priority: answered state > hover state > default.
         */
        let background: string;
        let borderColor: string;
        let opacity = 1;
        const cursor: React.CSSProperties['cursor'] = disabled ? 'default' : 'pointer';

        if (answered) {
          if (isCorrect) {
            background = 'rgba(76, 175, 80, 0.2)';
            borderColor = 'rgba(76, 175, 80, 0.6)';
          } else if (isSelected) {
            background = 'rgba(239, 68, 68, 0.2)';
            borderColor = 'rgba(239, 68, 68, 0.6)';
          } else {
            background = 'var(--bg-elevated)';
            borderColor = 'var(--border-subtle)';
            opacity = 0.5;
          }
        } else if (isHovered && !disabled) {
          background = 'var(--bg-primary)';
          borderColor = 'var(--border-input)';
        } else {
          background = 'var(--bg-elevated)';
          borderColor = 'var(--border-subtle)';
        }

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (!disabled) onAnswer(option.value);
            }}
            onMouseEnter={() => !disabled && setHoveredValue(option.value)}
            onMouseLeave={() => setHoveredValue(null)}
            disabled={disabled}
            aria-label={`${option.label}${option.subtitle ? ` — ${option.subtitle}` : ''}`}
            aria-pressed={isSelected}
            style={{
              background,
              border: `1px solid ${borderColor}`,
              borderRadius: 8,
              padding: '14px 12px',
              cursor,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              opacity,
              transition: 'background 300ms ease, border-color 300ms ease, opacity 300ms ease',
              outline: 'none',
              position: 'relative',
              minHeight: 64,
            }}
          >
            {/* Feedback icon overlay */}
            {answered && isCorrect && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 8,
                  fontSize: 14,
                  color: 'var(--correct)',
                }}
              >
                ✓
              </span>
            )}
            {answered && isSelected && !isCorrect && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 8,
                  fontSize: 14,
                  color: 'var(--incorrect)',
                }}
              >
                ✗
              </span>
            )}

            {/* Label */}
            <span
              style={{
                fontSize: 15,
                color: 'var(--accent-glow)',
                fontWeight: 500,
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              {option.label}
            </span>

            {/* Optional subtitle */}
            {option.subtitle && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {option.subtitle}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
