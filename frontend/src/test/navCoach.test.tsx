/**
 * navCoach.test.tsx
 *
 * Tests for the navigation changes: the Practice Coach tab is reachable,
 * and the mobile "More" dropdown is not nested inside the horizontally
 * scrolling tab strip (overflow-x: auto also clips vertically, which hid
 * the dropdown and with it the Reference, Progress, ChordAI and Coach tabs).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NavBar from '../components/layout/NavBar';
import AppShell from '../components/layout/AppShell';
import { useGuitarStore } from '../store/useGuitarStore';

beforeEach(() => {
  useGuitarStore.setState({ activeTab: 'fretboard' });
});

describe('Coach tab', () => {
  it('appears in the navigation and selects the coach tab', () => {
    render(<NavBar />);
    fireEvent.click(screen.getAllByText('Coach')[0]);
    expect(useGuitarStore.getState().activeTab).toBe('coach');
  });

  it('renders the Practice Coach when selected', async () => {
    useGuitarStore.setState({ activeTab: 'coach' });
    render(<AppShell />);
    expect(await screen.findByRole('button', { name: /generate plan/i })).toBeInTheDocument();
  });
});

describe('mobile More menu', () => {
  it('is not clipped by the scrolling tab strip', () => {
    render(<NavBar />);
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    const menu = screen.getByRole('menu');

    for (let el = menu.parentElement; el; el = el.parentElement) {
      expect(el.style.overflowX, 'an ancestor of the dropdown scrolls horizontally').not.toBe('auto');
    }
  });
});
