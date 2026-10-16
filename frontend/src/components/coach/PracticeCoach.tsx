/**
 * PracticeCoach.tsx
 *
 * The Coach view (FretAgent, rebuilt in the app): describe a goal, pick a
 * level, and Claude researches and writes a practice plan on your own key.
 * The research steps stream into an activity trace, the plan streams in
 * below, scales it names open on the fretboard, and finished plans are saved
 * in this browser.
 *
 * Logic lives in usePracticeCoach; this file renders.
 */

import { useEffect, useId, useRef } from 'react';
import { BookOpen, FileText, Lightbulb, MessageSquare, Music, Search, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePracticeCoach, MAX_GOAL_LENGTH } from '../../hooks/usePracticeCoach';
import { DIFFICULTIES, type Difficulty } from '../../coach/prompt';
import { parseScaleMentions } from '../../coach/planParser';
import type { CoachStep } from '../../coach/runCoach';
import { useGuitarStore } from '../../store/useGuitarStore';
import { useHistoryStore } from '../../store/useHistoryStore';
import { Button, Chip, Notice, PageTitle, Panel, SegmentedControl, cn } from '../../ui';
import ApiKeyPanel from '../ai/ApiKeyPanel';
import PlanMarkdown from './PlanMarkdown';

/** Starting points, from FretAgent. */
const EXAMPLES = [
  'Build me a sweep picking practice routine',
  'Help me learn jazz chords in Bb',
  'Create a blues plan in the style of John Mayer',
  'Teach me the modes of the major scale',
  'Design a fingerpicking workout for acoustic',
  'Master legato technique like Allan Holdsworth',
];

const LEVEL_OPTIONS = DIFFICULTIES.map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }));

/** Dims an aria-disabled Button the way `disabled` would, without losing focus. */
const BUSY_CLASS = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-45';

const STEP_ICON: Record<CoachStep['kind'], LucideIcon> = {
  thinking: Lightbulb,
  search: Search,
  fetch: FileText,
  theory: Music,
  research: BookOpen,
  note: MessageSquare,
};

/** One-line text for a trace step. */
function stepText(step: CoachStep): string {
  switch (step.kind) {
    case 'thinking':
      return step.text.trim() || 'Thinking…';
    case 'search':
      return `Searched the web: “${step.query}”`;
    case 'fetch':
      return `Read ${step.url.replace(/^https?:\/\/(www\.)?/, '')}`;
    case 'theory':
      return `Looked up ${step.label}`;
    case 'research':
      return `Checked practice research: “${step.query}”`;
    case 'note':
      return step.text;
  }
}

function StepList({ steps }: { steps: CoachStep[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((step, i) => {
        const Icon = STEP_ICON[step.kind];
        return (
          <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
            <Icon size={15} strokeWidth={2} aria-hidden="true" className="mt-[3px] shrink-0 text-muted" />
            <span
              className={cn(
                'min-w-0 break-words',
                step.kind === 'thinking' || step.kind === 'note' ? 'text-muted' : 'text-ink',
                step.kind === 'thinking' && 'line-clamp-4',
              )}
            >
              {stepText(step)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "2 web searches · 1 page read · 34k tokens" */
function usageLine(u: { inputTokens: number; outputTokens: number; webSearches: number; webFetches: number }): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const tokens = u.inputTokens + u.outputTokens;
  return [
    plural(u.webSearches, 'web search', 'web searches'),
    plural(u.webFetches, 'page read', 'pages read'),
    `${tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : tokens} tokens`,
  ].join(' · ');
}

export default function PracticeCoach() {
  const coach = usePracticeCoach();
  const plans = useHistoryStore((s) => s.plans);
  const deletePlan = useHistoryStore((s) => s.deletePlan);
  const setSelectedRoot = useGuitarStore((s) => s.setSelectedRoot);
  const setSelectedScale = useGuitarStore((s) => s.setSelectedScale);
  const setActiveTab = useGuitarStore((s) => s.setActiveTab);

  const goalId = useId();
  const running = coach.status === 'running';
  const mentions = coach.status === 'done' ? parseScaleMentions(coach.plan) : [];

  // Generate swaps for Stop while running; hand focus across so it isn't lost
  const generateRef = useRef<HTMLButtonElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const wasRunning = useRef(running);
  useEffect(() => {
    if (running && !wasRunning.current) stopRef.current?.focus();
    if (!running && wasRunning.current) generateRef.current?.focus();
    wasRunning.current = running;
  }, [running]);

  const openOnFretboard = (root: string, scaleKey: string) => {
    setSelectedRoot(root);
    setSelectedScale(scaleKey);
    setActiveTab('fretboard');
  };

  const generate = () => {
    if (!coach.canGenerate) return;
    void coach.generate();
  };

  const showPlanArea = running || coach.plan !== '' || coach.steps.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <PageTitle>Coach</PageTitle>
        <p className="mt-1 text-[13px] text-muted">
          Tell it what you want to work on. Claude researches it and writes a practice plan for your level.
        </p>
      </header>

      {!coach.apiKeySet && <ApiKeyPanel />}

      <Panel title="Your goal">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Level</span>
            <SegmentedControl<Difficulty>
              ariaLabel="Player level"
              options={LEVEL_OPTIONS}
              value={coach.difficulty}
              onChange={coach.setDifficulty}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={goalId} className="text-xs text-muted">
              What do you want to master?
            </label>
            <textarea
              id={goalId}
              rows={3}
              maxLength={MAX_GOAL_LENGTH}
              value={coach.goal}
              onChange={(e) => coach.setGoal(e.target.value)}
              onKeyDown={(e) => {
                // Cmd/Ctrl+Enter submits; plain Enter stays a newline
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  generate();
                }
              }}
              placeholder="e.g. Clean up my alternate picking so I can play Animals as Leaders riffs at 140 BPM"
              className="w-full resize-y rounded-control border border-control bg-surface px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-muted hover:border-ink"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted">Or start from</span>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <Chip key={ex} pressed={coach.goal === ex} onClick={() => coach.setGoal(ex)} className="max-w-full truncate">
                  {ex}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {running ? (
              <Button ref={stopRef} type="button" variant="secondary" size="lg" onClick={coach.stop}>
                Stop
              </Button>
            ) : (
              <Button
                ref={generateRef}
                type="submit"
                variant="ink"
                size="lg"
                aria-disabled={!coach.canGenerate || undefined}
                className={BUSY_CLASS}
              >
                Generate plan
              </Button>
            )}
            <p className="text-xs text-muted">
              {!coach.apiKeySet
                ? 'Set your Anthropic API key above first.'
                : running
                  ? 'Researching… this takes about a minute.'
                  : 'Runs one or two web searches plus a few model calls on your key.'}
            </p>
          </div>
        </form>
      </Panel>

      {coach.error && <Notice tone="error">{coach.error}</Notice>}

      {showPlanArea && (
        <>
          {coach.steps.length > 0 &&
            (running ? (
              <Panel title="Research" subtitle={String(coach.steps.length)}>
                {/* Polite log: new steps are announced without stealing focus */}
                <div role="log" aria-live="polite" aria-label="Coach activity">
                  <StepList steps={coach.steps} />
                </div>
              </Panel>
            ) : (
              <details className="group rounded-panel border border-line bg-surface">
                <summary className="cursor-pointer list-none px-5 py-3.5 text-[13px] font-bold marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90" aria-hidden="true">
                    ›
                  </span>
                  Research steps <span className="font-medium text-muted">{coach.steps.length}</span>
                </summary>
                <div className="px-5 pb-4">
                  <StepList steps={coach.steps} />
                </div>
              </details>
            ))}

          <Panel title="Practice plan" subtitle={coach.runGoal}>
            {coach.plan === '' ? (
              <p role="status" className="py-6 text-center text-[13px] text-muted">
                {running ? 'Writing your plan once the research is in…' : 'Stopped before the plan was written.'}
              </p>
            ) : (
              <div aria-busy={running}>
                <PlanMarkdown markdown={coach.plan} />
              </div>
            )}

            {coach.truncated && (
              <Notice className="mt-4">The plan hit the length cap and may end mid-section.</Notice>
            )}

            {mentions.length > 0 && (
              <section aria-labelledby="coach-scales" className="mt-6 border-t border-line pt-4">
                <h3 id="coach-scales" className="mb-2.5 text-xs text-muted">
                  Scales in this plan
                </h3>
                <div className="flex flex-wrap gap-2">
                  {mentions.map((m) => (
                    <Button
                      key={`${m.root}:${m.scaleKey}`}
                      variant="secondary"
                      size="sm"
                      icon={Music}
                      aria-label={`Show ${m.label} on the fretboard`}
                      onClick={() => openOnFretboard(m.root, m.scaleKey)}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
              </section>
            )}

            {coach.status === 'done' && coach.sources.length > 0 && (
              <section aria-labelledby="coach-sources" className="mt-6 border-t border-line pt-4">
                <h3 id="coach-sources" className="mb-2 text-xs text-muted">
                  Sources
                </h3>
                <ul className="flex flex-col gap-1 text-[13px]">
                  {coach.sources.map((s) => (
                    <li key={s.url} className="min-w-0 truncate">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-line-strong underline-offset-2 hover:decoration-ink"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {coach.usage && <p className="tabular mt-5 font-mono text-xs text-muted">{usageLine(coach.usage)}</p>}
          </Panel>
        </>
      )}

      {plans.length > 0 && (
        <Panel title="Saved plans" subtitle={String(plans.length)} flush>
          <ul className="border-t border-line">
            {plans.map((p) => {
              const current = p.id === coach.savedPlanId;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.goal}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      <span className="capitalize">{p.difficulty}</span> ·{' '}
                      <span className="tabular font-mono">{new Date(p.createdAt).toLocaleDateString()}</span>
                      {current && ' · showing'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Open plan: ${p.goal}`}
                      onClick={() => coach.openSaved(p.id)}
                      disabled={running}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      iconOnly
                      aria-label={`Delete plan: ${p.goal}`}
                      onClick={() => deletePlan(p.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {coach.apiKeySet && <ApiKeyPanel />}
    </div>
  );
}
