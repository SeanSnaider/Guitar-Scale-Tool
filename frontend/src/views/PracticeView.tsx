/**
 * PracticeView
 *
 * The main practice workspace: control strip, the fretboard (the hero),
 * tablature, and the current scale's reference column. On wide screens the
 * scale column sits on the right; below 1280px it follows the tab.
 */
import Fretboard from '../components/Fretboard';
import Tablature from '../components/Tablature';
import FretboardControls, { FretboardOptions } from '../components/fretboard/FretboardControls';
import ScaleColumn from '../components/practice/ScaleColumn';
import TabStrip from '../components/practice/TabStrip';
import { useGuitarStore } from '../store/useGuitarStore';
import { Panel } from '../ui';

export default function PracticeView() {
  const numFrets = useGuitarStore((s) => s.numFrets);
  const position = useGuitarStore((s) => s.selectedPosition);
  const system = useGuitarStore((s) => s.positionSystem);

  return (
    <div className="xl:grid xl:min-h-full xl:grid-cols-[minmax(0,1fr)_var(--aside-w)]">
      <div className="flex min-w-0 flex-col gap-4 px-[var(--gutter)] pt-5 pb-6">
        <FretboardControls />

        <Panel
          title="Fretboard"
          subtitle={`Frets 0–${numFrets} · ${position === null ? 'all positions' : `${system === 'caged' ? 'CAGED' : '3NPS'} position\u00A0${position}`}`}
          actions={
            // On phones these live in the scale-settings disclosure instead
            <div className="flex flex-wrap items-center gap-3 max-md:hidden">
              <FretboardOptions />
            </div>
          }
        >
          <Fretboard />
          <TabStrip />
          <div aria-hidden="true" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-accent" />
              Root
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-ink" />
              Scale note
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full border-2 border-accent" />
              Playing
            </span>
            {position !== null && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full ring-2 ring-ink ring-inset" />
                  Outside root
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full ring-[1.5px] ring-control ring-inset" />
                  Outside position
                </span>
              </>
            )}
          </div>
        </Panel>

        <Tablature />
      </div>

      <aside
        aria-label="Current scale"
        className="border-line bg-surface px-[var(--gutter)] py-6 max-xl:mx-[var(--gutter)] max-xl:mb-6 max-xl:rounded-panel max-xl:border xl:border-l xl:px-6"
      >
        <ScaleColumn />
      </aside>
    </div>
  );
}
