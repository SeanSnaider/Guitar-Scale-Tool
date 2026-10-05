/**
 * FretboardControls.test.tsx
 *
 * Tests for the FretboardControls component
 * (src/components/fretboard/FretboardControls.tsx).
 * The Zustand store is mocked with controllable setter stubs so we can
 * verify that every UI action dispatches the correct store call.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FretboardControls from '../components/fretboard/FretboardControls';
import { TUNINGS } from '../data/musicTheory';

// ─────────────────────────────────────────────────────────────────────────────
// Store mock
// ─────────────────────────────────────────────────────────────────────────────

const mockSetSelectedRoot       = vi.fn();
const mockSetSelectedScale      = vi.fn();
const mockSetCurrentTuning      = vi.fn();
const mockSetDisplayMode        = vi.fn();
const mockSetShowNonScaleNotes  = vi.fn();
const mockSetNumFrets           = vi.fn();
const mockSetPositionSystem     = vi.fn();
const mockSetSelectedPosition   = vi.fn();

/** Shared controlled state returned by the mock store. */
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
  selectedPosition: 1,
  setSelectedPosition: mockSetSelectedPosition,
};

vi.mock('../store/useGuitarStore', () => ({
  useGuitarStore: vi.fn(() => mockState),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to default state before each test
  mockState.selectedRoot = 'C';
  mockState.selectedScale = 'major';
  mockState.displayMode = 'notes';
  mockState.positionSystem = 'caged';
  mockState.selectedPosition = 1;
  mockState.showNonScaleNotes = true;
  mockState.numFrets = 24;
  mockState.currentTuning = TUNINGS['standard'];
});

// ─────────────────────────────────────────────────────────────────────────────
// Dropdown rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('FretboardControls dropdown labels', () => {
  it('renders Root Note label', () => {
    render(<FretboardControls />);
    expect(screen.getByText('Root Note')).toBeDefined();
  });

  it('renders Scale Type label', () => {
    render(<FretboardControls />);
    expect(screen.getByText('Scale Type')).toBeDefined();
  });

  it('renders Tuning label', () => {
    render(<FretboardControls />);
    expect(screen.getByText('Tuning')).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Display mode segmented toggle
// ─────────────────────────────────────────────────────────────────────────────

describe('FretboardControls display mode toggle', () => {
  it('renders all four display mode buttons', () => {
    render(<FretboardControls />);
    expect(screen.getByText('Dots')).toBeDefined();
    expect(screen.getByText('Notes')).toBeDefined();
    expect(screen.getByText('Intervals')).toBeDefined();
    expect(screen.getByText('Patterns')).toBeDefined();
  });

  it('clicking Dots calls setDisplayMode with "dots"', () => {
    render(<FretboardControls />);
    fireEvent.click(screen.getByText('Dots'));
    expect(mockSetDisplayMode).toHaveBeenCalledWith('dots');
  });

  it('clicking Intervals calls setDisplayMode with "intervals"', () => {
    render(<FretboardControls />);
    fireEvent.click(screen.getByText('Intervals'));
    expect(mockSetDisplayMode).toHaveBeenCalledWith('intervals');
  });

  it('clicking Patterns calls setDisplayMode with "patterns"', () => {
    render(<FretboardControls />);
    fireEvent.click(screen.getByText('Patterns'));
    expect(mockSetDisplayMode).toHaveBeenCalledWith('patterns');
  });

  it('"Notes" button is aria-pressed=true when displayMode is "notes"', () => {
    render(<FretboardControls />);
    const notesBtn = screen.getByText('Notes').closest('button');
    expect(notesBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('"Dots" button is aria-pressed=false when displayMode is "notes"', () => {
    render(<FretboardControls />);
    const dotsBtn = screen.getByText('Dots').closest('button');
    expect(dotsBtn?.getAttribute('aria-pressed')).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Root note dropdown
// ─────────────────────────────────────────────────────────────────────────────

describe('FretboardControls root note dropdown', () => {
  it('shows "C" as current selected value', () => {
    render(<FretboardControls />);
    const selects = screen.getAllByRole('combobox');
    // First select is Root Note
    expect((selects[0] as HTMLSelectElement).value).toBe('C');
  });

  it('changing root note select calls setSelectedRoot', () => {
    render(<FretboardControls />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'G' } });
    expect(mockSetSelectedRoot).toHaveBeenCalledWith('G');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scale type dropdown
// ─────────────────────────────────────────────────────────────────────────────

describe('FretboardControls scale type dropdown', () => {
  it('shows "major" as current selected value', () => {
    render(<FretboardControls />);
    const selects = screen.getAllByRole('combobox');
    expect((selects[1] as HTMLSelectElement).value).toBe('major');
  });

  it('changing scale select calls setSelectedScale', () => {
    render(<FretboardControls />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'dorian' } });
    expect(mockSetSelectedScale).toHaveBeenCalledWith('dorian');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Muted notes checkbox
// ─────────────────────────────────────────────────────────────────────────────

describe('FretboardControls muted notes checkbox', () => {
  it('renders the "Muted notes" checkbox', () => {
    render(<FretboardControls />);
    expect(screen.getByText('Muted notes')).toBeDefined();
  });

  it('checkbox is checked when showNonScaleNotes is true', () => {
    render(<FretboardControls />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('unchecking calls setShowNonScaleNotes(false)', () => {
    render(<FretboardControls />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(mockSetShowNonScaleNotes).toHaveBeenCalledWith(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Position system buttons
// ─────────────────────────────────────────────────────────────────────────────

describe('FretboardControls position system', () => {
  it('renders CAGED button', () => {
    render(<FretboardControls />);
    expect(screen.getByText('CAGED')).toBeDefined();
  });

  it('renders 3NPS button', () => {
    render(<FretboardControls />);
    expect(screen.getByText('3NPS')).toBeDefined();
  });

  it('clicking CAGED calls setPositionSystem("caged") and setSelectedPosition(1)', () => {
    render(<FretboardControls />);
    fireEvent.click(screen.getByText('CAGED'));
    expect(mockSetPositionSystem).toHaveBeenCalledWith('caged');
    expect(mockSetSelectedPosition).toHaveBeenCalledWith(1);
  });

  it('clicking 3NPS calls setPositionSystem("3nps") and setSelectedPosition(1)', () => {
    render(<FretboardControls />);
    fireEvent.click(screen.getByText('3NPS'));
    expect(mockSetPositionSystem).toHaveBeenCalledWith('3nps');
    expect(mockSetSelectedPosition).toHaveBeenCalledWith(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Position number buttons (CAGED: 5 positions)
// ─────────────────────────────────────────────────────────────────────────────

describe('FretboardControls position buttons — CAGED', () => {
  it('renders the "All" position button', () => {
    render(<FretboardControls />);
    expect(screen.getByText('All')).toBeDefined();
  });

  it('renders 5 numbered position buttons for CAGED', () => {
    render(<FretboardControls />);
    // Position buttons are labelled 1–5 for CAGED
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('clicking "All" calls setSelectedPosition(null)', () => {
    render(<FretboardControls />);
    fireEvent.click(screen.getByText('All'));
    expect(mockSetSelectedPosition).toHaveBeenCalledWith(null);
  });

  it('clicking position 3 calls setSelectedPosition(3)', () => {
    render(<FretboardControls />);
    fireEvent.click(screen.getByText('3'));
    expect(mockSetSelectedPosition).toHaveBeenCalledWith(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Position number buttons (3NPS: 7 positions)
// ─────────────────────────────────────────────────────────────────────────────

describe('FretboardControls position buttons — 3NPS', () => {
  beforeEach(() => {
    mockState.positionSystem = '3nps';
  });

  it('renders 7 numbered position buttons for 3NPS', () => {
    render(<FretboardControls />);
    expect(screen.getByText('6')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Frets range slider
// ─────────────────────────────────────────────────────────────────────────────

describe('FretboardControls frets range slider', () => {
  it('renders the Frets label with current numFrets value', () => {
    render(<FretboardControls />);
    expect(screen.getByText(/Frets: 24/)).toBeDefined();
  });

  it('changing the range slider calls setNumFrets', () => {
    render(<FretboardControls />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '18' } });
    expect(mockSetNumFrets).toHaveBeenCalledWith(18);
  });
});
