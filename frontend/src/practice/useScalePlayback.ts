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
 * Changing the scale, root, direction, tuning or tempo while playing
 * restarts the run from the first note, so the ring and tab always describe
 * the notes actually sounding.
 *
 * Also binds Space as a global play/stop shortcut on the Practice view when
 * nothing is focused.
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
  /**
   * What the running schedule was built from, frozen when it was scheduled.
   * The engine reports indices into *that* run, so the callback must map
   * them through the same pattern (and string count), not the latest one.
   * The midi array and bpm are kept to detect changes that need a restart.
   */
  const playingRef = useRef<{ pattern: typeof pattern; strings: number; midi: number[]; bpm: number } | null>(null);

  // Engine → store: which note is sounding
  useEffect(() => {
    audioEngine.onScaleNotePlay = (index: number) => {
      const { setPlaying, setIsPlayingScale: setFlag } = useGuitarStore.getState();
      if (index >= 0) {
        startingRef.current = false;
        const run = playingRef.current;
        const n = run?.pattern[index];
        // Tab order (0 = highest) → store order (0 = lowest)
        setPlaying(index, run && n ? { string: run.strings - 1 - n.string, fret: n.fret } : null);
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

  // Store → engine: start or stop when the shared flag changes, and restart
  // from the top when the notes or tempo change mid-run.
  useEffect(() => {
    const stop = () => {
      scheduledRef.current = false;
      startingRef.current = false;
      playingRef.current = null;
      audioEngine.stopScalePlayback(); // reports -1, which clears the ring
    };
    const schedule = () => {
      playingRef.current = {
        pattern,
        strings: useGuitarStore.getState().currentTuning.strings,
        midi,
        bpm,
      };
      // Swallow the engine's own -1 from tearing down the previous run
      startingRef.current = true;
      scheduledRef.current = true;
      audioEngine.scheduleScalePlayback(midi, bpm);
    };

    if (isPlaying && !scheduledRef.current) {
      if (midi.length === 0) {
        setIsPlayingScale(false);
        return;
      }
      schedule();
    } else if (!isPlaying && scheduledRef.current) {
      stop();
    } else if (isPlaying && scheduledRef.current) {
      const run = playingRef.current;
      if (run && run.midi === midi && run.bpm === bpm) return; // nothing changed
      if (midi.length === 0) {
        stop();
        return;
      }
      // The old ring would linger until the new run's first note
      useGuitarStore.getState().setPlaying(-1, null);
      schedule();
    }
  }, [isPlaying, midi, pattern, bpm, setIsPlayingScale]);

  const toggle = useCallback(
    () => setIsPlayingScale(!useGuitarStore.getState().isPlayingScale),
    [setIsPlayingScale],
  );

  // Space: global play/stop, only when nothing is focused, so Space on a
  // focused button, input or note keeps doing its native job. Practice view
  // only: on other views focus falls back to <body> when a focused button is
  // disabled or unmounted, and a keyboard user's next Space must not start
  // the scale from a page that doesn't show it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (e.target !== document.body && e.target !== document.documentElement) return;
      const view = useGuitarStore.getState().activeTab;
      if (view !== 'fretboard' && view !== 'reference') return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { toggle };
}
