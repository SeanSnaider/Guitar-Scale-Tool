/**
 * usePracticeCoach.ts
 *
 * State for the Coach view: the goal form, one agent run at a time (with
 * Stop), the live trace and streaming plan, and saving finished plans to
 * this browser's history.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiKeyStore } from '../ai/apiKey';
import { describeClaudeError, isCancelledRequest } from '../ai/claude';
import { CoachError, runCoach, type CoachResult, type CoachSource, type CoachStep } from '../coach/runCoach';
import { buildGoalMessage, type Difficulty } from '../coach/prompt';
import { SCALES, spellScale } from '../data/musicTheory';
import { parseLearnedScaleKey } from '../store/progress';
import { useGuitarStore } from '../store/useGuitarStore';
import { chordStats, useHistoryStore } from '../store/useHistoryStore';

export type CoachStatus = 'idle' | 'running' | 'done' | 'error';

/** Longest goal sent, matching FretAgent's server-side limit. */
export const MAX_GOAL_LENGTH = 1000;

/** Learned scales as readable names ("G Dorian"), for personalising the prompt. */
function learnedScaleNames(keys: Iterable<string>): string[] {
  return [...keys].flatMap((k) => {
    const p = parseLearnedScaleKey(k);
    const scale = p && SCALES[p.scaleKey];
    return p && scale ? [`${spellScale(p.root, p.scaleKey)[0] ?? p.root} ${scale.name}`] : [];
  });
}

export function usePracticeCoach() {
  const apiKey = useApiKeyStore((s) => s.apiKey);
  const savePlan = useHistoryStore((s) => s.savePlan);

  const [goal, setGoal] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [status, setStatus] = useState<CoachStatus>('idle');
  const [steps, setSteps] = useState<CoachStep[]>([]);
  const [plan, setPlan] = useState('');
  const [sources, setSources] = useState<CoachSource[]>([]);
  /** Token and tool counts for a fresh run; null for a reopened saved plan. */
  const [usage, setUsage] = useState<CoachResult['usage'] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The goal of the run on screen (the field may have been edited since). */
  const [runGoal, setRunGoal] = useState('');
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  // A run outliving the view would keep spending tokens; stop it
  useEffect(() => () => controllerRef.current?.abort(), []);

  const canGenerate = apiKey !== '' && goal.trim() !== '' && status !== 'running';

  const generate = useCallback(async () => {
    const trimmed = goal.trim().slice(0, MAX_GOAL_LENGTH);
    if (!apiKey || !trimmed) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const guitar = useGuitarStore.getState();
    const goalMessage = buildGoalMessage(trimmed, difficulty, {
      tuningName: guitar.currentTuning.name,
      learnedScales: learnedScaleNames(guitar.learnedScales),
      topChords: chordStats(useHistoryStore.getState().chords).mostCommon.map((c) => c.chord),
    });

    setStatus('running');
    setSteps([]);
    setPlan('');
    setSources([]);
    setUsage(null);
    setTruncated(false);
    setError(null);
    setRunGoal(trimmed);
    setSavedPlanId(null);

    try {
      const res = await runCoach({
        apiKey,
        goalMessage,
        tuning: { name: guitar.currentTuning.name, notes: guitar.currentTuning.notes },
        signal: controller.signal,
        onSteps: setSteps,
        onPlan: setPlan,
      });
      if (controller.signal.aborted) return;
      setPlan(res.markdown);
      setSources(res.sources);
      setUsage(res.usage);
      setTruncated(res.truncated);
      setStatus('done');
      setSavedPlanId(savePlan({ goal: trimmed, difficulty, markdown: res.markdown, sources: res.sources }));
    } catch (err) {
      if (isCancelledRequest(err) || controller.signal.aborted) {
        setStatus((s) => (s === 'running' ? 'idle' : s));
        return;
      }
      setError(err instanceof CoachError ? err.message : describeClaudeError(err));
      setStatus('error');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [apiKey, goal, difficulty, savePlan]);

  /** Stops the run in progress; what streamed so far stays on screen. */
  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus('idle');
  }, []);

  /** Shows a saved plan in place of the current one. */
  const openSaved = useCallback((id: string) => {
    const saved = useHistoryStore.getState().plans.find((p) => p.id === id);
    if (!saved) return;
    controllerRef.current?.abort();
    setStatus('done');
    setSteps([]);
    setPlan(saved.markdown);
    setSources(saved.sources);
    setUsage(null);
    setTruncated(false);
    setError(null);
    setRunGoal(saved.goal);
    setSavedPlanId(saved.id);
  }, []);

  return {
    apiKeySet: apiKey !== '',
    goal,
    setGoal,
    difficulty,
    setDifficulty,
    status,
    steps,
    plan,
    sources,
    usage,
    truncated,
    error,
    runGoal,
    savedPlanId,
    canGenerate,
    generate,
    stop,
    openSaved,
  };
}
