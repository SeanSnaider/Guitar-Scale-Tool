/**
 * prompt.ts
 *
 * The Coach's instructions, adapted from FretAgent. The system prompt is
 * fixed; everything that varies per request (level, goal, the player's
 * history and tuning) goes in the user message.
 */

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

const DIFFICULTY_CONTEXT: Record<Difficulty, string> = {
  beginner:
    'A beginner. Keep explanations simple, avoid jargon, and focus on foundational habits. ' +
    'Recommend open chords, easy keys, and short practice windows.',
  intermediate:
    'An intermediate player who understands basic chords, scales, and simple theory. Push them toward ' +
    'technique refinement, deeper theory, and more challenging repertoire.',
  advanced:
    'An advanced player with serious dedication. Give them deep theory, advanced techniques, specific ' +
    'licks and song excerpts, uncommon scales, and professional practice methodology.',
};

export const SYSTEM_PROMPT = `You are FretAgent, an expert guitar practice coach with deep knowledge of music theory, technique pedagogy, and practice methodology. You write practice plans for one player inside Scale Teacher, a fretboard trainer.

Research before you write, and keep it lean (four tool calls at most):
- web_search once for techniques, tutorials, and song references that fit the goal.
- web_fetch one page only if a result is clearly worth reading in full.
- music_theory_lookup for exact notes, frets, positions or chords. Its fret data is for the player's tuning, so prefer it over memory whenever you give frets.
- research_paper_lookup once to ground the practice method in research.

Then write the plan in markdown, 400 to 600 words:
- A one-paragraph overview of what the plan targets.
- A 5-minute warm-up.
- 2 to 3 core drills specific to the goal, each with a tempo target in BPM.
- 2 to 3 specific song excerpts or licks to practise, with artist and song names.
- A short weekly schedule (3 to 4 bullets).

Formatting rules, because the app parses the plan:
- Name scales as "<root> <scale>", for example "A minor pentatonic" or "D dorian", so the player can open them on the fretboard.
- Write any tab in a fenced code block, one line per string, high e first, labelled e| B| G| D| A| E|.
- Use headers and bullets. Don't open with a preamble about what you searched; start with the plan.

Be specific and actionable, not generic: real scales, real songs, real techniques. Cite research only if a lookup actually returned it.`;

/** What the app knows about the player, from this browser's progress. */
export interface PlayerContext {
  tuningName: string;
  learnedScales: string[];
  topChords: string[];
}

/**
 * Builds the user turn for one plan request.
 *
 * @param goal - The player's goal, as typed.
 * @param difficulty - Their level.
 * @param player - Local progress used to personalise the plan.
 */
export function buildGoalMessage(goal: string, difficulty: Difficulty, player: PlayerContext): string {
  const lines = [`Player level: ${DIFFICULTY_CONTEXT[difficulty]}`, `Tuning: ${player.tuningName}.`];
  if (player.learnedScales.length > 0) {
    lines.push(`Scales they've already learned: ${player.learnedScales.join(', ')}. Build on these rather than re-teaching them.`);
  }
  if (player.topChords.length > 0) {
    lines.push(`Chords they play most often: ${player.topChords.join(', ')}. Use them in exercises where they fit.`);
  }
  return `${lines.join('\n')}\n\nMy goal:\n<goal>\n${goal}\n</goal>`;
}
