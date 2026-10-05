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

import { useMemo, useCallback } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';
import {
  getNoteAtPosition,
  getScaleNotes,
  isNoteInScale,
  getScaleDegree,
  getInterval,
  SCALES,
  getScalePositions,
  isFretInPosition,
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

  /** CAGED / 3NPS windows for the current key, scale and tuning. */
  const positions = useMemo(
    () => getScalePositions(positionSystem, selectedRoot, selectedScale, currentTuning.notes),
    [positionSystem, selectedRoot, selectedScale, currentTuning.notes]
  );

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
      return positions.filter((pos) => isFretInPosition(fret, pos));
    },
    [scaleNotes, positions]
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

      // ── Non-scale note ────────────────────────────────────────────────────
      if (!inScale) {
        if (!showNonScaleNotes) return null;
        return (
          <div
            key={`${stringIndex}-${fret}`}
            style={{ opacity: 0.3 }}
          >
            <NoteCircle
              note={note}
              displayText={displayMode === 'notes' ? note : ''}
              variant="muted"
              isHighlighted={false}
              onClick={() => handleNoteClick(stringIndex, fret)}
              title={`${note} (not in scale)`}
            />
          </div>
        );
      }

      // ── Position-filtered note (out of selected position) ─────────────────
      if (selectedPosition !== null && !isInSelectedPosition) {
        return (
          <div
            key={`${stringIndex}-${fret}`}
            style={{ opacity: 0.2 }}
          >
            <NoteCircle
              note={note}
              displayText={displayText}
              variant={isRoot ? 'root' : 'scale'}
              isHighlighted={isHighlighted}
              onClick={() => handleNoteClick(stringIndex, fret)}
              title={note}
            />
          </div>
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
    ]
  );

  return (
    /* Outer wrapper: horizontal scroll on narrow viewports */
    <div style={{ overflowX: 'auto', width: '100%' }}>
      {/* ── Fretboard container ──────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: 'var(--fretboard-bg)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          minWidth: 600,
        }}
      >
        {/* ── Fret numbers row ─────────────────────────────────────────── */}
        <div
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
                minWidth: 28,
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
          // Thicker strings towards the bass side. stringIndex is stored
          // low -> high (0 = lowest string), so invert it for thickness.
          const stringThickness = 1 + (currentTuning.strings - 1 - stringIndex) * 0.3;

          return (
            <div
              key={stringIndex}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 36 }}
            >
              {/* String name label */}
              <div
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
              <div style={{ display: 'flex', position: 'relative', zIndex: 1, flex: 1 }}>
                {frets.map((fret, i) => (
                  <div
                    key={fret}
                    style={{
                      flex: fretWidthRatios[i],
                      minWidth: 28,
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
                  minWidth: 28,
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
