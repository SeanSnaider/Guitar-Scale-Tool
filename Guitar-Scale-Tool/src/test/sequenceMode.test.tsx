/**
 * sequenceMode.test.tsx
 *
 * Ear Training's Sequence mode asks the player to click scale notes in
 * order on a fretboard. These tests drive the mode end to end inside the
 * Ear Training tab: the fretboard must be present there, correct clicks
 * advance the score, and a note clicked before Start is not scored.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    startSession: vi.fn(() => Promise.reject(new Error('offline'))),
    endSession: vi.fn(() => Promise.resolve()),
    recordScaleAttempt: vi.fn(() => Promise.reject(new Error('offline'))),
  };
});

import EarTrainingView from '../components/ear-training/EarTrainingView';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';

beforeEach(() => {
  vi.spyOn(audioEngine, 'playNoteAtPosition').mockImplementation(() => {});
  useGuitarStore.setState({
    selectedRoot: 'C',
    selectedScale: 'major',
    selectedPosition: null,
    showNonScaleNotes: false,
    displayMode: 'notes',
    lastClickedNote: null,
    earTrainingMode: 'intervals',
  });
});

/** Switches to Sequence mode and presses Start. */
async function startSequenceMode(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Sequence' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
  });
}

describe('Ear Training Sequence mode', () => {
  it('shows a fretboard to play on while the exercise is running', async () => {
    render(<EarTrainingView />);
    await startSequenceMode();
    expect(screen.getAllByRole('button', { name: 'C (Root)' }).length).toBeGreaterThan(0);
  });

  it('scores correct clicks on the embedded fretboard', async () => {
    render(<EarTrainingView />);
    await startSequenceMode();

    fireEvent.click(screen.getAllByRole('button', { name: 'C (Root)' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'D' })[0]);

    expect(screen.getByText('Score: 2/2')).toBeInTheDocument();
  });

  it('does not score a note that was clicked before Start', async () => {
    useGuitarStore.setState({ lastClickedNote: 'F#' });
    render(<EarTrainingView />);
    await startSequenceMode();

    expect(screen.getByText('Score: 0/0')).toBeInTheDocument();
  });
});
