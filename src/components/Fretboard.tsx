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
  CAGED_POSITIONS,
  THREE_NPS_POSITIONS,
  ALL_NOTES,
} from '../data/musicTheory';

const SINGLE_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_MARKERS = [12, 24];

function getFretWidthRatio(fret: number): number {
  const taperFactor = 0.015;
  const minRatio = 0.7;
  const ratio = Math.exp(-taperFactor * fret);
  return Math.max(ratio, minRatio);
}

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

  // Get string names from tuning
  const stringNames = useMemo(() => {
    return currentTuning.notes.map(noteIndex => ALL_NOTES[noteIndex]);
  }, [currentTuning]);

  // Generate fret numbers
  const frets = useMemo(() => Array.from({ length: numFrets + 1 }, (_, i) => i), [numFrets]);

  // Calculate fret width ratios for proportional flex-grow
  const fretWidthRatios = useMemo(() => {
    return frets.map(fret => getFretWidthRatio(fret));
  }, [frets]);

  // Strings from high to low (display order) - e B G D A E
  const strings = useMemo(
    () => Array.from({ length: currentTuning.strings }, (_, i) => currentTuning.strings - 1 - i),
    [currentTuning.strings]
  );

  // Get positions for a note at a specific fret
  const getPositionsForNote = useCallback(
    (fret: number, note: string) => {
      if (!isNoteInScale(note, scaleNotes)) return [];
      return positions.filter(pos => fret >= pos.startFret && fret <= pos.endFret);
    },
    [scaleNotes, positions]
  );

  // Handle note click
  const handleNoteClick = useCallback(
    (stringIndex: number, fret: number) => {
      audioEngine.playNoteAtPosition(stringIndex, fret, currentTuning.notes);
    },
    [currentTuning.notes]
  );

  // Render a single note
  const renderNote = useCallback(
    (stringIndex: number, fret: number) => {
      const note = getNoteAtPosition(stringIndex, fret, currentTuning.notes);
      const inScale = isNoteInScale(note, scaleNotes);
      const isRoot = note === selectedRoot;
      const notePositions = getPositionsForNote(fret, note);

      // Check if this interval should be highlighted
      const interval = getInterval(selectedRoot, note);
      const isHighlighted = highlightedIntervals.includes(interval);

      // Determine if note is in selected position
      const isInSelectedPosition =
        selectedPosition !== null && notePositions.some(p => p.id === selectedPosition);

      // Get display text based on mode
      let displayText = '';
      if (displayMode === 'notes') {
        displayText = note;
      } else if (displayMode === 'intervals' && scale) {
        displayText = getScaleDegree(note, selectedRoot, scale) || '';
      }
      // 'dots' mode shows no text

      // Non-scale note (dimmed)
      if (!inScale) {
        if (!showNonScaleNotes) return null;

        return (
          <button
            key={`${stringIndex}-${fret}`}
            onClick={() => handleNoteClick(stringIndex, fret)}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium
                       bg-[var(--surface)]/50 text-[var(--text-subtle)] opacity-30
                       hover:opacity-50 transition-opacity cursor-pointer"
            title={`${note} (not in scale)`}
          >
            {displayMode === 'notes' ? note : ''}
          </button>
        );
      }

      // Determine background color
      let bgColor = 'var(--primary)';
      if (selectedPosition !== null) {
        if (isInSelectedPosition) {
          const pos = notePositions.find(p => p.id === selectedPosition);
          bgColor = pos?.color || 'var(--primary)';
        } else {
          // Not in selected position - dim it
          return (
            <button
              key={`${stringIndex}-${fret}`}
              onClick={() => handleNoteClick(stringIndex, fret)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium
                         opacity-20 transition-opacity cursor-pointer"
              style={{ backgroundColor: notePositions[0]?.color || 'var(--primary)' }}
              title={`${note}`}
            >
              {displayText}
            </button>
          );
        }
      } else if (notePositions.length === 1) {
        bgColor = notePositions[0].color;
      } else if (notePositions.length > 1) {
        // Multi-position - use first position color
        bgColor = notePositions[0].color;
      }

      // Root note styling
      const rootClasses = isRoot
        ? 'w-7 h-7 ring-2 ring-white ring-offset-1 ring-offset-[var(--fretboard)] font-bold text-xs'
        : 'w-6 h-6 text-[10px] font-medium';

      // Highlighted interval styling
      const highlightClasses = isHighlighted && !isRoot
        ? 'ring-2 ring-[var(--secondary)] ring-offset-1 ring-offset-[var(--fretboard)]'
        : '';

      return (
        <button
          key={`${stringIndex}-${fret}`}
          onClick={() => handleNoteClick(stringIndex, fret)}
          className={`
            ${rootClasses}
            ${highlightClasses}
            rounded-full flex items-center justify-center
            text-[var(--bg)] shadow-md
            hover:scale-110 hover:shadow-lg
            active:scale-95
            transition-all duration-150 cursor-pointer
          `}
          style={{ backgroundColor: bgColor }}
          title={`${note}${isRoot ? ' (Root)' : ''}`}
        >
          {displayText}
        </button>
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
    <div className="w-full">
      {/* Position Legend */}
      <div className="mb-3 p-2 bg-[var(--surface)] rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-[var(--text)]">
            {positionSystem === 'caged' ? 'CAGED Positions' : '3NPS Patterns'}
          </h3>
          <div className="flex gap-1 flex-wrap">
            {scaleNotes.map((note, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  note === selectedRoot
                    ? 'bg-[var(--secondary)] text-[var(--bg)]'
                    : 'bg-[var(--border)] text-[var(--text-muted)]'
                }`}
              >
                {note}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {positions.map(pos => (
            <div key={pos.id} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <div
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ backgroundColor: pos.color }}
              />
              <span>{pos.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fretboard Container - Full Width */}
      <div
        className="relative rounded-lg overflow-hidden"
        style={{ backgroundColor: 'var(--fretboard)' }}
      >
        {/* Fret Numbers Row */}
        <div className="flex items-center h-6 border-b border-[var(--string-color)]/30">
          <div className="w-10 flex-shrink-0" /> {/* Space for string labels */}
          {frets.map((fret, i) => (
            <div
              key={fret}
              className="flex items-center justify-center text-[10px] text-[var(--marker-color)] font-medium"
              style={{ flex: fretWidthRatios[i], minWidth: 28 }}
            >
              {SINGLE_MARKERS.includes(fret) || DOUBLE_MARKERS.includes(fret) ? fret : ''}
            </div>
          ))}
        </div>

        {/* Strings and Frets */}
        {strings.map((stringIndex) => {
          // Calculate string thickness (high strings thinner)
          const stringThickness = 1 + (stringIndex * 0.3);

          return (
            <div key={stringIndex} className="relative flex items-center h-9">
              {/* String Name Label */}
              <div className="w-10 flex-shrink-0 text-center text-xs font-medium text-[var(--marker-color)]">
                {stringNames[stringIndex]}
              </div>

              {/* String Line */}
              <div
                className="absolute left-10 right-0 z-0"
                style={{
                  height: `${stringThickness}px`,
                  backgroundColor: 'var(--string-color)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />

              {/* Fret positions */}
              <div className="flex relative z-10 flex-1">
                {frets.map((fret, i) => (
                  <div
                    key={fret}
                    className="flex items-center justify-center relative"
                    style={{ flex: fretWidthRatios[i], minWidth: 28 }}
                  >
                    {/* Fret wire */}
                    {fret > 0 && (
                      <div
                        className={`absolute left-0 top-0 bottom-0 ${
                          fret === 1 ? 'w-1 bg-[var(--color-nut-bone)]' : 'w-[2px] bg-[var(--color-fret-gold)]'
                        }`}
                        style={{ zIndex: 0 }}
                      />
                    )}

                    {/* Fret Marker (dots) - show on middle strings */}
                    {stringIndex === Math.floor(currentTuning.strings / 2) && SINGLE_MARKERS.includes(fret) && (
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-[var(--marker-color)] opacity-30 pointer-events-none" />
                    )}
                    {(stringIndex === Math.floor(currentTuning.strings / 2) - 1 || stringIndex === Math.floor(currentTuning.strings / 2) + 1) &&
                      DOUBLE_MARKERS.includes(fret) && (
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-[var(--marker-color)] opacity-30 pointer-events-none" />
                    )}

                    {/* Note */}
                    {renderNote(stringIndex, fret)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scale Info */}
      <div className="mt-3 p-2 bg-[var(--surface)] rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-[var(--text)]">
              {selectedRoot} {scale?.name}
            </span>
            {scale?.description && (
              <span className="text-xs text-[var(--text-muted)] ml-2 hidden sm:inline">
                {scale.description}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
