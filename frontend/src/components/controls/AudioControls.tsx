/**
 * AudioControls.tsx
 *
 * Compact audio controls for the right sidebar.
 *
 * Controls:
 *   - Playback direction (ascending / descending / both)
 *   - Master volume
 *   - Note volume
 *
 * Volume changes are forwarded to AudioEngine.updateSettings immediately
 * so the gain nodes respond without needing a restart.
 */

import { useEffect } from 'react';
import { useGuitarStore } from '../../store/useGuitarStore';
import { audioEngine } from '../../audio/AudioEngine';

export default function AudioControls() {
  const {
    audioSettings,
    setAudioSettings,
    playbackDirection,
    setPlaybackDirection,
  } = useGuitarStore();

  // Keep AudioEngine gain nodes in sync with the store
  useEffect(() => {
    audioEngine.updateSettings(audioSettings);
  }, [audioSettings]);

  return (
    <div className="space-y-3">
      {/* Playback direction */}
      <div className="flex gap-1">
        {(['ascending', 'descending', 'both'] as const).map(dir => (
          <button
            key={dir}
            onClick={() => setPlaybackDirection(dir)}
            className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium transition-all capitalize ${
              playbackDirection === dir
                ? 'bg-[var(--primary)] text-[var(--bg)]'
                : 'bg-[var(--button)] text-[var(--text-muted)] hover:bg-[var(--button-hover)]'
            }`}
          >
            {dir === 'ascending' ? '↑' : dir === 'descending' ? '↓' : '↑↓'}
          </button>
        ))}
      </div>

      {/* Volume sliders */}
      <div className="space-y-2">
        <VolumeSlider
          label="Master"
          value={audioSettings.masterVolume}
          onChange={v => setAudioSettings({ masterVolume: v })}
        />
        <VolumeSlider
          label="Notes"
          value={audioSettings.noteVolume}
          onChange={v => setAudioSettings({ noteVolume: v })}
        />
        <VolumeSlider
          label="Metronome"
          value={audioSettings.metronomeVolume}
          onChange={v => setAudioSettings({ metronomeVolume: v })}
        />
      </div>
    </div>
  );
}

// ── VolumeSlider ──────────────────────────────────────────────────────────────

interface VolumeSliderProps {
  label: string;
  value: number;       // 0–1
  onChange: (v: number) => void;
}

/**
 * Single labelled volume slider (0–100% display, 0–1 internal).
 */
function VolumeSlider({ label, value, onChange }: VolumeSliderProps) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={e => onChange(parseInt(e.target.value) / 100)}
        className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
      />
    </div>
  );
}
