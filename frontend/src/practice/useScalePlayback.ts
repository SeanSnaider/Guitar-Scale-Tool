import { useCallback, useEffect, useRef } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';
import { useScalePattern } from './useScalePattern';

/**
 * Owns scale playback for the whole app. Mount it once (the transport bar
 * does). Any component can start or stop playback by toggling the store's
 * `isPlayingScale`; this hook schedules the audio and publishes the sounding
 * note as `playingIndex` / `playingPosition` for the tab and fretboard.
 *
 * Also binds Space as a global play/stop shortcut when nothing is focused.
 */
export function useScalePlayback(): { toggle: () => void } {
  const isPlaying = useGuitarStore((s) => s.isPlayingScale);
  const setIsPlayingScale = useGuitarStore((s) => s.setIsPlayingScale);
  const bpm = useGuitarStore((s) => s.metronome.bpm);
  const { pattern, midi } = useScalePattern();

  /** True while the engine has a schedule running for us. */
  const scheduledRef = useRef(false);
  /**
   * True between asking the engine to start and its first note. The engine's
   * start path calls stopScalePlayback (which reports -1) and may first await
   * AudioContext initialisation; that -1 must not be read as "finished".
   */
  const startingRef = useRef(false);
  /** Latest pattern, read inside the engine callback without re-binding it. */
  const patternRef = useRef(pattern);
  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  // Engine → store: which note is sounding
  useEffect(() => {
    const strings = () => useGuitarStore.getState().currentTuning.strings;
    audioEngine.onScaleNotePlay = (index: number) => {
      const { setPlaying, setIsPlayingScale: setFlag } = useGuitarStore.getState();
      if (index >= 0) {
        startingRef.current = false;
        const n = patternRef.current[index];
        // Tab order (0 = highest) → store order (0 = lowest)
        setPlaying(index, n ? { string: strings() - 1 - n.string, fret: n.fret } : null);
        return;
      }
      if (startingRef.current) return; // the engine's own reset while starting
      scheduledRef.current = false;
      setPlaying(-1, null);
      setFlag(false);
    };
    return () => {
      audioEngine.onScaleNotePlay = null;
      if (scheduledRef.current) audioEngine.stopScalePlayback();
      scheduledRef.current = false;
      useGuitarStore.getState().setPlaying(-1, null);
      useGuitarStore.getState().setIsPlayingScale(false);
    };
  }, []);

  // Store → engine: start or stop when the shared flag changes
  useEffect(() => {
    if (isPlaying && !scheduledRef.current) {
      if (midi.length === 0) {
        setIsPlayingScale(false);
        return;
      }
      startingRef.current = true;
      scheduledRef.current = true;
      audioEngine.scheduleScalePlayback(midi, bpm);
    } else if (!isPlaying && scheduledRef.current) {
      scheduledRef.current = false;
      startingRef.current = false;
      audioEngine.stopScalePlayback(); // reports -1, which clears the ring
    }
  }, [isPlaying, midi, bpm, setIsPlayingScale]);

  const toggle = useCallback(
    () => setIsPlayingScale(!useGuitarStore.getState().isPlayingScale),
    [setIsPlayingScale],
  );

  // Space: global play/stop, only when nothing is focused, so Space on a
  // focused button, input or note keeps doing its native job.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (e.target !== document.body && e.target !== document.documentElement) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { toggle };
}
