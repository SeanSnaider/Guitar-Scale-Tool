/**
 * SegmentedToggle.test.tsx
 *
 * Tests for the SegmentedToggle UI component
 * (src/components/ui/SegmentedToggle.tsx).
 * Covers option rendering, active state, onChange invocation,
 * and className prop forwarding.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SegmentedToggle from '../components/ui/SegmentedToggle';
import type { SegmentOption } from '../components/ui/SegmentedToggle';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const DISPLAY_OPTIONS: SegmentOption[] = [
  { value: 'dots',      label: 'Dots'      },
  { value: 'notes',     label: 'Notes'     },
  { value: 'intervals', label: 'Intervals' },
  { value: 'patterns',  label: 'Patterns'  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('SegmentedToggle rendering', () => {
  it('renders all option labels as buttons', () => {
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="dots" onChange={vi.fn()} />
    );
    expect(screen.getByText('Dots')).toBeDefined();
    expect(screen.getByText('Notes')).toBeDefined();
    expect(screen.getByText('Intervals')).toBeDefined();
    expect(screen.getByText('Patterns')).toBeDefined();
  });

  it('renders the correct number of buttons (4 options → 4 buttons)', () => {
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="dots" onChange={vi.fn()} />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
  });

  it('renders a single option correctly', () => {
    render(
      <SegmentedToggle
        options={[{ value: 'solo', label: 'Solo' }]}
        value="solo"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Solo')).toBeDefined();
  });

  it('wraps in a group role container', () => {
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="dots" onChange={vi.fn()} />
    );
    expect(screen.getByRole('group')).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Active state (aria-pressed)
// ─────────────────────────────────────────────────────────────────────────────

describe('SegmentedToggle active state', () => {
  it('active option has aria-pressed="true"', () => {
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="notes" onChange={vi.fn()} />
    );
    const notesBtn = screen.getByText('Notes').closest('button') as HTMLButtonElement;
    expect(notesBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('inactive options have aria-pressed="false"', () => {
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="notes" onChange={vi.fn()} />
    );
    const dotsBtn = screen.getByText('Dots').closest('button') as HTMLButtonElement;
    expect(dotsBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('only one option is aria-pressed="true" at a time', () => {
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="intervals" onChange={vi.fn()} />
    );
    const buttons = screen.getAllByRole('button');
    const pressed = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
  });

  it('active option has bolder font weight', () => {
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="patterns" onChange={vi.fn()} />
    );
    const patternsBtn = screen.getByText('Patterns').closest('button') as HTMLButtonElement;
    const inactiveBtn = screen.getByText('Dots').closest('button') as HTMLButtonElement;

    const activeFontWeight = parseInt(patternsBtn.style.fontWeight, 10);
    const inactiveFontWeight = parseInt(inactiveBtn.style.fontWeight, 10);
    expect(activeFontWeight).toBeGreaterThan(inactiveFontWeight);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// onChange invocation
// ─────────────────────────────────────────────────────────────────────────────

describe('SegmentedToggle onChange', () => {
  it('calls onChange with correct value when clicking an inactive option', () => {
    const onChange = vi.fn();
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="dots" onChange={onChange} />
    );
    fireEvent.click(screen.getByText('Notes'));
    expect(onChange).toHaveBeenCalledWith('notes');
  });

  it('still calls onChange when clicking the active option (no guard in component)', () => {
    // The component always calls onChange on any click — guarding is caller's responsibility
    const onChange = vi.fn();
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="dots" onChange={onChange} />
    );
    fireEvent.click(screen.getByText('Dots'));
    expect(onChange).toHaveBeenCalledWith('dots');
  });

  it('calls onChange with the correct value for each option', () => {
    const onChange = vi.fn();
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="dots" onChange={onChange} />
    );
    fireEvent.click(screen.getByText('Intervals'));
    expect(onChange).toHaveBeenCalledWith('intervals');
  });

  it('calls onChange exactly once per click', () => {
    const onChange = vi.fn();
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="dots" onChange={onChange} />
    );
    fireEvent.click(screen.getByText('Patterns'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// className prop
// ─────────────────────────────────────────────────────────────────────────────

describe('SegmentedToggle className prop', () => {
  it('applies className to the outer container', () => {
    const { container } = render(
      <SegmentedToggle
        options={DISPLAY_OPTIONS}
        value="dots"
        onChange={vi.fn()}
        className="my-toggle-class"
      />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('my-toggle-class');
  });

  it('renders without error when className is not provided', () => {
    expect(() =>
      render(<SegmentedToggle options={DISPLAY_OPTIONS} value="dots" onChange={vi.fn()} />)
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hover state interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('SegmentedToggle hover state', () => {
  it('does not throw on mouseEnter of a button', () => {
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="dots" onChange={vi.fn()} />
    );
    expect(() => fireEvent.mouseEnter(screen.getByText('Notes'))).not.toThrow();
  });

  it('does not throw on mouseLeave of a button', () => {
    render(
      <SegmentedToggle options={DISPLAY_OPTIONS} value="dots" onChange={vi.fn()} />
    );
    const btn = screen.getByText('Notes');
    fireEvent.mouseEnter(btn);
    expect(() => fireEvent.mouseLeave(btn)).not.toThrow();
  });
});
