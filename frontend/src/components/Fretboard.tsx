/**
 * Fretboard.tsx
 *
 * The interactive fretboard: strings, fret wires, nut, inlay dots, and a
 * NoteCircle at every drawn position. An ARIA grid with one tab stop and
 * arrow-key movement; clicking a note plays it.
 *
 * Orange appears only on roots and on the playing ring, which follows scale
 * playback via the store's `playingPosition`.
 */

import React, { useMemo, useCallback, useState } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';
import {
  getNoteAtPosition,
  getScaleNotes,
  isNoteInScale,
  getScaleDegree,
  getInterval,
  SCALES,
  CAGED_POSITIONS,
  THREE_NPS_POSITIONS,
  ALL_NOTES,
} from '../data/musicTheory';
import NoteCircle from './fretboard/NoteCircle';

/** Frets that receive a single inlay dot. */
const SINGLE_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21];
/** Frets that receive a double inlay dot. */
const DOUBLE_MARKERS = [12, 24];
/** All frets that should display a fret number label at the top. */
const LABELLED_FRETS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

/**
 * Returns a flex-grow ratio that tapers fret spacing toward the body,
 * mirroring the physical scale-length reduction of a real fretboard.
 */
function getFretWidthRatio(fret: number): number {
  const taperFactor = 0.015;
  const minRatio = 0.7;
  const ratio = Math.exp(-taperFactor * fret);
  return Math.max(ratio, minRatio);
}

/**
 * Fretboard
 *
 * Interactive fretboard component.  Reads all state from `useGuitarStore` and
 * delegates note-circle rendering to `NoteCircle`.  Clicking any note circle
 * plays the corresponding pitch via `audioEngine.playNoteAtPosition`.
 *
 * @returns The full fretboard UI wrapped in a horizontally-scrollable container.
 */
export default function Fretboard() {
  const {
    selectedRoot,
    selectedScale,
    displayMode,
    showNonScaleNotes,
    positionSystem,
    selectedPosition,
    numFrets,
    currentTuning,
    highlightedIntervals,
  } = useGuitarStore();
  const playingPosition = useGuitarStore((s) => s.playingPosition);

  const scale = SCALES[selectedScale];
  const scaleNotes = useMemo(
    () => (scale ? getScaleNotes(selectedRoot, scale.intervals) : []),
    [selectedRoot, scale]
  );

  const positions = positionSystem === 'caged' ? CAGED_POSITIONS : THREE_NPS_POSITIONS;

  /** Open-string note names (low → high order for labelling). */
  const stringNames = useMemo(
    () => currentTuning.notes.map((noteIndex) => ALL_NOTES[noteIndex]),
    [currentTuning]
  );

  /** Array [0 … numFrets] representing each column. */
  const frets = useMemo(
    () => Array.from({ length: numFrets + 1 }, (_, i) => i),
    [numFrets]
  );

  /** Pre-computed flex-grow ratios for proportional fret widths. */
  const fretWidthRatios = useMemo(
    () => frets.map((fret) => getFretWidthRatio(fret)),
    [frets]
  );

  /**
   * Display order: high string first (e B G D A E for standard tuning).
   * The store stores strings low→high, so we reverse for visual rendering.
   */
  const strings = useMemo(
    () =>
      Array.from(
        { length: currentTuning.strings },
        (_, i) => currentTuning.strings - 1 - i
      ),
    [currentTuning.strings]
  );

  /** Returns all position objects (CAGED/3NPS) whose fret range contains `fret`. */
  const getPositionsForNote = useCallback(
    (fret: number, note: string) => {
      if (!isNoteInScale(note, scaleNotes)) return [];
      return positions.filter((pos) => fret >= pos.startFret && fret <= pos.endFret);
    },
    [scaleNotes, positions]
  );

  /** A note is drawn at a cell when it's in the scale, or when muted notes are shown. */
  const isCellRendered = useCallback(
    (stringIndex: number, fret: number) =>
      showNonScaleNotes ||
      isNoteInScale(getNoteAtPosition(stringIndex, fret, currentTuning.notes), scaleNotes),
    [showNonScaleNotes, currentTuning.notes, scaleNotes]
  );

  // ── Keyboard model ──────────────────────────────────────────────────────
  // The board is an ARIA grid with a single tab stop (roving tabindex).
  // `focusCell` is the last note focused; if a scale or filter change hides
  // it, the tab stop falls back to the first drawn note in reading order.
  const [focusCell, setFocusCell] = useState<{ s: number; f: number } | null>(null);

  // At most 8 strings × 25 frets, so this is computed per render rather than memoized
  const tabStop = ((): { s: number; f: number } | null => {
    if (focusCell && focusCell.f <= numFrets && isCellRendered(focusCell.s, focusCell.f)) {
      return focusCell;
    }
    for (const s of strings) {
      for (const f of frets) {
        if (isCellRendered(s, f)) return { s, f };
      }
    }
    return null;
  })();

  /**
   * Arrow keys move between drawn notes: left/right along a string, up/down to
   * the nearest note on the neighbouring string. Home/End jump to the ends of
   * the string. Enter/Space are left to the button, which plays the note.
   */
  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.dataset.string === undefined) return;
      const s = Number(target.dataset.string);
      const f = Number(target.dataset.fret);
      const row = strings.indexOf(s);
      const drawnFrets = (str: number) => frets.filter((fr) => isCellRendered(str, fr));

      let next: { s: number; f: number } | null = null;
      const onString = drawnFrets(s);
      switch (event.key) {
        case 'ArrowRight': {
          const fr = onString.find((x) => x > f);
          if (fr !== undefined) next = { s, f: fr };
          break;
        }
        case 'ArrowLeft': {
          const fr = [...onString].reverse().find((x) => x < f);
          if (fr !== undefined) next = { s, f: fr };
          break;
        }
        case 'Home':
          if (onString.length) next = { s, f: onString[0] };
          break;
        case 'End':
          if (onString.length) next = { s, f: onString[onString.length - 1] };
          break;
        case 'ArrowUp':
        case 'ArrowDown': {
          // Walk rows in the pressed direction until one has a drawn note,
          // then take the note nearest the current fret.
          const step = event.key === 'ArrowUp' ? -1 : 1;
          for (let r = row + step; r >= 0 && r < strings.length; r += step) {
            const candidates = drawnFrets(strings[r]);
            if (candidates.length) {
              const nearest = candidates.reduce((a, b) =>
                Math.abs(b - f) < Math.abs(a - f) ? b : a
              );
              next = { s: strings[r], f: nearest };
              break;
            }
          }
          break;
        }
        default:
          return;
      }

      event.preventDefault();
      if (!next) return;
      setFocusCell(next);
      const el = event.currentTarget.querySelector<HTMLButtonElement>(
        `[data-string="${next.s}"][data-fret="${next.f}"]`
      );
      el?.focus();
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },
    [strings, frets, isCellRendered]
  );

  /** Plays the note at the clicked fret position and records it in the store. */
  const handleNoteClick = useCallback(
    (stringIndex: number, fret: number) => {
      const note = getNoteAtPosition(stringIndex, fret, currentTuning.notes);
      audioEngine.playNoteAtPosition(stringIndex, fret, currentTuning.notes);
      useGuitarStore.getState().setLastClickedNote(note);
    },
    [currentTuning.notes]
  );

  /**
   * Produces a `<NoteCircle>` (or null) for a single string × fret intersection.
   *
   * Variant selection:
   *   - Root note   → `'root'`
   *   - In-scale    → `'scale'`
   *   - Non-scale   → `'muted'` (only when `showNonScaleNotes` is true)
   *
   * When `selectedPosition` is set, notes outside that position are dimmed by
   * reducing their opacity — the circle component itself still renders normally.
   */
  const renderNote = useCallback(
    (stringIndex: number, fret: number) => {
      const note = getNoteAtPosition(stringIndex, fret, currentTuning.notes);
      const inScale = isNoteInScale(note, scaleNotes);
      const isRoot = note === selectedRoot;
      const notePositions = getPositionsForNote(fret, note);
      const interval = getInterval(selectedRoot, note);
      const isHighlighted = highlightedIntervals.includes(interval);

      const isInSelectedPosition =
        selectedPosition !== null &&
        notePositions.some((p) => p.id === selectedPosition);

      // ── Display text ──────────────────────────────────────────────────────
      let displayText = '';
      if (displayMode === 'notes') {
        displayText = note;
      } else if (displayMode === 'intervals' && scale) {
        displayText = getScaleDegree(note, selectedRoot, scale) || '';
      }
      // 'dots' and 'patterns' modes render no text label

      // ── Accessible name and roving tab stop ───────────────────────────────
      // Strings are numbered the way guitarists count them: 1 = highest.
      const stringNumber = currentTuning.strings - stringIndex;
      const where = `string ${stringNumber} (${ALL_NOTES[currentTuning.notes[stringIndex]]}), ${
        fret === 0 ? 'open' : `fret ${fret}`
      }`;
      const degree = inScale && scale ? getScaleDegree(note, selectedRoot, scale) : '';
      const isPlaying =
        playingPosition !== null && playingPosition.string === stringIndex && playingPosition.fret === fret;
      const a11y = {
        isPlaying,
        stringIndex,
        fret,
        tabIndex: tabStop && tabStop.s === stringIndex && tabStop.f === fret ? 0 : -1,
        onFocus: () => setFocusCell({ s: stringIndex, f: fret }),
      };
      const labelFor = (suffix: string) =>
        `${note}${isRoot ? ', root' : degree ? `, degree ${degree}` : ''}, ${where}${suffix}`;

      // ── Non-scale note ────────────────────────────────────────────────────
      if (!inScale) {
        if (!showNonScaleNotes) return null;
        // Drawn as a bare label on the wood (see NoteCircle) rather than faded,
        // so it keeps AA contrast. Dots mode has no labels, so it gets a small dot.
        return (
          <NoteCircle
            key={`${stringIndex}-${fret}`}
            note={note}
            displayText={displayMode === 'dots' ? '·' : note}
            variant="muted"
            isHighlighted={false}
            onClick={() => handleNoteClick(stringIndex, fret)}
            title={`${note} (not in scale)`}
            ariaLabel={labelFor(', not in scale')}
            {...a11y}
          />
        );
      }

      // ── Position-filtered note (out of selected position) ─────────────────
      if (selectedPosition !== null && !isInSelectedPosition) {
        return (
          <NoteCircle
            key={`${stringIndex}-${fret}`}
            note={note}
            displayText={displayText}
            variant={isRoot ? 'root' : 'scale'}
            dimmed
            isHighlighted={isHighlighted}
            onClick={() => handleNoteClick(stringIndex, fret)}
            title={note}
            ariaLabel={labelFor(', outside selected position')}
            {...a11y}
          />
        );
      }

      // ── In-scale note (normal render) ─────────────────────────────────────
      return (
        <NoteCircle
          key={`${stringIndex}-${fret}`}
          note={note}
          displayText={displayText}
          variant={isRoot ? 'root' : 'scale'}
          isHighlighted={isHighlighted && !isRoot}
          onClick={() => handleNoteClick(stringIndex, fret)}
          title={`${note}${isRoot ? ' (Root)' : ''}`}
          ariaLabel={labelFor('')}
          {...a11y}
        />
      );
    },
    [
      currentTuning.notes,
      scaleNotes,
      selectedRoot,
      scale,
      displayMode,
      showNonScaleNotes,
      selectedPosition,
      highlightedIntervals,
      getPositionsForNote,
      handleNoteClick,
      currentTuning.strings,
      tabStop,
      playingPosition,
    ]
  );

  // Board width: every fret cell plus the 36px string-label column, so
  // overflow:hidden (for the rounded corners) never clips the high frets.
  const boardMinWidth = `max(560px, calc(36px + ${frets.length} * var(--fret-cell-min)))`;

  /** One cell per fret column; flex ratios taper toward the body like a real neck. */
  const cellStyle = (i: number): React.CSSProperties => ({
    flex: fretWidthRatios[i],
    minWidth: 'var(--fret-cell-min)',
  });

  return (
    <div className="w-full overflow-x-auto overscroll-x-contain">
      <p id="fretboard-keys-hint" className="sr-only">
        Arrow keys move between notes. Enter plays the selected note.
      </p>
      <div
        role="grid"
        aria-label={`Fretboard, ${selectedRoot} ${scale?.name ?? ''}`.trim()}
        aria-describedby="fretboard-keys-hint"
        onKeyDown={handleGridKeyDown}
        className="relative"
        style={{ minWidth: boardMinWidth }}
      >
        {/* Fret numbers (visual only; each note's label names its fret) */}
        <div aria-hidden="true" className="tabular flex h-6 items-end pb-1 font-mono text-[11px] text-muted">
          <div className="w-9 shrink-0" />
          {frets.map((fret, i) => (
            <div key={fret} className="flex justify-center" style={cellStyle(i)}>
              {LABELLED_FRETS.has(fret) ? fret : ''}
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-control bg-board">
          {strings.map((stringIndex) => {
            // Thicker strings toward the bass side
            const stringThickness = 1 + stringIndex * 0.3;
            return (
              <div key={stringIndex} role="row" className="relative flex items-center" style={{ height: 'var(--fret-row-h)' }}>
                <div
                  role="rowheader"
                  aria-label={`String ${currentTuning.strings - stringIndex}, ${stringNames[stringIndex]}`}
                  className="w-9 shrink-0 text-center text-xs text-muted select-none"
                >
                  {stringNames[stringIndex]}
                </div>

                {/* The string itself */}
                <div
                  aria-hidden="true"
                  className="absolute right-0 left-9 top-1/2 -translate-y-1/2 bg-string"
                  style={{ height: stringThickness }}
                />

                <div role="none" className="relative z-[1] flex flex-1">
                  {frets.map((fret, i) => (
                    <div key={fret} role="gridcell" className="relative flex items-center justify-center" style={{ ...cellStyle(i), height: 'var(--fret-row-h)' }}>
                      {fret === 0 ? (
                        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-[3px] bg-ink" />
                      ) : (
                        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-line-strong" />
                      )}
                      {renderNote(stringIndex, fret)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Inlay dots below the board */}
        <div aria-hidden="true" className="flex h-5 items-center">
          <div className="w-9 shrink-0" />
          {frets.map((fret, i) => (
            <div key={fret} className="flex justify-center gap-1" style={cellStyle(i)}>
              {SINGLE_MARKERS.includes(fret) && <span className="size-1.5 rounded-full bg-control" />}
              {DOUBLE_MARKERS.includes(fret) && (
                <>
                  <span className="size-1.5 rounded-full bg-control" />
                  <span className="size-1.5 rounded-full bg-control" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
