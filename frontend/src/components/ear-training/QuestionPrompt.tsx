/**
 * QuestionPrompt.tsx
 *
 * The audio-first question block at the centre of an ear-training session:
 * the question text above a large round play button the user taps to hear
 * the sound they must identify.
 *
 * States:
 *  - Initial (hasPlayed=false): play icon, hint "Tap to hear"
 *  - Playing (isPlaying=true): animated three-bar waveform
 *  - Idle after first play: play icon, hint "Tap to replay"
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '../../ui';

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
  /**
   * Move keyboard focus to the play button on mount. The parent keys this
   * component by question, so each new question receives focus; the answer
   * card (or Start button) the user was on has just been disabled or removed.
   */
  focusOnMount?: boolean;
}

/**
 * QuestionPrompt
 *
 * Renders the question text above a large ink-ringed play button. The button
 * shows an animated waveform while audio is playing and a play icon otherwise.
 *
 * @param props - {@link QuestionPromptProps}
 * @returns The rendered question prompt element.
 */
export default function QuestionPrompt({
  questionText,
  onPlay,
  isPlaying,
  canReplay,
  focusOnMount = false,
}: QuestionPromptProps): React.ReactElement {
  const [hasPlayed, setHasPlayed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const focusAtMount = useRef(focusOnMount);

  useEffect(() => {
    if (focusAtMount.current) buttonRef.current?.focus();
  }, []);

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
    <div className="flex flex-col items-center gap-3">
      <p className="mb-2 text-center text-xl leading-snug font-bold tracking-[-0.01em] text-ink">
        {questionText}
      </p>

      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={isPlaying ? 'Playing audio…' : hintText}
        className={cn(
          'flex size-20 items-center justify-center rounded-full border-2 border-ink bg-surface text-ink',
          'transition-[background-color,opacity] duration-150 hover:bg-sunken',
          'disabled:pointer-events-none disabled:opacity-45',
        )}
      >
        {isPlaying ? (
          <AudioWaveIcon />
        ) : (
          // Nudged right so the triangle reads as optically centred
          <Play size={30} strokeWidth={2} aria-hidden="true" className="translate-x-0.5 fill-current" />
        )}
      </button>

      <span className="text-xs text-muted">{isPlaying ? 'Playing…' : hintText}</span>
    </div>
  );
}

// ── Internal sub-components ────────────────────────────────────────────────────

/** Staggered start offsets so the three bars move as a wave, not in unison. */
const BAR_DELAYS = ['[animation-delay:0ms]', '[animation-delay:150ms]', '[animation-delay:300ms]'];

/**
 * AudioWaveIcon
 *
 * Three vertical bars that pulse (the `wave-bar` keyframe in index.css) to
 * show audio is playing. Under reduced motion `motion-loop` stops the loop
 * and the bars rest at full height.
 *
 * @returns The animated waveform element.
 */
function AudioWaveIcon(): React.ReactElement {
  return (
    <span className="flex h-7 items-center gap-1" aria-hidden="true">
      {BAR_DELAYS.map((delay, i) => (
        <span
          key={i}
          className={cn(
            'motion-loop inline-block w-[5px] origin-center animate-[wave-bar_0.7s_ease-in-out_infinite] rounded-full bg-ink',
            i === 1 ? 'h-4' : 'h-6',
            delay,
          )}
        />
      ))}
    </span>
  );
}
