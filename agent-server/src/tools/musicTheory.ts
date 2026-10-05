/**
 * Music theory lookup tool endpoint.
 *
 * Exposes POST /api/tools/music-theory for the Subconscious agent to call.
 * Computes scale notes, chord progressions, interval data, and fretboard
 * positions entirely from lookup tables — no external API required.
 *
 * Spelling model: every scale and chord is described by DEGREE NAMES
 * ("1", "b3", "#4", "bb7" …). A degree's number fixes the letter (number − 1
 * letter steps above the root letter) and its major-scale semitone offset
 * plus accidentals fixes the pitch, so notes come out spelled the way a
 * musician would write them (Bb major = Bb C D Eb F G A, never A# … D#).
 * Fretboard matching compares pitch classes, so enharmonic spelling never
 * affects positions.
 *
 * Response field names are part of the tool contract with the agent and must
 * stay stable: name, key, type, notes, intervals, positions, all_frets,
 * practice_tip, chords[{degree, chord, quality}], common_progressions[{name, chords}].
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { formatZodError } from "../lib/validation.js";

export const musicTheoryRouter = Router();

// ---------------------------------------------------------------------------
// Core theory data
// ---------------------------------------------------------------------------

/** Natural note letters in scale order. */
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;

/** Pitch class (0–11, C = 0) of each natural letter, parallel to LETTERS. */
const LETTER_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11] as const;

/** Semitones above the root for major-scale degrees 1–7 (index = degree − 1). */
const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

/** Scale formulas as degree names relative to the root. */
const SCALE_DEGREES: Record<string, readonly string[]> = {
  major:            ["1", "2", "3", "4", "5", "6", "7"],
  natural_minor:    ["1", "2", "b3", "4", "5", "b6", "b7"],
  minor_pentatonic: ["1", "b3", "4", "5", "b7"],
  major_pentatonic: ["1", "2", "3", "5", "6"],
  dorian:           ["1", "2", "b3", "4", "5", "6", "b7"],
  mixolydian:       ["1", "2", "3", "4", "5", "6", "b7"],
  phrygian:         ["1", "b2", "b3", "4", "5", "b6", "b7"],
  lydian:           ["1", "2", "3", "#4", "5", "6", "7"],
  harmonic_minor:   ["1", "2", "b3", "4", "5", "b6", "7"],
  melodic_minor:    ["1", "2", "b3", "4", "5", "6", "7"],
  blues:            ["1", "b3", "4", "b5", "5", "b7"],
  whole_tone:       ["1", "2", "3", "#4", "#5", "b7"],
  diminished:       ["1", "2", "b3", "4", "b5", "b6", "6", "7"],
};

/**
 * Seven-note parent scale used for chord_progression on gapped scales.
 * Scales absent here must themselves have seven notes.
 */
const PROGRESSION_PARENT_SCALE: Record<string, string> = {
  minor_pentatonic: "natural_minor",
  blues: "natural_minor",
  major_pentatonic: "major",
};

/** Chord formulas as degree names, keyed by chord-symbol suffix. */
const CHORD_DEGREES: Record<string, readonly string[]> = {
  "":   ["1", "3", "5"],
  m:    ["1", "b3", "5"],
  maj7: ["1", "3", "5", "7"],
  m7:   ["1", "b3", "5", "b7"],
  "7":  ["1", "3", "5", "b7"],
  dim:  ["1", "b3", "b5"],
  aug:  ["1", "3", "#5"],
  sus2: ["1", "2", "5"],
  sus4: ["1", "4", "5"],
  m7b5: ["1", "b3", "b5", "b7"],
  dim7: ["1", "b3", "b5", "bb7"],
};

/** The 12 chromatic intervals above a root, as degree names (index = semitones). */
const CHROMATIC_DEGREES = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"] as const;

const INTERVAL_NAMES = [
  "Unison", "Minor 2nd", "Major 2nd", "Minor 3rd", "Major 3rd",
  "Perfect 4th", "Tritone", "Perfect 5th", "Minor 6th", "Major 6th",
  "Minor 7th", "Major 7th",
];

/** Triad qualities produced by stacking scale thirds. */
type TriadQuality = "maj" | "min" | "dim" | "aug";

/** Triad quality keyed by "lowerThirdSemitones,upperThirdSemitones". */
const TRIAD_QUALITY_BY_THIRDS: Record<string, TriadQuality> = {
  "4,3": "maj",
  "3,4": "min",
  "3,3": "dim",
  "4,4": "aug",
};

/** Chord-symbol suffix for each triad quality. */
const TRIAD_SUFFIX: Record<TriadQuality, string> = { maj: "", min: "m", dim: "dim", aug: "aug" };

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;

/** Common progressions, as zero-based scale-degree indices. */
const COMMON_PROGRESSION_DEGREES: readonly (readonly number[])[] = [
  [0, 3, 4, 0],
  [0, 4, 5, 3],
  [1, 4, 0],
];

/** Standard guitar tuning (low → high), open-string pitch classes: E A D G B E. */
const STANDARD_TUNING_PITCH_CLASSES = [4, 9, 2, 7, 11, 4] as const;
const STRING_NAMES = ["E_low", "A", "D", "G", "B", "E_high"];

// ---------------------------------------------------------------------------
// Note spelling
// ---------------------------------------------------------------------------

/** A spelled note: a letter plus a signed accidental count (+1 = #, −1 = b). */
interface SpelledNote {
  letterIndex: number;
  accidental: number;
}

/**
 * Non-negative modulo.
 *
 * @param value - Dividend.
 * @param modulus - Positive divisor.
 * @returns value mod modulus in [0, modulus).
 */
function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/**
 * Count accidentals in a string of #/b symbols (ASCII or unicode ♯/♭).
 *
 * @param symbols - Accidental characters only, e.g. "##", "b", "♭".
 * @returns Signed accidental count.
 */
function countAccidentals(symbols: string): number {
  let total = 0;
  for (const ch of symbols) total += ch === "#" || ch === "♯" ? 1 : -1;
  return total;
}

/**
 * Parse a note name case-insensitively: a letter A–G followed by up to two
 * sharps or flats (#, b, ♯, ♭). E.g. "bb" → Bb, "f#" → F#, "E#" → E#.
 *
 * @param raw - Note name from the request.
 * @returns The spelled note.
 * @throws {Error} If raw is not a recognisable note name.
 */
export function parseNote(raw: string): SpelledNote {
  const match = raw.trim().match(/^([A-Ga-g])([#♯]{1,2}|[b♭]{1,2})?$/u);
  if (!match) throw new Error(`Unknown key: ${raw}`);
  return {
    letterIndex: LETTERS.indexOf(match[1].toUpperCase() as (typeof LETTERS)[number]),
    accidental: countAccidentals(match[2] ?? ""),
  };
}

/**
 * Format a spelled note, e.g. { B, −1 } → "Bb", { F, +2 } → "F##".
 *
 * @param note - Spelled note.
 * @returns Display string using ASCII # and b.
 */
export function formatNote(note: SpelledNote): string {
  const symbol = note.accidental > 0 ? "#" : "b";
  return LETTERS[note.letterIndex] + symbol.repeat(Math.abs(note.accidental));
}

/**
 * Pitch class of a spelled note.
 *
 * @param note - Spelled note.
 * @returns Integer 0–11 with C = 0.
 */
function pitchClass(note: SpelledNote): number {
  return mod(LETTER_PITCH_CLASSES[note.letterIndex] + note.accidental, 12);
}

/**
 * Parse a degree name such as "b3", "#4" or "bb7".
 *
 * @param degree - Degree name (accidentals then a number 1–7).
 * @returns Degree number and signed accidental.
 * @throws {Error} If the degree name is malformed (a programming error in the tables).
 */
function parseDegree(degree: string): { number: number; accidental: number } {
  const match = degree.match(/^(#{1,2}|b{1,2})?([1-7])$/);
  if (!match) throw new Error(`Invalid degree name: ${degree}`);
  return { number: Number(match[2]), accidental: countAccidentals(match[1] ?? "") };
}

/**
 * Spell the note at a given degree above a root.
 *
 * The degree number selects the letter (number − 1 steps above the root
 * letter); the accidental is whatever makes that letter hit the target pitch.
 *
 * @param root - Root note.
 * @param degree - Degree name, e.g. "b3".
 * @returns The spelled note.
 */
function spellDegree(root: SpelledNote, degree: string): SpelledNote {
  const { number, accidental } = parseDegree(degree);
  const letterSteps = number - 1;
  const letterIndex = (root.letterIndex + letterSteps) % LETTERS.length;
  const targetPitch = mod(pitchClass(root) + MAJOR_SCALE_SEMITONES[letterSteps] + accidental, 12);
  const offset = mod(targetPitch - LETTER_PITCH_CLASSES[letterIndex] + 6, 12) - 6;
  return { letterIndex, accidental: offset };
}

/**
 * Look up a scale's degree names.
 *
 * @param scale - Scale type key from SCALE_DEGREES.
 * @returns Degree names for the scale.
 * @throws {Error} If the scale is unknown.
 */
function getScaleDegrees(scale: string): readonly string[] {
  const degrees = SCALE_DEGREES[scale];
  if (!degrees) throw new Error(`Unknown scale: ${scale}`);
  return degrees;
}

// ---------------------------------------------------------------------------
// Fretboard helpers
// ---------------------------------------------------------------------------

/**
 * Compute fretboard positions (frets 0–12) on each string for the given pitch classes.
 *
 * @param pitchClasses - Set of pitch classes (0–11) in the scale.
 * @returns Map from string name to array of matching fret numbers.
 */
function fretboardPositions(pitchClasses: Set<number>): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  STANDARD_TUNING_PITCH_CLASSES.forEach((openPitch, stringIdx) => {
    const frets: number[] = [];
    for (let fret = 0; fret <= 12; fret++) {
      if (pitchClasses.has((openPitch + fret) % 12)) frets.push(fret);
    }
    result[STRING_NAMES[stringIdx]] = frets;
  });
  return result;
}

/**
 * Return scale notes within a fret window starting at boxStart.
 *
 * @param allFrets - Full fretboard positions map.
 * @param boxStart - Lowest fret of the box.
 * @param span - Width of the box in frets (inclusive).
 * @returns Filtered fretboard positions within the box.
 */
function boxPosition(
  allFrets: Record<string, number[]>,
  boxStart: number,
  span = 4,
): Record<string, number[]> {
  const box: Record<string, number[]> = {};
  for (const [str, frets] of Object.entries(allFrets)) {
    box[str] = frets.filter((f) => f >= boxStart && f <= boxStart + span);
  }
  return box;
}

// ---------------------------------------------------------------------------
// Diatonic triads
// ---------------------------------------------------------------------------

/** One diatonic chord in a chord_progression response. */
interface DiatonicChord {
  degree: string;
  chord: string;
  quality: TriadQuality;
}

/**
 * Resolve the seven-note scale used to harmonise `scale`.
 *
 * @param scale - Requested scale type.
 * @returns Seven degree names.
 * @throws {Error} If the scale is unknown or has no seven-note parent.
 */
function heptatonicDegreesFor(scale: string): readonly string[] {
  getScaleDegrees(scale); // reject unknown scales before consulting the parent map
  const degrees = getScaleDegrees(PROGRESSION_PARENT_SCALE[scale] ?? scale);
  if (degrees.length !== 7) {
    throw new Error(
      `chord_progression requires a seven-note scale; "${scale}" has ${degrees.length} notes`,
    );
  }
  return degrees;
}

/**
 * Roman numeral for a triad: uppercase for maj/aug, lowercase for min/dim,
 * with "°" for diminished and "+" for augmented.
 *
 * @param index - Zero-based scale degree.
 * @param quality - Triad quality.
 * @returns Numeral such as "ii°" or "III+".
 */
function romanNumeral(index: number, quality: TriadQuality): string {
  const base = ROMAN_NUMERALS[index];
  switch (quality) {
    case "maj": return base;
    case "aug": return `${base}+`;
    case "min": return base.toLowerCase();
    case "dim": return `${base.toLowerCase()}°`;
  }
}

/**
 * Build the triad on each degree by stacking scale thirds (degrees i, i+2, i+4).
 *
 * @param scaleNotes - Seven spelled scale notes.
 * @returns The seven diatonic triads.
 * @throws {Error} If a stacked triad is not maj/min/dim/aug.
 */
function diatonicTriads(scaleNotes: SpelledNote[]): DiatonicChord[] {
  return scaleNotes.map((root, i) => {
    const [r, third, fifth] = [0, 2, 4].map((step) => pitchClass(scaleNotes[(i + step) % 7]));
    const thirds = `${mod(third - r, 12)},${mod(fifth - third, 12)}`;
    const quality = TRIAD_QUALITY_BY_THIRDS[thirds];
    if (!quality) throw new Error(`Unsupported triad interval structure ${thirds}`);
    return {
      degree: romanNumeral(i, quality),
      chord: formatNote(root) + TRIAD_SUFFIX[quality],
      quality,
    };
  });
}

// ---------------------------------------------------------------------------
// Query handlers
// ---------------------------------------------------------------------------

/**
 * Handle scale_info queries — returns notes, intervals, box positions.
 *
 * @param key - Root note (e.g. "A", "bb", "F♯").
 * @param scale - Scale type key from SCALE_DEGREES.
 */
function handleScaleInfo(key: string, scale: string) {
  const degrees = getScaleDegrees(scale);
  const root = parseNote(key);
  const displayKey = formatNote(root);

  const spelled = degrees.map((degree) => spellDegree(root, degree));
  const allFrets = fretboardPositions(new Set(spelled.map(pitchClass)));

  const lowestFret = Math.min(
    ...Object.values(allFrets)
      .flat()
      .filter((f) => f > 0),
  );
  const box1 = boxPosition(allFrets, lowestFret, 4);
  const box2 = boxPosition(allFrets, lowestFret + 3, 4);

  return {
    name: `${displayKey} ${scale.replace(/_/g, " ")}`,
    key: displayKey,
    type: scale,
    notes: spelled.map(formatNote),
    intervals: [...degrees],
    positions: [
      { name: "Position 1 (Box 1)", frets: box1 },
      { name: "Position 2 (Box 2)", frets: box2 },
    ],
    all_frets: allFrets,
    practice_tip: `Start with Position 1 at fret ${lowestFret}. Learn the pattern in one position before connecting them.`,
  };
}

/**
 * Handle chord_progression queries — returns diatonic chords and common progressions.
 * Chord qualities are computed from the scale itself, so modes and the
 * harmonic/melodic minors get their real triads. Pentatonic and blues
 * scales are harmonised with their seven-note parent scale.
 *
 * @param key - Root note.
 * @param scale - Scale type (determines chord qualities).
 * @throws {Error} For unknown scales, or six/eight-note scales with no parent.
 */
function handleChordProgression(key: string, scale: string) {
  const degrees = heptatonicDegreesFor(scale);
  const root = parseNote(key);
  const chords = diatonicTriads(degrees.map((degree) => spellDegree(root, degree)));

  return {
    key: formatNote(root),
    scale,
    chords,
    common_progressions: COMMON_PROGRESSION_DEGREES.map((indices) => ({
      name: indices.map((i) => chords[i].degree).join("–"),
      chords: indices.map((i) => chords[i].chord),
    })),
  };
}

/**
 * Handle intervals queries — returns all 12 intervals from the given root,
 * with each note spelled for its interval (b3 above Bb is Db, not C#).
 *
 * @param key - Root note.
 */
function handleIntervals(key: string) {
  const root = parseNote(key);

  return {
    key: formatNote(root),
    intervals: INTERVAL_NAMES.map((name, semitones) => ({
      semitones,
      name,
      shorthand: CHROMATIC_DEGREES[semitones],
      note: formatNote(spellDegree(root, CHROMATIC_DEGREES[semitones])),
    })),
  };
}

/**
 * Handle chord_info queries — returns notes and intervals for a named chord.
 *
 * @param chord - Chord symbol (e.g. "Am7", "Cmaj7", "Bbm7b5", "e#").
 * @throws {Error} If the chord symbol cannot be parsed.
 */
function handleChordInfo(chord: string) {
  const match = chord
    .trim()
    .match(/^([A-Ga-g](?:[#♯]{1,2}|[b♭]{1,2})?)(maj7|m7b5|m7|dim7|dim|aug|sus2|sus4|m|7)?$/u);
  if (!match) throw new Error(`Cannot parse chord: ${chord}`);

  const root = parseNote(match[1]);
  const quality = match[2] ?? "";
  const degrees = CHORD_DEGREES[quality];
  const displayRoot = formatNote(root);

  return {
    chord: displayRoot + quality,
    root: displayRoot,
    quality: quality || "major",
    notes: degrees.map((degree) => formatNote(spellDegree(root, degree))),
    intervals: [...degrees],
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/** Schema for the tool request body (optionally wrapped in `parameters`). */
const musicTheoryRequestSchema = z.object({
  query_type: z.string({ required_error: "is required", invalid_type_error: "must be a string" }),
  key: z.string({ invalid_type_error: "must be a string" }).default("C"),
  scale: z.string({ invalid_type_error: "must be a string" }).default("major"),
  chord: z.string({ invalid_type_error: "must be a string" }).optional(),
});

musicTheoryRouter.post("/music-theory", (req: Request, res: Response) => {
  const body: unknown = req.body?.parameters ?? req.body ?? {};
  const parsed = musicTheoryRequestSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }
  const { query_type, key, scale, chord } = parsed.data;

  try {
    let result: unknown;

    switch (query_type) {
      case "scale_info":
        result = handleScaleInfo(key, scale);
        break;
      case "chord_progression":
        result = handleChordProgression(key, scale);
        break;
      case "intervals":
        result = handleIntervals(key);
        break;
      case "chord_info":
        result = handleChordInfo(chord ?? key);
        break;
      default:
        res.status(400).json({ error: `Unknown query_type: ${query_type}` });
        return;
    }

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});
