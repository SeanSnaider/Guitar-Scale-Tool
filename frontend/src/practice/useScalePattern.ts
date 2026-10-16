import { useMemo } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { SCALES } from '../data/musicTheory';
import { buildAscendingPattern, orderPattern, patternToMidi } from './scalePattern';
import type { TabNote } from './scalePattern';

/**
 * The current tab pattern (in playing order) and its MIDI notes, derived
 * from the store. Used by both the Tablature (display) and the transport
 * (playback), so they always agree.
 */
export function useScalePattern(): { pattern: TabNote[]; midi: number[] } {
  const selectedRoot = useGuitarStore((s) => s.selectedRoot);
  const selectedScale = useGuitarStore((s) => s.selectedScale);
  const tuning = useGuitarStore((s) => s.currentTuning.notes);
  const direction = useGuitarStore((s) => s.playbackDirection);
  const numFrets = useGuitarStore((s) => s.numFrets);

  return useMemo(() => {
    const scale = SCALES[selectedScale];
    if (!scale) return { pattern: [], midi: [] };
    const pattern = orderPattern(buildAscendingPattern(selectedRoot, scale.intervals, tuning, numFrets), direction);
    return { pattern, midi: patternToMidi(pattern, tuning) };
  }, [selectedRoot, selectedScale, tuning, direction, numFrets]);
}
