/** Visual treatment of a fretboard note marker. */
export type NoteVariant = 'root' | 'scale' | 'muted';

/** Drawn diameter in px per variant (kept in step with NoteCircle's size classes). */
export const NOTE_SIZE: Record<NoteVariant, number> = { root: 26, scale: 24, muted: 24 };
