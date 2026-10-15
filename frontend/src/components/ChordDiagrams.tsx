/**
 * ChordDiagrams.tsx
 *
 * The Library's Chords section: the diatonic chords of the current scale,
 * as chord box diagrams (SVG) or a compact tab view. Clicking a chord plays
 * it as an arpeggio.
 *
 * Dependencies:
 * - useGuitarStore: selectedRoot, selectedScale
 * - audioEngine: playNote
 * - musicTheory: SCALES, getScaleNotes, getDiatonicChords (stacked thirds), makeNoteNamer, ALL_NOTES
 */

import { useState, useMemo } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';
import {
  SCALES,
  TUNINGS,
  getScaleNotes,
  getDiatonicChords,
  makeNoteNamer,
  spellScale,
  ALL_NOTES,
} from '../data/musicTheory';
import type { DiatonicChord } from '../data/musicTheory';
import { Notice, SegmentedControl, cn, PageTitle } from '../ui';

type ViewMode = 'boxes' | 'tab';

const VIEW_MODES = [
  { value: 'boxes', label: 'Boxes' },
  { value: 'tab', label: 'Tab' },
] as const;

// ─── Chord voicing data ────────────────────────────────────────────────────────

/**
 * Hardcoded fret positions for the most common chord voicings.
 * Format: [lowE, A, D, G, B, highE]. -1 = muted, 0 = open string.
 */
const CHORD_VOICINGS: Record<string, number[]> = {
  // Major chords
  'C_major': [-1, 3, 2, 0, 1, 0],
  'C#_major': [-1, 4, 3, 1, 2, 1],
  'D_major': [-1, -1, 0, 2, 3, 2],
  'D#_major': [-1, 6, 5, 3, 4, 3],
  'E_major': [0, 2, 2, 1, 0, 0],
  'F_major': [1, 3, 3, 2, 1, 1],
  'F#_major': [2, 4, 4, 3, 2, 2],
  'G_major': [3, 2, 0, 0, 0, 3],
  'G#_major': [4, 6, 6, 5, 4, 4],
  'A_major': [-1, 0, 2, 2, 2, 0],
  'A#_major': [-1, 1, 3, 3, 3, 1],
  'B_major': [-1, 2, 4, 4, 4, 2],

  // Minor chords
  'C_minor': [-1, 3, 5, 5, 4, 3],
  'C#_minor': [-1, 4, 6, 6, 5, 4],
  'D_minor': [-1, -1, 0, 2, 3, 1],
  'D#_minor': [-1, 6, 8, 8, 7, 6],
  'E_minor': [0, 2, 2, 0, 0, 0],
  'F_minor': [1, 3, 3, 1, 1, 1],
  'F#_minor': [2, 4, 4, 2, 2, 2],
  'G_minor': [3, 5, 5, 3, 3, 3],
  'G#_minor': [4, 6, 6, 4, 4, 4],
  'A_minor': [-1, 0, 2, 2, 1, 0],
  'A#_minor': [-1, 1, 3, 3, 2, 1],
  'B_minor': [-1, 2, 4, 4, 3, 2],

  // Diminished
  'B_diminished': [-1, 2, 3, 4, 3, -1],
  'C#_diminished': [-1, 4, 5, 3, 5, -1],
  'D_diminished': [-1, -1, 0, 1, 0, 1],
  'E_diminished': [0, 1, 2, 0, 2, 0],
  'F#_diminished': [2, 3, 4, 2, -1, -1],
  'G_diminished': [3, 4, 5, 3, -1, -1],
  'A_diminished': [-1, 0, 1, 2, 1, -1],
};

/**
 * Returns fret positions for a given root + chord type combination.
 * Falls back to an A-shape barre voicing when no hardcoded voicing exists.
 *
 * @param root - Root note (e.g. "G").
 * @param chordType - Chord quality key (e.g. "major", "minor").
 * @returns Array of 6 fret numbers [lowE … highE], -1 = muted.
 */
function getChordVoicing(root: string, chordType: string): number[] {
  const key = `${root}_${chordType}`;
  if (CHORD_VOICINGS[key]) return CHORD_VOICINGS[key];

  const rootIndex = ALL_NOTES.indexOf(root as typeof ALL_NOTES[number]);
  if (rootIndex === -1) return [-1, -1, -1, -1, -1, -1];

  // A-string root: open A = index 9
  const barFret = (rootIndex - 9 + 12) % 12;

  if (chordType === 'major') {
    return [-1, barFret, barFret + 2, barFret + 2, barFret + 2, barFret];
  }
  if (chordType === 'minor') {
    return [-1, barFret, barFret + 2, barFret + 2, barFret + 1, barFret];
  }
  // A-string-root shapes for the other triads (low E to high E):
  // dim: root, b5 on D, octave on G, b3 on B; aug: root, #5 on D, octave on G, 3 on B
  if (chordType === 'diminished') {
    return [-1, barFret, barFret + 1, barFret + 2, barFret + 1, -1];
  }
  if (chordType === 'augmented') {
    return [-1, barFret, barFret + 3, barFret + 2, barFret + 2, -1];
  }
  return [-1, barFret, -1, -1, -1, -1];
}

/** Open-string pitch classes of standard tuning, low E to high E (the voicings assume it). */
const STANDARD_OPEN = [4, 9, 2, 7, 11, 4];

/** Short fret list for screen readers, low E to high E: "x 3 2 0 1 0". */
function fretList(voicing: number[]): string {
  return voicing.map((f) => (f === -1 ? 'x' : String(f))).join(' ');
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ChordDiagrams component.
 *
 * Renders all diatonic chords for the currently selected root + scale in either
 * a graphical box view or a compact tab view. Clicking any chord plays it as a
 * short arpeggio via the AudioEngine.
 *
 * @returns The rendered chord section, or an empty-state message.
 */
export default function ChordDiagrams() {
  const selectedRoot = useGuitarStore((s) => s.selectedRoot);
  const selectedScale = useGuitarStore((s) => s.selectedScale);
  const [viewMode, setViewMode] = useState<ViewMode>('boxes');
  const tuning = useGuitarStore((s) => s.currentTuning);
  const isStandardTuning = tuning.notes.join(',') === TUNINGS.standard.notes.join(',');
  const nameOf = useMemo(() => makeNoteNamer(selectedRoot, selectedScale), [selectedRoot, selectedScale]);
  const rootName = spellScale(selectedRoot, selectedScale)[0] ?? selectedRoot;

  const scale = SCALES[selectedScale];

  /** Resolve all diatonic chords for the current root + scale. */
  const diatonicChords = useMemo(() => {
    if (!scale) return [];
    return getDiatonicChords(selectedRoot, selectedScale);
  }, [selectedRoot, selectedScale, scale]);

  /**
   * Plays a chord as a staggered arpeggio via the global AudioEngine.
   *
   * @param chord - The diatonic chord (root and triad intervals).
   */
  const handlePlayChord = (chord: DiatonicChord) => {
    // The chord's own stacked-third intervals, so unusual triads play correctly too
    const chordNotes = getScaleNotes(chord.root, chord.intervals);
    chordNotes.forEach((note, i) => {
      setTimeout(() => {
        const noteIndex = ALL_NOTES.indexOf(note as typeof ALL_NOTES[number]);
        if (noteIndex !== -1) {
          audioEngine.playNote(note, 3 + Math.floor(i / 3));
        }
      }, i * 80);
    });
  };

  if (!scale || diatonicChords.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageTitle>Chords</PageTitle>
        <p className="text-sm text-muted">
          {scale
            ? `Diatonic chords are built by stacking thirds of a 7-note scale. ${scale.name} has ${scale.intervals.length} notes, so it has no diatonic chord set.`
            : 'Select a scale to view chord diagrams'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>
          Chords in {rootName} <span className="text-muted">{scale.name}</span>
        </PageTitle>
        <SegmentedControl
          ariaLabel="Chord view"
          size="sm"
          options={VIEW_MODES}
          value={viewMode}
          onChange={setViewMode}
        />
      </div>

      {!isStandardTuning && (
        <Notice tone="info">
          These diagrams use standard tuning (E A D G B E). Your current tuning is {tuning.name}, so the fret numbers
          won't match your strings.
        </Notice>
      )}

      {viewMode === 'boxes' ? (
        <ChordBoxesView chords={diatonicChords} onPlayChord={handlePlayChord} nameOf={nameOf} />
      ) : (
        <ChordTabView chords={diatonicChords} onPlayChord={handlePlayChord} nameOf={nameOf} />
      )}

      <p className="text-xs text-muted">
        Select a chord to hear it. Root notes in <span className="font-bold text-accent-ink">orange</span>.
      </p>
    </div>
  );
}

// ─── ChordBoxesView ───────────────────────────────────────────────────────────

/** Props shared by the two chord view sub-components. */
interface ChordViewProps {
  chords: DiatonicChord[];
  onPlayChord: (chord: DiatonicChord) => void;
  /** Spells chord roots for the key (Bb, not A#). */
  nameOf: (sharpName: string) => string;
}

const DIAGRAM_W = 70;
const DIAGRAM_H = 80;
const NUM_FRETS = 4;
const NUM_STRINGS = 6;
const DOT_R = 5;
const STRING_GAP = DIAGRAM_W / (NUM_STRINGS - 1);
const FRET_GAP = DIAGRAM_H / NUM_FRETS;
/** Margins around the grid: left for the "5fr" label, top for the o/x markers. */
const PAD_L = 20;
const PAD_T = 14;
const PAD_R = 8;
const PAD_B = 4;

/**
 * ChordBox draws one chord diagram: vertical strings, horizontal frets, ink
 * finger dots (accent where the fretted note is the chord root), and open (o)
 * and muted (x) markers above the nut. Decorative; the button carries the
 * fret list as its accessible name.
 */
function ChordBox({ voicing, root }: { voicing: number[]; root: string }) {
  const rootPc = ALL_NOTES.indexOf(root as typeof ALL_NOTES[number]);

  const frettedNotes = voicing.filter((f) => f > 0);
  const minFret = frettedNotes.length > 0 ? Math.min(...frettedNotes) : 1;
  const maxFret = frettedNotes.length > 0 ? Math.max(...frettedNotes) : 4;

  let startFret = 1;
  if (minFret > 4) {
    startFret = minFret;
  } else if (maxFret > 4) {
    startFret = Math.max(1, minFret);
  }
  const showNut = startFret === 1;

  return (
    <svg
      aria-hidden="true"
      width={DIAGRAM_W + PAD_L + PAD_R}
      height={DIAGRAM_H + PAD_T + PAD_B}
      viewBox={`${-PAD_L} ${-PAD_T} ${DIAGRAM_W + PAD_L + PAD_R} ${DIAGRAM_H + PAD_T + PAD_B}`}
    >
      {/* Frets (the top line becomes the nut at the first position) */}
      <g className="text-line-strong" stroke="currentColor" strokeWidth={1}>
        {Array.from({ length: NUM_FRETS + 1 }, (_, idx) =>
          idx === 0 && showNut ? null : (
            <line key={idx} x1={0} y1={idx * FRET_GAP} x2={DIAGRAM_W} y2={idx * FRET_GAP} />
          ),
        )}
      </g>

      {/* Strings */}
      <g className="text-control" stroke="currentColor" strokeWidth={1}>
        {Array.from({ length: NUM_STRINGS }, (_, idx) => (
          <line key={idx} x1={idx * STRING_GAP} y1={0} x2={idx * STRING_GAP} y2={DIAGRAM_H} />
        ))}
      </g>

      {showNut ? (
        <rect x={-0.5} y={-1.5} width={DIAGRAM_W + 1} height={3} rx={1} className="text-ink" fill="currentColor" />
      ) : (
        <text
          x={-6}
          y={FRET_GAP / 2 + 3}
          textAnchor="end"
          fontSize={9}
          className="text-muted font-mono"
          fill="currentColor"
        >
          {startFret}fr
        </text>
      )}

      {/* Open (o) and muted (x) markers above the nut */}
      <g className="text-muted" stroke="currentColor" strokeWidth={1.25} fill="none">
        {voicing.map((fret, idx) => {
          const x = idx * STRING_GAP;
          if (fret === 0) return <circle key={idx} cx={x} cy={-8} r={3} />;
          if (fret === -1) {
            return <path key={idx} d={`M${x - 3} -11 L${x + 3} -5 M${x + 3} -11 L${x - 3} -5`} />;
          }
          return null;
        })}
      </g>

      {/* Finger dots */}
      {voicing.map((fret, stringIdx) => {
        if (fret <= 0) return null;
        const cy = (fret - startFret) * FRET_GAP + FRET_GAP / 2;
        const isRoot = rootPc !== -1 && (STANDARD_OPEN[stringIdx] + fret) % 12 === rootPc;
        return (
          <circle
            key={stringIdx}
            cx={stringIdx * STRING_GAP}
            cy={Math.max(DOT_R, Math.min(cy, DIAGRAM_H - DOT_R))}
            r={DOT_R}
            className={isRoot ? 'text-accent' : 'text-ink'}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}

/**
 * ChordBoxesView renders the chords as a wrapping grid of diagram cards.
 *
 * @param chords - Array of diatonic chord descriptors.
 * @param onPlayChord - Callback when a chord card is clicked.
 */
function ChordBoxesView({ chords, onPlayChord, nameOf }: ChordViewProps) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
      {chords.map((chord, i) => {
        const voicing = getChordVoicing(chord.root, chord.type);
        const name = `${nameOf(chord.root)}${chord.symbol}`;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onPlayChord(chord)}
              aria-label={`${name} ${chord.degree}, frets ${fretList(voicing)}`}
              title={`Play ${name}`}
              className="flex w-full flex-col items-center gap-2 rounded-panel border border-line bg-surface px-3 pt-3 pb-2 transition-colors duration-150 hover:border-control"
            >
              <span className="flex items-baseline gap-2">
                <span className="text-[15px] font-bold text-ink">{name}</span>
                <span className="font-mono text-xs text-muted">{chord.degree}</span>
              </span>
              <ChordBox voicing={voicing} root={chord.root} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── ChordTabView ─────────────────────────────────────────────────────────────

/**
 * ChordTabView renders chords as a six-line tab, one column per chord with
 * the chord name underneath. Each column is one button that plays the chord.
 *
 * @param chords - Array of diatonic chord descriptors.
 * @param onPlayChord - Callback when a chord column is clicked.
 */
function ChordTabView({ chords, onPlayChord, nameOf }: ChordViewProps) {
  const stringNames = ['e', 'B', 'G', 'D', 'A', 'E'];

  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-panel border border-line bg-surface p-4">
      <div className="flex min-w-min font-mono text-[13px]">
        {/* String names (the button labels carry the frets for screen readers) */}
        <div aria-hidden="true" className="flex shrink-0 flex-col">
          {stringNames.map((name) => (
            <span key={name} className="flex h-7 w-6 items-center text-[11px] text-muted">
              {name}
            </span>
          ))}
        </div>

        {chords.map((chord, chordIdx) => {
          const voicing = getChordVoicing(chord.root, chord.type);
          const name = `${nameOf(chord.root)}${chord.symbol}`;
          return (
            <button
              key={chordIdx}
              type="button"
              onClick={() => onPlayChord(chord)}
              aria-label={`${name} ${chord.degree}, frets ${fretList(voicing)}`}
              title={`Play ${name}`}
              className="group flex w-11 shrink-0 flex-col rounded-[4px] hover:bg-sunken"
            >
              {stringNames.map((stringName, rowIdx) => {
                // Rows run high e to low E; voicings run low E to high e
                const fret = voicing[NUM_STRINGS - 1 - rowIdx];
                return (
                  <span key={stringName} className="relative flex h-7 items-center justify-center">
                    <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
                    <span
                      className={cn(
                        'tabular relative bg-surface px-1 group-hover:bg-sunken',
                        fret === -1 ? 'text-muted' : 'text-ink',
                      )}
                    >
                      {fret === -1 ? 'x' : fret}
                    </span>
                  </span>
                );
              })}
              <span className="mt-1 border-t border-line pt-1 text-center text-[11px] text-muted group-hover:text-ink">
                {name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
