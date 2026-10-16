/**
 * UiDefectFixes.test.tsx
 *
 * Regression tests for the ear-training, progress and library UI fixes:
 *   - Sequence mastery is tracked locally (no server needed)
 *   - Progress parses learned keys in both formats and "Practice" sets root + scale
 *   - Accessible names match visible labels (WCAG 2.5.3)
 *   - Re-pressing the active exercise type keeps the session; question audio
 *     plays the full scale and stops when the view goes away
 *
 * There is no server: history lives in useHistoryStore, reset per test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { useGuitarStore } from '../store/useGuitarStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { SCALES } from '../data/musicTheory';

vi.mock('../audio/AudioEngine', () => ({
  audioEngine: { playNote: vi.fn(), playNoteAtPosition: vi.fn() },
}));

// The board itself is covered elsewhere; sequence answers are fed through the
// store's lastClickedNote, exactly as a fretboard tap does.
vi.mock('../components/Fretboard', () => ({ default: () => null }));

import { audioEngine } from '../audio/AudioEngine';
import EarTrainingView from '../components/ear-training/EarTrainingView';
import ProgressDashboard from '../components/ProgressDashboard';
import ScalesBrowser from '../components/ScalesBrowser';
import Tablature from '../components/Tablature';

const initialState = useGuitarStore.getInitialState();
const initialHistory = useHistoryStore.getInitialState();

beforeEach(() => {
  localStorage.clear();
  useGuitarStore.setState(initialState, true);
  useHistoryStore.setState(initialHistory, true);
  vi.mocked(audioEngine.playNote).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setBpm(bpm: number) {
  useGuitarStore.setState((s) => ({ metronome: { ...s.metronome, bpm } }));
}

/** Simulates a fretboard tap. */
function tap(note: string) {
  act(() => useGuitarStore.getState().setLastClickedNote(note));
}

const C_MAJOR = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

function startSequence() {
  useGuitarStore.setState({ selectedRoot: 'C', selectedScale: 'major' });
  render(<EarTrainingView />);
  fireEvent.click(screen.getByRole('button', { name: 'Sequence' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));
}

// ─── Sequence mastery (local) ────────────────────────────────────────────────

describe('Sequence mastery is tracked locally', () => {
  it('three clean runs at 120 BPM mark the scale learned without a server', () => {
    setBpm(120);
    startSequence();

    for (let run = 1; run <= 3; run++) {
      C_MAJOR.forEach(tap);
      expect(useGuitarStore.getState().sequenceMastery['C-major']).toBe(run);
    }

    const state = useGuitarStore.getState();
    expect(state.learnedScales.has('C-major')).toBe(true);
    expect(state.userStats.totalScalesLearned).toBe(1);
    expect(screen.getByText(/C Major \(Ionian\) is now learned!/)).toBeInTheDocument();
    expect(screen.getByText('3/3 at 120 BPM')).toBeInTheDocument();
  });

  it('a wrong note at 120 BPM resets mastery to 0, and that run does not count', () => {
    setBpm(120);
    startSequence();
    C_MAJOR.forEach(tap);
    expect(useGuitarStore.getState().sequenceMastery['C-major']).toBe(1);

    tap('C');
    tap('F#'); // wrong
    expect(useGuitarStore.getState().sequenceMastery['C-major']).toBe(0);
    C_MAJOR.slice(1).forEach(tap); // finish the flawed run
    expect(useGuitarStore.getState().sequenceMastery['C-major']).toBe(0);
    expect(screen.getByText('0/3 at 120 BPM')).toBeInTheDocument();
  });

  it('runs below 120 BPM neither count nor reset', () => {
    useGuitarStore.getState().setSequenceMastery('C-major', 2);
    setBpm(100);
    startSequence();
    C_MAJOR.forEach(tap);
    tap('F#');
    expect(useGuitarStore.getState().sequenceMastery['C-major']).toBe(2);
    expect(useGuitarStore.getState().learnedScales.has('C-major')).toBe(false);
  });

  it('ending a session with answers records a practice day', () => {
    setBpm(120);
    startSequence();
    tap('C');
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    const stats = useGuitarStore.getState().userStats;
    expect(stats.currentStreak).toBe(1);
    expect(stats.lastPracticeDate).not.toBeNull();
    // "End" unmounted; focus lands on the next action
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus();
  });
});

// ─── Progress: learned key parsing ───────────────────────────────────────────

describe('Progress learned tab', () => {
  async function renderLearnedTab() {
    render(<ProgressDashboard />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Learned' }));
  }

  it('lists Sequence-learned keys ("G-dorian") and legacy keys ("A-minor-2")', async () => {
    useGuitarStore.setState({ learnedScales: new Set(['G-dorian', 'A-minor-2']) });
    await renderLearnedTab();

    expect(screen.getByText(`G ${SCALES.dorian.name}`)).toBeInTheDocument();
    expect(screen.getByText(`A ${SCALES.minor.name}`)).toBeInTheDocument();
    // Only the legacy key carries a position
    expect(screen.getAllByText(/Position/)).toHaveLength(1);
  });

  it('"Practice" loads both the root and the scale, then opens the fretboard', async () => {
    useGuitarStore.setState({
      learnedScales: new Set(['G-dorian']),
      selectedRoot: 'C',
      selectedScale: 'major',
      activeTab: 'progress',
    });
    await renderLearnedTab();

    fireEvent.click(screen.getByRole('button', { name: `Practice G ${SCALES.dorian.name}` }));
    const s = useGuitarStore.getState();
    expect(s.selectedRoot).toBe('G');
    expect(s.selectedScale).toBe('dorian');
    expect(s.activeTab).toBe('fretboard');
  });

  it('empty state points to Sequence practice, not a missing control', async () => {
    await renderLearnedTab();
    expect(screen.getByText(/Sequence practice \(Ear training\) at 120 BPM/)).toBeInTheDocument();
  });

  it('a lapsed streak reads 0', async () => {
    useGuitarStore.setState((s) => ({
      userStats: { ...s.userStats, currentStreak: 5, longestStreak: 5, lastPracticeDate: '2020-01-01' },
    }));
    render(<ProgressDashboard />);
    await act(async () => {});
    const streak = screen.getByText('Current streak').parentElement!;
    expect(within(streak).getByText('0')).toBeInTheDocument();
  });
});

// ─── Accessible names (WCAG 2.5.3) ───────────────────────────────────────────

describe('Accessible names start with the visible label', () => {
  it('Tablature direction options are named by their visible text', () => {
    render(<Tablature />);
    const group = screen.getByRole('group', { name: 'Playback direction' });
    for (const label of ['Up', 'Down', 'Up & down']) {
      expect(within(group).getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('Library "Load on fretboard" keeps its text as the name and the scale as its description', () => {
    useGuitarStore.setState({ selectedScale: 'major' });
    render(<ScalesBrowser />);

    const loads = screen.getAllByRole('button', { name: 'Load on fretboard' });
    expect(loads.length).toBeGreaterThan(0);
    expect(loads[0]).toHaveAccessibleDescription(/\S/);

    const loaded = screen.getByRole('button', { name: 'Loaded' });
    expect(loaded).toHaveAccessibleDescription(SCALES.major.name);
  });

  it('a pressed category still applies while searching', () => {
    render(<ScalesBrowser />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search scales' }), { target: { value: 'minor' } });
    const allCount = screen.getAllByRole('button', { name: /Load on fretboard|Loaded/ }).length;
    fireEvent.click(screen.getByRole('button', { name: 'Modes' }));
    const filtered = screen.queryAllByRole('button', { name: /Load on fretboard|Loaded/ }).length;
    expect(filtered).toBeLessThan(allCount);
  });
});

// ─── Ear training: same-mode guard and question audio ────────────────────────

describe('Ear training session control', () => {
  it('re-pressing the active exercise type keeps the session', async () => {
    useGuitarStore.setState({ earTrainingMode: 'intervals' });
    render(<EarTrainingView />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    await act(async () => {});

    expect(screen.getByRole('progressbar', { name: 'Session progress' })).toBeInTheDocument();
    // Start unmounted; the new question's play button has focus
    expect(screen.getByRole('button', { name: 'Tap to hear' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Intervals' }));
    expect(screen.getByRole('progressbar', { name: 'Session progress' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();

    // A different type does reset to its start screen
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument();
  });

  it('the progress bar reads its counts as one sentence', async () => {
    useGuitarStore.setState({ earTrainingMode: 'notes' });
    render(<EarTrainingView />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    await act(async () => {});
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Question 1 of 10, 0 correct, 0 incorrect',
    );
  });

  it('scale questions play the full scale up to the octave, rising across the octave break', async () => {
    vi.useFakeTimers();
    // Root index floor(0.76 * 12) = 9 (A); scale index floor(0.76 * 8) = 6 (phrygian)
    vi.spyOn(Math, 'random').mockReturnValue(0.76);
    useGuitarStore.setState({ earTrainingMode: 'scales' });
    render(<EarTrainingView />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(vi.mocked(audioEngine.playNote).mock.calls.map(([n, o]) => `${n}${o}`)).toEqual([
      'A4', 'A#4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5',
    ]);
  });

  it('pending question notes stop when the view unmounts', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    useGuitarStore.setState({ earTrainingMode: 'scales' });
    const { unmount } = render(<EarTrainingView />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(160); // auto-play fires; first note sounds
    });
    expect(audioEngine.playNote).toHaveBeenCalledTimes(1);

    unmount();
    vi.advanceTimersByTime(5000);
    expect(audioEngine.playNote).toHaveBeenCalledTimes(1);
  });
});
