/**
 * EarTrainingView.tsx
 *
 * The full ear-training session screen for the Guitar Scale Tool.
 *
 * Provides four modes selectable via a SegmentedControl:
 *
 *   1. Intervals — user hears two notes and identifies the interval name.
 *   2. Notes     — user hears a single note and identifies its name.
 *   3. Scales    — user hears a full scale ascending (root to octave) and
 *                  identifies the scale type.
 *   4. Sequence  — preserved from PracticeMode; user plays scale notes on the
 *                  fretboard in order. Mastery is tracked locally in the store
 *                  (sequenceMastery).
 *
 * Session flow:
 *   Start screen → 10-question quiz → End screen (score + "Try Again")
 *
 * History (useHistoryStore, this browser only):
 *   - a finished session is logged with its mode, scale, BPM and accuracy;
 *   - recordScaleAttempt counts Scales answers and Sequence notes.
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
import { learnedScaleKey } from '../../store/progress';
import { audioEngine } from '../../audio/AudioEngine';
import { ALL_NOTES, SCALES, getScaleNotes } from '../../data/musicTheory';
import { useHistoryStore } from '../../store/useHistoryStore';
import { Button, Notice, Panel, SegmentedControl, cn, PageTitle } from '../../ui';
import ProgressBar, { type AnswerStatus } from './ProgressBar';
import QuestionPrompt from './QuestionPrompt';
import AnswerGrid, { type AnswerOption } from './AnswerGrid';
import Fretboard from '../Fretboard';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Total questions per ear-training session. */
const TOTAL_QUESTIONS = 10;

/** Milliseconds the feedback colours are shown before advancing. */
const FEEDBACK_DELAY_MS = 800;

/** Sequence runs only count toward mastery at or above this metronome BPM. */
const MASTERY_BPM = 120;

/** Consecutive clean runs at MASTERY_BPM that mark a scale learned. */
const MASTERY_RUNS = 3;

/** Gap between notes of a Scales-mode question. */
const SCALE_NOTE_GAP_MS = 250;

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

/**
 * Schedules a callback after a delay. The view passes its own `later`, so
 * every pending note is cancelled when the user leaves or changes mode.
 */
type Scheduler = (fn: () => void, ms: number) => void;

/** A fully-formed question ready to be rendered. */
interface Question {
  /** Unique monotonic ID used as React key when switching questions. */
  id: number;
  /** Plays (or replays) the question audio; delayed notes go through `schedule`. */
  audioToPlay: (schedule: Scheduler) => void;
  /** Roughly how long the audio lasts, for the "playing" indicator. */
  durationMs: number;
  /** Instruction text shown in the QuestionPrompt heading. */
  questionText: string;
  /** Four answer options offered to the user. */
  options: AnswerOption[];
  /** The `value` field of the correct AnswerOption. */
  correctAnswer: string;
}

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
    audioToPlay: (schedule) => {
      audioEngine.playNote(rootNote, 4);
      schedule(() => audioEngine.playNote(secondNote, secondOctave), 400);
    },
    durationMs: 1200,
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
    durationMs: 1200,
    options,
    correctAnswer: note,
  };
}

/**
 * Generates a random Scales-mode question.
 *
 * Picks a random root and scale type from the curated list, plays the whole
 * scale ascending from the root up to the root an octave higher (250 ms
 * apart), and offers four scale names as answers. The full run matters:
 * modes like Natural Minor and Dorian share their first five notes.
 *
 * @returns A complete Question object.
 */
function generateScaleQuestion(): Question {
  const rootIdx = randInt(ALL_NOTES.length);
  const rootNote = ALL_NOTES[rootIdx];
  const scaleKeyIdx = randInt(SCALE_MODE_KEYS.length);
  const scaleKey = SCALE_MODE_KEYS[scaleKeyIdx];
  const scale = SCALES[scaleKey];

  // Ascend from the root at octave 4. Like the interval generator, a degree
  // whose pitch class wraps past B (rootIdx + interval >= 12) moves up an
  // octave, so the run never drops mid-scale. Ends on the octave root.
  const notesToPlay: Array<{ note: string; octave: number }> = [
    ...scale.intervals.map((iv) => {
      const abs = rootIdx + iv;
      return { note: ALL_NOTES[abs % 12], octave: 4 + Math.floor(abs / 12) };
    }),
    { note: rootNote, octave: 5 },
  ];

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
    audioToPlay: (schedule) => {
      notesToPlay.forEach(({ note, octave }, i) => {
        if (i === 0) audioEngine.playNote(note, octave);
        else schedule(() => audioEngine.playNote(note, octave), i * SCALE_NOTE_GAP_MS);
      });
    },
    durationMs: notesToPlay.length * SCALE_NOTE_GAP_MS + 400,
    correctAnswer,
    options,
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
    markScaleLearned,
    recordPracticeDay,
    sequenceMastery,
    setSequenceMastery,
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
  /** True after "Try again", so the start screen takes focus when it mounts. */
  const [focusStart, setFocusStart] = useState(false);

  // Pending timeouts (feedback delay, auto-play, banners). Cleared on unmount
  // and on mode change, so a late timer can't advance a session the user left.
  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  // Screen-reader feedback. `n` changes on every message so a repeated
  // "Correct." is still announced.
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 });
  const announce = useCallback(
    (text: string) => setAnnouncement((prev) => ({ text, n: prev.n + 1 })),
    [],
  );

  const logSession = useHistoryStore((s) => s.logSession);
  const recordScaleAttempt = useHistoryStore((s) => s.recordScaleAttempt);
  const sessionStartTimeRef = useRef<number | null>(null);

  // ── Sequence mode state (preserved from PracticeMode) ─────────────────────

  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [seqScore, setSeqScore] = useState(0);
  const [seqTotal, setSeqTotal] = useState(0);
  const [justLearnedMessage, setJustLearnedMessage] = useState<string | null>(null);
  const sequenceRunsRef = useRef(0);
  /**
   * Whether the run in progress still qualifies for mastery: every note so
   * far was right and played at >= MASTERY_BPM. Reset when a run starts.
   */
  const runQualifiesRef = useRef(true);

  const scale = SCALES[selectedScale];
  /** Display name ("Major (Ionian)"), not the registry key ("major"). */
  const scaleName = scale?.name ?? selectedScale;
  const scaleNotes = useMemo(
    () => (scale ? getScaleNotes(selectedRoot, scale.intervals) : []),
    [selectedRoot, scale],
  );

  const scaleKey = learnedScaleKey(selectedRoot, selectedScale);
  /** Local mastery: consecutive clean runs at >= MASTERY_BPM (persisted). */
  const consecutiveCorrect = sequenceMastery[scaleKey] ?? 0;

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

  // ── History: scale attempts ────────────────────────────────────────────────

  /**
   * Counts an attempt at the current scale in the local history. Mastery
   * itself is tracked separately (see recordSequenceMastery).
   *
   * @param correct - Whether the user answered correctly.
   */
  const reportScaleAttempt = useCallback(
    (correct: boolean) => recordScaleAttempt(scaleKey, correct),
    [scaleKey, recordScaleAttempt],
  );

  /**
   * Logs the session that just finished, if one was started.
   *
   * @param accuracy - 0–1, or null when nothing was answered.
   */
  const logFinishedSession = useCallback(
    (accuracy: number | null) => {
      const started = sessionStartTimeRef.current;
      if (started == null) return;
      sessionStartTimeRef.current = null;
      logSession({
        mode: activeMode,
        scaleKey,
        bpm: metronome.bpm,
        startedAt: new Date(started).toISOString(),
        accuracy,
      });
    },
    [activeMode, scaleKey, metronome.bpm, logSession],
  );

  /**
   * Local sequence mastery. A clean run (no wrong notes, every note at
   * >= MASTERY_BPM) adds one; a wrong note at >= MASTERY_BPM resets to 0;
   * slower runs don't count either way. Reaching MASTERY_RUNS marks the
   * scale learned (once) and shows the "learned" message.
   *
   * @param outcome - 'run' when a qualifying run completes, 'miss' on a wrong note.
   */
  const recordSequenceMastery = useCallback(
    (outcome: 'run' | 'miss') => {
      const state = useGuitarStore.getState();
      const current = state.sequenceMastery[scaleKey] ?? 0;
      if (outcome === 'miss') {
        if (current !== 0) setSequenceMastery(scaleKey, 0);
        return;
      }
      const next = Math.min(current + 1, MASTERY_RUNS);
      if (next !== current) setSequenceMastery(scaleKey, next);
      if (next >= MASTERY_RUNS && !state.learnedScales.has(scaleKey)) {
        markScaleLearned(scaleKey);
        addXP(50);
        setJustLearnedMessage(`${selectedRoot} ${scaleName} is now learned!`);
        announce(`${selectedRoot} ${scaleName} is now learned.`);
        later(() => setJustLearnedMessage(null), 4000);
      }
    },
    [scaleKey, selectedRoot, scaleName, setSequenceMastery, markScaleLearned, addXP, announce, later],
  );

  // ── Sequence mode: wire fretboard note clicks ──────────────────────────────

  // A fretboard tap is an event, so it's handled in a store subscription
  // callback rather than by an effect that sets state when the value changes.
  const handleSequenceNote = useCallback(
    (clicked: string) => {
    if (phase !== 'active' || activeMode !== 'sequence' || scaleNotes.length === 0) return;

    const posInScale = sequenceIndex % scaleNotes.length;
    const targetNote = scaleNotes[posInScale];
    const bpm = metronome.bpm;
    const fastEnough = bpm >= MASTERY_BPM;

    // A new run starts on the first note of the scale
    if (posInScale === 0 && clicked === targetNote) runQualifiesRef.current = true;

    if (clicked === targetNote) {
      if (!fastEnough) runQualifiesRef.current = false;
      const nextIndex = sequenceIndex + 1;
      announce(`${clicked}, correct. Next: ${scaleNotes[nextIndex % scaleNotes.length]}.`);
      setSequenceIndex(nextIndex);
      setSeqScore((s) => s + 1);
      setSeqTotal((t) => t + 1);

      if (posInScale === scaleNotes.length - 1) {
        sequenceRunsRef.current += 1;
        if (runQualifiesRef.current) recordSequenceMastery('run');
        reportScaleAttempt(true);
      }
    } else {
      announce(`${clicked} is not it. Play ${targetNote}.`);
      setSeqTotal((t) => t + 1);
      runQualifiesRef.current = false;
      if (fastEnough) recordSequenceMastery('miss');
      reportScaleAttempt(false);
    }
    },
    [phase, activeMode, scaleNotes, sequenceIndex, reportScaleAttempt, recordSequenceMastery, metronome.bpm, announce],
  );

  useEffect(
    () =>
      useGuitarStore.subscribe((state, prev) => {
        const clicked = state.lastClickedNote;
        if (!clicked || clicked === prev.lastClickedNote) return;
        handleSequenceNote(clicked);
        // Reset so tapping the same note again registers as a new event
        state.setLastClickedNote(null);
      }),
    [handleSequenceNote],
  );

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

      announce(`Question ${idx + 1} of ${TOTAL_QUESTIONS}. ${q.questionText}`);

      // Auto-play after a short layout delay
      later(() => {
        setIsPlaying(true);
        q.audioToPlay(later);
        // Mark as finished playing after a generous window
        later(() => setIsPlaying(false), q.durationMs);
      }, 150);
    },
    [buildAnswersArray, setEarTrainingAnswers, announce, later],
  );

  // ── Session start ──────────────────────────────────────────────────────────

  /**
   * Begins a new 10-question session: resets all state and loads the first
   * question.
   */
  const startQuizSession = useCallback(() => {
    // Reset session state
    setEarTrainingScore(0);
    setEarTrainingTotal(0);
    setEarTrainingAnswers(Array(TOTAL_QUESTIONS).fill('pending'));
    setPhase('active');
    sessionStartTimeRef.current = Date.now();
    loadQuestion(0, [], activeMode);
  }, [
    activeMode,
    loadQuestion,
    setEarTrainingScore,
    setEarTrainingTotal,
    setEarTrainingAnswers,
  ]);

  // ── Session end ────────────────────────────────────────────────────────────

  /**
   * Finalises the session: awards XP, records practice minutes, logs the
   * session to history, and transitions to the end screen.
   *
   * @param finalScore - Total correct answers.
   * @param finalTotal - Total questions answered.
   */
  const finishSession = useCallback(
    (finalScore: number, finalTotal: number) => {
      setPhase('end');
      recordPracticeDay();

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

      logFinishedSession(finalTotal > 0 ? finalScore / finalTotal : null);
    },
    [addXP, addPracticeMinutes, recordPracticeDay, logFinishedSession],
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

      const correctLabel =
        currentQuestion.options.find((o) => o.value === currentQuestion.correctAnswer)?.label ??
        currentQuestion.correctAnswer;
      announce(isCorrect ? 'Correct.' : `Incorrect. The answer was ${correctLabel}.`);

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
        reportScaleAttempt(isCorrect);
      }

      // After feedback delay, advance or end session
      later(() => {
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex >= TOTAL_QUESTIONS) {
          announce(`Session complete. ${newScore} of ${newTotal} correct.`);
          finishSession(newScore, newTotal);
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
      setEarTrainingScore,
      setEarTrainingTotal,
      setEarTrainingAnswers,
      reportScaleAttempt,
      finishSession,
      loadQuestion,
      announce,
      later,
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
    currentQuestion.audioToPlay(later);
    later(() => setIsPlaying(false), currentQuestion.durationMs);
  }, [currentQuestion, later]);

  // ── Mode change ────────────────────────────────────────────────────────────

  /**
   * Handles mode-selector changes.  Resets to start screen when the mode
   * changes mid-session so the user gets a clean slate.
   *
   * @param value - The newly selected mode value string.
   */
  const handleModeChange = useCallback(
    (value: string) => {
      // Re-pressing the active exercise type must not throw away the session
      if (value === activeMode) return;
      const newMode = value as EarMode;
      // Drop pending feedback/auto-play timers from the abandoned session
      clearTimers();
      setIsAdvancing(false);
      setIsPlaying(false);
      setActiveMode(newMode);
      if (newMode !== 'sequence') {
        setEarTrainingMode(newMode as 'intervals' | 'notes' | 'scales');
      }
      setJustLearnedMessage(null);
      // Focus stays on the mode button the user pressed
      setFocusStart(false);
      setPhase('start');
    },
    [activeMode, setEarTrainingMode, clearTimers],
  );

  // ── Sequence mode start/stop ───────────────────────────────────────────────

  /** Starts a sequence mode session. */
  const startSequenceSession = useCallback(() => {
    setSeqScore(0);
    setSeqTotal(0);
    setSequenceIndex(0);
    setJustLearnedMessage(null);
    sequenceRunsRef.current = 0;
    runQualifiesRef.current = true;
    sessionStartTimeRef.current = Date.now();
    setPhase('active');
  }, []);

  /** Ends a sequence mode session. */
  const endSequenceSession = useCallback(() => {
    setPhase('end');
    if (seqTotal > 0) recordPracticeDay();

    if (sessionStartTimeRef.current) {
      const mins = Math.floor(
        (Date.now() - sessionStartTimeRef.current) / 60_000,
      );
      if (mins > 0) addPracticeMinutes(mins);
    }

    if (seqTotal > 0) logFinishedSession(seqScore / seqTotal);
    else sessionStartTimeRef.current = null;
  }, [seqScore, seqTotal, addPracticeMinutes, recordPracticeDay, logFinishedSession]);


  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="motion-slide flex animate-[rise-in_150ms_ease-out] flex-col gap-5">
      {/* Polite live region: answer feedback, question changes, session end */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement.text}
        {announcement.n % 2 ? ' ' : ''}
      </p>

      <div className="flex flex-col items-start gap-3">
        <PageTitle>Ear training</PageTitle>
        <SegmentedControl
          ariaLabel="Exercise type"
          options={modeOptions}
          value={activeMode}
          onChange={handleModeChange}
        />
      </div>

      {/* ── Sequence mode ─────────────────────────────────────────────────── */}
      {activeMode === 'sequence' && (
        <>
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
            focusStart={focusStart}
            onStart={startSequenceSession}
            onEnd={endSequenceSession}
            onRestart={() => {
              setFocusStart(true);
              setPhase('start');
            }}
          />

          {/* Sequence answers come from fretboard taps, so the board has to
              be on this tab while a session runs. */}
          {phase === 'active' && (
            <Panel title="Fretboard" headingLevel={3} subtitle="Tap the notes in order">
              <Fretboard />
            </Panel>
          )}
        </>
      )}

      {/* ── Quiz modes (intervals / notes / scales) ───────────────────────── */}
      {activeMode !== 'sequence' && (
        <>
          {phase === 'start' && (
            <StartScreen mode={activeMode} autoFocus={focusStart} onStart={startQuizSession} />
          )}

          {phase === 'active' && currentQuestion && (
            <>
              <ProgressBar
                total={TOTAL_QUESTIONS}
                current={currentQuestionIndex}
                answers={earTrainingAnswers}
              />

              <Panel>
                <div className="flex flex-col gap-6 py-1">
                  <QuestionPrompt
                    key={currentQuestion.id}
                    questionText={currentQuestion.questionText}
                    onPlay={handlePlay}
                    isPlaying={isPlaying}
                    canReplay={!isAdvancing}
                    focusOnMount
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
              </Panel>

              <p className="text-center text-xs text-muted">
                Score:{' '}
                <span className="tabular font-mono text-ink">
                  {earTrainingScore} / {earTrainingTotal}
                </span>
              </p>
            </>
          )}

          {phase === 'end' && (
            <EndScreen
              score={earTrainingScore}
              total={TOTAL_QUESTIONS}
              onRetry={() => {
                setFocusStart(true);
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

/**
 * Returns a ref that receives focus when the component mounts, if `enabled`
 * was true at mount. Used where an action unmounts the control the user was
 * on (Start, End, Try again), so keyboard focus lands on the next control
 * instead of falling back to <body>.
 *
 * @param enabled - Whether to focus on mount (read once).
 */
function useFocusOnMount<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  const enabledAtMount = useRef(enabled);
  useEffect(() => {
    if (enabledAtMount.current) ref.current?.focus();
  }, []);
  return ref;
}

/** Quiz-mode names, used as the start screen's panel title. */
const MODE_LABELS: Record<string, string> = {
  intervals: 'Intervals',
  notes: 'Notes',
  scales: 'Scales',
};

// ---- StartScreen -----

/** Props for StartScreen. */
interface StartScreenProps {
  /** Current ear-training mode. */
  mode: EarMode;
  /** Focus "Start session" on mount (after "Try again"). */
  autoFocus?: boolean;
  /** Called when the user taps "Start session". */
  onStart: () => void;
}

/**
 * StartScreen
 *
 * Shown before a session begins. Describes the active mode and presents the
 * "Start session" button.
 *
 * @param props - {@link StartScreenProps}
 * @returns The rendered start screen.
 */
function StartScreen({ mode, autoFocus = false, onStart }: StartScreenProps): React.ReactElement {
  const startRef = useFocusOnMount<HTMLButtonElement>(autoFocus);
  const descriptions: Record<string, string> = {
    intervals:
      'Two notes will be played in sequence. Identify the interval between them by ear.',
    notes:
      'A single note will be played. Identify which pitch you hear from the four options.',
    scales:
      'A scale will be played ascending, from the root up to its octave. Identify the scale type by ear.',
  };

  return (
    <Panel title={MODE_LABELS[mode] ?? MODE_LABELS.intervals} headingLevel={3}>
      <div className="flex flex-col items-start gap-4">
        <div className="flex flex-col gap-1">
          <p className="max-w-[52ch] text-sm leading-relaxed text-ink">
            {descriptions[mode] ?? descriptions['intervals']}
          </p>
          <p className="text-xs text-muted">
            <span className="font-mono">{TOTAL_QUESTIONS}</span> questions per session
          </p>
        </div>
        <Button ref={startRef} variant="ink" size="lg" onClick={onStart}>
          Start session
        </Button>
      </div>
    </Panel>
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
 * Displays the session result (score, percentage) with a "Try again" button.
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
  // The last answer card just unmounted; land on the next action
  const retryRef = useFocusOnMount<HTMLButtonElement>();

  const message =
    pct >= 80
      ? 'Excellent work!'
      : pct >= 60
      ? 'Good job!'
      : 'Keep practising!';

  return (
    <Panel title="Session complete" headingLevel={3}>
      <div className="flex flex-col items-start gap-4">
        <div className="flex flex-col gap-1">
          <p className="flex items-baseline gap-3">
            <span aria-hidden="true" className="tabular font-mono text-5xl leading-none font-bold tracking-[-0.03em] text-ink">
              {score} / {total}
            </span>
            <span className="sr-only">
              {score} of {total} correct,
            </span>
            <span className="tabular font-mono text-lg text-muted">{pct}%</span>
          </p>
          <p className="mt-2 text-[13px] text-muted">{message}</p>
        </div>
        <Button ref={retryRef} variant="ink" size="lg" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Panel>
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
  /** Local mastery: consecutive clean runs at >= 120 BPM (from the store). */
  consecutiveCorrect: number;
  /** Non-null while showing a "just learned" celebration message. */
  justLearnedMessage: string | null;
  /** Current metronome BPM (shown in mastery tracker). */
  metronomeBpm: number;
  /** Currently selected root note name. */
  selectedRoot: string;
  /** Currently selected scale key. */
  selectedScale: string;
  /** Focus "Start practice" on mount (after "Try again"). */
  focusStart: boolean;
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
 * The Sequence exercise lifted from PracticeMode.tsx. The user plays scale
 * notes in order by selecting them on the fretboard (rendered by the parent
 * below this card). Mastery is 3 consecutive clean runs at >= 120 BPM,
 * tracked locally in the store.
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
  focusStart,
  onStart,
  onEnd,
  onRestart,
}: SequenceSectionProps): React.ReactElement {
  if (phase === 'start') {
    return <SequenceStart autoFocus={focusStart} onStart={onStart} />;
  }

  if (phase === 'end') {
    return <SequenceEnd score={score} total={total} onRestart={onRestart} />;
  }

  return (
    <SequenceActive
      scaleNotes={scaleNotes}
      sequenceIndex={sequenceIndex}
      score={score}
      total={total}
      consecutiveCorrect={consecutiveCorrect}
      justLearnedMessage={justLearnedMessage}
      metronomeBpm={metronomeBpm}
      selectedRoot={selectedRoot}
      selectedScale={selectedScale}
      onEnd={onEnd}
    />
  );
}

/** Sequence start card. Takes focus after "Try again". */
function SequenceStart({ autoFocus, onStart }: { autoFocus: boolean; onStart: () => void }): React.ReactElement {
  const startRef = useFocusOnMount<HTMLButtonElement>(autoFocus);
  return (
    <Panel title="Sequence practice" headingLevel={3}>
      <div className="flex flex-col items-start gap-4">
        <p className="max-w-[52ch] text-sm leading-relaxed text-ink">
          Play the scale notes in order on the fretboard, which appears once you start.
          Achieve {MASTERY_RUNS} clean runs in a row at {MASTERY_BPM} BPM to mark the scale as learned.
        </p>
        <Button ref={startRef} variant="ink" size="lg" onClick={onStart}>
          Start practice
        </Button>
      </div>
    </Panel>
  );
}

/** Sequence end card. "End" just unmounted, so "Try again" takes focus. */
function SequenceEnd({ score, total, onRestart }: { score: number; total: number; onRestart: () => void }): React.ReactElement {
  const retryRef = useFocusOnMount<HTMLButtonElement>();
  return (
    <Panel title="Session ended" headingLevel={3}>
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted">
          Score:{' '}
          <span className="tabular font-mono text-ink">
            {score} / {total}
          </span>
        </p>
        <Button ref={retryRef} variant="ink" size="lg" onClick={onRestart}>
          Try again
        </Button>
      </div>
    </Panel>
  );
}

/** Props for the active sequence card. */
type SequenceActiveProps = Omit<SequenceSectionProps, 'phase' | 'focusStart' | 'onStart' | 'onRestart'>;

/**
 * The running sequence exercise. "Start practice" just unmounted, so the
 * target-note readout takes focus (it reads the note to play next).
 */
function SequenceActive({
  scaleNotes,
  sequenceIndex,
  score,
  total,
  consecutiveCorrect,
  justLearnedMessage,
  metronomeBpm,
  selectedRoot,
  selectedScale,
  onEnd,
}: SequenceActiveProps): React.ReactElement {
  const targetRef = useFocusOnMount<HTMLDivElement>();

  // Active phase
  const posInScale = sequenceIndex % (scaleNotes.length || 1);
  const masteryPct = Math.min((consecutiveCorrect / MASTERY_RUNS) * 100, 100);

  return (
    <Panel
      title="Sequence practice"
      headingLevel={3}
      actions={
        <>
          <span className="text-[13px] text-muted">
            Score:{' '}
            <span className="tabular font-mono text-ink">
              {score}/{total}
            </span>
          </span>
          <Button size="sm" onClick={onEnd}>
            End
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {justLearnedMessage && <Notice tone="success">{justLearnedMessage}</Notice>}

        {/* Current target note */}
        <div ref={targetRef} tabIndex={-1} className="rounded-control bg-sunken px-4 py-5 text-center">
          <p className="text-xs text-muted">Play the next note in the sequence:</p>
          <p className="mt-2 text-[44px] leading-none font-extrabold tracking-[-0.02em] text-ink">
            {scaleNotes[posInScale] ?? '—'}
          </p>
          <p className="mt-2 text-xs text-muted">
            Note <span className="tabular font-mono">{posInScale + 1}</span> of{' '}
            <span className="font-mono">{scaleNotes.length}</span>
          </p>
        </div>

        {/* Scale notes: done outlined in ink, next-to-play ink-filled with a
            ring, upcoming hairline. Orange is kept for sounding notes. */}
        <ol aria-label="Scale notes" className="flex flex-wrap justify-center gap-1.5">
          {scaleNotes.map((note, i) => (
            <li
              key={i}
              aria-current={i === posInScale ? 'step' : undefined}
              className={cn(
                'inline-flex h-7 min-w-8 items-center justify-center rounded-full border px-2.5 text-xs font-bold transition-colors duration-150',
                i === posInScale
                  ? 'border-ink bg-ink text-surface ring-2 ring-ink ring-offset-2 ring-offset-surface'
                  : i < posInScale
                    ? 'border-ink bg-surface text-ink'
                    : 'border-line-strong bg-surface text-muted',
              )}
            >
              {note}
            </li>
          ))}
        </ol>

        {/* Mastery progress */}
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
            <span className="text-muted">
              Mastery: {selectedRoot} {SCALES[selectedScale]?.name ?? selectedScale}
            </span>
            <span className="tabular font-mono text-ink">
              {consecutiveCorrect}/{MASTERY_RUNS} at {metronomeBpm} BPM
            </span>
          </div>
          <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-line">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-[400ms] ease-out',
                consecutiveCorrect >= MASTERY_RUNS ? 'bg-correct' : 'bg-ink',
              )}
              style={{ width: `${masteryPct}%` }}
            />
          </div>
          {metronomeBpm < MASTERY_BPM && (
            <p className="text-xs text-muted">Set metronome to {MASTERY_BPM} BPM to earn mastery</p>
          )}
        </div>

        <p className="text-center text-xs text-muted">
          Play the notes on the fretboard below, in order
        </p>
      </div>
    </Panel>
  );
}
