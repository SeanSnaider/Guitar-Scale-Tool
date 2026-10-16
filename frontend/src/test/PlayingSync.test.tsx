/**
 * PlayingSync.test.tsx
 *
 * The revamp's signature behaviour: while the scale plays, the note that is
 * sounding is marked in BOTH places at once, the playing ring on the
 * fretboard and the highlighted column in the tablature. Both read the same
 * store fields (playingIndex / playingPosition) that useScalePlayback writes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import Fretboard from '../components/Fretboard';
import Tablature from '../components/Tablature';
import { useGuitarStore } from '../store/useGuitarStore';
import { TUNINGS } from '../data/musicTheory';
import { buildAscendingPattern } from '../practice/scalePattern';
import { SCALES } from '../data/musicTheory';

beforeEach(() => {
  useGuitarStore.setState({
    selectedRoot: 'C',
    selectedScale: 'major',
    currentTuning: TUNINGS['standard'],
    playbackDirection: 'ascending',
    numFrets: 15,
    selectedPosition: null,
    showNonScaleNotes: false,
    displayMode: 'notes',
    playingIndex: -1,
    playingPosition: null,
  });
});

describe('playing note sync', () => {
  it('nothing is marked when idle', () => {
    const { container } = render(
      <>
        <Fretboard />
        <Tablature />
      </>,
    );
    expect(container.querySelectorAll('[data-playing]')).toHaveLength(0);
  });

  it('marks the same note on the fretboard and in the tab', () => {
    const { container } = render(
      <>
        <Fretboard />
        <Tablature />
      </>,
    );

    // First note of the ascending pattern: C on the low E string
    const pattern = buildAscendingPattern('C', SCALES.major.intervals, TUNINGS.standard.notes);
    const first = pattern[0];
    const storeString = TUNINGS.standard.strings - 1 - first.string;

    act(() => {
      useGuitarStore.getState().setPlaying(0, { string: storeString, fret: first.fret });
    });

    const ringed = container.querySelectorAll('[data-playing]');
    expect(ringed).toHaveLength(1);
    expect(ringed[0].getAttribute('data-string')).toBe(String(storeString));
    expect(ringed[0].getAttribute('data-fret')).toBe(String(first.fret));

    // The tab's playing fret button carries the accent fill
    const tabButtons = [...container.querySelectorAll('button')].filter((b) => b.className.includes('bg-accent text-on-accent') || b.className.includes('bg-accent font-bold'));
    expect(tabButtons.some((b) => b.textContent === String(first.fret))).toBe(true);
  });

  it('clears both when playback stops', () => {
    const { container } = render(<Fretboard />);
    act(() => useGuitarStore.getState().setPlaying(0, { string: 0, fret: 8 }));
    expect(container.querySelectorAll('[data-playing]')).toHaveLength(1);
    act(() => useGuitarStore.getState().setPlaying(-1, null));
    expect(container.querySelectorAll('[data-playing]')).toHaveLength(0);
  });
});
