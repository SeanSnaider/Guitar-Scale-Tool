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

import React, { useEffect, useId, useRef, useState, useCallback } from 'react';
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
  const inputId = useId();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <label htmlFor={inputId} style={labelStyle}>
          {label}
        </label>
        <span aria-hidden="true" className="tabular" style={{ ...labelStyle, color: 'var(--accent-primary)' }}>
          {displayValue}
          {unit}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        aria-valuetext={`${displayValue}${unit === '%' ? ' percent' : unit === 's' ? ' seconds' : unit}`}
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

  const panelRef = useRef<HTMLDivElement>(null);
  /** Element focused before the shelf opened, so focus can return there on close. */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Modal focus management: focus the panel on open, close on Escape, and
  // hand focus back to whatever opened it (the ⚙ button or the trigger bar).
  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const target = returnFocusRef.current;
      // Defer one frame so the background is no longer inert when we focus it
      requestAnimationFrame(() => {
        if (target && document.contains(target)) target.focus();
      });
    };
  }, [isOpen, setIsOpen]);

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
    // bpm is deliberately left out: tempo changes go through updateMetronomeBpm
    // below, so dragging the slider doesn't restart the metronome every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
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
            ref={panelRef}
            id="audio-shelf-panel"
            className="motion-slide"
            role="dialog"
            tabIndex={-1}
            aria-label="Audio and metronome controls"
            style={{
              background: 'var(--bg-sunken)',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 16,
              paddingBottom: 20,
              paddingLeft: 'max(clamp(16px, 4vw, 24px), env(safe-area-inset-left))',
              paddingRight: 'max(clamp(16px, 4vw, 24px), env(safe-area-inset-right))',
              animation: 'shelf-slide-up 220ms ease-out',
              display: 'flex',
              gap: 'clamp(16px, 4vw, 32px)',
              flexWrap: 'wrap',
              // Never taller than the space above the trigger bar; scrolls on
              // short landscape phones instead of pushing controls off-screen.
              maxHeight:
                'calc(100dvh - var(--nav-h) - var(--shelf-bar-h) - env(safe-area-inset-bottom))',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
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
                <div style={{ textAlign: 'center', flex: 1 }} aria-hidden="true">
                  <div
                    className="tabular"
                    style={{
                      fontSize: 32,
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      color: beatFlash ? 'var(--accent-glow)' : 'var(--accent-primary)',
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
                aria-label="Tempo"
                aria-valuetext={`${metronome.bpm} BPM`}
                min={20}
                max={300}
                value={metronome.bpm}
                onChange={(e) => setMetronome({ bpm: parseInt(e.target.value, 10) })}
                style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />

              {/* Time signature + play/stop row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select
                  aria-label="Time signature"
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
          aria-controls="audio-shelf-panel"
          aria-label="Toggle audio controls shelf"
          style={{
            // Bar height plus the home-indicator inset, so the label stays above it
            height: 'calc(var(--shelf-bar-h) + env(safe-area-inset-bottom))',
            paddingBottom: 'env(safe-area-inset-bottom)',
            background: 'var(--bg-elevated)',
            border: 'none',
            borderTop: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            paddingLeft: 16,
            paddingRight: 16,
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
