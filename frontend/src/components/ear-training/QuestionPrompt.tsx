/**
 * QuestionPrompt.tsx
 *
 * The audio-first question card rendered at the centre of an ear-training
 * session. It shows the question text and a large circular play button that
 * the user taps to hear the sound they must identify.
 *
 * States:
 *  - Initial (hasPlayed=false): button shows a play triangle, hint says "Tap to hear"
 *  - Playing (isPlaying=true): button shows an animated waveform with 3 bars
 *  - Idle after first play: button shows play triangle, hint says "Tap to replay"
 *  - Hover: amber border brightens + subtle box-shadow glow
 *
 * All colours use Studio Walnut CSS custom-property tokens.
 */

import React, { useState } from 'react';

/** Props for the QuestionPrompt component. */
export interface QuestionPromptProps {
  /** The question instruction text, e.g. "What interval is this?" */
  questionText: string;
  /** Callback invoked when the user taps the play/replay button. */
  onPlay: () => void;
  /** When true the button animates as an audio waveform to signal active playback. */
  isPlaying: boolean;
  /**
   * Whether the replay button should be enabled.
   * Disabled during the brief moment after answering while the next question loads.
   */
  canReplay: boolean;
}

/**
 * QuestionPrompt
 *
 * Renders the question text above a large circular play button styled in the
 * Studio Walnut amber palette.  The button shows an animated waveform while
 * audio is playing and a triangle play icon otherwise.
 *
 * @param props - {@link QuestionPromptProps}
 * @returns The rendered question prompt element.
 */
export default function QuestionPrompt({
  questionText,
  onPlay,
  isPlaying,
  canReplay,
}: QuestionPromptProps): React.ReactElement {
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  /**
   * Handles a click on the play button.
   * Marks the question as played and delegates to the parent `onPlay` callback.
   */
  const handleClick = () => {
    if (!canReplay && hasPlayed) return;
    setHasPlayed(true);
    onPlay();
  };

  const isDisabled = !canReplay && hasPlayed && !isPlaying;

  const hintText = !hasPlayed ? 'Tap to hear' : 'Tap to replay';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Question text */}
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          color: 'var(--accent-glow)',
          textAlign: 'center',
          margin: '0 0 12px 0',
          lineHeight: 1.35,
        }}
      >
        {questionText}
      </p>

      {/* Circular play button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={isPlaying ? 'Playing audio…' : hintText}
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          border: `3px solid var(--accent-primary)`,
          background: 'transparent',
          cursor: isDisabled ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
          boxShadow: isHovered && !isDisabled
            ? '0 0 12px var(--accent-line)'
            : 'none',
          borderColor: isHovered && !isDisabled
            ? 'var(--accent-glow)'
            : 'var(--accent-primary)',
          opacity: isDisabled ? 0.45 : 1,
        }}
      >
        {isPlaying ? (
          /* Animated waveform: 3 bars of different heights */
          <AudioWaveIcon />
        ) : (
          /* Play triangle */
          <PlayIcon />
        )}
      </button>

      {/* Hint text */}
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          letterSpacing: '0.03em',
        }}
      >
        {isPlaying ? 'Playing…' : hintText}
      </span>

      {/* Waveform animation keyframes */}
      <style>{`
        @keyframes ear-bar1 {
          0%, 100% { height: 8px;  }
          50%       { height: 20px; }
        }
        @keyframes ear-bar2 {
          0%, 100% { height: 16px; }
          50%       { height: 6px;  }
        }
        @keyframes ear-bar3 {
          0%, 100% { height: 10px; }
          50%       { height: 22px; }
        }
      `}</style>
    </div>
  );
}

// ── Internal sub-components ────────────────────────────────────────────────────

/**
 * PlayIcon
 *
 * A simple right-pointing triangle SVG rendered in amber accent colour.
 *
 * @returns The play triangle SVG element.
 */
function PlayIcon(): React.ReactElement {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <polygon
        points="6,4 20,12 6,20"
        fill="var(--accent-primary)"
      />
    </svg>
  );
}

/**
 * AudioWaveIcon
 *
 * Three vertical bars that animate independently to suggest audio playback.
 * Each bar uses a separate CSS keyframe animation for a staggered wave look.
 *
 * @returns The animated waveform element.
 */
function AudioWaveIcon(): React.ReactElement {
  const barBase: React.CSSProperties = {
    width: 5,
    borderRadius: 3,
    background: 'var(--accent-primary)',
    display: 'inline-block',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 28,
      }}
      aria-hidden="true"
    >
      <span
        className="motion-loop"
        style={{
          ...barBase,
          height: 8,
          animation: 'ear-bar1 0.7s ease-in-out infinite',
        }}
      />
      <span
        className="motion-loop"
        style={{
          ...barBase,
          height: 16,
          animation: 'ear-bar2 0.7s ease-in-out infinite 0.15s',
        }}
      />
      <span
        className="motion-loop"
        style={{
          ...barBase,
          height: 10,
          animation: 'ear-bar3 0.7s ease-in-out infinite 0.3s',
        }}
      />
    </div>
  );
}
