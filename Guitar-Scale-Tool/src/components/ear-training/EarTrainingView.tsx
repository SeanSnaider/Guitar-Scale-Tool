/**
 * EarTrainingView.tsx
 *
 * The full ear-training session screen for the Guitar Scale Tool.
 *
 * Provides four modes selectable via a SegmentedToggle:
 *
 *   1. Intervals — user hears two notes and identifies the interval name.
 *   2. Notes     — user hears a single note and identifies its name.
 *   3. Scales    — user hears the first five notes of a scale and identifies
 *                  the scale type.
 *   4. Sequence  — preserved from PracticeMode; user plays scale notes on the
 *                  fretboard in order; mastery tracking via the backend API.
 *
 * Session flow:
 *   Start screen → 10-question quiz → End screen (score + "Try Again")
 *
 * Backend integration:
 *   - startSession / endSession called at quiz boundaries.
 *   - recordScaleAttempt called after each scales-mode question.
 *   - All backend errors are silently swallowed; they never block the UI.
 *
 * Store integration:
 *   - earTrainingMode / setEarTrainingMode — persisted mode selection.
 *   - earTrainingScore / earTrainingTotal / earTrainingAnswers — live session
 *     state updated on each answer.
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useGuitarStore } from '../../store/useGuitarStore';
import { audioEngine } from '../../audio/AudioEngine';
import { ALL_NOTES, SCALES, getAscendingOctaves, getScaleNotes } from '../../data/musicTheory';
import {
  startSession,
  endSession,
  recordScaleAttempt,
  type PracticeSession,
} from '../../services/api';
import SegmentedToggle from '../ui/SegmentedToggle';
import Fretboard from '../Fretboard';
import ProgressBar, { type AnswerStatus } from './ProgressBar';
import QuestionPrompt from './QuestionPrompt';
import AnswerGrid, { type AnswerOption } from './AnswerGrid';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Total questions per ear-training session. */
const TOTAL_QUESTIONS = 10;

/** Milliseconds the feedback colours are shown before advancing. */
const FEEDBACK_DELAY_MS = 800;

/**
 * Maps semitone distances (1–11) to their interval names.
 * Used by the Intervals mode for both question generation and display.
 */
const INTERVAL_NAMES: Record<number, string> = {
  1: 'Minor 2nd',
  2: 'Major 2nd',
  3: 'Minor 3rd',
  4: 'Major 3rd',
  5: 'Perfect 4th',
  6: 'Tritone',
  7: 'Perfect 5th',
  8: 'Minor 6th',
  9: 'Major 6th',
  10: 'Minor 7th',
  11: 'Major 7th',
};

/** All interval name strings, derived once so we can pick random wrong answers. */
const ALL_INTERVAL_NAMES = Object.values(INTERVAL_NAMES);

/**
 * Subset of scale keys used for the Scales mode.
 * Limited to common, easily distinguishable scales to keep questions fair.
 */
const SCALE_MODE_KEYS = [
  'major',
  'minor',
  'major_pentatonic',
  'minor_pentatonic',
  'blues',
  'dorian',
  'phrygian',
  'lydian',
] as const;

// ── Types ──────────────────────────────────────────────────────────────────────

/** The four ear-training modes available via the mode selector. */
type EarMode = 'intervals' | 'notes' | 'scales' | 'sequence';

/** Session lifecycle state machine. */
type SessionPhase = 'start' | 'active' | 'end';

/** A fully-formed question ready to be rendered. */
interface Question {
  /** Unique monotonic ID used as React key when switching questions. */
  id: number;
  /** Called to play (or replay) the audio for this question. */
  audioToPlay: () => void;
  /** Instruction text shown in the QuestionPrompt heading. */
  questionText: string;
  /** Four answer options offered to the user. */
  options: AnswerOption[];
  /** The `value` field of the correct AnswerOption. */
  correctAnswer: string;
  /** How long the question audio lasts, in ms (drives the playing animation). */
  audioDurationMs?: number;
  /**
   * For Scales-mode questions: the scale actually played, so the attempt is
   * credited to it rather than to whatever scale the fretboard has selected.
   */
  scaleTarget?: ScaleTarget;
}

/** Identifies the scale an attempt is recorded against. */
interface ScaleTarget {
  /** Learned-scale store/backend key, `${root}-${scaleKey}`. */
  key: string;
  /** Human-readable name for the "now LEARNED" message. */
  label: string;
}

/** Default duration of the "playing" animation when a question does not set one. */
const DEFAULT_AUDIO_DURATION_MS = 1200;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns a random integer in [0, max).
 *
 * @param max - Exclusive upper bound.
 * @returns A random integer.
 */
function randInt(max: number): number {
  return Math.floor(Math.random() * max);
}

/**
 * Picks `count` unique elements from `arr` excluding `exclude`.
 *
 * @param arr     - Source array.
 * @param exclude - Value to exclude from the selection.
 * @param count   - Number of items to return.
 * @returns Array of `count` unique items that are not equal to `exclude`.
 */
function pickDistinct<T>(arr: readonly T[], exclude: T, count: number): T[] {
  const pool = arr.filter((x) => x !== exclude);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Shuffles an array in-place using Fisher-Yates and returns it.
 *
 * @param arr - The array to shuffle.
 * @returns The same array, now shuffled.
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Question generators ────────────────────────────────────────────────────────

/** Monotonic counter used to give each question a unique id. */
let questionCounter = 0;

/**
 * Generates a random Intervals-mode question.
 *
 * Picks a root note and a random semitone distance (1–11), plays the two
 * notes 400 ms apart, and offers four interval names as answers.
 *
 * @returns A complete Question object.
 */
function generateIntervalQuestion(): Question {
  const rootIdx = randInt(ALL_NOTES.length);
  const rootNote = ALL_NOTES[rootIdx];
  const semitones = randInt(11) + 1; // 1–11
  const secondIdx = (rootIdx + semitones) % ALL_NOTES.length;
  const secondNote = ALL_NOTES[secondIdx];

  // Octave: keep root at 4, let the second note go to 5 if it wrapped around
  const secondOctave = secondIdx < rootIdx ? 5 : 4;

  const correctAnswer = INTERVAL_NAMES[semitones];
  const wrongs = pickDistinct(ALL_INTERVAL_NAMES, correctAnswer, 3);
  const options: AnswerOption[] = shuffle([
    correctAnswer,
    ...wrongs,
  ]).map((name) => ({ value: name, label: name }));

  return {
    id: ++questionCounter,
    questionText: 'What interval is this?',
    audioToPlay: () => {
      audioEngine.playNote(rootNote, 4);
      setTimeout(() => audioEngine.playNote(secondNote, secondOctave), 400);
    },
    options,
    correctAnswer,
  };
}

/**
 * Generates a random Notes-mode question.
 *
 * Picks a random note from the chromatic scale, plays it at octave 4, and
 * offers four note names as answers.
 *
 * @returns A complete Question object.
 */
function generateNoteQuestion(): Question {
  const idx = randInt(ALL_NOTES.length);
  const note = ALL_NOTES[idx];

  const wrongs = pickDistinct(ALL_NOTES, note, 3);
  const options: AnswerOption[] = shuffle([note, ...wrongs]).map((n) => ({
    value: n,
    label: n,
  }));

  return {
    id: ++questionCounter,
    questionText: 'What note is this?',
    audioToPlay: () => audioEngine.playNote(note, 4),
    options,
    correctAnswer: note,
  };
}

/**
 * Generates a random Scales-mode question.
 *
 * Picks a random root and scale type from the curated list, plays the whole
 * scale ascending to the octave (250 ms apart), and offers four scale names
 * as answers. The full scale is needed: the first five notes of Natural
 * Minor and Dorian are identical, so a five-note preview made some
 * questions unanswerable.
 *
 * @returns A complete Question object.
 */
function generateScaleQuestion(): Question {
  const rootIdx = randInt(ALL_NOTES.length);
  const rootNote = ALL_NOTES[rootIdx];
  const scaleKeyIdx = randInt(SCALE_MODE_KEYS.length);
  const scaleKey = SCALE_MODE_KEYS[scaleKeyIdx];
  const scale = SCALES[scaleKey];
  const scaleNotes = getScaleNotes(rootNote, scale.intervals);

  // Play the full scale plus the octave, ascending from octave 4.
  const notesToPlay = getAscendingOctaves([...scaleNotes, rootNote], 4);

  const correctAnswer = scaleKey;
  const correctLabel = scale.name;

  const wrongKeys = pickDistinct(SCALE_MODE_KEYS, scaleKey, 3);
  const options: AnswerOption[] = shuffle([
    { value: scaleKey, label: correctLabel },
    ...wrongKeys.map((k) => ({ value: k, label: SCALES[k].name })),
  ]);

  return {
    id: ++questionCounter,
    questionText: 'What scale is this?',
    audioToPlay: () => {
      notesToPlay.forEach(({ note, octave }, i) => {
        setTimeout(() => audioEngine.playNote(note, octave), i * 250);
      });
    },
    audioDurationMs: notesToPlay.length * 250 + 300,
    correctAnswer,
    options,
    scaleTarget: { key: `${rootNote}-${scaleKey}`, label: `${rootNote} ${scale.name}` },
  };
}

/**
 * Dispatches to the correct generator based on the current ear-training mode.
 *
 * @param mode - Current EarMode (intervals | notes | scales).
 * @returns A freshly generated Question.
 */
function generateQuestion(mode: EarMode): Question {
  switch (mode) {
    case 'intervals':
      return generateIntervalQuestion();
    case 'notes':
      return generateNoteQuestion();
    case 'scales':
    default:
      return generateScaleQuestion();
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * EarTrainingView
 *
 * The top-level component for the Ear Training tab.  Manages the full
 * session lifecycle (start → active → end) and delegates rendering to
 * ProgressBar, QuestionPrompt, AnswerGrid, and the Sequence sub-section.
 *
 * @returns The rendered ear-training view.
 */
export default function EarTrainingView(): React.ReactElement {
  // ── Store ──────────────────────────────────────────────────────────────────

  const {
    earTrainingMode,
    setEarTrainingMode,
    earTrainingScore,
    earTrainingTotal,
    earTrainingAnswers,
    setEarTrainingScore,
    setEarTrainingTotal,
    setEarTrainingAnswers,
    selectedRoot,
    selectedScale,
    metronome,
    addXP,
    addPracticeMinutes,
    setLastClickedNote,
    markScaleLearned,
  } = useGuitarStore();

  // Map store's 3-mode type to our 4-mode type (sequence is local only)
  const [activeMode, setActiveMode] = useState<EarMode>(() => {
    // Sequence is stored locally; if store has 'intervals'|'notes'|'scales' use it
    return earTrainingMode as EarMode;
  });

  // ── Session state ──────────────────────────────────────────────────────────

  const [phase, setPhase] = useState<SessionPhase>('start');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Backend session
  const backendSessionRef = useRef<PracticeSession | null>(null);

  // Pending UI timers (auto-play, feedback delay, messages). Tracked so they
  // can be cancelled on mode change / restart / unmount; otherwise a timer
  // from the previous session could finish or advance the new one.
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  /**
   * setTimeout that is automatically cancelled by clearTimers().
   *
   * @param callback - Work to run.
   * @param delayMs  - Delay in milliseconds.
   */
  const schedule = useCallback((callback: () => void, delayMs: number) => {
    const handle = setTimeout(() => {
      timersRef.current.delete(handle);
      callback();
    }, delayMs);
    timersRef.current.add(handle);
  }, []);

  /** Cancels every pending timer created with schedule(). */
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((handle) => clearTimeout(handle));
    timersRef.current.clear();
  }, []);

  /**
   * Ends the in-flight backend session without accuracy (used when a session
   * is abandoned), so it is not left open forever.
   */
  const abandonBackendSession = useCallback(() => {
    const session = backendSessionRef.current;
    backendSessionRef.current = null;
    if (session) endSession(session.id).catch(() => {});
  }, []);

  // Cancel timers and close any open backend session on unmount.
  useEffect(() => () => {
    clearTimers();
    abandonBackendSession();
  }, [clearTimers, abandonBackendSession]);
  const sessionStartTimeRef = useRef<number | null>(null);

  // ── Sequence mode state (preserved from PracticeMode) ─────────────────────

  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [seqScore, setSeqScore] = useState(0);
  const [seqTotal, setSeqTotal] = useState(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [justLearnedMessage, setJustLearnedMessage] = useState<string | null>(null);
  const sequenceRunsRef = useRef(0);

  const scale = SCALES[selectedScale];
  const scaleNotes = useMemo(
    () => (scale ? getScaleNotes(selectedRoot, scale.intervals) : []),
    [selectedRoot, scale],
  );

  const scaleKey = `${selectedRoot}-${selectedScale}`;

  // ── Mode selector options ──────────────────────────────────────────────────

  const modeOptions = [
    { value: 'intervals', label: 'Intervals' },
    { value: 'notes', label: 'Notes' },
    { value: 'scales', label: 'Scales' },
    { value: 'sequence', label: 'Sequence' },
  ];

  // ── Answer array helpers ───────────────────────────────────────────────────

  /**
   * Builds a fresh 10-slot answers array with the given index as 'pending'
   * and all previous slots filled from the historical answers array.
   *
   * @param idx           - Zero-based index of the active question.
   * @param prevAnswers   - Results recorded so far.
   * @returns A new AnswerStatus array of length TOTAL_QUESTIONS.
   */
  const buildAnswersArray = useCallback(
    (
      idx: number,
      prevAnswers: Array<'correct' | 'incorrect'>,
    ): AnswerStatus[] => {
      return Array.from({ length: TOTAL_QUESTIONS }, (_, i) => {
        if (i < prevAnswers.length) return prevAnswers[i];
        if (i === idx) return 'pending';
        return 'pending'; // future slots also shown as pending but will stay dark
      });
    },
    [],
  );

  // ── Backend: record scale attempt ──────────────────────────────────────────

  /**
   * Records a scale attempt to the backend (scales mode + sequence mode).
   * Silently ignores network errors.
   *
   * @param correct - Whether the user answered correctly.
   * @param bpm     - Current metronome BPM (used for mastery threshold).
   * @param target  - Scale to credit; defaults to the fretboard's selected
   *                  scale (Sequence mode). Scales mode passes the scale that
   *                  was actually played in the question.
   */
  const reportScaleAttempt = useCallback(
    async (correct: boolean, bpm: number, target?: ScaleTarget) => {
      const { key, label } = target ?? { key: scaleKey, label: `${selectedRoot} ${selectedScale}` };
      try {
        const res = await recordScaleAttempt(
          key,
          bpm,
          correct,
          backendSessionRef.current?.id,
        );
        setConsecutiveCorrect(res.mastery.consecutive_correct);
        if (res.just_learned) {
          // markScaleLearned is idempotent; toggling would un-learn a scale
          // that was already in the local set.
          markScaleLearned(key);
          setJustLearnedMessage(`${label} is now LEARNED!`);
          addXP(50);
          schedule(() => setJustLearnedMessage(null), 4000);
        }
      } catch {
        // Backend unreachable — silently continue
      }
    },
    [scaleKey, selectedRoot, selectedScale, markScaleLearned, addXP, schedule],
  );

  // ── Sequence mode: wire fretboard note clicks ──────────────────────────────

  // Subscribes to fretboard clicks rather than reacting to lastClickedNote
  // in render: only clicks made *during* the session count (a note clicked
  // earlier no longer gets scored the moment Start is pressed), and state is
  // updated from the subscription callback instead of the effect body.
  useEffect(() => {
    if (phase !== 'active' || activeMode !== 'sequence' || scaleNotes.length === 0) return;

    return useGuitarStore.subscribe((state, prevState) => {
      const clicked = state.lastClickedNote;
      if (!clicked || clicked === prevState.lastClickedNote) return;

      const posInScale = sequenceIndex % scaleNotes.length;
      if (clicked === scaleNotes[posInScale]) {
        setSequenceIndex(sequenceIndex + 1);
        setSeqScore((s) => s + 1);
        setSeqTotal((t) => t + 1);

        if (posInScale === scaleNotes.length - 1) {
          sequenceRunsRef.current += 1;
          void reportScaleAttempt(true, metronome.bpm);
        }
      } else {
        setSeqTotal((t) => t + 1);
        void reportScaleAttempt(false, metronome.bpm);
      }

      setLastClickedNote(null);
    });
  }, [
    phase,
    activeMode,
    scaleNotes,
    sequenceIndex,
    setLastClickedNote,
    reportScaleAttempt,
    metronome.bpm,
  ]);

  // ── Question lifecycle ─────────────────────────────────────────────────────

  /**
   * Loads and auto-plays a new question for the given index.
   *
   * @param idx         - Zero-based question index (0–9).
   * @param prevAnswers - Answer history so far, used to rebuild the store array.
   * @param mode        - Current EarMode.
   */
  const loadQuestion = useCallback(
    (
      idx: number,
      prevAnswers: Array<'correct' | 'incorrect'>,
      mode: EarMode,
    ) => {
      const q = generateQuestion(mode);
      setCurrentQuestion(q);
      setCurrentQuestionIndex(idx);
      setSelectedAnswer(null);
      setResult(null);
      setIsAdvancing(false);

      // Update store answers array
      const updatedAnswers = buildAnswersArray(idx, prevAnswers);
      setEarTrainingAnswers(updatedAnswers);

      // Auto-play after a short layout delay
      schedule(() => {
        setIsPlaying(true);
        q.audioToPlay();
        // Mark as finished playing once the question audio has ended
        schedule(() => setIsPlaying(false), q.audioDurationMs ?? DEFAULT_AUDIO_DURATION_MS);
      }, 150);
    },
    [buildAnswersArray, setEarTrainingAnswers, schedule],
  );

  // ── Session start ──────────────────────────────────────────────────────────

  /**
   * Begins a new 10-question session: resets all state, starts the backend
   * session, and loads the first question.
   */
  const startQuizSession = useCallback(async () => {
    // Drop anything left over from a previous run before resetting state
    clearTimers();
    abandonBackendSession();
    setEarTrainingScore(0);
    setEarTrainingTotal(0);
    setEarTrainingAnswers(Array(TOTAL_QUESTIONS).fill('pending'));
    setPhase('active');
    sessionStartTimeRef.current = Date.now();

    // Start backend session (non-blocking)
    try {
      const session = await startSession([scaleKey], metronome.bpm);
      backendSessionRef.current = session;
    } catch {
      backendSessionRef.current = null;
    }

    loadQuestion(0, [], activeMode);
  }, [
    activeMode,
    loadQuestion,
    clearTimers,
    abandonBackendSession,
    scaleKey,
    metronome.bpm,
    setEarTrainingScore,
    setEarTrainingTotal,
    setEarTrainingAnswers,
  ]);

  // ── Session end ────────────────────────────────────────────────────────────

  /**
   * Finalises the session: awards XP, records practice minutes, ends the
   * backend session, and transitions to the end screen.
   *
   * @param finalScore - Total correct answers.
   * @param finalTotal - Total questions answered.
   */
  const finishSession = useCallback(
    async (finalScore: number, finalTotal: number) => {
      setPhase('end');

      // Award XP proportional to score
      const xpEarned = finalScore * 5;
      if (xpEarned > 0) addXP(xpEarned);

      // Record practice minutes
      if (sessionStartTimeRef.current) {
        const mins = Math.floor(
          (Date.now() - sessionStartTimeRef.current) / 60_000,
        );
        if (mins > 0) addPracticeMinutes(mins);
      }

      // End backend session
      if (backendSessionRef.current) {
        const accuracy = finalTotal > 0 ? finalScore / finalTotal : undefined;
        try {
          await endSession(backendSessionRef.current.id, accuracy);
        } catch {
          // Silently ignore
        }
        backendSessionRef.current = null;
      }
    },
    [addXP, addPracticeMinutes],
  );

  // ── Answer handler ─────────────────────────────────────────────────────────

  /**
   * Processes the user's answer: updates state, schedules the next question
   * or ends the session after the feedback delay.
   *
   * @param value - The value of the answer card the user tapped.
   */
  const handleAnswer = useCallback(
    (value: string) => {
      if (!currentQuestion || isAdvancing) return;

      setIsAdvancing(true);
      setSelectedAnswer(value);

      const isCorrect = value === currentQuestion.correctAnswer;
      const newResult: 'correct' | 'incorrect' = isCorrect
        ? 'correct'
        : 'incorrect';
      setResult(newResult);

      // Update running score in store
      const newScore = earTrainingScore + (isCorrect ? 1 : 0);
      const newTotal = earTrainingTotal + 1;
      setEarTrainingScore(newScore);
      setEarTrainingTotal(newTotal);

      // Update answer history
      const prevAnswers = earTrainingAnswers
        .slice(0, currentQuestionIndex)
        .filter((a): a is 'correct' | 'incorrect' =>
          a === 'correct' || a === 'incorrect',
        );
      const updatedAnswers: AnswerStatus[] = [
        ...prevAnswers,
        newResult,
        ...Array(TOTAL_QUESTIONS - currentQuestionIndex - 1).fill(
          'pending' as AnswerStatus,
        ),
      ];
      setEarTrainingAnswers(updatedAnswers);

      // Record backend attempt for scales mode
      if (activeMode === 'scales') {
        void reportScaleAttempt(isCorrect, metronome.bpm, currentQuestion.scaleTarget);
      }

      // After feedback delay, advance or end session
      schedule(() => {
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex >= TOTAL_QUESTIONS) {
          void finishSession(newScore, newTotal);
        } else {
          loadQuestion(
            nextIndex,
            [...prevAnswers, newResult],
            activeMode,
          );
        }
      }, FEEDBACK_DELAY_MS);
    },
    [
      currentQuestion,
      isAdvancing,
      earTrainingScore,
      earTrainingTotal,
      earTrainingAnswers,
      currentQuestionIndex,
      activeMode,
      metronome.bpm,
      setEarTrainingScore,
      setEarTrainingTotal,
      setEarTrainingAnswers,
      reportScaleAttempt,
      finishSession,
      loadQuestion,
      schedule,
    ],
  );

  // ── Play button handler ────────────────────────────────────────────────────

  /**
   * Handles the user tapping the play/replay button.
   * Replays the current question's audio and shows the playing animation.
   */
  const handlePlay = useCallback(() => {
    if (!currentQuestion) return;
    setIsPlaying(true);
    currentQuestion.audioToPlay();
    schedule(() => setIsPlaying(false), currentQuestion.audioDurationMs ?? DEFAULT_AUDIO_DURATION_MS);
  }, [currentQuestion, schedule]);

  // ── Mode change ────────────────────────────────────────────────────────────

  /**
   * Handles mode-selector changes.  Resets to start screen when the mode
   * changes mid-session so the user gets a clean slate.
   *
   * @param value - The newly selected mode value string.
   */
  const handleModeChange = useCallback(
    (value: string) => {
      const newMode = value as EarMode;
      // Abandon the running session: pending timers would otherwise advance
      // or finish the *new* mode, and the backend session would stay open.
      clearTimers();
      abandonBackendSession();
      setIsAdvancing(false);
      setActiveMode(newMode);
      if (newMode !== 'sequence') {
        setEarTrainingMode(newMode as 'intervals' | 'notes' | 'scales');
      }
      setPhase('start');
    },
    [setEarTrainingMode, clearTimers, abandonBackendSession],
  );

  // ── Sequence mode start/stop ───────────────────────────────────────────────

  /** Starts a sequence mode session. */
  const startSequenceSession = useCallback(async () => {
    setSeqScore(0);
    setSeqTotal(0);
    setSequenceIndex(0);
    setConsecutiveCorrect(0);
    setJustLearnedMessage(null);
    sequenceRunsRef.current = 0;
    sessionStartTimeRef.current = Date.now();
    setPhase('active');

    try {
      const session = await startSession([scaleKey], metronome.bpm);
      backendSessionRef.current = session;
    } catch {
      backendSessionRef.current = null;
    }
  }, [scaleKey, metronome.bpm]);

  /** Ends a sequence mode session. */
  const endSequenceSession = useCallback(async () => {
    setPhase('end');

    if (sessionStartTimeRef.current) {
      const mins = Math.floor(
        (Date.now() - sessionStartTimeRef.current) / 60_000,
      );
      if (mins > 0) addPracticeMinutes(mins);
    }

    const accuracy = seqTotal > 0 ? seqScore / seqTotal : undefined;
    if (backendSessionRef.current) {
      try {
        await endSession(backendSessionRef.current.id, accuracy);
      } catch {
        // Silently ignore
      }
      backendSessionRef.current = null;
    }
  }, [seqScore, seqTotal, addPracticeMinutes]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    maxWidth: 520,
    margin: '0 auto',
    padding: 24,
    animation: 'ear-fadein 150ms ease',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes ear-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Mode selector — always visible */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <SegmentedToggle
          options={modeOptions}
          value={activeMode}
          onChange={handleModeChange}
        />
      </div>

      {/* ── Sequence mode ─────────────────────────────────────────────────── */}
      {activeMode === 'sequence' && (
        <SequenceSection
          phase={phase}
          scaleNotes={scaleNotes}
          sequenceIndex={sequenceIndex}
          score={seqScore}
          total={seqTotal}
          consecutiveCorrect={consecutiveCorrect}
          justLearnedMessage={justLearnedMessage}
          metronomeBpm={metronome.bpm}
          selectedRoot={selectedRoot}
          selectedScale={selectedScale}
          onStart={startSequenceSession}
          onEnd={endSequenceSession}
          onRestart={() => {
            setPhase('start');
          }}
        />
      )}

      {/* The exercise is played by clicking notes, so the fretboard has to be
          on this tab; Fretboard writes each click to lastClickedNote. */}
      {activeMode === 'sequence' && phase === 'active' && (
        <div style={{ marginTop: 16 }}>
          <Fretboard />
        </div>
      )}

      {/* ── Quiz modes (intervals / notes / scales) ───────────────────────── */}
      {activeMode !== 'sequence' && (
        <>
          {phase === 'start' && (
            <StartScreen mode={activeMode} onStart={startQuizSession} />
          )}

          {phase === 'active' && currentQuestion && (
            <>
              <ProgressBar
                total={TOTAL_QUESTIONS}
                current={currentQuestionIndex}
                answers={earTrainingAnswers}
              />

              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '24px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 24,
                }}
              >
                <QuestionPrompt
                  key={currentQuestion.id}
                  questionText={currentQuestion.questionText}
                  onPlay={handlePlay}
                  isPlaying={isPlaying}
                  canReplay={!isAdvancing}
                />

                <AnswerGrid
                  options={currentQuestion.options}
                  correctAnswer={currentQuestion.correctAnswer}
                  onAnswer={handleAnswer}
                  result={result}
                  selectedAnswer={selectedAnswer}
                  disabled={isAdvancing}
                />
              </div>

              {/* Live score */}
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                Score: {earTrainingScore} / {earTrainingTotal}
              </div>
            </>
          )}

          {phase === 'end' && (
            <EndScreen
              score={earTrainingScore}
              total={TOTAL_QUESTIONS}
              onRetry={() => {
                setPhase('start');
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// ---- StartScreen -----

/** Props for StartScreen. */
interface StartScreenProps {
  /** Current ear-training mode. */
  mode: EarMode;
  /** Called when the user taps "Start Session". */
  onStart: () => void;
}

/**
 * StartScreen
 *
 * Shown before a session begins. Describes the active mode and presents a
 * "Start Session" button.
 *
 * @param props - {@link StartScreenProps}
 * @returns The rendered start screen.
 */
function StartScreen({ mode, onStart }: StartScreenProps): React.ReactElement {
  const descriptions: Record<string, string> = {
    intervals:
      'Two notes will be played in sequence. Identify the interval between them by ear.',
    notes:
      'A single note will be played. Identify which pitch you hear from the four options.',
    scales:
      'The first five notes of a scale will be played. Identify the scale type by ear.',
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          color: 'var(--accent-glow)',
          margin: 0,
        }}
      >
        Ear Training
      </p>

      <p
        style={{
          fontSize: 14,
          color: 'var(--text-body)',
          margin: 0,
          lineHeight: 1.6,
          maxWidth: 320,
        }}
      >
        {descriptions[mode] ?? descriptions['intervals']}
      </p>

      <p
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          margin: 0,
        }}
      >
        {TOTAL_QUESTIONS} questions per session
      </p>

      <button
        type="button"
        onClick={onStart}
        style={{
          marginTop: 8,
          padding: '12px 36px',
          background: 'var(--accent-primary)',
          color: '#1C1714',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 150ms ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '1';
        }}
      >
        Start Session
      </button>
    </div>
  );
}

// ---- EndScreen -----

/** Props for the EndScreen component. */
interface EndScreenProps {
  /** Number of correct answers. */
  score: number;
  /** Total questions in the session. */
  total: number;
  /** Callback to restart from the start screen. */
  onRetry: () => void;
}

/**
 * EndScreen
 *
 * Displays the session result (score, percentage) with a "Try Again" button.
 *
 * @param props - {@link EndScreenProps}
 * @returns The rendered end screen.
 */
function EndScreen({
  score,
  total,
  onRetry,
}: EndScreenProps): React.ReactElement {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const message =
    pct >= 80
      ? 'Excellent work!'
      : pct >= 60
      ? 'Good job!'
      : 'Keep practising!';

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          color: 'var(--accent-glow)',
          margin: 0,
        }}
      >
        Session Complete
      </p>

      <p
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: pct >= 60 ? 'var(--correct)' : 'var(--incorrect)',
          margin: '8px 0 0',
          lineHeight: 1,
        }}
      >
        {pct}%
      </p>

      <p
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          margin: 0,
        }}
      >
        {score} of {total} correct
      </p>

      <p
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          margin: 0,
        }}
      >
        {message}
      </p>

      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 12,
          padding: '12px 36px',
          background: 'var(--accent-primary)',
          color: '#1C1714',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 150ms ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '1';
        }}
      >
        Try Again
      </button>
    </div>
  );
}

// ---- SequenceSection -----

/** Props for the SequenceSection component. */
interface SequenceSectionProps {
  /** Current session lifecycle phase. */
  phase: SessionPhase;
  /** Ordered list of scale notes to click through. */
  scaleNotes: string[];
  /** Index of the note the user must click next (unbounded — mod by length). */
  sequenceIndex: number;
  /** Number of correct note clicks so far. */
  score: number;
  /** Total note clicks so far. */
  total: number;
  /** Backend mastery consecutive-correct count. */
  consecutiveCorrect: number;
  /** Non-null while showing a "just learned" celebration message. */
  justLearnedMessage: string | null;
  /** Current metronome BPM (shown in mastery tracker). */
  metronomeBpm: number;
  /** Currently selected root note name. */
  selectedRoot: string;
  /** Currently selected scale key. */
  selectedScale: string;
  /** Starts a new sequence session. */
  onStart: () => void;
  /** Ends the active sequence session. */
  onEnd: () => void;
  /** Returns to the start screen without ending the backend session. */
  onRestart: () => void;
}

/**
 * SequenceSection
 *
 * Renders the Sequence exercise lifted directly from PracticeMode.tsx.
 * The user plays scale notes in order by clicking the fretboard rendered
 * below it (by EarTrainingView) while the exercise is active.
 * Mastery is tracked at 3 consecutive correct runs at ≥ 120 BPM via the
 * backend.
 *
 * @param props - {@link SequenceSectionProps}
 * @returns The rendered sequence exercise section.
 */
function SequenceSection({
  phase,
  scaleNotes,
  sequenceIndex,
  score,
  total,
  consecutiveCorrect,
  justLearnedMessage,
  metronomeBpm,
  selectedRoot,
  selectedScale,
  onStart,
  onEnd,
  onRestart,
}: SequenceSectionProps): React.ReactElement {
  if (phase === 'start') {
    return (
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--accent-glow)',
            margin: 0,
          }}
        >
          Sequence Practice
        </p>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-body)',
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 320,
          }}
        >
          Play the scale notes in order by clicking them on the fretboard.
          Achieve 3 correct runs at 120 BPM to mark the scale as learned.
        </p>
        <button
          type="button"
          onClick={onStart}
          style={{
            marginTop: 8,
            padding: '12px 36px',
            background: 'var(--accent-primary)',
            color: '#1C1714',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Start Practice
        </button>
      </div>
    );
  }

  if (phase === 'end') {
    return (
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '40px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--accent-glow)',
            margin: 0,
          }}
        >
          Session Ended
        </p>
        <p
          style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}
        >
          Score: {score} / {total}
        </p>
        <button
          type="button"
          onClick={onRestart}
          style={{
            padding: '12px 36px',
            background: 'var(--accent-primary)',
            color: '#1C1714',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Active phase
  const posInScale = sequenceIndex % (scaleNotes.length || 1);

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{ fontSize: 13, color: 'var(--text-muted)' }}
        >
          Score: {score}/{total}
        </span>
        <button
          type="button"
          onClick={onEnd}
          style={{
            padding: '4px 12px',
            background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          End
        </button>
      </div>

      {/* Just-learned celebration */}
      {justLearnedMessage && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(76, 175, 80, 0.15)',
            border: '1px solid rgba(76, 175, 80, 0.4)',
            borderRadius: 8,
            color: 'var(--correct)',
            fontSize: 13,
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          {justLearnedMessage}
        </div>
      )}

      {/* Current target note */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          padding: '20px 16px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            margin: '0 0 8px 0',
          }}
        >
          Play the next note in the sequence:
        </p>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 40,
            color: 'var(--accent-primary)',
            margin: 0,
            lineHeight: 1,
          }}
        >
          {scaleNotes[posInScale] ?? '—'}
        </p>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            margin: '8px 0 0 0',
          }}
        >
          Note {posInScale + 1} of {scaleNotes.length}
        </p>
      </div>

      {/* Scale note chips */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {scaleNotes.map((note, i) => (
          <span
            key={i}
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              background:
                i === posInScale
                  ? 'var(--accent-primary)'
                  : i < posInScale
                  ? 'rgba(76, 175, 80, 0.2)'
                  : 'var(--bg-elevated)',
              color:
                i === posInScale
                  ? '#1C1714'
                  : i < posInScale
                  ? 'var(--correct)'
                  : 'var(--text-muted)',
              border:
                i < posInScale
                  ? '1px solid rgba(76, 175, 80, 0.4)'
                  : '1px solid var(--border-subtle)',
            }}
          >
            {note}
          </span>
        ))}
      </div>

      {/* Mastery progress */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            Mastery: {selectedRoot} {selectedScale}
          </span>
          <span style={{ color: 'var(--text-body)' }}>
            {consecutiveCorrect}/3 at {metronomeBpm} BPM
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: 'var(--border-subtle)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min((consecutiveCorrect / 3) * 100, 100)}%`,
              background:
                consecutiveCorrect >= 3
                  ? 'var(--correct)'
                  : 'var(--accent-primary)',
              borderRadius: 3,
              transition: 'width 400ms ease',
            }}
          />
        </div>
        {metronomeBpm < 120 && (
          <p
            style={{
              fontSize: 11,
              color: '#EF9F27',
              margin: 0,
            }}
          >
            Set metronome to 120 BPM to earn mastery
          </p>
        )}
      </div>

      <p
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        Click the notes on the fretboard below to play the sequence
      </p>
    </div>
  );
}
