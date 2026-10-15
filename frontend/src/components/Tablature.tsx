/**
 * Tablature.tsx
 *
 * The current scale pattern as six-line tab, one column per note in playing
 * order. Display only: playback lives in useScalePlayback (mounted by the
 * transport bar), and the sounding column comes from the store's
 * `playingIndex`, so the tab and the fretboard ring always move together.
 */
import { useGuitarStore } from '../store/useGuitarStore';
import type { PlaybackDirection } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';
import { ALL_NOTES, SCALES, spellScale } from '../data/musicTheory';
import { useScalePattern } from '../practice/useScalePattern';
import type { TabNote } from '../practice/scalePattern';
import { Panel, SegmentedControl, cn } from '../ui';

// The visible label is the accessible name (WCAG 2.5.3 label in name), so no
// ariaLabel override; the group is already named "Playback direction".
const DIRECTIONS = [
  { value: 'ascending', label: 'Up' },
  { value: 'descending', label: 'Down' },
  { value: 'both', label: 'Up & down' },
] as const;

export default function Tablature() {
  const selectedRoot = useGuitarStore((s) => s.selectedRoot);
  const selectedScale = useGuitarStore((s) => s.selectedScale);
  const tuning = useGuitarStore((s) => s.currentTuning);
  const direction = useGuitarStore((s) => s.playbackDirection);
  const setDirection = useGuitarStore((s) => s.setPlaybackDirection);
  const playingIndex = useGuitarStore((s) => s.playingIndex);
  const { pattern } = useScalePattern();

  const scale = SCALES[selectedScale];

  // Tab order: highest string on the top line
  const stringNames = [...tuning.notes.map((n) => ALL_NOTES[n])].reverse();

  const playNote = (n: TabNote) =>
    audioEngine.playNoteAtPosition(tuning.strings - 1 - n.string, n.fret, tuning.notes);

  if (!scale) {
    return (
      <Panel title="Tablature">
        <p className="text-sm text-muted">Select a scale to see its tablature.</p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Tablature"
      subtitle={`${pattern.length} notes${playingIndex >= 0 ? ` · note ${playingIndex + 1}` : ''}`}
      actions={
        <SegmentedControl
          ariaLabel="Playback direction"
          size="sm"
          className="max-sm:flex max-sm:w-full max-sm:[&>button]:flex-1"
          options={DIRECTIONS}
          value={direction}
          onChange={(v) => setDirection(v as PlaybackDirection)}
        />
      }
    >
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="min-w-min font-mono text-[13px]">
          {stringNames.map((name, stringIdx) => (
            <div key={stringIdx} className="flex h-7 items-center pointer-coarse:h-10">
              <span className="w-6 shrink-0 text-[11px] text-muted">{name}</span>
              <div className="relative flex flex-1 items-center">
                {/* The tab line */}
                <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
                {pattern.map((note, i) => {
                  const here = note.string === stringIdx;
                  const playing = playingIndex === i;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'relative flex min-w-8 flex-1 justify-center pointer-coarse:min-w-10',
                        playing && 'bg-accent-soft',
                      )}
                    >
                      {playing && stringIdx === 0 && (
                        <span aria-hidden="true" className="absolute inset-x-0 -top-px h-0.5 bg-accent" />
                      )}
                      {here && (
                        <button
                          type="button"
                          data-dense
                          onClick={() => playNote(note)}
                          title={`${note.note}, fret ${note.fret}`}
                          aria-label={`${note.note}${note.isRoot ? ' (root)' : ''}, ${stringNames[stringIdx]} string, fret ${note.fret}`}
                          className={cn(
                            'tabular relative z-[1] min-w-6 rounded-[4px] bg-surface px-1 leading-6 pointer-coarse:min-w-8 pointer-coarse:leading-8',
                            'hover:bg-sunken',
                            note.isRoot ? 'font-bold text-accent-ink' : 'text-ink',
                            playing && 'bg-accent font-bold text-on-accent hover:bg-accent',
                          )}
                        >
                          {note.fret}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span>
          Root frets in <span className="font-bold text-accent-ink">orange</span>
        </span>
        <span>Select a fret number to hear it</span>
        <span className="ml-auto">
          {spellScale(selectedRoot, selectedScale)[0] ?? selectedRoot} {scale.name}
        </span>
      </div>
    </Panel>
  );
}
