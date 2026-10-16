/**
 * planParser.ts
 *
 * Finds scale mentions and guitar tab in a Coach plan, ported from
 * FretAgent's musicParser. Mentions map to the app's SCALES keys so each one
 * can open straight onto the fretboard instead of a separate diagram.
 */

import { SCALES, spellScale, toSharpName } from '../data/musicTheory';

/** Free-text scale phrases, mapped to SCALES keys. */
const SCALE_PHRASES: Readonly<Record<string, string>> = {
  'major pentatonic': 'major_pentatonic',
  'minor pentatonic': 'minor_pentatonic',
  'pentatonic major': 'major_pentatonic',
  'pentatonic minor': 'minor_pentatonic',
  'natural minor': 'minor',
  'harmonic minor': 'harmonic_minor',
  'melodic minor': 'melodic_minor',
  'phrygian dominant': 'phrygian_dominant',
  'lydian dominant': 'lydian_dominant',
  'whole tone': 'whole_tone',
  'major blues': 'major_blues',
  'major scale': 'major',
  'minor scale': 'minor',
  'blues scale': 'blues',
  blues: 'blues',
  major: 'major',
  minor: 'minor',
  ionian: 'ionian',
  dorian: 'dorian',
  phrygian: 'phrygian',
  lydian: 'lydian',
  mixolydian: 'mixolydian',
  aeolian: 'aeolian',
  locrian: 'locrian',
};

/** One scale the plan names, resolved to the app's registry. */
export interface ScaleMention {
  /** Root as the theory functions expect it (sharp names). */
  root: string;
  scaleKey: string;
  /** "A Minor Pentatonic", spelled for the key ("Bb Major (Ionian)"). */
  label: string;
}

/** Most mentions surfaced, so a long plan doesn't bury the page in buttons. */
const MAX_MENTIONS = 6;

const PHRASE_PATTERN = Object.keys(SCALE_PHRASES)
  .sort((a, b) => b.length - a.length) // longest first, so "minor pentatonic" beats "minor"
  .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

/**
 * "A minor pentatonic", "G Dorian mode", "E blues scale". The lookahead skips
 * "A minor chord", which names a chord, not a scale.
 */
const MENTION = new RegExp(
  `\\b([A-G][#b]?)\\s+(${PHRASE_PATTERN})(?:\\s+(?:scale|mode|position|box))?\\b(?!\\s+(?:chords?|triads?|arpeggios?)\\b)`,
  'gi',
);

/**
 * Deduplicated scale mentions in plan markdown, in order of appearance.
 *
 * @param text - Plan markdown.
 */
export function parseScaleMentions(text: string): ScaleMention[] {
  const seen = new Set<string>();
  const out: ScaleMention[] = [];
  for (const m of text.matchAll(MENTION)) {
    // The note letter must be a capital: "a minor" in prose is an article
    if (m[1][0] !== m[1][0].toUpperCase()) continue;
    const scaleKey = SCALE_PHRASES[m[2].toLowerCase()];
    if (!scaleKey || !SCALES[scaleKey]) continue;
    const root = toSharpName(m[1]);
    const id = `${root}:${scaleKey}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ root, scaleKey, label: `${spellScale(root, scaleKey)[0] ?? root} ${SCALES[scaleKey].name}` });
    if (out.length >= MAX_MENTIONS) break;
  }
  return out;
}

/** A tab line: a string label then | or :, e.g. "e|--0--2--". */
const TAB_LINE = /^\s*([eEBGDAb])\s*[|:](.*)$/;

/**
 * Whether a code block is ASCII guitar tab (at least three labelled strings).
 *
 * @param content - Raw code block text.
 */
export function isGuitarTab(content: string): boolean {
  return content.trim().split('\n').filter((l) => TAB_LINE.test(l)).length >= 3;
}

/**
 * Splits tab into labelled string lines; null if it isn't tab.
 *
 * @param content - Raw code block text.
 */
export function parseTabLines(content: string): Array<{ string: string; frets: string }> | null {
  const lines = content
    .trim()
    .split('\n')
    .map((l) => TAB_LINE.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ string: m[1], frets: m[2] }));
  return lines.length >= 3 ? lines : null;
}
