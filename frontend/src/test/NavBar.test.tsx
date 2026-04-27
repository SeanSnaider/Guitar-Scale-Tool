/**
 * NavBar.test.tsx
 *
 * Tests for the NavBar component (src/components/layout/NavBar.tsx).
 * The Zustand store is mocked so that every selector call returns
 * a controlled state object with vi.fn() setters.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NavBar from '../components/layout/NavBar';

// ─────────────────────────────────────────────────────────────────────────────
// Store mock
// ─────────────────────────────────────────────────────────────────────────────

const mockSetActiveTab = vi.fn();
const mockSetIsAudioShelfOpen = vi.fn();

vi.mock('../store/useGuitarStore', () => ({
  useGuitarStore: vi.fn((selector: (state: object) => unknown) =>
    selector({
      activeTab: 'fretboard',
      setActiveTab: mockSetActiveTab,
      setIsAudioShelfOpen: mockSetIsAudioShelfOpen,
    })
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Brand / logo
// ─────────────────────────────────────────────────────────────────────────────

describe('NavBar brand', () => {
  it('renders "Scale Teacher" wordmark', () => {
    render(<NavBar />);
    expect(screen.getByText('Scale Teacher')).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('NavBar tab rendering', () => {
  it('renders a Fretboard tab button', () => {
    render(<NavBar />);
    expect(screen.getAllByText('Fretboard').length).toBeGreaterThan(0);
  });

  it('renders a Scales tab button', () => {
    render(<NavBar />);
    expect(screen.getAllByText('Scales').length).toBeGreaterThan(0);
  });

  it('renders an Ear Training tab button', () => {
    render(<NavBar />);
    expect(screen.getAllByText('Ear Training').length).toBeGreaterThan(0);
  });

  it('renders a Chords tab button', () => {
    render(<NavBar />);
    expect(screen.getAllByText('Chords').length).toBeGreaterThan(0);
  });

  it('renders a Reference tab button', () => {
    render(<NavBar />);
    expect(screen.getAllByText('Reference').length).toBeGreaterThan(0);
  });

  it('renders navigation landmark', () => {
    render(<NavBar />);
    expect(screen.getByRole('navigation')).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Active tab styling
// ─────────────────────────────────────────────────────────────────────────────

describe('NavBar active tab styling', () => {
  it('fretboard tab button has aria-selected="true" (active tab is fretboard)', () => {
    render(<NavBar />);
    // Tab buttons use role="tab" and aria-selected
    const tabButtons = screen.getAllByRole('tab');
    const fretboardTab = tabButtons.find(
      (btn) => btn.textContent === 'Fretboard'
    );
    expect(fretboardTab).toBeDefined();
    expect(fretboardTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('scales tab button has aria-selected="false" when fretboard is active', () => {
    render(<NavBar />);
    const tabButtons = screen.getAllByRole('tab');
    const scalesTab = tabButtons.find((btn) => btn.textContent === 'Scales');
    expect(scalesTab?.getAttribute('aria-selected')).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab click interactions
// ─────────────────────────────────────────────────────────────────────────────

describe('NavBar tab clicks', () => {
  it('clicking Scales tab calls setActiveTab("scales")', () => {
    render(<NavBar />);
    const tabButtons = screen.getAllByRole('tab');
    const scalesBtn = tabButtons.find((btn) => btn.textContent === 'Scales');
    if (scalesBtn) fireEvent.click(scalesBtn);
    expect(mockSetActiveTab).toHaveBeenCalledWith('scales');
  });

  it('clicking Fretboard tab calls setActiveTab("fretboard")', () => {
    render(<NavBar />);
    const tabButtons = screen.getAllByRole('tab');
    const fretboardBtn = tabButtons.find((btn) => btn.textContent === 'Fretboard');
    if (fretboardBtn) fireEvent.click(fretboardBtn);
    expect(mockSetActiveTab).toHaveBeenCalledWith('fretboard');
  });

  it('clicking Ear Training tab calls setActiveTab("ear-training")', () => {
    render(<NavBar />);
    const tabButtons = screen.getAllByRole('tab');
    const earBtn = tabButtons.find((btn) => btn.textContent === 'Ear Training');
    if (earBtn) fireEvent.click(earBtn);
    expect(mockSetActiveTab).toHaveBeenCalledWith('ear-training');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Audio shelf button
// ─────────────────────────────────────────────────────────────────────────────

describe('NavBar audio shelf button', () => {
  it('renders the audio controls button', () => {
    render(<NavBar />);
    expect(screen.getByLabelText('Open audio controls')).toBeDefined();
  });

  it('clicking the ⚙ button calls setIsAudioShelfOpen(true)', () => {
    render(<NavBar />);
    const settingsBtn = screen.getByLabelText('Open audio controls');
    fireEvent.click(settingsBtn);
    expect(mockSetIsAudioShelfOpen).toHaveBeenCalledWith(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mobile "More" overflow button
// ─────────────────────────────────────────────────────────────────────────────

describe('NavBar mobile overflow', () => {
  it('renders a "More" button for the mobile overflow menu', () => {
    render(<NavBar />);
    // The "More ▾" button is always rendered in the mobile tab strip
    const moreButtons = screen.getAllByText(/More/);
    expect(moreButtons.length).toBeGreaterThan(0);
  });

  it('clicking More button shows the overflow menu items', () => {
    render(<NavBar />);
    const moreBtn = screen.getAllByText(/More/)[0];
    fireEvent.click(moreBtn);
    // After clicking, overflow tabs (Reference, Progress, ChordAI) appear in menu
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('clicking a menu item calls setActiveTab with correct id', () => {
    render(<NavBar />);
    const moreBtn = screen.getAllByText(/More/)[0];
    fireEvent.click(moreBtn);
    const progressItem = screen.getByRole('menuitem', { name: 'Progress' });
    fireEvent.click(progressItem);
    expect(mockSetActiveTab).toHaveBeenCalledWith('progress');
  });
});
