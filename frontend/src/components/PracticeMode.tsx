import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import { audioEngine } from '../audio/AudioEngine';
import {
  SCALES,
  getScaleNotes,
  getNoteAtPosition,
  ALL_NOTES,
} from '../data/musicTheory';
import {
  startSession,
  endSession,
  recordScaleAttempt,
  type PracticeSession,
} from '../services/api';

type ExerciseType = 'note_id' | 'sequence' | 'intervals';
type Difficulty = 'easy' | 'medium' | 'hard';

interface QuizQuestion {
  type: 'note_id' | 'interval';
  targetNote: string;
  targetFret: number;
  targetString: number;
  options: string[];
  correctAnswer: string;
  intervalName?: string;
}

const INTERVAL_NAMES: Record<number, string> = {
  0: 'Unison',
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
  12: 'Octave',
};

export default function PracticeMode() {
  const {
    selectedRoot,
    selectedScale,
    currentTuning,
    metronome,
    addXP,
    addPracticeMinutes,
    lastClickedNote,
    setLastClickedNote,
    toggleLearnedScale,
  } = useGuitarStore();

  const [exerciseType, setExerciseType] = useState<ExerciseType>('note_id');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [isActive, setIsActive] = useState(false);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [practiceStartTime, setPracticeStartTime] = useState<number | null>(null);

  // Backend session tracking
  const backendSessionRef = useRef<PracticeSession | null>(null);
  /** How many consecutive times the full scale was correctly completed at ≥120 BPM. */
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  /** Shown when a scale is just marked learned by the backend. */
  const [justLearnedMessage, setJustLearnedMessage] = useState<string | null>(null);
  /** How many times the current scale run has completed (for sequence mode). */
  const sequenceRunsRef = useRef(0);

  const scale = SCALES[selectedScale];
  const scaleNotes = useMemo(
    () => (scale ? getScaleNotes(selectedRoot, scale.intervals) : []),
    [selectedRoot, scale]
  );

  // Get fret range based on difficulty
  const getFretRange = useCallback((): [number, number] => {
    switch (difficulty) {
      case 'easy': return [0, 5];
      case 'medium': return [0, 12];
      case 'hard': return [0, 15];
    }
  }, [difficulty]);

  // Generate a random question
  const generateQuestion = useCallback((): QuizQuestion | null => {
    if (scaleNotes.length === 0) return null;

    const [minFret, maxFret] = getFretRange();
    const stringIdx = Math.floor(Math.random() * currentTuning.strings);
    const fret = Math.floor(Math.random() * (maxFret - minFret + 1)) + minFret;
    const note = getNoteAtPosition(stringIdx, fret, currentTuning.notes);

    if (exerciseType === 'note_id') {
      // Generate wrong options
      const wrongNotes = ALL_NOTES.filter(n => n !== note);
      const shuffledWrong = wrongNotes.sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [note, ...shuffledWrong].sort(() => Math.random() - 0.5);

      return {
        type: 'note_id',
        targetNote: note,
        targetFret: fret,
        targetString: stringIdx,
        options,
        correctAnswer: note,
      };
    }

    if (exerciseType === 'intervals') {
      // Pick two notes from the scale
      if (scaleNotes.length < 2) return null;
      const note1Idx = Math.floor(Math.random() * scaleNotes.length);
      let note2Idx = Math.floor(Math.random() * scaleNotes.length);
      while (note2Idx === note1Idx) {
        note2Idx = Math.floor(Math.random() * scaleNotes.length);
      }

      const note1 = scaleNotes[note1Idx];
      const note2 = scaleNotes[note2Idx];
      const interval = (ALL_NOTES.indexOf(note2 as typeof ALL_NOTES[number]) -
                       ALL_NOTES.indexOf(note1 as typeof ALL_NOTES[number]) + 12) % 12;

      const correctInterval = INTERVAL_NAMES[interval];
      const wrongIntervals = Object.values(INTERVAL_NAMES)
        .filter(name => name !== correctInterval)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const options = [correctInterval, ...wrongIntervals].sort(() => Math.random() - 0.5);

      return {
        type: 'interval',
        targetNote: `${note1} → ${note2}`,
        targetFret: fret,
        targetString: stringIdx,
        options,
        correctAnswer: correctInterval,
        intervalName: correctInterval,
      };
    }

    return null;
  }, [scaleNotes, exerciseType, getFretRange, currentTuning]);

  // ── Backend helpers ─────────────────────────────────────────────────────────

  /**
   * Builds the scale key used for backend mastery tracking.
   * Format: "Root-scaleName" (e.g., "C-major").
   */
  const scaleKey = `${selectedRoot}-${selectedScale}`;

  /**
   * Records a scale attempt to the backend and handles "just learned" transition.
   * Silently no-ops if the backend is unreachable.
   *
   * @param correct - Whether the full scale was played correctly.
   * @param bpm - The BPM at the time of completion.
   */
  const reportScaleAttempt = useCallback(
    async (correct: boolean, bpm: number) => {
      try {
        const result = await recordScaleAttempt(
          scaleKey,
          bpm,
          correct,
          backendSessionRef.current?.id,
        );
        setConsecutiveCorrect(result.mastery.consecutive_correct);
        if (result.just_learned) {
          // Sync to local store so fretboard shows learned indicator
          toggleLearnedScale(scaleKey);
          setJustLearnedMessage(`${selectedRoot} ${selectedScale} is now LEARNED!`);
          addXP(50); // Bonus XP for mastery
          setTimeout(() => setJustLearnedMessage(null), 4000);
        }
      } catch {
        // Backend unreachable — silently continue
      }
    },
    [scaleKey, selectedRoot, selectedScale, toggleLearnedScale, addXP],
  );

  // Wire fretboard clicks to advance the sequence
  useEffect(() => {
    if (!isActive || exerciseType !== 'sequence' || !lastClickedNote) return;

    const positionInScale = sequenceIndex % scaleNotes.length;
    const targetNote = scaleNotes[positionInScale];

    if (lastClickedNote === targetNote) {
      const nextIndex = sequenceIndex + 1;
      setSequenceIndex(nextIndex);
      setScore(prev => prev + 1);
      setTotalQuestions(prev => prev + 1);

      // Check if a full scale run was just completed
      if (positionInScale === scaleNotes.length - 1) {
        sequenceRunsRef.current += 1;
        // Report a correct attempt to the backend using current metronome BPM
        void reportScaleAttempt(true, metronome.bpm);
      }

      setLastClickedNote(null);
    } else if (lastClickedNote !== null) {
      setTotalQuestions(prev => prev + 1);
      setLastClickedNote(null);
      // A wrong note resets the consecutive-correct count for mastery
      void reportScaleAttempt(false, metronome.bpm);
    }
  }, [
    lastClickedNote,
    isActive,
    exerciseType,
    scaleNotes,
    sequenceIndex,
    setLastClickedNote,
    reportScaleAttempt,
    metronome.bpm,
  ]);

  // Start practice session
  const startPractice = useCallback(async () => {
    setIsActive(true);
    setScore(0);
    setTotalQuestions(0);
    setFeedback(null);
    setSequenceIndex(0);
    setConsecutiveCorrect(0);
    setJustLearnedMessage(null);
    sequenceRunsRef.current = 0;
    setPracticeStartTime(Date.now());

    // Start a backend session (fire-and-forget; never blocks UI)
    try {
      const session = await startSession([scaleKey], metronome.bpm);
      backendSessionRef.current = session;
    } catch {
      backendSessionRef.current = null;
    }

    if (exerciseType !== 'sequence') {
      setCurrentQuestion(generateQuestion());
    }
  }, [exerciseType, generateQuestion, scaleKey, metronome.bpm]);

  // End practice session
  const endPractice = useCallback(async () => {
    setIsActive(false);
    setCurrentQuestion(null);

    // Calculate practice time and award XP
    if (practiceStartTime) {
      const practiceMinutes = Math.floor((Date.now() - practiceStartTime) / 60000);
      if (practiceMinutes > 0) {
        addPracticeMinutes(practiceMinutes);
      }
    }

    // Award XP based on performance
    const accuracy = totalQuestions > 0 ? score / totalQuestions : 0;
    if (totalQuestions > 0) {
      const xpEarned = Math.floor(score * 5 + accuracy * 20);
      addXP(xpEarned);
    }

    // End the backend session
    if (backendSessionRef.current) {
      try {
        await endSession(backendSessionRef.current.id, accuracy || undefined);
      } catch {
        // Silently ignore
      }
      backendSessionRef.current = null;
    }
  }, [practiceStartTime, totalQuestions, score, addPracticeMinutes, addXP]);

  // Handle answer selection
  const handleAnswer = useCallback((answer: string) => {
    if (!currentQuestion) return;

    setTotalQuestions(prev => prev + 1);

    if (answer === currentQuestion.correctAnswer) {
      setFeedback('correct');
      setScore(prev => prev + 1);
      if (currentQuestion.type === 'interval') {
        // targetNote is "A → C" — play first note then second note after 400ms
        const parts = currentQuestion.targetNote.split(' → ');
        audioEngine.playNote(parts[0], 4);
        setTimeout(() => audioEngine.playNote(parts[1], 4), 400);
      } else {
        audioEngine.playNote(currentQuestion.targetNote, 4);
      }
    } else {
      setFeedback('wrong');
    }

    // Show feedback briefly, then next question
    setTimeout(() => {
      setFeedback(null);
      setCurrentQuestion(generateQuestion());
    }, 1000);
  }, [currentQuestion, generateQuestion]);

  if (!scale) {
    return (
      <div className="p-4 bg-[var(--surface)] rounded-lg text-center text-[var(--text-muted)]">
        Select a scale to start practice mode
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--text)]">Practice Mode</h3>
        {isActive && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)]">
              Score: {score}/{totalQuestions}
            </span>
            <button
              onClick={endPractice}
              className="px-3 py-1 text-xs bg-[var(--secondary)] text-[var(--bg)] rounded"
            >
              End
            </button>
          </div>
        )}
      </div>

      {!isActive ? (
        <div className="space-y-4">
          {/* Exercise Type Selection */}
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-2 block">Exercise Type</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'note_id', label: 'Note ID', icon: '🎵' },
                { id: 'sequence', label: 'Sequence', icon: '📝' },
                { id: 'intervals', label: 'Intervals', icon: '↔️' },
              ] as const).map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setExerciseType(ex.id)}
                  className={`p-3 rounded-lg text-center transition-all ${
                    exerciseType === ex.id
                      ? 'bg-[var(--primary)] text-[var(--bg)]'
                      : 'bg-[var(--button)] text-[var(--text)] hover:bg-[var(--button-hover)]'
                  }`}
                >
                  <div className="text-xl mb-1">{ex.icon}</div>
                  <div className="text-xs font-medium">{ex.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Selection */}
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-2 block">Difficulty</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded text-xs font-medium capitalize transition-all ${
                    difficulty === d
                      ? 'bg-[var(--primary)] text-[var(--bg)]'
                      : 'bg-[var(--button)] text-[var(--text-muted)] hover:bg-[var(--button-hover)]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise Descriptions */}
          <div className="p-3 bg-[var(--bg)] rounded-lg">
            <div className="text-xs text-[var(--text-muted)]">
              {exerciseType === 'note_id' && (
                <>
                  <strong>Note Identification:</strong> A fret position will be highlighted.
                  Identify which note it is.
                </>
              )}
              {exerciseType === 'sequence' && (
                <>
                  <strong>Sequence Practice:</strong> Play the scale notes in order on the fretboard.
                  Start from the root and follow the sequence.
                </>
              )}
              {exerciseType === 'intervals' && (
                <>
                  <strong>Interval Training:</strong> Two notes will be played.
                  Identify the interval between them.
                </>
              )}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={startPractice}
            className="w-full py-3 bg-[var(--primary)] text-[var(--bg)] rounded-lg font-medium
                       hover:opacity-90 transition-opacity"
          >
            Start Practice
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quiz Mode */}
          {exerciseType !== 'sequence' && currentQuestion && (
            <div className="space-y-4">
              {/* Question */}
              <div className="p-4 bg-[var(--bg)] rounded-lg text-center">
                {exerciseType === 'note_id' && (
                  <>
                    <div className="text-xs text-[var(--text-muted)] mb-2">
                      What note is at fret {currentQuestion.targetFret} on string{' '}
                      {ALL_NOTES[currentTuning.notes[currentQuestion.targetString]]}?
                    </div>
                    <div className="text-3xl font-bold text-[var(--primary)] mb-2">
                      Fret {currentQuestion.targetFret}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      String: {ALL_NOTES[currentTuning.notes[currentQuestion.targetString]]}
                    </div>
                  </>
                )}
                {exerciseType === 'intervals' && (
                  <>
                    <div className="text-xs text-[var(--text-muted)] mb-2">
                      What is the interval between these notes?
                    </div>
                    <div className="text-2xl font-bold text-[var(--primary)]">
                      {currentQuestion.targetNote}
                    </div>
                  </>
                )}
              </div>

              {/* Answer Options */}
              <div className="grid grid-cols-2 gap-2">
                {currentQuestion.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(option)}
                    disabled={feedback !== null}
                    className={`py-3 rounded-lg font-medium transition-all ${
                      feedback !== null
                        ? option === currentQuestion.correctAnswer
                          ? 'bg-green-500 text-white'
                          : 'bg-[var(--button)] text-[var(--text-muted)]'
                        : 'bg-[var(--button)] text-[var(--text)] hover:bg-[var(--button-hover)]'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {/* Feedback */}
              {feedback && (
                <div
                  className={`p-3 rounded-lg text-center font-medium ${
                    feedback === 'correct'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {feedback === 'correct' ? '✓ Correct!' : `✗ Wrong! It was ${currentQuestion.correctAnswer}`}
                </div>
              )}
            </div>
          )}

          {/* Sequence Mode */}
          {exerciseType === 'sequence' && (
            <div className="space-y-4">
              {/* Just-learned celebration */}
              {justLearnedMessage && (
                <div className="p-3 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium text-center">
                  🎉 {justLearnedMessage}
                </div>
              )}

              <div className="p-4 bg-[var(--bg)] rounded-lg text-center">
                <div className="text-xs text-[var(--text-muted)] mb-2">
                  Play the next note in the sequence:
                </div>
                <div className="text-3xl font-bold text-[var(--primary)]">
                  {scaleNotes[sequenceIndex % scaleNotes.length]}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-2">
                  Note {(sequenceIndex % scaleNotes.length) + 1} of {scaleNotes.length}
                </div>
              </div>

              {/* Scale sequence display */}
              <div className="flex gap-1 justify-center flex-wrap">
                {scaleNotes.map((note, i) => (
                  <span
                    key={i}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      i === sequenceIndex % scaleNotes.length
                        ? 'bg-[var(--primary)] text-[var(--bg)]'
                        : i < sequenceIndex % scaleNotes.length
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {note}
                  </span>
                ))}
              </div>

              {/* Scale Mastery Progress */}
              <div className="p-3 bg-[var(--bg)] rounded-lg space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">
                    Mastery: {selectedRoot} {selectedScale}
                  </span>
                  <span className="text-[var(--text)]">
                    {consecutiveCorrect}/3 at {metronome.bpm} BPM
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${
                      consecutiveCorrect >= 3 ? 'bg-green-500' : 'bg-[var(--primary)]'
                    }`}
                    style={{ width: `${Math.min((consecutiveCorrect / 3) * 100, 100)}%` }}
                  />
                </div>
                {metronome.bpm < 120 && (
                  <div className="text-xs text-amber-400">
                    Set metronome to ≥120 BPM to earn mastery
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-[var(--text-muted)]">
                Click the notes on the fretboard above to play the sequence
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
