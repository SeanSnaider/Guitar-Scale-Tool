import { useEffect, useState } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';

/**
 * Keeps the audio engine's metronome and gain settings in step with the
 * store, and reports the current beat for the transport's beat indicator.
 * Mount once (the transport bar does).
 *
 * @returns The 0-based beat that just sounded, or -1 when stopped.
 */
export function useMetronomeBridge(): number {
  const metronome = useGuitarStore((s) => s.metronome);
  const audioSettings = useGuitarStore((s) => s.audioSettings);
  const [beat, setBeat] = useState(-1);

  // Start/stop and meter changes restart the metronome. Tempo changes go
  // through updateMetronomeBpm below, so dragging the tempo doesn't restart
  // it on every value.
  useEffect(() => {
    if (metronome.isPlaying) {
      audioEngine.startMetronome(metronome.bpm, metronome.timeSignature, metronome.accentFirst);
    } else {
      audioEngine.stopMetronome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metronome.isPlaying, metronome.timeSignature, metronome.accentFirst]);

  useEffect(() => {
    if (metronome.isPlaying) audioEngine.updateMetronomeBpm(metronome.bpm);
  }, [metronome.bpm, metronome.isPlaying]);

  useEffect(() => {
    audioEngine.onMetronomeBeat = (b: number) => setBeat(b);
    return () => {
      audioEngine.onMetronomeBeat = null;
    };
  }, []);

  useEffect(() => {
    audioEngine.updateSettings(audioSettings);
  }, [audioSettings]);

  return metronome.isPlaying ? beat : -1;
}
