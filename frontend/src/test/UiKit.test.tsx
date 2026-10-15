/**
 * UiKit.test.tsx
 *
 * Behaviour and accessibility contracts of the shared UI kit (src/ui).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Chip, SegmentedControl, Select, Slider, Switch, TextField, Notice } from '../ui';
import { Play } from 'lucide-react';

const OPTIONS = [
  { value: 'dots', label: 'Dots' },
  { value: 'notes', label: 'Notes' },
  { value: 'intervals', label: 'Intervals' },
];

describe('SegmentedControl', () => {
  it('renders a named group of toggle buttons', () => {
    render(<SegmentedControl ariaLabel="Display mode" options={OPTIONS} value="notes" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Display mode' })).toBeDefined();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('marks only the selected option as pressed', () => {
    render(<SegmentedControl ariaLabel="Display mode" options={OPTIONS} value="notes" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Notes' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Dots' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the clicked value', () => {
    const onChange = vi.fn();
    render(<SegmentedControl ariaLabel="Display mode" options={OPTIONS} value="notes" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Intervals' }));
    expect(onChange).toHaveBeenCalledWith('intervals');
  });

  it('uses ariaLabel on an option when given', () => {
    render(
      <SegmentedControl ariaLabel="Position" options={[{ value: '1', label: '1', ariaLabel: 'Position 1' }]} value="1" onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Position 1' })).toBeDefined();
  });
});

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
  });

  it('icon-only buttons are named by aria-label and render no text', () => {
    render(<Button iconOnly icon={Play} aria-label="Play">Play</Button>);
    const btn = screen.getByRole('button', { name: 'Play' });
    expect(btn.textContent).toBe('');
  });

  it('primary is the accent fill with ink text', () => {
    render(<Button variant="primary">Go</Button>);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('bg-accent');
    expect(cls).toContain('text-on-accent');
  });
});

describe('Chip', () => {
  it('exposes its pressed state', () => {
    render(<Chip pressed>Rock</Chip>);
    expect(screen.getByRole('button', { name: 'Rock' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Switch', () => {
  it('is a named switch that toggles', () => {
    const onChange = vi.fn();
    render(<Switch label="Metronome" checked={false} onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Metronome' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Select', () => {
  it('associates its visible label with the select', () => {
    render(<Select label="Tuning" value="a" onChange={() => {}} options={[{ value: 'a', label: 'Standard' }]} />);
    expect(screen.getByRole('combobox', { name: 'Tuning' })).toBeDefined();
  });

  it('keeps a hidden label as the accessible name', () => {
    render(<Select label="Time signature" hideLabel value="4/4" onChange={() => {}} options={[{ value: '4/4', label: '4/4' }]} />);
    expect(screen.getByRole('combobox', { name: 'Time signature' })).toBeDefined();
  });

  it('groups options by their group field', () => {
    const { container } = render(
      <Select
        label="Scale"
        value="major"
        onChange={() => {}}
        options={[
          { value: 'major', label: 'Major', group: 'Major' },
          { value: 'minor', label: 'Minor', group: 'Minor' },
        ]}
      />,
    );
    expect(container.querySelectorAll('optgroup')).toHaveLength(2);
  });
});

describe('Slider', () => {
  it('is a labelled range with a spoken value', () => {
    render(<Slider label="Note volume" min={0} max={100} value={80} onChange={() => {}} format={(v) => `${v}%`} />);
    const slider = screen.getByRole('slider', { name: 'Note volume' });
    expect(slider.getAttribute('aria-valuetext')).toBe('80%');
  });
});

describe('TextField', () => {
  it('always has a label, even when hidden', () => {
    render(<TextField label="Search scales" hideLabel placeholder="Search…" />);
    expect(screen.getByRole('textbox', { name: 'Search scales' })).toBeDefined();
  });
});

describe('Notice', () => {
  it('errors are alerts, info is status', () => {
    const { rerender } = render(<Notice tone="error">Broken</Notice>);
    expect(screen.getByRole('alert')).toBeDefined();
    rerender(<Notice tone="info">Heads up</Notice>);
    expect(screen.getByRole('status')).toBeDefined();
  });
});
