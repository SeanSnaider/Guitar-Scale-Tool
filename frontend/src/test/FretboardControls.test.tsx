/**
 * FretboardControls.test.tsx
 *
 * The Practice control strip (FretboardControls) and the fretboard panel's
 * options (FretboardOptions). The store is mocked with setter stubs so each
 * control can be checked for the store call it dispatches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FretboardControls, { FretboardOptions } from '../components/fretboard/FretboardControls';
import { TUNINGS } from '../data/musicTheory';

const mockSetSelectedRoot = vi.fn();
const mockSetSelectedScale = vi.fn();
const mockSetCurrentTuning = vi.fn();
const mockSetDisplayMode = vi.fn();
const mockSetShowNonScaleNotes = vi.fn();
const mockSetNumFrets = vi.fn();
const mockSetPositionSystem = vi.fn();
const mockSetSelectedPosition = vi.fn();

const mockState = {
  selectedRoot: 'C',
  setSelectedRoot: mockSetSelectedRoot,
  selectedScale: 'major',
  setSelectedScale: mockSetSelectedScale,
  currentTuning: TUNINGS['standard'],
  setCurrentTuning: mockSetCurrentTuning,
  displayMode: 'notes',
  setDisplayMode: mockSetDisplayMode,
  showNonScaleNotes: true,
  setShowNonScaleNotes: mockSetShowNonScaleNotes,
  numFrets: 24,
  setNumFrets: mockSetNumFrets,
  positionSystem: 'caged',
  setPositionSystem: mockSetPositionSystem,
  selectedPosition: 1 as number | null,
  setSelectedPosition: mockSetSelectedPosition,
};

vi.mock('../store/useGuitarStore', () => ({
  useGuitarStore: vi.fn((selector?: (s: typeof mockState) => unknown) => (selector ? selector(mockState) : mockState)),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockState.displayMode = 'notes';
  mockState.positionSystem = 'caged';
  mockState.selectedPosition = 1;
  mockState.showNonScaleNotes = true;
  mockState.numFrets = 24;
});

describe('FretboardControls selects', () => {
  it('labels the root, scale and tuning selects', () => {
    render(<FretboardControls />);
    expect(screen.getByRole('combobox', { name: 'Root note' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Scale' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Tuning' })).toBeDefined();
  });

  it('changing the root calls setSelectedRoot', () => {
    render(<FretboardControls />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Root note' }), { target: { value: 'G' } });
    expect(mockSetSelectedRoot).toHaveBeenCalledWith('G');
  });

  it('changing the scale calls setSelectedScale', () => {
    render(<FretboardControls />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Scale' }), { target: { value: 'minor' } });
    expect(mockSetSelectedScale).toHaveBeenCalledWith('minor');
  });

  it('changing the tuning passes the tuning definition', () => {
    render(<FretboardControls />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Tuning' }), { target: { value: 'dropD' in TUNINGS ? 'dropD' : Object.keys(TUNINGS)[1] } });
    expect(mockSetCurrentTuning).toHaveBeenCalledTimes(1);
  });
});

describe('FretboardControls display mode', () => {
  it('offers all four display modes in a named group', () => {
    render(<FretboardControls />);
    expect(screen.getByRole('group', { name: 'Display mode' })).toBeDefined();
    for (const m of ['Dots', 'Notes', 'Intervals', 'Patterns']) expect(screen.getByRole('button', { name: m })).toBeDefined();
  });

  it('marks the current mode as pressed and switches on click', () => {
    render(<FretboardControls />);
    expect(screen.getByRole('button', { name: 'Notes' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Intervals' }));
    expect(mockSetDisplayMode).toHaveBeenCalledWith('intervals');
  });
});

describe('FretboardControls positions', () => {
  it('switching the system resets to position 1', () => {
    render(<FretboardControls />);
    fireEvent.click(screen.getByRole('button', { name: 'Three notes per string' }));
    expect(mockSetPositionSystem).toHaveBeenCalledWith('3nps');
    expect(mockSetSelectedPosition).toHaveBeenCalledWith(1);
  });

  it('shows 5 CAGED positions plus All', () => {
    render(<FretboardControls />);
    expect(screen.getByRole('button', { name: 'All positions' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Position 5' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Position 6' })).toBeNull();
  });

  it('shows 7 positions for 3NPS', () => {
    mockState.positionSystem = '3nps';
    render(<FretboardControls />);
    expect(screen.getByRole('button', { name: 'Position 7' })).toBeDefined();
  });

  it('All clears the position; a number selects it', () => {
    render(<FretboardControls />);
    fireEvent.click(screen.getByRole('button', { name: 'All positions' }));
    expect(mockSetSelectedPosition).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'Position 3' }));
    expect(mockSetSelectedPosition).toHaveBeenCalledWith(3);
  });
});

describe('FretboardOptions', () => {
  it('non-scale notes is a switch reflecting the store', () => {
    render(<FretboardOptions />);
    const sw = screen.getByRole('switch', { name: 'Non-scale notes' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(mockSetShowNonScaleNotes).toHaveBeenCalledWith(false);
  });

  it('the frets slider is labelled and dispatches setNumFrets', () => {
    render(<FretboardOptions />);
    const slider = screen.getByRole('slider', { name: /Frets/ });
    expect(slider.getAttribute('aria-valuetext')).toBe('24 frets');
    fireEvent.change(slider, { target: { value: '15' } });
    expect(mockSetNumFrets).toHaveBeenCalledWith(15);
  });
});
