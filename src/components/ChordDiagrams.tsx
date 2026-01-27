import { useState, useMemo } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';
import {
  SCALES,
  getScaleNotes,
  getDiatonicChords,
  CHORD_TYPES,
  ALL_NOTES,
} from '../data/musicTheory';

type ViewMode = 'boxes' | 'tab';

// Common chord voicings (fret positions for each string, -1 = muted, 0 = open)
// Format: [lowE, A, D, G, B, highE]
const CHORD_VOICINGS: Record<string, number[]> = {
  // Major chords
  'C_major': [-1, 3, 2, 0, 1, 0],
  'D_major': [-1, -1, 0, 2, 3, 2],
  'E_major': [0, 2, 2, 1, 0, 0],
  'F_major': [1, 3, 3, 2, 1, 1],
  'G_major': [3, 2, 0, 0, 0, 3],
  'A_major': [-1, 0, 2, 2, 2, 0],
  'B_major': [-1, 2, 4, 4, 4, 2],

  // Minor chords
  'C_minor': [-1, 3, 5, 5, 4, 3],
  'D_minor': [-1, -1, 0, 2, 3, 1],
  'E_minor': [0, 2, 2, 0, 0, 0],
  'F_minor': [1, 3, 3, 1, 1, 1],
  'G_minor': [3, 5, 5, 3, 3, 3],
  'A_minor': [-1, 0, 2, 2, 1, 0],
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

// Generate a basic voicing for any chord
function getChordVoicing(root: string, chordType: string): number[] {
  const key = `${root}_${chordType}`;
  if (CHORD_VOICINGS[key]) {
    return CHORD_VOICINGS[key];
  }

  // Generate a moveable shape based on root note
  const rootIndex = ALL_NOTES.indexOf(root as typeof ALL_NOTES[number]);
  if (rootIndex === -1) return [-1, -1, -1, -1, -1, -1];

  // Use E-shape barre for major/minor
  if (chordType === 'major') {
    const barFret = rootIndex === 0 ? 0 : rootIndex;
    return [barFret, barFret + 2, barFret + 2, barFret + 1, barFret, barFret];
  }
  if (chordType === 'minor') {
    const barFret = rootIndex === 0 ? 0 : rootIndex;
    return [barFret, barFret + 2, barFret + 2, barFret, barFret, barFret];
  }

  // Default: just show root on low E
  return [rootIndex, -1, -1, -1, -1, -1];
}

export default function ChordDiagrams() {
  const { selectedRoot, selectedScale } = useGuitarStore();
  const [viewMode, setViewMode] = useState<ViewMode>('boxes');

  const scale = SCALES[selectedScale];

  // Get diatonic chords for the scale
  const diatonicChords = useMemo(() => {
    if (!scale) return [];
    return getDiatonicChords(selectedRoot, selectedScale);
  }, [selectedRoot, selectedScale, scale]);

  // Play chord (arpeggio style)
  const handlePlayChord = (chordRoot: string, chordType: string) => {
    const chord = CHORD_TYPES[chordType];
    if (!chord) return;

    const chordNotes = getScaleNotes(chordRoot, chord.intervals);
    chordNotes.forEach((note, i) => {
      setTimeout(() => {
        // Find this note on the fretboard and play it
        const noteIndex = ALL_NOTES.indexOf(note as typeof ALL_NOTES[number]);
        if (noteIndex !== -1) {
          audioEngine.playNote(note, 3 + Math.floor(i / 3));
        }
      }, i * 80); // Strum effect
    });
  };

  if (!scale || diatonicChords.length === 0) {
    return (
      <div className="p-4 bg-[var(--surface)] rounded-lg text-center text-[var(--text-muted)]">
        Select a scale to view chord diagrams
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-lg p-4">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--text)]">
          Diatonic Chords - {selectedRoot} {scale.name}
        </h3>
        <div className="flex bg-[var(--border)] rounded p-0.5">
          <button
            onClick={() => setViewMode('boxes')}
            className={`px-2 py-1 text-xs rounded transition-all ${
              viewMode === 'boxes'
                ? 'bg-[var(--primary)] text-[var(--bg)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            Boxes
          </button>
          <button
            onClick={() => setViewMode('tab')}
            className={`px-2 py-1 text-xs rounded transition-all ${
              viewMode === 'tab'
                ? 'bg-[var(--primary)] text-[var(--bg)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            Tab
          </button>
        </div>
      </div>

      {/* Chord Display */}
      {viewMode === 'boxes' ? (
        <ChordBoxesView
          chords={diatonicChords}
          onPlayChord={handlePlayChord}
        />
      ) : (
        <ChordTabView
          chords={diatonicChords}
          onPlayChord={handlePlayChord}
        />
      )}
    </div>
  );
}

// Vertical chord box diagrams
function ChordBoxesView({
  chords,
  onPlayChord,
}: {
  chords: Array<{ root: string; degree: string; type: string; seventh: string }>;
  onPlayChord: (root: string, type: string) => void;
}) {
  // Diagram dimensions
  const diagramWidth = 70; // px
  const diagramHeight = 80; // px
  const numFrets = 4;
  const numStrings = 6;
  const dotSize = 10; // px

  // Calculate spacing
  const stringSpacing = diagramWidth / (numStrings - 1);
  const fretSpacing = diagramHeight / numFrets;

  return (
    <div className="flex flex-wrap justify-center gap-4">
      {chords.map((chord, i) => {
        const voicing = getChordVoicing(chord.root, chord.type);
        const chordSymbol = CHORD_TYPES[chord.type]?.symbol || '';

        // Find the fret range to display
        const frettedNotes = voicing.filter(f => f > 0);
        const minFret = frettedNotes.length > 0 ? Math.min(...frettedNotes) : 1;
        const maxFret = frettedNotes.length > 0 ? Math.max(...frettedNotes) : 4;

        // Determine starting fret
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
            className="bg-[var(--bg)] rounded-lg p-3 hover:bg-[var(--button-hover)] transition-colors flex flex-col items-center"
          >
            {/* Chord name */}
            <div className="text-center mb-2">
              <span className="text-sm font-bold text-[var(--text)]">
                {chord.root}{chordSymbol}
              </span>
              <div className="text-[10px] text-[var(--text-muted)]">{chord.degree}</div>
            </div>

            {/* Open/Muted string indicators */}
            <div
              className="flex mb-1"
              style={{ width: diagramWidth, justifyContent: 'space-between' }}
            >
              {voicing.map((fret, idx) => (
                <div
                  key={idx}
                  className="text-center text-[10px] text-[var(--text-muted)]"
                  style={{ width: dotSize }}
                >
                  {fret === -1 ? '×' : fret === 0 ? '○' : ''}
                </div>
              ))}
            </div>

            {/* Chord diagram container */}
            <div
              className="relative"
              style={{ width: diagramWidth, height: diagramHeight }}
            >
              {/* Nut or fret number indicator */}
              {showNut ? (
                <div
                  className="absolute top-0 left-0 bg-[var(--color-nut-bone)] rounded-sm"
                  style={{ width: diagramWidth, height: 3 }}
                />
              ) : (
                <div className="absolute text-[9px] text-[var(--text-muted)]"
                  style={{ left: -18, top: fretSpacing / 2 - 5 }}
                >
                  {startFret}fr
                </div>
              )}

              {/* Vertical strings */}
              {Array.from({ length: numStrings }).map((_, idx) => (
                <div
                  key={idx}
                  className="absolute bg-[var(--string-color)]"
                  style={{
                    left: idx * stringSpacing,
                    top: showNut ? 3 : 0,
                    width: 1,
                    height: showNut ? diagramHeight - 3 : diagramHeight,
                  }}
                />
              ))}

              {/* Horizontal frets */}
              {Array.from({ length: numFrets + 1 }).map((_, idx) => (
                <div
                  key={idx}
                  className="absolute bg-[var(--border)]"
                  style={{
                    top: idx * fretSpacing,
                    left: 0,
                    width: diagramWidth,
                    height: idx === 0 && showNut ? 0 : 1,
                  }}
                />
              ))}

              {/* Finger position dots */}
              {voicing.map((fret, stringIdx) => {
                if (fret <= 0) return null;

                const relativeFret = fret - startFret;
                // Position dot in the middle of the fret space
                const topPos = (relativeFret * fretSpacing) + (fretSpacing / 2) - (dotSize / 2);
                // Center dot on the string
                const leftPos = (stringIdx * stringSpacing) - (dotSize / 2);

                return (
                  <div
                    key={stringIdx}
                    className="absolute rounded-full bg-[var(--primary)] border border-white/20"
                    style={{
                      width: dotSize,
                      height: dotSize,
                      top: Math.max(2, Math.min(topPos, diagramHeight - dotSize - 2)),
                      left: Math.max(0, Math.min(leftPos, diagramWidth - dotSize)),
                    }}
                  />
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Horizontal tab view of chords
function ChordTabView({
  chords,
  onPlayChord,
}: {
  chords: Array<{ root: string; degree: string; type: string; seventh: string }>;
  onPlayChord: (root: string, type: string) => void;
}) {
  const stringNames = ['e', 'B', 'G', 'D', 'A', 'E'];

  return (
    <div className="bg-[var(--bg)] rounded-lg p-3 font-mono text-sm">
      {/* String labels and chord columns */}
      {stringNames.map((stringName, stringIdx) => {
        const actualIdx = 5 - stringIdx; // Reverse for tab display
        return (
          <div key={stringIdx} className="flex items-center h-5">
            <span className="w-4 text-xs text-[var(--text-muted)] font-bold">{stringName}</span>
            <span className="text-[var(--text-muted)]">|</span>
            <div className="flex-1 flex">
              {chords.map((chord, chordIdx) => {
                const voicing = getChordVoicing(chord.root, chord.type);
                const fret = voicing[actualIdx];
                return (
                  <button
                    key={chordIdx}
                    onClick={() => onPlayChord(chord.root, chord.type)}
                    className="w-10 text-center hover:bg-[var(--button-hover)] transition-colors"
                  >
                    {fret === -1 ? (
                      <span className="text-[var(--text-subtle)]">x</span>
                    ) : (
                      <span className={fret === 0 ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'}>
                        {fret}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <span className="text-[var(--text-muted)]">|</span>
          </div>
        );
      })}

      {/* Chord names row */}
      <div className="flex items-center h-6 mt-1 border-t border-[var(--border)]">
        <span className="w-4" />
        <span className="w-2" />
        <div className="flex-1 flex">
          {chords.map((chord, i) => {
            const chordSymbol = CHORD_TYPES[chord.type]?.symbol || '';
            return (
              <div key={i} className="w-10 text-center text-[10px] text-[var(--text-muted)]">
                {chord.root}{chordSymbol}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
