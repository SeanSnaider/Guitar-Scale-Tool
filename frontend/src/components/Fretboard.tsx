/**
 * Fretboard.tsx
 *
 * The interactive guitar fretboard visualiser.  Renders all six strings,
 * fret wires, a nut bar, fret-position dot markers (below the strings), and
 * note circles for every playable fret position.
 *
 * Visual changes from the original (Studio Walnut restyling):
 *   - Background uses `--fretboard-bg` (#3D2B1A).
 *   - Fret 0 renders as a thick nut bar in `--nut-color`.
 *   - Fret wires are 1 px lines in `--fret-wire`.
 *   - Position dots are rendered in a separate row BELOW the strings.
 *   - The Position Legend panel at the top is removed.
 *   - The Scale Info section at the bottom is removed.
 *   - Note circles are delegated to the `NoteCircle` sub-component.
 *   - The entire component is wrapped in a horizontally scrollable div.
 *
 * All note-rendering logic, position detection, and click handling remain
 * identical to the original implementation.
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
      const a11y = {
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
    ]
  );

  return (
    /* Outer wrapper: horizontal scroll on narrow viewports */
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <p id="fretboard-keys-hint" className="sr-only">
        Arrow keys move between notes. Enter plays the selected note.
      </p>
      {/* ── Fretboard container ──────────────────────────────────────────── */}
      <div
        role="grid"
        aria-label={`Fretboard, ${selectedRoot} ${scale?.name ?? ''}`.trim()}
        aria-describedby="fretboard-keys-hint"
        onKeyDown={handleGridKeyDown}
        style={{
          position: 'relative',
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: 'var(--fretboard-bg)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          // Wide enough for every fret cell plus the 40 px string-label column,
          // so overflow:hidden (for the rounded corners) never clips high frets.
          minWidth: `max(600px, calc(40px + ${frets.length} * var(--fret-cell-min)))`,
        }}
      >
        {/* ── Fret numbers row (visual only; each note's label names its fret) ── */}
        <div
          aria-hidden="true"
          className="tabular"
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 24,
            borderBottom: '1px solid rgba(138, 128, 112, 0.2)',
          }}
        >
          {/* String label spacer */}
          <div style={{ width: 40, flexShrink: 0 }} />

          {frets.map((fret, i) => (
            <div
              key={fret}
              style={{
                flex: fretWidthRatios[i],
                minWidth: 'var(--fret-cell-min)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {LABELLED_FRETS.has(fret) ? fret : ''}
            </div>
          ))}
        </div>

        {/* ── String rows ──────────────────────────────────────────────── */}
        {strings.map((stringIndex) => {
          // Thicker strings towards the bass side
          const stringThickness = 1 + stringIndex * 0.3;

          return (
            <div
              key={stringIndex}
              role="row"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 'var(--fret-row-h)' }}
            >
              {/* String name label */}
              <div
                role="rowheader"
                aria-label={`String ${currentTuning.strings - stringIndex}, ${stringNames[stringIndex]}`}
                style={{
                  width: 40,
                  flexShrink: 0,
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                  userSelect: 'none',
                }}
              >
                {stringNames[stringIndex]}
              </div>

              {/* The physical string line */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 40,
                  right: 0,
                  height: stringThickness,
                  backgroundColor: 'var(--string-color)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 0,
                }}
              />

              {/* Fret positions */}
              <div role="none" style={{ display: 'flex', position: 'relative', zIndex: 1, flex: 1 }}>
                {frets.map((fret, i) => (
                  <div
                    key={fret}
                    role="gridcell"
                    style={{
                      flex: fretWidthRatios[i],
                      minWidth: 'var(--fret-cell-min)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {/* Nut (fret 0 left edge) or fret wire */}
                    {fret === 0 ? (
                      // Nut: thick bar on the left edge of fret 0
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          backgroundColor: 'var(--nut-color)',
                          zIndex: 0,
                        }}
                      />
                    ) : (
                      // Fret wire: 1 px line on the left edge
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          backgroundColor: 'var(--fret-wire)',
                          zIndex: 0,
                        }}
                      />
                    )}

                    {/* Note circle */}
                    {renderNote(stringIndex, fret)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* ── Fret dot markers row (below strings) ─────────────────────── */}
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 20,
            borderTop: '1px solid rgba(138, 128, 112, 0.1)',
          }}
        >
          {/* Spacer matching string label width */}
          <div style={{ width: 40, flexShrink: 0 }} />

          {frets.map((fret, i) => {
            const isSingle = SINGLE_MARKERS.includes(fret);
            const isDouble = DOUBLE_MARKERS.includes(fret);

            return (
              <div
                key={fret}
                style={{
                  flex: fretWidthRatios[i],
                  minWidth: 'var(--fret-cell-min)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  position: 'relative',
                }}
              >
                {isSingle && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-muted)',
                      opacity: 0.35,
                    }}
                  />
                )}
                {isDouble && (
                  <>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-primary)',
                        opacity: 0.5,
                      }}
                    />
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-primary)',
                        opacity: 0.5,
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
