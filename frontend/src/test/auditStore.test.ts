/**
 * auditStore.test.ts
 *
 * Regression tests for store defects found during the repository audit:
 * XP farming by toggling a learned scale, idempotent "mark learned",
 * streak dates computed in UTC instead of the user's local day, and
 * object-returning selector hooks that loop forever under zustand v5.
 *
 * TZ is pinned to US Eastern so the local/UTC date mismatch is
 * reproducible on any machine.
 */
declare const process: { env: Record<string, string | undefined> };
process.env.TZ = 'America/New_York';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGuitarStore, useSelectedScale, useDisplayOptions } from '../store/useGuitarStore';

const FRESH_STATS = {
  totalScalesLearned: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalPracticeMinutes: 0,
  lastPracticeDate: null,
  xp: 0,
  level: 1,
  achievements: [],
};

beforeEach(() => {
  useGuitarStore.setState({
    userStats: { ...FRESH_STATS },
    learnedScales: new Set<string>(),
    rewardedScales: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('learned scale XP', () => {
  it('cannot be farmed by toggling the same scale off and on', () => {
    const { toggleLearnedScale } = useGuitarStore.getState();
    for (let i = 0; i < 10; i++) {
      toggleLearnedScale('C-major'); // on
      toggleLearnedScale('C-major'); // off
    }
    toggleLearnedScale('C-major'); // finally on

    const { userStats, learnedScales } = useGuitarStore.getState();
    expect(learnedScales.has('C-major')).toBe(true);
    expect(userStats.xp).toBe(10);
    expect(userStats.totalScalesLearned).toBe(1);
  });

  it('markScaleLearned is idempotent and never un-learns a scale', () => {
    const { markScaleLearned } = useGuitarStore.getState();
    markScaleLearned('A-minor');
    markScaleLearned('A-minor');

    const { userStats, learnedScales } = useGuitarStore.getState();
    expect(learnedScales.has('A-minor')).toBe(true);
    expect(userStats.xp).toBe(10);
    expect(userStats.totalScalesLearned).toBe(1);
  });
});

describe('incrementStreak', () => {
  it('uses the local calendar day, not the UTC day', () => {
    // 21:30 on Oct 4 in New York is already Oct 5 in UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T01:30:00Z'));
    expect(new Date().getDate()).toBe(4); // sanity: TZ override is active

    useGuitarStore.setState({
      userStats: { ...FRESH_STATS, currentStreak: 3, longestStreak: 3, lastPracticeDate: '2026-10-03' },
    });
    useGuitarStore.getState().incrementStreak();

    const { userStats } = useGuitarStore.getState();
    expect(userStats.lastPracticeDate).toBe('2026-10-04');
    expect(userStats.currentStreak).toBe(4);
  });
});

describe('selector hooks', () => {
  it('useSelectedScale returns a stable value without an infinite render loop', () => {
    const { result } = renderHook(() => useSelectedScale());
    expect(result.current).toEqual({ root: 'C', scale: 'major' });
  });

  it('useDisplayOptions returns a stable value without an infinite render loop', () => {
    const { result } = renderHook(() => useDisplayOptions());
    expect(result.current).toHaveProperty('displayMode');
  });
});
