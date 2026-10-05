/**
 * auditComponents.test.tsx
 *
 * Regression tests for component defects found during the repository audit:
 *  - "Relative minor/major" links in RelatedScales kept the old root
 *    (C major → C minor instead of A minor);
 *  - FooterInfoBar played every note at octave 4, so scales dropped an
 *    octave after B instead of ascending.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RelatedScales from '../components/reference/RelatedScales';
import FooterInfoBar from '../components/FooterInfoBar';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';

beforeEach(() => {
  useGuitarStore.setState({ selectedRoot: 'C', selectedScale: 'major', isPlayingScale: false });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('RelatedScales', () => {
  it('moves to the relative minor root (C major → A minor)', () => {
    render(<RelatedScales scaleKey="major" root="C" />);
    fireEvent.click(screen.getByText('Relative minor'));

    const { selectedRoot, selectedScale } = useGuitarStore.getState();
    expect(selectedScale).toBe('minor');
    expect(selectedRoot).toBe('A');
  });

  it('keeps the root for parallel relationships (C major → C mixolydian)', () => {
    render(<RelatedScales scaleKey="major" root="C" />);
    fireEvent.click(screen.getByText('Parallel mode (b7)'));

    const { selectedRoot, selectedScale } = useGuitarStore.getState();
    expect(selectedScale).toBe('mixolydian');
    expect(selectedRoot).toBe('C');
  });
});

describe('FooterInfoBar playback', () => {
  it('plays A minor as an ascending line, moving up an octave at C', () => {
    vi.useFakeTimers();
    const playNote = vi.spyOn(audioEngine, 'playNote').mockImplementation(() => {});
    useGuitarStore.setState({ selectedRoot: 'A', selectedScale: 'minor' });

    render(<FooterInfoBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Play scale' }));
    act(() => { vi.advanceTimersByTime(5000); });

    const played = playNote.mock.calls.map(([note, octave]) => `${note}${octave}`);
    expect(played).toEqual(['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4']);
  });
});
