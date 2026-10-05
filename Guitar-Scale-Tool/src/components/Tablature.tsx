import { useEffect, useMemo, useState } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';
import {
  getNoteAtPosition,
  getScaleNotes,
  isNoteInScale,
  SCALES,
  ALL_NOTES,
  stringFretToMidi,
} from '../data/musicTheory';

interface TabNote {
  string: number; // 0 = high e, 5 = low E (tab order)
  fret: number;
  note: string;
  isRoot: boolean;
}

// Generate 3NPS scale pattern starting from lowest root note
function generate3NPSPattern(
  rootNote: string,
  scaleIntervals: number[],
  tuning: number[],
  startFret: number = 0,
  maxFret: number = 15
): TabNote[] {
  const scaleNotes = getScaleNotes(rootNote, scaleIntervals);
  const pattern: TabNote[] = [];

  // Work from low E string (index 0 in tuning) to high e (index 5)
  // But in tab display, high e is string 0, low E is string 5
  for (let stringIdx = 0; stringIdx < tuning.length; stringIdx++) {
    const tabString = tuning.length - 1 - stringIdx; // Convert to tab string number
    let notesOnString = 0;

    // Find notes on this string within fret range
    for (let fret = startFret; fret <= maxFret && notesOnString < 3; fret++) {
      const note = getNoteAtPosition(stringIdx, fret, tuning);
      if (isNoteInScale(note, scaleNotes)) {
        pattern.push({
          string: tabString,
          fret,
          note,
          isRoot: note === rootNote,
        });
        notesOnString++;
      }
    }
  }

  return pattern;
}

// Find the lowest occurrence of the root note on the fretboard
function findLowestRoot(
  rootNote: string,
  tuning: number[],
  maxFret: number = 12
): { string: number; fret: number } | null {
  // Start from low E string
  for (let stringIdx = 0; stringIdx < tuning.length; stringIdx++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const note = getNoteAtPosition(stringIdx, fret, tuning);
      if (note === rootNote) {
        return { string: stringIdx, fret };
      }
    }
  }
  return null;
}

export default function Tablature() {
  const {
    selectedRoot,
    selectedScale,
    currentTuning,
    playbackDirection,
    metronome,
  } = useGuitarStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number>(-1);

  const scale = SCALES[selectedScale];

  // Get string names in tab order (high to low: e B G D A E)
  const tabStringNames = useMemo(() => {
    const names = currentTuning.notes.map(noteIndex => ALL_NOTES[noteIndex]);
    // Reverse for tab display (high string at top)
    return [...names].reverse();
  }, [currentTuning]);

  // Generate the scale pattern
  const scalePattern = useMemo(() => {
    if (!scale) return [];

    // Find lowest root note position
    const lowestRoot = findLowestRoot(selectedRoot, currentTuning.notes);
    const startFret = lowestRoot ? Math.max(0, lowestRoot.fret) : 0;

    return generate3NPSPattern(
      selectedRoot,
      scale.intervals,
      currentTuning.notes,
      startFret,
      startFret + 15
    );
  }, [selectedRoot, scale, currentTuning.notes]);

  // Create ascending pattern (sorted by string then fret)
  const ascendingPattern = useMemo(() => {
    return [...scalePattern].sort((a, b) => {
      // Sort by string (high number = lower pitch) then by fret
      if (b.string !== a.string) return b.string - a.string;
      return a.fret - b.fret;
    });
  }, [scalePattern]);

  // Create descending pattern
  const descendingPattern = useMemo(() => {
    return [...ascendingPattern].reverse();
  }, [ascendingPattern]);

  // Combine based on playback direction
  const displayPattern = useMemo(() => {
    if (playbackDirection === 'ascending') return ascendingPattern;
    if (playbackDirection === 'descending') return descendingPattern;
    // 'both' - ascending then descending (skip duplicate middle note)
    return [...ascendingPattern, ...descendingPattern.slice(1)];
  }, [playbackDirection, ascendingPattern, descendingPattern]);

  // Pre-compute MIDI note numbers for the display pattern
  const midiNotes = useMemo(() => {
    return displayPattern.map(note => {
      // note.string is in tab order (0 = high e), actualString is 0 = low E
      const actualStringIndex = currentTuning.strings - 1 - note.string;
      return stringFretToMidi(actualStringIndex, note.fret, currentTuning.notes);
    });
  }, [displayPattern, currentTuning]);

  // Wire AudioEngine callback to update the active note indicator
  useEffect(() => {
    audioEngine.onScaleNotePlay = (noteIndex: number) => {
      setActiveNoteIndex(noteIndex);
      if (noteIndex === -1) setIsPlaying(false);
    };
    return () => { audioEngine.onScaleNotePlay = null; };
  }, []);

  // Spacebar toggles scale playback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only capture space when not typing in an input
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();

      if (isPlaying) {
        audioEngine.stopScalePlayback();
        setIsPlaying(false);
        setActiveNoteIndex(-1);
      } else if (midiNotes.length > 0) {
        audioEngine.scheduleScalePlayback(midiNotes, metronome.bpm);
        setIsPlaying(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, midiNotes, metronome.bpm]);

  // Handle note click
  const handleNoteClick = (note: TabNote) => {
    const actualStringIndex = currentTuning.strings - 1 - note.string;
    audioEngine.playNoteAtPosition(actualStringIndex, note.fret, currentTuning.notes);
  };

  if (!scale) {
    return (
      <div className="p-4 bg-[var(--surface)] rounded-lg text-center text-[var(--text-muted)]">
        Select a scale to view tablature
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[var(--text)]">
          Tablature — {selectedRoot} {scale.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{metronome.bpm} BPM</span>
          <button
            onClick={() => {
              if (isPlaying) {
                audioEngine.stopScalePlayback();
                setIsPlaying(false);
                setActiveNoteIndex(-1);
              } else if (midiNotes.length > 0) {
                audioEngine.scheduleScalePlayback(midiNotes, metronome.bpm);
                setIsPlaying(true);
              }
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              isPlaying
                ? 'bg-[var(--secondary)] text-[var(--bg)]'
                : 'bg-[var(--primary)] text-[var(--bg)]'
            }`}
            title="Play/Stop scale (Space)"
          >
            {isPlaying ? '■ Stop' : '▶ Play'}
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            {displayPattern.length} notes
          </span>
        </div>
      </div>

      {/* Tab Display - Single continuous block that fills width */}
      <div className="font-mono text-sm">
        <div className="bg-[var(--bg)] rounded-lg p-3">
          {/* String lines */}
          {tabStringNames.map((stringName, stringIdx) => (
            <div key={stringIdx} className="flex items-center h-6">
              {/* String label */}
              <span className="w-6 text-xs text-[var(--text-muted)] font-bold flex-shrink-0">
                {stringName}
              </span>
              <span className="text-[var(--text-muted)] flex-shrink-0">|</span>

              {/* Notes on this string - stretch to fill width */}
              <div className="flex flex-1">
                {displayPattern.map((note, noteIdx) => {
                  const isOnThisString = note.string === stringIdx;
                  return (
                    <div
                      key={noteIdx}
                      className={`flex-1 text-center min-w-[24px] relative ${
                        activeNoteIndex === noteIdx ? 'bg-white/10' : ''
                      }`}
                    >
                      {/* Moving playhead line */}
                      {activeNoteIndex === noteIdx && (
                        <div className="absolute inset-0 border-l-2 border-white/70 pointer-events-none" />
                      )}
                      {isOnThisString ? (
                        <button
                          onClick={() => handleNoteClick(note)}
                          className={`
                            min-w-[20px] h-5 px-1 inline-flex items-center justify-center rounded
                            transition-all hover:scale-110 cursor-pointer text-xs
                            ${note.isRoot
                              ? 'bg-[var(--secondary)] text-[var(--bg)] font-bold'
                              : 'bg-[var(--primary)]/20 text-[var(--text)] hover:bg-[var(--primary)]/40'
                            }
                          `}
                          title={`${note.note} - Fret ${note.fret}`}
                        >
                          {note.fret}
                        </button>
                      ) : (
                        <span className="text-[var(--border)]">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="text-[var(--text-muted)] flex-shrink-0">|</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-[var(--secondary)] inline-block" />
          <span>Root note</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-[var(--primary)]/20 inline-block" />
          <span>Scale note</span>
        </div>
        <span className="ml-auto">Click notes to play</span>
      </div>
    </div>
  );
}
