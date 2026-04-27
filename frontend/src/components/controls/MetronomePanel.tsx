/**
 * MetronomePanel.tsx
 *
 * Compact metronome control for the right sidebar.
 *
 * Responsibilities:
 *   - Display and control BPM, time signature, and accent settings.
 *   - Bridge the Zustand metronome state to the AudioEngine look-ahead
 *     scheduler (start/stop/setBpm) via useEffect.
 *   - Show a visual beat flash on each metronome tick via onMetronomeBeat.
 *
 * The metronome audio is driven by AudioEngine.startMetronome / stopMetronome.
 * All BPM changes while the metronome is running are forwarded to
 * AudioEngine.updateMetronomeBpm so the scheduler adapts without restarting.
 */

import { useEffect, useRef, useState } from 'react';
import { useGuitarStore } from '../../store/useGuitarStore';
import { audioEngine } from '../../audio/AudioEngine';

export default function MetronomePanel() {
  const { metronome, setMetronome, toggleMetronome } = useGuitarStore();
  const [beatFlash, setBeatFlash] = useState(false);
  const flashTimerRef = useRef<number | null>(null);

  // ── Wire store → AudioEngine ──────────────────────────────────────────────
  useEffect(() => {
    if (metronome.isPlaying) {
      audioEngine.startMetronome(
        metronome.bpm,
        metronome.timeSignature,
        metronome.accentFirst
      );
    } else {
      audioEngine.stopMetronome();
    }
  }, [metronome.isPlaying, metronome.timeSignature, metronome.accentFirst]);

  // Update BPM without restarting when the slider moves
  useEffect(() => {
    if (metronome.isPlaying) {
      audioEngine.updateMetronomeBpm(metronome.bpm);
    }
  }, [metronome.bpm, metronome.isPlaying]);

  // Register visual beat callback once
  useEffect(() => {
    audioEngine.onMetronomeBeat = (_beat, _isAccent) => {
      setBeatFlash(true);
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => setBeatFlash(false), 80);
    };

    return () => {
      audioEngine.onMetronomeBeat = null;
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* BPM display + start/stop */}
      <div className="flex items-center justify-between">
        <div className="text-center">
          <div
            className={`text-2xl font-bold transition-colors ${
              beatFlash ? 'text-[var(--primary)]' : 'text-[var(--text)]'
            }`}
          >
            {metronome.bpm}
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">BPM</div>
        </div>

        <button
          onClick={toggleMetronome}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            metronome.isPlaying
              ? 'bg-[var(--secondary)] text-[var(--bg)]'
              : 'bg-[var(--primary)] text-[var(--bg)]'
          }`}
        >
          {metronome.isPlaying ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* BPM slider */}
      <input
        type="range"
        min={20}
        max={300}
        value={metronome.bpm}
        onChange={e => setMetronome({ bpm: parseInt(e.target.value) })}
        className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
      />

      {/* Tap tempo */}
      <TapTempo onTap={bpm => setMetronome({ bpm })} />

      {/* Time signature */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)]">Time:</span>
        <select
          value={`${metronome.timeSignature[0]}/${metronome.timeSignature[1]}`}
          onChange={e => {
            const [beats, note] = e.target.value.split('/').map(Number);
            setMetronome({ timeSignature: [beats, note] as [number, number] });
          }}
          className="px-2 py-1 bg-[var(--input)] border border-[var(--border)] rounded text-[var(--text)] text-xs"
        >
          <option value="4/4">4/4</option>
          <option value="3/4">3/4</option>
          <option value="6/8">6/8</option>
          <option value="5/4">5/4</option>
        </select>
      </div>
    </div>
  );
}

// ── Tap Tempo ────────────────────────────────────────────────────────────────

/**
 * TapTempo
 *
 * Calculates BPM from the average interval between recent taps.
 * Resets if the user waits more than 2 seconds between taps.
 *
 * @param onTap - Called with the calculated BPM after each tap (≥2 taps).
 */
function TapTempo({ onTap }: { onTap: (bpm: number) => void }) {
  const tapsRef = useRef<number[]>([]);

  const handleTap = () => {
    const now = performance.now();
    const taps = tapsRef.current;

    // Reset if it's been more than 2 seconds since the last tap
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      tapsRef.current = [];
    }

    tapsRef.current.push(now);

    // Need at least 2 taps to calculate interval
    if (tapsRef.current.length < 2) return;

    // Keep only the last 8 taps for a rolling average
    if (tapsRef.current.length > 8) tapsRef.current.shift();

    const intervals = tapsRef.current
      .slice(1)
      .map((t, i) => t - tapsRef.current[i]);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgInterval);

    onTap(Math.min(300, Math.max(20, bpm)));
  };

  return (
    <button
      onPointerDown={handleTap}
      className="w-full py-1.5 text-xs bg-[var(--button)] text-[var(--text-muted)]
                 hover:bg-[var(--button-hover)] rounded transition-colors select-none"
    >
      Tap Tempo
    </button>
  );
}
