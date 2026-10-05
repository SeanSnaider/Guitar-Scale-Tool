/**
 * PracticeCoach.tsx
 *
 * The "Practice Coach" tab — an AI-powered guitar practice plan generator.
 *
 * Layout (desktop ≥ 1024 px):
 *   Two-column grid: [ReasoningTrace sidebar 300 px] | [PracticePlan main area]
 *
 * Layout (mobile < 1024 px):
 *   Single column. When the agent is thinking, the reasoning trace appears
 *   above the plan area in a collapsible section.
 *
 * Design system: Studio Walnut (amber/brown dark theme).
 * All colours use CSS custom properties from index.css.
 *
 * Agent lifecycle driven by usePracticeAgent hook:
 *   idle → (submit) → thinking → complete | error
 */

import { useState } from 'react';
import { usePracticeAgent } from '../hooks/usePracticeAgent';
import PracticePlan from './PracticePlan';

// ---------------------------------------------------------------------------
// Difficulty options
// ---------------------------------------------------------------------------

const DIFFICULTY_OPTIONS = [
  { value: 'beginner',     label: 'Beginner'     },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced',     label: 'Advanced'     },
] as const;

type Difficulty = typeof DIFFICULTY_OPTIONS[number]['value'];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * ReasoningTrace
 *
 * Sticky sidebar that shows the agent's reasoning steps as they arrive.
 * Each step appears with a small amber dot and a fade-in animation.
 *
 * @param thoughts  - Array of reasoning strings collected so far.
 * @param isActive  - True while the agent is running (shows a spinner).
 */
function ReasoningTrace({
  thoughts,
  isActive,
}: {
  thoughts: string[];
  isActive: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '14px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '14px',
            fontWeight: 400,
            color: 'var(--accent-primary)',
          }}
        >
          Reasoning
        </span>
        {isActive && (
          <span
            style={{
              display: 'inline-block',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              animation: 'blink 1s step-end infinite',
              flexShrink: 0,
            }}
            aria-label="Agent is thinking"
          />
        )}
      </div>

      {/* Thought list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {thoughts.length === 0 && isActive && (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            Gathering information…
          </p>
        )}
        {thoughts.map((thought, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
              animation: 'fade-in 300ms ease',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                flexShrink: 0,
                marginTop: '5px',
                opacity: 0.7,
              }}
            />
            <p
              style={{
                fontSize: '12px',
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              {thought}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * GoalForm
 *
 * Input form for the user's practice goal and difficulty selector.
 * Renders a multiline textarea and three pill-style difficulty buttons.
 *
 * @param onSubmit  - Called with (goal, difficulty) when the form is submitted.
 * @param isRunning - True while a run is in progress (disables submit).
 * @param onAbort   - Called when the user clicks "Stop".
 */
function GoalForm({
  onSubmit,
  isRunning,
  onAbort,
}: {
  onSubmit: (goal: string, difficulty: Difficulty) => void;
  isRunning: boolean;
  onAbort: () => void;
}) {
  const [goal, setGoal] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = goal.trim();
    if (!trimmed) return;
    onSubmit(trimmed, difficulty);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Goal textarea */}
      <div>
        <label
          htmlFor="practice-goal"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          What do you want to work on?
        </label>
        <textarea
          id="practice-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Improve my blues soloing in the key of A minor…"
          rows={3}
          disabled={isRunning}
          style={{
            width: '100%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-input)',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '14px',
            color: 'var(--text-body)',
            fontFamily: 'var(--font-body)',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            opacity: isRunning ? 0.6 : 1,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-input)';
          }}
        />
      </div>

      {/* Difficulty pills */}
      <div>
        <p
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Level
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {DIFFICULTY_OPTIONS.map((opt) => {
            const isActive = difficulty === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDifficulty(opt.value)}
                disabled={isRunning}
                style={{
                  padding: '5px 14px',
                  fontSize: '13px',
                  borderRadius: '20px',
                  border: '1px solid',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'all 150ms ease',
                  background: isActive ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: isActive ? '#1C1714' : 'var(--text-secondary)',
                  borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  fontWeight: isActive ? 600 : 400,
                  opacity: isRunning ? 0.6 : 1,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit / Stop */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {isRunning ? (
          <button
            type="button"
            onClick={onAbort}
            style={{
              padding: '9px 20px',
              background: 'transparent',
              border: '1px solid var(--border-input)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-input)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!goal.trim()}
            style={{
              padding: '9px 24px',
              background: goal.trim() ? 'var(--accent-primary)' : 'var(--bg-elevated)',
              border: '1px solid',
              borderColor: goal.trim() ? 'var(--accent-primary)' : 'var(--border-subtle)',
              borderRadius: '6px',
              color: goal.trim() ? '#1C1714' : 'var(--text-muted)',
              fontSize: '14px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              cursor: goal.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 150ms ease',
            }}
          >
            Generate Plan
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * PracticeCoach
 *
 * Full-page Practice Coach tab rendered inside AppShell.
 * Wires the GoalForm, ReasoningTrace sidebar, and PracticePlan together
 * using the usePracticeAgent state machine hook.
 *
 * @returns The rendered Practice Coach tab content.
 */
export default function PracticeCoach() {
  const { status, thoughts, streamingContent, answer, errorMessage, run, abort, reset } =
    usePracticeAgent();

  const isRunning = status === 'thinking';
  const hasResult = status === 'complete' || (isRunning && (thoughts.length > 0 || streamingContent.length > 0));

  const handleSubmit = (goal: string, difficulty: Difficulty) => {
    run(goal, difficulty);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Page header */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            fontWeight: 400,
            color: 'var(--accent-primary)',
            margin: '0 0 6px 0',
          }}
        >
          Practice Coach
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
          Describe your goal and get a personalised, research-backed practice plan.
        </p>
      </div>

      {/* Input card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <GoalForm onSubmit={handleSubmit} isRunning={isRunning} onAbort={abort} />
      </div>

      {/* Error state */}
      {status === 'error' && errorMessage && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <span style={{ color: 'var(--incorrect)', fontSize: '16px', flexShrink: 0 }}>✕</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', color: 'var(--incorrect)', margin: '0 0 8px' }}>
              {errorMessage}
            </p>
            <button
              onClick={reset}
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                background: 'none',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Two-column result area — only shown when there's something to show */}
      {hasResult && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '16px',
          }}
          className="practice-coach-grid"
        >
          {/* Reasoning trace — full width on mobile, sidebar on desktop */}
          <style>{`
            @media (min-width: 1024px) {
              .practice-coach-grid {
                grid-template-columns: 300px minmax(0, 1fr) !important;
              }
            }
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
            @keyframes fade-in {
              from { opacity: 0; transform: translateY(4px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Sidebar */}
          <div style={{ position: 'sticky', top: '68px', alignSelf: 'start' }}>
            <ReasoningTrace thoughts={thoughts} isActive={isRunning} />
          </div>

          {/* Main plan area */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            {status === 'complete' && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '15px',
                    color: 'var(--accent-primary)',
                  }}
                >
                  Your Practice Plan
                </span>
                <button
                  onClick={reset}
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    background: 'none',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'color 150ms ease, border-color 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent-primary)';
                    e.currentTarget.style.borderColor = 'var(--border-input)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  New Plan
                </button>
              </div>
            )}

            <PracticePlan
              answer={answer}
              isStreaming={isRunning}
            />
          </div>
        </div>
      )}
    </div>
  );
}
