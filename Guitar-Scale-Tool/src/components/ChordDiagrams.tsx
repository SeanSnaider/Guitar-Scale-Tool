/**
 * ChordDiagrams.tsx
 *
 * Renders the Diatonic Chords panel for the currently selected scale.
 * Shows either graphical chord box diagrams (SVG-based) or a horizontal
 * ASCII-style tablature view. Clicking a chord plays it as an arpeggio.
 *
 * Styling: Studio Walnut theme — dark surfaces, amber accents.
 *
 * Dependencies:
 * - useGuitarStore: selectedRoot, selectedScale
 * - audioEngine: playNote
 * - musicTheory: SCALES, getScaleNotes, getDiatonicChords, getAscendingOctaves, CHORD_TYPES, ALL_NOTES
 */

import { useState, useMemo } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';
import {
  SCALES,
  getScaleNotes,
  getDiatonicChords,
  getAscendingOctaves,
  CHORD_TYPES,
  ALL_NOTES,
} from '../data/musicTheory';

type ViewMode = 'boxes' | 'tab';

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
  return [-1, barFret, -1, -1, -1, -1];
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ChordDiagrams component.
 *
 * Renders all diatonic chords for the currently selected root + scale in either
 * a graphical box view or a compact tab view. Clicking any chord plays it as a
 * short arpeggio via the AudioEngine.
 *
 * @returns The rendered chord diagrams panel, or an empty-state message.
 */
export default function ChordDiagrams() {
  const { selectedRoot, selectedScale } = useGuitarStore();
  const [viewMode, setViewMode] = useState<ViewMode>('boxes');

  const scale = SCALES[selectedScale];

  /** Resolve all diatonic chords for the current root + scale. */
  const diatonicChords = useMemo(() => {
    if (!scale) return [];
    return getDiatonicChords(selectedRoot, selectedScale);
  }, [selectedRoot, selectedScale, scale]);

  /**
   * Plays a chord as a staggered arpeggio via the global AudioEngine.
   *
   * @param chordRoot - Root note of the chord.
   * @param chordType - Quality key for the chord (e.g. "major").
   */
  const handlePlayChord = (chordRoot: string, chordType: string) => {
    const chord = CHORD_TYPES[chordType];
    if (!chord) return;

    // Root position: each chord tone sits above the previous one.
    const chordNotes = getScaleNotes(chordRoot, chord.intervals);
    getAscendingOctaves(chordNotes, 3).forEach(({ note, octave }, i) => {
      setTimeout(() => audioEngine.playNote(note, octave), i * 80);
    });
  };

  if (!scale || diatonicChords.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          background: 'var(--bg-elevated)',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px',
        }}
      >
        {scale
          ? `${scale.name} has no seven-note diatonic harmony to show`
          : 'Select a scale to view chord diagrams'}
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Section heading */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          fontWeight: 400,
          color: 'var(--accent-glow)',
          margin: '0 0 16px 0',
        }}
      >
        Diatonic Chords
      </h2>

      {/* Header row: scale label + view toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {selectedRoot} {scale.name}
        </span>

        <div
          style={{
            display: 'flex',
            background: 'var(--bg-primary)',
            borderRadius: '6px',
            padding: '2px',
            gap: '2px',
          }}
        >
          {(['boxes', 'tab'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease',
                background: viewMode === mode ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === mode ? '#1C1714' : 'var(--text-muted)',
                fontWeight: viewMode === mode ? 600 : 400,
              }}
            >
              {mode === 'boxes' ? 'Boxes' : 'Tab'}
            </button>
          ))}
        </div>
      </div>

      {/* View */}
      {viewMode === 'boxes' ? (
        <ChordBoxesView chords={diatonicChords} onPlayChord={handlePlayChord} />
      ) : (
        <ChordTabView chords={diatonicChords} onPlayChord={handlePlayChord} />
      )}
    </div>
  );
}

// ─── ChordBoxesView ───────────────────────────────────────────────────────────

/** Props shared by the two chord view sub-components. */
interface ChordViewProps {
  chords: Array<{ root: string; degree: string; type: string; seventh: string }>;
  onPlayChord: (root: string, type: string) => void;
}

/**
 * ChordBoxesView renders graphical fretboard chord diagrams.
 *
 * Each diagram is an inline SVG showing vertical strings, horizontal frets,
 * and filled dots for finger positions. Muted / open strings are shown above
 * the nut as × / ○ symbols.
 *
 * @param chords - Array of diatonic chord descriptors.
 * @param onPlayChord - Callback when a chord card is clicked.
 */
function ChordBoxesView({ chords, onPlayChord }: ChordViewProps) {
  const diagramWidth = 70;
  const diagramHeight = 80;
  const numFrets = 4;
  const numStrings = 6;
  const dotSize = 10;

  const stringSpacing = diagramWidth / (numStrings - 1);
  const fretSpacing = diagramHeight / numFrets;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '12px',
      }}
    >
      {chords.map((chord, i) => {
        const voicing = getChordVoicing(chord.root, chord.type);
        const chordSymbol = CHORD_TYPES[chord.type]?.symbol || '';

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
          <button
            key={i}
            onClick={() => onPlayChord(chord.root, chord.type)}
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-primary)';
            }}
          >
            {/* Chord name + degree */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-body)',
                }}
              >
                {chord.root}{chordSymbol}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                }}
              >
                {chord.degree}
              </div>
            </div>

            {/* Open / muted string indicators */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: diagramWidth,
                marginBottom: '4px',
              }}
            >
              {voicing.map((fret, idx) => (
                <div
                  key={idx}
                  style={{
                    width: dotSize,
                    textAlign: 'center',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                  }}
                >
                  {fret === -1 ? '×' : fret === 0 ? '○' : ''}
                </div>
              ))}
            </div>

            {/* SVG diagram */}
            <svg
              width={diagramWidth + 20}
              height={diagramHeight + 4}
              style={{ overflow: 'visible' }}
            >
              {/* Nut */}
              {showNut && (
                <rect
                  x={0}
                  y={0}
                  width={diagramWidth}
                  height={3}
                  fill="#C8B89A"
                  rx={1}
                />
              )}

              {/* Fret number label (when not at nut) */}
              {!showNut && (
                <text
                  x={-4}
                  y={fretSpacing / 2 + 4}
                  textAnchor="end"
                  fontSize={9}
                  fill="var(--text-muted)"
                >
                  {startFret}fr
                </text>
              )}

              {/* Vertical strings */}
              {Array.from({ length: numStrings }).map((_, idx) => (
                <line
                  key={idx}
                  x1={idx * stringSpacing}
                  y1={showNut ? 3 : 0}
                  x2={idx * stringSpacing}
                  y2={diagramHeight}
                  stroke="var(--text-muted)"
                  strokeWidth={0.8}
                  strokeOpacity={0.5}
                />
              ))}

              {/* Horizontal frets */}
              {Array.from({ length: numFrets + 1 }).map((_, idx) => (
                <line
                  key={idx}
                  x1={0}
                  y1={idx * fretSpacing}
                  x2={diagramWidth}
                  y2={idx * fretSpacing}
                  stroke="var(--border-subtle)"
                  strokeWidth={idx === 0 && showNut ? 0 : 1}
                />
              ))}

              {/* Finger dots */}
              {voicing.map((fret, stringIdx) => {
                if (fret <= 0) return null;

                const relativeFret = fret - startFret;
                const cy = relativeFret * fretSpacing + fretSpacing / 2;
                const cx = stringIdx * stringSpacing;

                const isRoot = stringIdx === 0 || stringIdx === 5;

                return (
                  <circle
                    key={stringIdx}
                    cx={Math.max(dotSize / 2, Math.min(cx, diagramWidth - dotSize / 2))}
                    cy={Math.max(dotSize / 2, Math.min(cy, diagramHeight - dotSize / 2))}
                    r={dotSize / 2}
                    fill={isRoot ? 'var(--accent-primary)' : 'var(--accent-glow)'}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1}
                  />
                );
              })}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

// ─── ChordTabView ─────────────────────────────────────────────────────────────

/**
 * ChordTabView renders chords as a horizontal guitar tablature grid.
 *
 * Each column represents a diatonic chord; each row represents a string.
 * Clicking a chord column triggers the arpeggio playback callback.
 *
 * @param chords - Array of diatonic chord descriptors.
 * @param onPlayChord - Callback when a chord column is clicked.
 */
function ChordTabView({ chords, onPlayChord }: ChordViewProps) {
  const stringNames = ['e', 'B', 'G', 'D', 'A', 'E'];

  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        borderRadius: '8px',
        padding: '12px',
        fontFamily: 'monospace',
        fontSize: '13px',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {stringNames.map((stringName, stringIdx) => {
        const actualIdx = 5 - stringIdx;
        return (
          <div
            key={stringIdx}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '20px',
            }}
          >
            <span
              style={{
                width: '16px',
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {stringName}
            </span>
            <span style={{ color: 'var(--border-subtle)' }}>|</span>
            <div style={{ display: 'flex', flex: 1 }}>
              {chords.map((chord, chordIdx) => {
                const voicing = getChordVoicing(chord.root, chord.type);
                const fret = voicing[actualIdx];
                return (
                  <button
                    key={chordIdx}
                    onClick={() => onPlayChord(chord.root, chord.type)}
                    style={{
                      width: '40px',
                      textAlign: 'center',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color:
                        fret === -1
                          ? 'var(--text-muted)'
                          : fret === 0
                          ? 'var(--text-secondary)'
                          : 'var(--text-body)',
                      transition: 'color 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-primary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color =
                        fret === -1
                          ? 'var(--text-muted)'
                          : fret === 0
                          ? 'var(--text-secondary)'
                          : 'var(--text-body)';
                    }}
                  >
                    {fret === -1 ? 'x' : fret}
                  </button>
                );
              })}
            </div>
            <span style={{ color: 'var(--border-subtle)' }}>|</span>
          </div>
        );
      })}

      {/* Chord name row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '24px',
          marginTop: '4px',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '4px',
        }}
      >
        <span style={{ width: '16px' }} />
        <span style={{ width: '8px' }} />
        <div style={{ display: 'flex', flex: 1 }}>
          {chords.map((chord, i) => {
            const chordSymbol = CHORD_TYPES[chord.type]?.symbol || '';
            return (
              <div
                key={i}
                style={{
                  width: '40px',
                  textAlign: 'center',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                }}
              >
                {chord.root}{chordSymbol}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
