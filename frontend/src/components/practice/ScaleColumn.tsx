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
  SCALES,
  intervalNameForDegree,
  makeNoteNamer,
  relatedScaleRoot,
  spellScale,
} from '../../data/musicTheory';
import { cn } from '../../ui';
import { stepPattern } from '../../practice/scalePattern';
import { cellFretRange, positionCopies, positionStart } from '../../practice/positions';

const sectionTitle = 'mb-2.5 text-xs text-muted';

export default function ScaleColumn() {
  const root = useGuitarStore((s) => s.selectedRoot);
  const tuning = useGuitarStore((s) => s.currentTuning);
  const system = useGuitarStore((s) => s.positionSystem);
  const positionId = useGuitarStore((s) => s.selectedPosition);
  const scaleKey = useGuitarStore((s) => s.selectedScale);
  const setSelectedScale = useGuitarStore((s) => s.setSelectedScale);
  const setSelectedRoot = useGuitarStore((s) => s.setSelectedRoot);
  const numFrets = useGuitarStore((s) => s.numFrets);
  const scale = SCALES[scaleKey];

  if (!scale) {
    return <p className="text-sm text-muted">Choose a scale to see its notes and intervals.</p>;
  }

  // Spelled for the key (F major shows Bb); degrees name the intervals
  const notes = spellScale(root, scaleKey);
  const rootName = notes[0] ?? root;
  const nameOf = makeNoteNamer(root, scaleKey);
  // Describe the lowest copy of the shape (it repeats each octave)
  const cells = positionCopies(system, positionId, root, scale.intervals, tuning.notes, numFrets)[0] ?? null;
  const range = cells ? cellFretRange(cells) : null;
  const start = cells ? positionStart(cells, root, tuning.notes) : null;
  const steps = stepPattern(scale.intervals);
  const related = scale.relatedScales ?? [];

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.03em] text-balance">
          {rootName} {scale.name}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          <span className="capitalize">{scale.category}</span> · {notes.length} notes
        </p>
        {scale.description && <p className="mt-3 text-[13px] leading-relaxed text-ink/80">{scale.description}</p>}
      </div>

      {cells && positionId !== null && (
        <section aria-labelledby="position-title" className="rounded-panel border border-line px-4 py-3.5">
          <h3 id="position-title" className="text-[13px] font-bold">
            {system === 'caged' ? 'CAGED' : '3NPS'} position {positionId}
            {range && ` · frets ${range.min}–${range.max}`}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink/80">
            {start
              ? `Start on the root ${rootName}: string ${tuning.strings - start.string} (${nameOf(ALL_NOTES[tuning.notes[start.string]])}), ${
                  start.fret === 0 ? 'open' : `fret ${start.fret}`
                }. Keep one finger per fret across the shape.`
              : `The root ${rootName} doesn't fall inside this shape; play it from the lowest scale note up.`}
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
            const semis = scale.intervals[i];
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
                <span className="text-[13px]">{intervalNameForDegree(scale.degrees[i] ?? '')}</span>
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
                  onClick={() => {
                    // Relatives and modes move the root (C major -> A minor); parallels keep it
                    setSelectedRoot(relatedScaleRoot(root, scaleKey, rel.key));
                    setSelectedScale(rel.key);
                  }}
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
