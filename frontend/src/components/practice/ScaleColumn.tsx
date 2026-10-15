/**
 * ScaleColumn.tsx
 *
 * The Practice view's reference column for the current scale: name and
 * category, its step pattern, the formula, every note with its interval, the
 * common uses, and related scales to jump to.
 */
import { useGuitarStore } from '../../store/useGuitarStore';
import {
  ALL_NOTES,
  CAGED_POSITIONS,
  SCALES,
  THREE_NPS_POSITIONS,
  getInterval,
  getIntervalName,
  getNoteAtPosition,
  getScaleNotes,
} from '../../data/musicTheory';
import { cn } from '../../ui';
import { stepPattern } from '../../practice/scalePattern';

const sectionTitle = 'mb-2.5 text-xs text-muted';

/**
 * Where to start in the selected position: the lowest-sounding root inside
 * its fret range, searched from the lowest string up. Derived from the
 * position data, never invented.
 */
function positionStart(root: string, tuning: number[], startFret: number, endFret: number) {
  for (let s = 0; s < tuning.length; s++) {
    for (let f = startFret; f <= endFret; f++) {
      if (getNoteAtPosition(s, f, tuning) === root) return { string: s, fret: f };
    }
  }
  return null;
}

export default function ScaleColumn() {
  const root = useGuitarStore((s) => s.selectedRoot);
  const tuning = useGuitarStore((s) => s.currentTuning);
  const system = useGuitarStore((s) => s.positionSystem);
  const positionId = useGuitarStore((s) => s.selectedPosition);
  const scaleKey = useGuitarStore((s) => s.selectedScale);
  const setSelectedScale = useGuitarStore((s) => s.setSelectedScale);
  const scale = SCALES[scaleKey];

  if (!scale) {
    return <p className="text-sm text-muted">Choose a scale to see its notes and intervals.</p>;
  }

  const notes = getScaleNotes(root, scale.intervals);
  const position =
    positionId === null ? null : (system === 'caged' ? CAGED_POSITIONS : THREE_NPS_POSITIONS).find((p) => p.id === positionId);
  const start = position ? positionStart(root, tuning.notes, position.startFret, position.endFret) : null;
  const steps = stepPattern(scale.intervals);
  const related = scale.relatedScales ?? [];

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.03em] text-balance">
          {root} {scale.name}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          <span className="capitalize">{scale.category}</span> · {notes.length} notes
        </p>
        {scale.description && <p className="mt-3 text-[13px] leading-relaxed text-ink/80">{scale.description}</p>}
      </div>

      {position && (
        <section aria-labelledby="position-title" className="rounded-panel border border-line px-4 py-3.5">
          <h3 id="position-title" className="text-[13px] font-bold">
            {system === 'caged' ? 'CAGED' : '3NPS'} position {position.id} · frets {position.startFret}–{position.endFret}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink/80">
            {start
              ? `Start on the root ${root}: string ${tuning.strings - start.string} (${ALL_NOTES[tuning.notes[start.string]]}), ${
                  start.fret === 0 ? 'open' : `fret ${start.fret}`
                }. Keep one finger per fret across the shape.`
              : `The root ${root} doesn't fall inside this shape; play it from the lowest scale note up.`}
          </p>
        </section>
      )}

      <section aria-labelledby="steps-title">
        <h3 id="steps-title" className={sectionTitle}>
          Steps
        </h3>
        <p className="tabular font-mono text-[13px] tracking-wide text-ink">{steps.join(' ')}</p>
      </section>

      <section aria-labelledby="formula-title">
        <h3 id="formula-title" className={sectionTitle}>
          Formula
        </h3>
        <ol className="flex gap-1">
          {scale.degrees.map((deg, i) => (
            <li
              key={`${deg}-${i}`}
              className={cn(
                'flex h-9 min-w-0 flex-1 items-center justify-center rounded-[6px] border font-mono text-[13px] font-bold',
                i === 0 ? 'border-ink' : 'border-line',
              )}
            >
              {deg}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="intervals-title">
        <h3 id="intervals-title" className={sectionTitle}>
          Intervals
        </h3>
        <ul className="border-t border-line">
          {notes.map((note, i) => {
            const semis = getInterval(root, note);
            return (
              <li key={`${note}-${i}`} className="flex items-center gap-3 border-b border-line py-2.5">
                <span
                  className={cn(
                    'flex size-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    i === 0 ? 'bg-accent text-on-accent' : 'bg-ink text-surface',
                  )}
                >
                  {note}
                </span>
                <span className="text-[13px]">{i === 0 ? 'Root' : getIntervalName(semis)}</span>
                <span className="tabular ml-auto font-mono text-xs text-muted">{semis} st</span>
              </li>
            );
          })}
        </ul>
      </section>

      {scale.commonUses && (
        <section aria-labelledby="uses-title">
          <h3 id="uses-title" className={sectionTitle}>
            Common uses
          </h3>
          <p className="text-[13px] leading-relaxed text-ink/80">{scale.commonUses}</p>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related-title">
          <h3 id="related-title" className={sectionTitle}>
            Related scales
          </h3>
          <ul className="flex flex-col gap-1">
            {related.map((rel) => (
              <li key={rel.key}>
                <button
                  type="button"
                  onClick={() => setSelectedScale(rel.key)}
                  className="flex w-full items-baseline justify-between gap-3 rounded-control px-2.5 py-2 text-left hover:bg-sunken"
                >
                  <span className="text-[13px] font-bold">{rel.label}</span>
                  <span className="text-xs text-muted">{rel.relationship}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
