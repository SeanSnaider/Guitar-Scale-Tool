/**
 * NoteCircle.test.tsx
 *
 * Tests for the NoteCircle component (src/components/fretboard/NoteCircle.tsx).
 * Covers rendering variants, interaction handlers, accessibility attributes,
 * and the highlight/animation states.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NoteCircle from '../components/fretboard/NoteCircle';
import { NOTE_SIZE } from '../components/fretboard/noteSizes';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Renders a NoteCircle with sensible defaults that can be overridden. */
function renderCircle(overrides: Partial<React.ComponentProps<typeof NoteCircle>> = {}) {
  const defaults = {
    note: 'C',
    displayText: 'C',
    variant: 'scale' as const,
  };
  return render(<NoteCircle {...defaults} {...overrides} />);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering variants
// ─────────────────────────────────────────────────────────────────────────────

describe('NoteCircle rendering', () => {
  it('renders the note text in "scale" variant', () => {
    renderCircle({ note: 'G', displayText: 'G', variant: 'scale' });
    expect(screen.getByText('G')).toBeDefined();
  });

  it('renders the note text in "root" variant', () => {
    renderCircle({ note: 'A', displayText: 'A', variant: 'root' });
    expect(screen.getByText('A')).toBeDefined();
  });

  it('renders the note text in "muted" variant', () => {
    renderCircle({ note: 'B', displayText: 'B', variant: 'muted' });
    expect(screen.getByText('B')).toBeDefined();
  });

  it('renders an empty button when displayText is ""', () => {
    renderCircle({ note: 'D', displayText: '' });
    // The button should exist but have no visible text
    const btn = screen.getByRole('button');
    expect(btn).toBeDefined();
    expect(btn.textContent).toBe('');
  });

  it('renders a button element (not a div)', () => {
    renderCircle();
    expect(screen.getByRole('button')).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Title / aria-label
// ─────────────────────────────────────────────────────────────────────────────

describe('NoteCircle title and aria-label', () => {
  it('uses the note as title when no explicit title prop is provided', () => {
    renderCircle({ note: 'F#', displayText: 'F#' });
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('title')).toBe('F#');
  });

  it('uses the explicit title prop when provided', () => {
    renderCircle({ note: 'E', displayText: '3', title: 'E — Major 3rd' });
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('title')).toBe('E — Major 3rd');
  });

  it('sets aria-label to title (or note as fallback)', () => {
    renderCircle({ note: 'C', displayText: 'C' });
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Click handler
// ─────────────────────────────────────────────────────────────────────────────

describe('NoteCircle click interaction', () => {
  it('calls onClick when the button is clicked', () => {
    const onClick = vi.fn();
    renderCircle({ onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onClick is not provided', () => {
    renderCircle();
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });

  it('calls onClick with no arguments', () => {
    const onClick = vi.fn();
    renderCircle({ onClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isHighlighted styling (a box-shadow ring, so it never collides with focus)
// ─────────────────────────────────────────────────────────────────────────────

describe('NoteCircle isHighlighted prop', () => {
  it('adds the highlight ring class when isHighlighted is true', () => {
    renderCircle({ isHighlighted: true });
    expect(screen.getByRole('button').className).toContain('shadow-[');
  });

  it('has no highlight ring when isHighlighted is false or omitted', () => {
    renderCircle({ isHighlighted: false });
    expect(screen.getAllByRole('button')[0].className).not.toContain('shadow-[');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variant-specific styles (monochrome world: orange only for roots/playing)
// ─────────────────────────────────────────────────────────────────────────────

describe('NoteCircle variant styles', () => {
  it('root variant is larger than the scale variant', () => {
    expect(NOTE_SIZE.root).toBeGreaterThan(NOTE_SIZE.scale);
  });

  it('root uses the accent fill with ink text', () => {
    renderCircle({ variant: 'root' });
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('bg-accent');
    expect(cls).toContain('text-on-accent');
  });

  it('scale notes are ink with white labels, never orange', () => {
    renderCircle({ variant: 'scale' });
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('bg-ink');
    expect(cls).not.toContain('bg-accent');
  });

  it('muted variant is a bare label on the board (no ring)', () => {
    renderCircle({ variant: 'muted' });
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('bg-board');
    expect(cls).not.toContain('ring-');
  });

  it('dimmed notes are drawn hollow with a ring', () => {
    renderCircle({ variant: 'scale', dimmed: true });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('ring-');
    expect(btn.className).toContain('bg-board');
    expect(btn.hasAttribute('data-dimmed')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Playing ring
// ─────────────────────────────────────────────────────────────────────────────

describe('NoteCircle playing ring', () => {
  it('draws the playing ring when isPlaying is true', () => {
    renderCircle({ isPlaying: true });
    const btn = screen.getByRole('button');
    expect(btn.hasAttribute('data-playing')).toBe(true);
    expect(btn.querySelector('.ring-land')).not.toBeNull();
  });

  it('has no playing ring by default', () => {
    renderCircle();
    expect(screen.getByRole('button').querySelector('.ring-land')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hover interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('NoteCircle hover state', () => {
  it('does not throw on mouseEnter', () => {
    renderCircle();
    const btn = screen.getByRole('button');
    expect(() => fireEvent.mouseEnter(btn)).not.toThrow();
  });

  it('does not throw on mouseLeave', () => {
    renderCircle();
    const btn = screen.getByRole('button');
    fireEvent.mouseEnter(btn);
    expect(() => fireEvent.mouseLeave(btn)).not.toThrow();
  });
});
