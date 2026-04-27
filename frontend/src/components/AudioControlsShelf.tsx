/**
 * AudioControlsShelf.tsx
 *
 * A NeuralDSP-inspired slide-up shelf panel fixed to the bottom of the screen.
 *
 * Anatomy:
 *   - Trigger bar (always visible, 48 px high): handle glyph + "Controls" label + chevron.
 *     Clicking it toggles the shelf open / closed.
 *   - Content panel (visible when open, 200 px): slides up via `shelf-slide-up` animation.
 *     Clicking anywhere outside the shelf (on the backdrop) closes it.
 *
 * Content layout (two columns side by side):
 *   Left column  — Metronome: BPM display + ±buttons + slider + time-signature select +
 *                  play/stop button + accent-first toggle.
 *   Right column — Audio:     master volume, note volume, sustain-length sliders.
 *
 * All state is read from / written to `useGuitarStore`.  Metronome audio is
 * bridged to `audioEngine` exactly as in the existing MetronomePanel.tsx.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';

// ── Shared label style ────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontFamily: 'var(--font-body)',
  userSelect: 'none',
};

// ── SliderRow ─────────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  value: number;       // 0–1
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  displayMultiplier?: number;
  unit?: string;
}

/**
 * SliderRow
 *
 * A single labelled range slider used in the audio column.
 * Displays the value scaled by `displayMultiplier` (default 100 for percentages).
 *
 * @param props - {@link SliderRowProps}
 * @returns The rendered slider row.
 */
function SliderRow({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  displayMultiplier = 100,
  unit = '%',
}: SliderRowProps): React.ReactElement {
  const displayValue = Math.round(value * displayMultiplier);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={labelStyle}>{label}</span>
        <span style={{ ...labelStyle, color: 'var(--accent-primary)' }}>
          {displayValue}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={displayValue}
        onChange={(e) => onChange(parseInt(e.target.value, 10) / displayMultiplier)}
        style={{
          width: '100%',
          accentColor: 'var(--accent-primary)',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

// ── AudioControlsShelf ────────────────────────────────────────────────────────

/**
 * AudioControlsShelf
 *
 * Slide-up shelf panel containing metronome and audio controls.
 * The trigger bar is always rendered; the content panel animates in/out.
 * Clicking the backdrop (area behind the panel) closes the shelf.
 *
 * @returns The rendered shelf element.
 */
export default function AudioControlsShelf(): React.ReactElement {
  const isOpen = useGuitarStore((s) => s.isAudioShelfOpen);
  const setIsOpen = useGuitarStore((s) => s.setIsAudioShelfOpen);
  const { metronome, setMetronome, toggleMetronome, audioSettings, setAudioSettings } =
    useGuitarStore();

  // Beat-flash visual indicator
  const [beatFlash, setBeatFlash] = useState(false);
  const flashTimerRef = useRef<number | null>(null);

  // ── Metronome ↔ AudioEngine bridge ─────────────────────────────────────────

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

  useEffect(() => {
    if (metronome.isPlaying) {
      audioEngine.updateMetronomeBpm(metronome.bpm);
    }
  }, [metronome.bpm, metronome.isPlaying]);

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

  // Keep AudioEngine gain nodes in sync
  useEffect(() => {
    audioEngine.updateSettings(audioSettings);
  }, [audioSettings]);

  // ── BPM helpers ────────────────────────────────────────────────────────────

  const incrementBpm = useCallback(
    () => setMetronome({ bpm: Math.min(300, metronome.bpm + 1) }),
    [metronome.bpm, setMetronome]
  );

  const decrementBpm = useCallback(
    () => setMetronome({ bpm: Math.max(20, metronome.bpm - 1) }),
    [metronome.bpm, setMetronome]
  );

  // ── Shared button style ────────────────────────────────────────────────────

  const smallBtn = (active = false): React.CSSProperties => ({
    padding: '4px 10px',
    borderRadius: 5,
    fontSize: 13,
    fontFamily: 'var(--font-body)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    background: active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
    color: active ? '#1C1714' : 'var(--text-secondary)',
    transition: 'background 150ms ease, color 150ms ease',
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Backdrop (only when open) ─────────────────────────────────── */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99,
            background: 'rgba(0,0,0,0.35)',
            animation: 'fade-in 150ms ease',
          }}
        />
      )}

      {/* ── Shelf wrapper (trigger bar + optional content) ─────────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Content panel ────────────────────────────────────────────── */}
        {isOpen && (
          <div
            role="dialog"
            aria-label="Audio and metronome controls"
            style={{
              background: '#1A1512',
              borderTop: '1px solid var(--border-subtle)',
              padding: '16px 24px 20px',
              animation: 'shelf-slide-up 220ms ease-out',
              display: 'flex',
              gap: 32,
              flexWrap: 'wrap',
            }}
          >
            {/* ── Left column: Metronome ──────────────────────────────── */}
            <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span
                style={{
                  ...labelStyle,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: 4,
                  marginBottom: 2,
                }}
              >
                Metronome
              </span>

              {/* BPM large display + ± buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* − button */}
                <button
                  type="button"
                  onClick={decrementBpm}
                  aria-label="Decrease BPM"
                  style={{
                    ...smallBtn(),
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  −
                </button>

                {/* BPM value */}
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div
                    style={{
                      fontSize: 32,
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      color: beatFlash ? '#FAEEDA' : 'var(--accent-primary)',
                      transition: 'color 80ms ease',
                      lineHeight: 1,
                    }}
                  >
                    {metronome.bpm}
                  </div>
                  <div style={labelStyle}>BPM</div>
                </div>

                {/* + button */}
                <button
                  type="button"
                  onClick={incrementBpm}
                  aria-label="Increase BPM"
                  style={{
                    ...smallBtn(),
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  +
                </button>
              </div>

              {/* BPM range slider */}
              <input
                type="range"
                min={20}
                max={300}
                value={metronome.bpm}
                onChange={(e) => setMetronome({ bpm: parseInt(e.target.value, 10) })}
                style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />

              {/* Time signature + play/stop row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select
                  value={`${metronome.timeSignature[0]}/${metronome.timeSignature[1]}`}
                  onChange={(e) => {
                    const [beats, note] = e.target.value.split('/').map(Number);
                    setMetronome({ timeSignature: [beats, note] as [number, number] });
                  }}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-input)',
                    color: 'var(--accent-glow)',
                    padding: '4px 8px',
                    borderRadius: 5,
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                    flex: 1,
                  }}
                >
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="6/8">6/8</option>
                  <option value="5/4">5/4</option>
                </select>

                {/* Play / Stop button */}
                <button
                  type="button"
                  onClick={toggleMetronome}
                  style={{
                    ...smallBtn(metronome.isPlaying),
                    flex: 1,
                    textAlign: 'center',
                  }}
                >
                  {metronome.isPlaying ? 'Stop' : 'Start'}
                </button>
              </div>

              {/* Accent first beat toggle */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={metronome.accentFirst}
                  onChange={(e) => setMetronome({ accentFirst: e.target.checked })}
                  style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
                Accent first beat
              </label>
            </div>

            {/* ── Right column: Audio ─────────────────────────────────────── */}
            <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span
                style={{
                  ...labelStyle,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: 4,
                  marginBottom: 2,
                }}
              >
                Audio
              </span>

              <SliderRow
                label="Master Volume"
                value={audioSettings.masterVolume}
                onChange={(v) => setAudioSettings({ masterVolume: v })}
              />
              <SliderRow
                label="Note Volume"
                value={audioSettings.noteVolume}
                onChange={(v) => setAudioSettings({ noteVolume: v })}
              />
              <SliderRow
                label="Sustain"
                value={audioSettings.sustainLength / 5}
                onChange={(v) => setAudioSettings({ sustainLength: v * 5 })}
                displayMultiplier={5}
                unit="s"
              />
            </div>
          </div>
        )}

        {/* ── Trigger bar ───────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Toggle audio controls shelf"
          style={{
            height: 48,
            background: 'var(--bg-elevated)',
            borderTop: '1px solid var(--border-subtle)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            padding: '0 16px',
          }}
        >
          {/* Handle pill */}
          <div
            style={{
              width: 32,
              height: 4,
              borderRadius: 2,
              background: 'var(--text-muted)',
              opacity: 0.5,
            }}
            aria-hidden="true"
          />

          <span
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              userSelect: 'none',
            }}
          >
            Controls
          </span>

          {/* Chevron — rotates when open */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="var(--text-muted)"
            aria-hidden="true"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
            }}
          >
            <path d="M6 8L1 3h10z" />
          </svg>
        </button>
      </div>
    </>
  );
}
