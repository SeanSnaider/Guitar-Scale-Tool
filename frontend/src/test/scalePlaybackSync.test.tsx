/**
 * scalePlaybackSync.test.tsx
 *
 * useScalePlayback against a stubbed engine: changing the notes or tempo
 * mid-run restarts the run (so the ring and tab match what sounds), the
 * engine's own -1 while restarting is not read as "finished", and the Space
 * shortcut only works on the Practice view. Plus the transport's focus and
 * ARIA fixes (TempoStepper limits, SoundPanel close button).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useRef } from 'react';

const engine = vi.hoisted(() => ({
  onScaleNotePlay: null as ((i: number) => void) | null,
  scheduleScalePlayback: vi.fn(),
  stopScalePlayback: vi.fn(),
}));
vi.mock('../audio/AudioEngine', () => ({ audioEngine: engine }));

import { useScalePlayback } from '../practice/useScalePlayback';
import { useGuitarStore } from '../store/useGuitarStore';
import { TUNINGS } from '../data/musicTheory';
import { TempoStepper } from '../components/shell/TempoStepper';
import { SoundPanel } from '../components/shell/SoundPanel';

beforeEach(() => {
  engine.scheduleScalePlayback.mockReset();
  engine.stopScalePlayback.mockReset();
  // Like the real engine: starting tears down the old run, which reports -1
  engine.scheduleScalePlayback.mockImplementation(() => engine.onScaleNotePlay?.(-1));
  engine.stopScalePlayback.mockImplementation(() => engine.onScaleNotePlay?.(-1));
  useGuitarStore.setState({
    selectedRoot: 'C',
    selectedScale: 'major',
    currentTuning: TUNINGS['standard'],
    playbackDirection: 'ascending',
    isPlayingScale: false,
    playingIndex: -1,
    playingPosition: null,
    activeTab: 'fretboard',
    isAudioShelfOpen: false,
  });
  useGuitarStore.getState().setMetronome({ bpm: 100 });
});

describe('useScalePlayback', () => {
  it('restarts the run when the root changes mid-playback', () => {
    renderHook(() => useScalePlayback());
    act(() => useGuitarStore.getState().setIsPlayingScale(true));
    expect(engine.scheduleScalePlayback).toHaveBeenCalledTimes(1);
    const [cMidi] = engine.scheduleScalePlayback.mock.calls[0];
    act(() => engine.onScaleNotePlay?.(3));
    expect(useGuitarStore.getState().playingIndex).toBe(3);

    act(() => useGuitarStore.getState().setSelectedRoot('D'));
    expect(engine.scheduleScalePlayback).toHaveBeenCalledTimes(2);
    const [dMidi] = engine.scheduleScalePlayback.mock.calls[1];
    expect(dMidi).not.toEqual(cMidi);
    // Still playing (the restart's -1 was swallowed) and the stale ring is gone
    expect(useGuitarStore.getState().isPlayingScale).toBe(true);
    expect(useGuitarStore.getState().playingIndex).toBe(-1);
  });

  it('restarts with the new tempo when BPM changes mid-playback', () => {
    renderHook(() => useScalePlayback());
    act(() => useGuitarStore.getState().setIsPlayingScale(true));
    act(() => useGuitarStore.getState().setMetronome({ bpm: 140 }));
    expect(engine.scheduleScalePlayback).toHaveBeenCalledTimes(2);
    expect(engine.scheduleScalePlayback.mock.calls[1][1]).toBe(140);
  });

  it('a natural finish (-1 after notes played) stops playback', () => {
    renderHook(() => useScalePlayback());
    act(() => useGuitarStore.getState().setIsPlayingScale(true));
    act(() => engine.onScaleNotePlay?.(0));
    act(() => engine.onScaleNotePlay?.(-1));
    expect(useGuitarStore.getState().isPlayingScale).toBe(false);
  });

  it('Space on <body> toggles playback on Practice only', () => {
    renderHook(() => useScalePlayback());
    act(() => useGuitarStore.setState({ activeTab: 'library' }));
    fireEvent.keyDown(document.body, { code: 'Space', key: ' ' });
    expect(useGuitarStore.getState().isPlayingScale).toBe(false);

    act(() => useGuitarStore.setState({ activeTab: 'fretboard' }));
    fireEvent.keyDown(document.body, { code: 'Space', key: ' ' });
    expect(useGuitarStore.getState().isPlayingScale).toBe(true);
  });
});

describe('TempoStepper at its limits', () => {
  it('keeps the step button focusable (aria-disabled) and ignores clicks', () => {
    const onChange = vi.fn();
    render(<TempoStepper bpm={20} onChange={onChange} />);
    const slower = screen.getByRole('button', { name: 'Slower' });
    expect(slower).not.toBeDisabled();
    expect(slower).toHaveAttribute('aria-disabled', 'true');
    slower.focus();
    fireEvent.click(slower);
    expect(onChange).not.toHaveBeenCalled();
    expect(slower).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Faster' })).not.toHaveAttribute('aria-disabled');
  });

  it('exposes the value as a spinbutton', () => {
    render(<TempoStepper bpm={120} onChange={() => {}} />);
    const spin = screen.getByRole('spinbutton', { name: 'Beats per minute' });
    expect(spin).toHaveAttribute('aria-valuenow', '120');
    expect(spin).toHaveAttribute('aria-valuemin', '20');
    expect(spin).toHaveAttribute('aria-valuemax', '300');
    expect(spin).toHaveAttribute('aria-valuetext', '120 BPM');
  });
});

describe('SoundPanel close button', () => {
  function Harness() {
    const anchor = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={anchor}>Sound settings</button>
        <SoundPanel anchorRef={anchor} />
      </>
    );
  }

  it('returns focus to the settings button', () => {
    useGuitarStore.setState({ isAudioShelfOpen: true });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Close sound settings' }));
    expect(useGuitarStore.getState().isAudioShelfOpen).toBe(false);
    expect(screen.getByRole('button', { name: 'Sound settings' })).toHaveFocus();
  });
});
