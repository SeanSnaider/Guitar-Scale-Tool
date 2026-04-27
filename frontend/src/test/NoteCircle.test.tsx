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
// isHighlighted styling
// ─────────────────────────────────────────────────────────────────────────────

describe('NoteCircle isHighlighted prop', () => {
  it('applies box-shadow style when isHighlighted is true', () => {
    renderCircle({ isHighlighted: true });
    const btn = screen.getByRole('button');
    // box-shadow should be set (not undefined / empty)
    expect(btn.style.boxShadow).toBeTruthy();
  });

  it('has no box-shadow when isHighlighted is false (default)', () => {
    renderCircle({ isHighlighted: false });
    const btn = screen.getByRole('button');
    expect(btn.style.boxShadow).toBeFalsy();
  });

  it('has no box-shadow when isHighlighted prop is omitted', () => {
    renderCircle();
    const btn = screen.getByRole('button');
    expect(btn.style.boxShadow).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variant-specific styles
// ─────────────────────────────────────────────────────────────────────────────

describe('NoteCircle variant styles', () => {
  it('root variant gets a larger size than scale variant', () => {
    const { container: rootContainer } = render(
      <NoteCircle note="C" displayText="C" variant="root" />
    );
    const { container: scaleContainer } = render(
      <NoteCircle note="C" displayText="C" variant="scale" />
    );

    const rootBtn = rootContainer.querySelector('button') as HTMLButtonElement;
    const scaleBtn = scaleContainer.querySelector('button') as HTMLButtonElement;

    const rootWidth = parseInt(rootBtn.style.width, 10);
    const scaleWidth = parseInt(scaleBtn.style.width, 10);

    expect(rootWidth).toBeGreaterThan(scaleWidth);
  });

  it('muted variant has a border', () => {
    renderCircle({ variant: 'muted' });
    const btn = screen.getByRole('button');
    expect(btn.style.border).not.toBe('none');
  });

  it('scale variant has no solid border color', () => {
    // jsdom normalises `border: 'none'` as borderStyle=none, not `border='none'`
    renderCircle({ variant: 'scale' });
    const btn = screen.getByRole('button');
    expect(btn.style.borderStyle).not.toBe('solid');
  });

  it('root variant has no solid border color', () => {
    renderCircle({ variant: 'root' });
    const btn = screen.getByRole('button');
    expect(btn.style.borderStyle).not.toBe('solid');
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
