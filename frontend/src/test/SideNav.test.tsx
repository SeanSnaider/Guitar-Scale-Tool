/**
 * SideNav.test.tsx
 *
 * The desktop/tablet navigation and the phone tab bar: all six
 * destinations render, the current one is marked aria-current="page", legacy
 * tab ids resolve to their destination, and clicks set the store's tab.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SideNav } from '../components/shell/SideNav';
import { MobileTabBar } from '../components/shell/MobileTabBar';
import { navItemFor } from '../components/shell/navItems';

const mockSetActiveTab = vi.fn();
const mockState = {
  activeTab: 'fretboard',
  setActiveTab: mockSetActiveTab,
  currentTuning: { name: 'Standard', notes: [4, 9, 2, 7, 11, 4], strings: 6 },
};

vi.mock('../store/useGuitarStore', () => ({
  useGuitarStore: vi.fn((selector?: (s: typeof mockState) => unknown) => (selector ? selector(mockState) : mockState)),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockState.activeTab = 'fretboard';
});

const DESTINATIONS = ['Practice', 'Ear training', 'ChordAI', 'Coach', 'Library', 'Progress'];

describe('SideNav', () => {
  it('renders a navigation landmark with all six destinations', () => {
    render(<SideNav />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    for (const label of DESTINATIONS) {
      expect(within(nav).getByRole('button', { name: label })).toBeDefined();
    }
  });

  it('marks the current destination with aria-current="page"', () => {
    render(<SideNav />);
    expect(screen.getByRole('button', { name: 'Practice' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Library' }).hasAttribute('aria-current')).toBe(false);
  });

  it('treats legacy ids as their destination (scales → Library)', () => {
    mockState.activeTab = 'scales';
    render(<SideNav />);
    expect(screen.getByRole('button', { name: 'Library' }).getAttribute('aria-current')).toBe('page');
  });

  it('clicking a destination sets the store tab', () => {
    render(<SideNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Ear training' }));
    expect(mockSetActiveTab).toHaveBeenCalledWith('ear-training');
  });

  it('shows the current tuning in the rail footer', () => {
    render(<SideNav />);
    expect(screen.getByText(/Standard tuning/)).toBeDefined();
  });
});

describe('MobileTabBar', () => {
  it('renders all six destinations and switches on click', () => {
    render(<MobileTabBar />);
    for (const label of DESTINATIONS) expect(screen.getByRole('button', { name: label })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'ChordAI' }));
    expect(mockSetActiveTab).toHaveBeenCalledWith('chordai');
  });
});

describe('navItemFor', () => {
  it('maps every store id to a destination', () => {
    expect(navItemFor('reference').label).toBe('Practice');
    expect(navItemFor('chords').label).toBe('Library');
    expect(navItemFor('progress').label).toBe('Progress');
  });
});
