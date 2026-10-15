/**
 * FretboardControls.tsx
 *
 * - `FretboardControls`: the control strip above the fretboard: root,
 *   scale, tuning, display mode, position system and position.
 * - `FretboardOptions`: the fretboard panel's own options (non-scale notes,
 *   number of frets), shown in that panel's header.
 */
import { useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useGuitarStore } from '../../store/useGuitarStore';
import type { DisplayMode, PositionSystem } from '../../store/useGuitarStore';
import { ALL_NOTES, SCALES, TUNINGS } from '../../data/musicTheory';
import { SegmentedControl, Select, Switch, cn } from '../../ui';

const DISPLAY_MODES = [
  { value: 'dots', label: 'Dots' },
  { value: 'notes', label: 'Notes' },
  { value: 'intervals', label: 'Intervals' },
  { value: 'patterns', label: 'Patterns' },
] as const;

const POSITION_SYSTEMS = [
  { value: 'caged', label: 'CAGED' },
  { value: '3nps', label: '3NPS', ariaLabel: 'Three notes per string' },
] as const;

const ROOT_OPTIONS = ALL_NOTES.map((n) => ({ value: n, label: n }));

const SCALE_OPTIONS = Object.entries(SCALES).map(([key, scale]) => ({
  value: key,
  label: scale.name,
  group: scale.category.charAt(0).toUpperCase() + scale.category.slice(1),
}));

const TUNING_OPTIONS = Object.entries(TUNINGS).map(([key, t]) => ({ value: key, label: t.name }));

/** Small caption above a control group that has no <label> of its own. */
function Caption({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="text-xs text-muted">
      {children}
    </span>
  );
}

export default function FretboardControls() {
  const selectedRoot = useGuitarStore((s) => s.selectedRoot);
  const setSelectedRoot = useGuitarStore((s) => s.setSelectedRoot);
  const selectedScale = useGuitarStore((s) => s.selectedScale);
  const setSelectedScale = useGuitarStore((s) => s.setSelectedScale);
  const currentTuning = useGuitarStore((s) => s.currentTuning);
  const setCurrentTuning = useGuitarStore((s) => s.setCurrentTuning);
  const displayMode = useGuitarStore((s) => s.displayMode);
  const setDisplayMode = useGuitarStore((s) => s.setDisplayMode);
  const positionSystem = useGuitarStore((s) => s.positionSystem);
  const setPositionSystem = useGuitarStore((s) => s.setPositionSystem);
  const selectedPosition = useGuitarStore((s) => s.selectedPosition);
  const setSelectedPosition = useGuitarStore((s) => s.setSelectedPosition);

  const currentTuningKey = useMemo(
    () => Object.keys(TUNINGS).find((k) => TUNINGS[k].notes.join(',') === currentTuning.notes.join(',')) ?? 'standard',
    [currentTuning],
  );

  const positionCount = positionSystem === 'caged' ? 5 : 7;
  const positionOptions = [
    { value: 'all', label: 'All', ariaLabel: 'All positions' },
    ...Array.from({ length: positionCount }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
      ariaLabel: `Position ${i + 1}`,
    })),
  ];

  // Phones: the strip collapses behind a one-line summary so the fretboard
  // leads the first screen. Tablet and up always show it.
  const [open, setOpen] = useState(false);
  const controlsId = useId();
  const tuningName = TUNINGS[currentTuningKey]?.name ?? currentTuning.name;
  const summary = `${selectedRoot} ${SCALES[selectedScale]?.name ?? selectedScale} · ${tuningName} · ${
    DISPLAY_MODES.find((m) => m.value === displayMode)?.label ?? displayMode
  }`;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={controlsId}
        onClick={() => setOpen(!open)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-control border border-control bg-surface px-3 text-left text-sm md:hidden"
      >
        <span className="min-w-0 truncate">
          <span className="sr-only">Scale settings: </span>
          <span className="font-bold">{summary}</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      <div
        id={controlsId}
        className={cn('flex flex-wrap items-end gap-x-4 gap-y-3 max-md:mt-3', !open && 'max-md:hidden')}
      >
        <Select
          label="Root note"
          value={selectedRoot}
          onChange={setSelectedRoot}
          options={ROOT_OPTIONS}
          className="w-[76px]"
        />
        <Select
          label="Scale"
          value={selectedScale}
          onChange={setSelectedScale}
          options={SCALE_OPTIONS}
          className="w-[200px] max-sm:w-full"
        />
        <Select
          label="Tuning"
          value={currentTuningKey}
          onChange={(key) => setCurrentTuning(TUNINGS[key])}
          options={TUNING_OPTIONS}
          className="w-[150px]"
        />

        <div className="flex flex-col gap-1.5">
          <Caption>Display</Caption>
          <SegmentedControl
            ariaLabel="Display mode"
            options={DISPLAY_MODES}
            value={displayMode}
            onChange={(v) => setDisplayMode(v as DisplayMode)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Caption>Position</Caption>
          <div className="flex flex-wrap gap-1.5">
            <SegmentedControl
              ariaLabel="Position system"
              options={POSITION_SYSTEMS}
              value={positionSystem}
              onChange={(v) => {
                setPositionSystem(v as PositionSystem);
                setSelectedPosition(1);
              }}
            />
            <SegmentedControl
              ariaLabel="Position"
              options={positionOptions}
              value={selectedPosition === null ? 'all' : String(selectedPosition)}
              onChange={(v) => setSelectedPosition(v === 'all' ? null : Number(v))}
            />
          </div>
        </div>
        {/* Phones: the fretboard panel's own options live here, inside the disclosure */}
        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 md:hidden">
          <FretboardOptions />
        </div>
      </div>
    </div>
  );
}

/** Fretboard panel options: non-scale notes on/off and the number of frets. */
export function FretboardOptions() {
  const showNonScaleNotes = useGuitarStore((s) => s.showNonScaleNotes);
  const setShowNonScaleNotes = useGuitarStore((s) => s.setShowNonScaleNotes);
  const numFrets = useGuitarStore((s) => s.numFrets);
  const setNumFrets = useGuitarStore((s) => s.setNumFrets);
  const fretsId = useId();

  return (
    <>
      <Switch label="Non-scale notes" checked={showNonScaleNotes} onChange={setShowNonScaleNotes} />
      <label htmlFor={fretsId} className="flex items-center gap-2 text-[13px] text-muted">
        Frets
        <input
          id={fretsId}
          type="range"
          min={12}
          max={24}
          value={numFrets}
          onChange={(e) => setNumFrets(Number(e.target.value))}
          aria-valuetext={`${numFrets} frets`}
          className="w-24 cursor-pointer"
        />
        <span className="tabular w-5 font-mono text-xs text-ink">{numFrets}</span>
      </label>
    </>
  );
}
