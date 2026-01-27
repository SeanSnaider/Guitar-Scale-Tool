// All 12 notes in chromatic order (using sharps)
export const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type NoteName = typeof ALL_NOTES[number];

// Enharmonic equivalents (C# = Db, etc.)
export const ENHARMONIC_MAP: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
};

// Flat to sharp mapping
export const FLAT_TO_SHARP: Record<string, string> = {
  'Db': 'C#',
  'Eb': 'D#',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#',
};

export interface Scale {
  name: string;
  intervals: number[];
  degrees: string[];
  category: ScaleCategory;
  description?: string;
  relatedScales?: string[]; // Keys of related scales
}

export type ScaleCategory =
  | 'major'
  | 'minor'
  | 'pentatonic'
  | 'modes'
  | 'harmonic'
  | 'melodic'
  | 'blues'
  | 'exotic'
  | 'jazz'
  | 'custom';

export interface ScaleMap {
  [key: string]: Scale;
}

export const SCALE_CATEGORIES: { id: ScaleCategory; name: string; description: string }[] = [
  { id: 'major', name: 'Major', description: 'Bright, happy scales' },
  { id: 'minor', name: 'Minor', description: 'Dark, melancholic scales' },
  { id: 'pentatonic', name: 'Pentatonic', description: '5-note scales, common in rock & blues' },
  { id: 'modes', name: 'Modes', description: 'The 7 Greek modes' },
  { id: 'harmonic', name: 'Harmonic', description: 'Harmonic minor and its modes' },
  { id: 'melodic', name: 'Melodic', description: 'Melodic minor and its modes' },
  { id: 'blues', name: 'Blues', description: 'Blues scales and variations' },
  { id: 'exotic', name: 'Exotic', description: 'World music scales' },
  { id: 'jazz', name: 'Jazz', description: 'Common jazz scales' },
  { id: 'custom', name: 'Custom', description: 'Your custom scales' },
];

export const SCALES: ScaleMap = {
  'major': {
    name: 'Major (Ionian)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ['1', '2', '3', '4', '5', '6', '7'],
    category: 'major',
    description: 'The foundation of Western music - bright and happy',
    relatedScales: ['minor', 'major_pentatonic'],
  },

  'minor': {
    name: 'Natural Minor (Aeolian)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
    category: 'minor',
    description: 'The relative minor of major - sad and introspective',
    relatedScales: ['harmonic_minor', 'melodic_minor', 'minor_pentatonic'],
  },
  'harmonic_minor': {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', '7'],
    category: 'harmonic',
    description: 'Natural minor with raised 7th - exotic, Middle Eastern flavor',
    relatedScales: ['minor', 'phrygian_dominant'],
  },
  'melodic_minor': {
    name: 'Melodic Minor',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    degrees: ['1', '2', 'b3', '4', '5', '6', '7'],
    category: 'melodic',
    description: 'Natural minor with raised 6th and 7th - jazzy and sophisticated',
    relatedScales: ['minor', 'lydian_dominant'],
  },

  'major_pentatonic': {
    name: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    degrees: ['1', '2', '3', '5', '6'],
    category: 'pentatonic',
    description: '5-note major scale - universally pleasing, very common in rock',
  },
  'minor_pentatonic': {
    name: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10],
    degrees: ['1', 'b3', '4', '5', 'b7'],
    category: 'pentatonic',
    description: 'The "blues box" - essential for rock and blues guitar',
  },

  'ionian': {
    name: 'Ionian',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ['1', '2', '3', '4', '5', '6', '7'],
    category: 'modes',
    description: 'Mode 1 - Same as major scale',
  },
  'dorian': {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'],
    category: 'modes',
    description: 'Mode 2 - Minor with raised 6th, jazzy/funky feel',
  },
  'phrygian': {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    degrees: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
    category: 'modes',
    description: 'Mode 3 - Spanish/Flamenco sound with flat 2nd',
  },
  'lydian': {
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    degrees: ['1', '2', '3', '#4', '5', '6', '7'],
    category: 'modes',
    description: 'Mode 4 - Dreamy, floating quality with raised 4th',
  },
  'mixolydian': {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degrees: ['1', '2', '3', '4', '5', '6', 'b7'],
    category: 'modes',
    description: 'Mode 5 - Dominant scale, great for blues rock',
  },
  'aeolian': {
    name: 'Aeolian',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
    category: 'modes',
    description: 'Mode 6 - Same as natural minor',
  },
  'locrian': {
    name: 'Locrian',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    degrees: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
    category: 'modes',
    description: 'Mode 7 - Diminished feel, unstable and dark',
  },

  'locrian_natural6': {
    name: 'Locrian Natural 6',
    intervals: [0, 1, 3, 5, 6, 9, 10],
    degrees: ['1', 'b2', 'b3', '4', 'b5', '6', 'b7'],
    category: 'harmonic',
    description: 'Mode 2 of Harmonic Minor',
  },
  'ionian_augmented': {
    name: 'Ionian Augmented',
    intervals: [0, 2, 4, 5, 8, 9, 11],
    degrees: ['1', '2', '3', '4', '#5', '6', '7'],
    category: 'harmonic',
    description: 'Mode 3 of Harmonic Minor - major with raised 5th',
  },
  'dorian_sharp4': {
    name: 'Dorian #4',
    intervals: [0, 2, 3, 6, 7, 9, 10],
    degrees: ['1', '2', 'b3', '#4', '5', '6', 'b7'],
    category: 'harmonic',
    description: 'Mode 4 of Harmonic Minor - Romanian scale',
  },
  'phrygian_dominant': {
    name: 'Phrygian Dominant',
    intervals: [0, 1, 4, 5, 7, 8, 10],
    degrees: ['1', 'b2', '3', '4', '5', 'b6', 'b7'],
    category: 'harmonic',
    description: 'Mode 5 of Harmonic Minor - Spanish/Middle Eastern',
  },
  'lydian_sharp2': {
    name: 'Lydian #2',
    intervals: [0, 3, 4, 6, 7, 9, 11],
    degrees: ['1', '#2', '3', '#4', '5', '6', '7'],
    category: 'harmonic',
    description: 'Mode 6 of Harmonic Minor',
  },
  'super_locrian_bb7': {
    name: 'Super Locrian bb7',
    intervals: [0, 1, 3, 4, 6, 8, 9],
    degrees: ['1', 'b2', 'b3', 'b4', 'b5', 'b6', 'bb7'],
    category: 'harmonic',
    description: 'Mode 7 of Harmonic Minor - ultralocrian',
  },

  'dorian_b2': {
    name: 'Dorian b2 (Phrygian #6)',
    intervals: [0, 1, 3, 5, 7, 9, 10],
    degrees: ['1', 'b2', 'b3', '4', '5', '6', 'b7'],
    category: 'melodic',
    description: 'Mode 2 of Melodic Minor',
  },
  'lydian_augmented': {
    name: 'Lydian Augmented',
    intervals: [0, 2, 4, 6, 8, 9, 11],
    degrees: ['1', '2', '3', '#4', '#5', '6', '7'],
    category: 'melodic',
    description: 'Mode 3 of Melodic Minor - bright and tense',
  },
  'lydian_dominant': {
    name: 'Lydian Dominant',
    intervals: [0, 2, 4, 6, 7, 9, 10],
    degrees: ['1', '2', '3', '#4', '5', '6', 'b7'],
    category: 'melodic',
    description: 'Mode 4 of Melodic Minor - overtone scale',
  },
  'mixolydian_b6': {
    name: 'Mixolydian b6',
    intervals: [0, 2, 4, 5, 7, 8, 10],
    degrees: ['1', '2', '3', '4', '5', 'b6', 'b7'],
    category: 'melodic',
    description: 'Mode 5 of Melodic Minor - Hindu scale',
  },
  'locrian_natural2': {
    name: 'Locrian Natural 2',
    intervals: [0, 2, 3, 5, 6, 8, 10],
    degrees: ['1', '2', 'b3', '4', 'b5', 'b6', 'b7'],
    category: 'melodic',
    description: 'Mode 6 of Melodic Minor - half-diminished scale',
  },
  'super_locrian': {
    name: 'Super Locrian (Altered)',
    intervals: [0, 1, 3, 4, 6, 8, 10],
    degrees: ['1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
    category: 'melodic',
    description: 'Mode 7 of Melodic Minor - altered dominant scale',
  },

  'blues': {
    name: 'Blues Scale',
    intervals: [0, 3, 5, 6, 7, 10],
    degrees: ['1', 'b3', '4', 'b5', '5', 'b7'],
    category: 'blues',
    description: 'Minor pentatonic with added blue note (b5)',
  },
  'major_blues': {
    name: 'Major Blues',
    intervals: [0, 2, 3, 4, 7, 9],
    degrees: ['1', '2', 'b3', '3', '5', '6'],
    category: 'blues',
    description: 'Major pentatonic with added b3 (blue note)',
  },

  'bebop_dominant': {
    name: 'Bebop Dominant',
    intervals: [0, 2, 4, 5, 7, 9, 10, 11],
    degrees: ['1', '2', '3', '4', '5', '6', 'b7', '7'],
    category: 'jazz',
    description: 'Mixolydian with passing tone - essential jazz scale',
  },
  'bebop_major': {
    name: 'Bebop Major',
    intervals: [0, 2, 4, 5, 7, 8, 9, 11],
    degrees: ['1', '2', '3', '4', '5', 'b6', '6', '7'],
    category: 'jazz',
    description: 'Major scale with added b6',
  },
  'bebop_minor': {
    name: 'Bebop Minor',
    intervals: [0, 2, 3, 5, 7, 8, 9, 10],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', '6', 'b7'],
    category: 'jazz',
    description: 'Dorian with added b6',
  },
  'diminished_whole_half': {
    name: 'Diminished (Whole-Half)',
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
    degrees: ['1', '2', 'b3', '4', 'b5', 'b6', '6', '7'],
    category: 'jazz',
    description: 'Symmetric scale - alternating whole/half steps',
  },
  'diminished_half_whole': {
    name: 'Diminished (Half-Whole)',
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    degrees: ['1', 'b2', 'b3', '3', 'b5', '5', '6', 'b7'],
    category: 'jazz',
    description: 'Symmetric scale - alternating half/whole steps',
  },
  'whole_tone': {
    name: 'Whole Tone',
    intervals: [0, 2, 4, 6, 8, 10],
    degrees: ['1', '2', '3', '#4', '#5', 'b7'],
    category: 'jazz',
    description: 'Symmetric scale - all whole steps, dreamy and ambiguous',
  },

  'hungarian_minor': {
    name: 'Hungarian Minor',
    intervals: [0, 2, 3, 6, 7, 8, 11],
    degrees: ['1', '2', 'b3', '#4', '5', 'b6', '7'],
    category: 'exotic',
    description: 'Gypsy scale - dramatic and Eastern European',
  },
  'hungarian_major': {
    name: 'Hungarian Major',
    intervals: [0, 3, 4, 6, 7, 9, 10],
    degrees: ['1', '#2', '3', '#4', '5', '6', 'b7'],
    category: 'exotic',
    description: 'Bright, exotic major variation',
  },
  'double_harmonic': {
    name: 'Double Harmonic (Byzantine)',
    intervals: [0, 1, 4, 5, 7, 8, 11],
    degrees: ['1', 'b2', '3', '4', '5', 'b6', '7'],
    category: 'exotic',
    description: 'Middle Eastern sound - Arabic/Byzantine scale',
  },
  'persian': {
    name: 'Persian',
    intervals: [0, 1, 4, 5, 6, 8, 11],
    degrees: ['1', 'b2', '3', '4', 'b5', 'b6', '7'],
    category: 'exotic',
    description: 'Ancient Persian scale - haunting quality',
  },
  'japanese_hirajoshi': {
    name: 'Hirajoshi',
    intervals: [0, 2, 3, 7, 8],
    degrees: ['1', '2', 'b3', '5', 'b6'],
    category: 'exotic',
    description: 'Japanese pentatonic - melancholic and ethereal',
  },
  'japanese_in': {
    name: 'In Scale',
    intervals: [0, 1, 5, 7, 8],
    degrees: ['1', 'b2', '4', '5', 'b6'],
    category: 'exotic',
    description: 'Japanese Sakura scale - traditional and delicate',
  },
  'japanese_yo': {
    name: 'Yo Scale',
    intervals: [0, 2, 5, 7, 9],
    degrees: ['1', '2', '4', '5', '6'],
    category: 'exotic',
    description: 'Japanese folk scale - bright and pastoral',
  },
  'chinese': {
    name: 'Chinese Scale',
    intervals: [0, 4, 6, 7, 11],
    degrees: ['1', '3', '#4', '5', '7'],
    category: 'exotic',
    description: 'Traditional Chinese pentatonic',
  },
  'egyptian': {
    name: 'Egyptian',
    intervals: [0, 2, 5, 7, 10],
    degrees: ['1', '2', '4', '5', 'b7'],
    category: 'exotic',
    description: 'Suspended pentatonic - ancient mystical quality',
  },
  'balinese': {
    name: 'Balinese',
    intervals: [0, 1, 3, 7, 8],
    degrees: ['1', 'b2', 'b3', '5', 'b6'],
    category: 'exotic',
    description: 'Indonesian gamelan-inspired scale',
  },
  'enigmatic': {
    name: 'Enigmatic',
    intervals: [0, 1, 4, 6, 8, 10, 11],
    degrees: ['1', 'b2', '3', '#4', '#5', 'b7', '7'],
    category: 'exotic',
    description: 'Invented by Verdi - mysterious and chromatic',
  },
  'neapolitan_major': {
    name: 'Neapolitan Major',
    intervals: [0, 1, 3, 5, 7, 9, 11],
    degrees: ['1', 'b2', 'b3', '4', '5', '6', '7'],
    category: 'exotic',
    description: 'Classical Italian scale - romantic and melancholic',
  },
  'neapolitan_minor': {
    name: 'Neapolitan Minor',
    intervals: [0, 1, 3, 5, 7, 8, 11],
    degrees: ['1', 'b2', 'b3', '4', '5', 'b6', '7'],
    category: 'exotic',
    description: 'Harmonic minor with flat 2nd',
  },
  'prometheus': {
    name: 'Prometheus',
    intervals: [0, 2, 4, 6, 9, 10],
    degrees: ['1', '2', '3', '#4', '6', 'b7'],
    category: 'exotic',
    description: 'Scriabin\'s mystic scale - ethereal and modern',
  },
  'arabian': {
    name: 'Arabian',
    intervals: [0, 2, 4, 5, 6, 8, 10],
    degrees: ['1', '2', '3', '4', 'b5', 'b6', 'b7'],
    category: 'exotic',
    description: 'Arabic maqam-inspired scale',
  },
};

export interface TuningDefinition {
  name: string;
  notes: number[]; // Index into ALL_NOTES for each string (low to high)
  strings: number;
  category: 'standard' | 'drop' | 'open' | 'alternate' | 'extended';
}

export const TUNINGS: Record<string, TuningDefinition> = {
  'standard': {
    name: 'Standard',
    notes: [4, 9, 2, 7, 11, 4], // E A D G B E
    strings: 6,
    category: 'standard',
  },
  'drop_d': {
    name: 'Drop D',
    notes: [2, 9, 2, 7, 11, 4], // D A D G B E
    strings: 6,
    category: 'drop',
  },
  'drop_c': {
    name: 'Drop C',
    notes: [0, 7, 0, 5, 9, 2], // C G C F A D
    strings: 6,
    category: 'drop',
  },
  'dadgad': {
    name: 'DADGAD',
    notes: [2, 9, 2, 7, 9, 2], // D A D G A D
    strings: 6,
    category: 'alternate',
  },
  'open_g': {
    name: 'Open G',
    notes: [2, 7, 2, 7, 11, 2], // D G D G B D
    strings: 6,
    category: 'open',
  },
  'open_d': {
    name: 'Open D',
    notes: [2, 9, 2, 6, 9, 2], // D A D F# A D
    strings: 6,
    category: 'open',
  },
  'open_e': {
    name: 'Open E',
    notes: [4, 11, 4, 8, 11, 4], // E B E G# B E
    strings: 6,
    category: 'open',
  },
  'open_a': {
    name: 'Open A',
    notes: [4, 9, 4, 9, 1, 4], // E A E A C# E
    strings: 6,
    category: 'open',
  },
  'half_step_down': {
    name: 'Half Step Down (Eb)',
    notes: [3, 8, 1, 6, 10, 3], // Eb Ab Db Gb Bb Eb
    strings: 6,
    category: 'alternate',
  },
  'whole_step_down': {
    name: 'Whole Step Down (D)',
    notes: [2, 7, 0, 5, 9, 2], // D G C F A D
    strings: 6,
    category: 'alternate',
  },
  'standard_7': {
    name: '7-String Standard',
    notes: [11, 4, 9, 2, 7, 11, 4], // B E A D G B E
    strings: 7,
    category: 'extended',
  },
  'standard_8': {
    name: '8-String Standard',
    notes: [6, 11, 4, 9, 2, 7, 11, 4], // F# B E A D G B E
    strings: 8,
    category: 'extended',
  },
};

// Human-readable string names for display (standard tuning)
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'] as const;
export const STANDARD_TUNING = TUNINGS.standard.notes;

export interface ScalePosition {
  id: number;
  name: string;
  startFret: number;
  endFret: number;
  color: string;
}

// CAGED System (5 positions)
export const CAGED_POSITIONS: ScalePosition[] = [
  { id: 1, name: 'Position 1', startFret: 0, endFret: 4, color: '#9B8ABD' },   // Taro lavender
  { id: 2, name: 'Position 2', startFret: 2, endFret: 6, color: '#7D9B76' },   // Botanical sage
  { id: 3, name: 'Position 3', startFret: 4, endFret: 8, color: '#D4A5A5' },   // Taro pink
  { id: 4, name: 'Position 4', startFret: 7, endFret: 11, color: '#A8C69F' },  // Botanical light
  { id: 5, name: 'Position 5', startFret: 9, endFret: 13, color: '#B8A8D4' },  // Taro light lavender
];

// 3 Notes Per String System (7 positions, one for each mode)
export const THREE_NPS_POSITIONS: ScalePosition[] = [
  { id: 1, name: 'Pattern 1', startFret: 0, endFret: 4, color: '#9B8ABD' },
  { id: 2, name: 'Pattern 2', startFret: 2, endFret: 6, color: '#7D9B76' },
  { id: 3, name: 'Pattern 3', startFret: 4, endFret: 8, color: '#D4A5A5' },
  { id: 4, name: 'Pattern 4', startFret: 5, endFret: 9, color: '#A8C69F' },
  { id: 5, name: 'Pattern 5', startFret: 7, endFret: 11, color: '#B8A8D4' },
  { id: 6, name: 'Pattern 6', startFret: 9, endFret: 13, color: '#8FBC8F' },
  { id: 7, name: 'Pattern 7', startFret: 11, endFret: 15, color: '#DEB887' },
];

export interface ChordDefinition {
  name: string;
  symbol: string;
  intervals: number[];
  quality: 'major' | 'minor' | 'diminished' | 'augmented' | 'dominant' | 'suspended';
}

export const CHORD_TYPES: Record<string, ChordDefinition> = {
  'major': { name: 'Major', symbol: '', intervals: [0, 4, 7], quality: 'major' },
  'minor': { name: 'Minor', symbol: 'm', intervals: [0, 3, 7], quality: 'minor' },
  'diminished': { name: 'Diminished', symbol: 'dim', intervals: [0, 3, 6], quality: 'diminished' },
  'augmented': { name: 'Augmented', symbol: 'aug', intervals: [0, 4, 8], quality: 'augmented' },
  'major7': { name: 'Major 7th', symbol: 'maj7', intervals: [0, 4, 7, 11], quality: 'major' },
  'minor7': { name: 'Minor 7th', symbol: 'm7', intervals: [0, 3, 7, 10], quality: 'minor' },
  'dominant7': { name: 'Dominant 7th', symbol: '7', intervals: [0, 4, 7, 10], quality: 'dominant' },
  'diminished7': { name: 'Diminished 7th', symbol: 'dim7', intervals: [0, 3, 6, 9], quality: 'diminished' },
  'half_diminished': { name: 'Half-Diminished', symbol: 'm7b5', intervals: [0, 3, 6, 10], quality: 'diminished' },
  'minor_major7': { name: 'Minor Major 7th', symbol: 'mMaj7', intervals: [0, 3, 7, 11], quality: 'minor' },
  'sus2': { name: 'Suspended 2nd', symbol: 'sus2', intervals: [0, 2, 7], quality: 'suspended' },
  'sus4': { name: 'Suspended 4th', symbol: 'sus4', intervals: [0, 5, 7], quality: 'suspended' },
  'add9': { name: 'Add 9', symbol: 'add9', intervals: [0, 4, 7, 14], quality: 'major' },
  '6': { name: 'Major 6th', symbol: '6', intervals: [0, 4, 7, 9], quality: 'major' },
  'm6': { name: 'Minor 6th', symbol: 'm6', intervals: [0, 3, 7, 9], quality: 'minor' },
  '9': { name: 'Dominant 9th', symbol: '9', intervals: [0, 4, 7, 10, 14], quality: 'dominant' },
};

// Diatonic chord qualities for major scale (I, ii, iii, IV, V, vi, vii°)
export const DIATONIC_CHORDS_MAJOR = [
  { degree: 'I', type: 'major', seventh: 'major7' },
  { degree: 'ii', type: 'minor', seventh: 'minor7' },
  { degree: 'iii', type: 'minor', seventh: 'minor7' },
  { degree: 'IV', type: 'major', seventh: 'major7' },
  { degree: 'V', type: 'major', seventh: 'dominant7' },
  { degree: 'vi', type: 'minor', seventh: 'minor7' },
  { degree: 'vii°', type: 'diminished', seventh: 'half_diminished' },
];

// Diatonic chord qualities for natural minor (i, ii°, III, iv, v, VI, VII)
export const DIATONIC_CHORDS_MINOR = [
  { degree: 'i', type: 'minor', seventh: 'minor7' },
  { degree: 'ii°', type: 'diminished', seventh: 'half_diminished' },
  { degree: 'III', type: 'major', seventh: 'major7' },
  { degree: 'iv', type: 'minor', seventh: 'minor7' },
  { degree: 'v', type: 'minor', seventh: 'minor7' },
  { degree: 'VI', type: 'major', seventh: 'major7' },
  { degree: 'VII', type: 'major', seventh: 'dominant7' },
];

/**
 * Get the note at a specific fret on a specific string
 */
export function getNoteAtPosition(
  stringIndex: number,
  fret: number,
  tuning: readonly number[] = STANDARD_TUNING
): string {
  const openNoteIndex = tuning[stringIndex];
  const noteIndex = (openNoteIndex + fret) % 12;
  return ALL_NOTES[noteIndex];
}

/**
 * Generate all notes in a scale
 */
export function getScaleNotes(rootNote: string, intervals: number[]): string[] {
  const rootIndex = ALL_NOTES.indexOf(rootNote as NoteName);
  if (rootIndex === -1) return [];

  return intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    return ALL_NOTES[noteIndex];
  });
}

/**
 * Check if a note is in a given scale
 */
export function isNoteInScale(note: string, scaleNotes: string[]): boolean {
  return scaleNotes.includes(note);
}

/**
 * Get the scale degree of a note
 */
export function getScaleDegree(note: string, rootNote: string, scale: Scale): string | null {
  const scaleNotes = getScaleNotes(rootNote, scale.intervals);
  const index = scaleNotes.indexOf(note);
  if (index === -1) return null;
  return scale.degrees[index];
}

/**
 * Get the interval (in semitones) between two notes
 */
export function getInterval(note1: string, note2: string): number {
  const index1 = ALL_NOTES.indexOf(note1 as NoteName);
  const index2 = ALL_NOTES.indexOf(note2 as NoteName);
  if (index1 === -1 || index2 === -1) return -1;
  return (index2 - index1 + 12) % 12;
}

/**
 * Get the frequency of a note (A4 = 440Hz)
 */
export function getNoteFrequency(note: string, octave: number = 4): number {
  const noteIndex = ALL_NOTES.indexOf(note as NoteName);
  if (noteIndex === -1) return 0;

  // A4 = 440Hz, A is at index 9
  const semitonesFromA4 = noteIndex - 9 + (octave - 4) * 12;
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

/**
 * Get the octave of a note on the fretboard
 */
export function getNoteOctave(stringIndex: number, fret: number): number {
  // Base octaves for each string in standard tuning (low E to high e)
  const baseOctaves = [2, 2, 3, 3, 3, 4];
  const baseNote = STANDARD_TUNING[stringIndex];
  const currentNote = (baseNote + fret) % 12;

  let octave = baseOctaves[stringIndex];
  // If we've wrapped past B to C, increment the octave
  if (baseNote + fret >= 12) {
    octave += Math.floor((baseNote + fret) / 12);
  }
  // Adjust for where B wraps to C
  if (currentNote < baseNote % 12 && fret > 0) {
    octave += 1;
  }

  return octave;
}

/**
 * Get diatonic chords for a given scale
 */
export function getDiatonicChords(rootNote: string, scaleKey: string): Array<{
  root: string;
  degree: string;
  type: string;
  seventh: string;
}> {
  const scale = SCALES[scaleKey];
  if (!scale) return [];

  const scaleNotes = getScaleNotes(rootNote, scale.intervals);
  const isMinor = scale.category === 'minor' || scaleKey.includes('minor') || scaleKey === 'aeolian';
  const chordQualities = isMinor ? DIATONIC_CHORDS_MINOR : DIATONIC_CHORDS_MAJOR;

  return scaleNotes.map((note, index) => ({
    root: note,
    ...chordQualities[index % chordQualities.length],
  }));
}

/**
 * Find scales that contain specific notes
 */
export function findScalesContaining(notes: string[]): Array<{ key: string; scale: Scale; root: string }> {
  const results: Array<{ key: string; scale: Scale; root: string }> = [];

  for (const root of ALL_NOTES) {
    for (const [key, scale] of Object.entries(SCALES)) {
      const scaleNotes = getScaleNotes(root, scale.intervals);
      const containsAll = notes.every(note => scaleNotes.includes(note));
      if (containsAll) {
        results.push({ key, scale, root });
      }
    }
  }

  return results;
}

/**
 * Get relative major/minor for a scale
 */
export function getRelativeScale(rootNote: string, scaleKey: string): { root: string; scale: string } | null {
  const rootIndex = ALL_NOTES.indexOf(rootNote as NoteName);
  if (rootIndex === -1) return null;

  if (scaleKey === 'major' || scaleKey === 'ionian') {
    // Relative minor is 3 semitones down (9 up)
    const relativeMinorRoot = ALL_NOTES[(rootIndex + 9) % 12];
    return { root: relativeMinorRoot, scale: 'minor' };
  }

  if (scaleKey === 'minor' || scaleKey === 'aeolian') {
    // Relative major is 3 semitones up
    const relativeMajorRoot = ALL_NOTES[(rootIndex + 3) % 12];
    return { root: relativeMajorRoot, scale: 'major' };
  }

  return null;
}

/**
 * Get parallel major/minor for a scale
 */
export function getParallelScale(rootNote: string, scaleKey: string): { root: string; scale: string } | null {
  if (scaleKey === 'major' || scaleKey === 'ionian') {
    return { root: rootNote, scale: 'minor' };
  }

  if (scaleKey === 'minor' || scaleKey === 'aeolian') {
    return { root: rootNote, scale: 'major' };
  }

  return null;
}

/**
 * Get all modes of a parent scale
 */
export function getModesOfScale(scaleKey: string): string[] {
  const modeGroups: Record<string, string[]> = {
    'major': ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'],
    'ionian': ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'],
    'harmonic_minor': ['harmonic_minor', 'locrian_natural6', 'ionian_augmented', 'dorian_sharp4', 'phrygian_dominant', 'lydian_sharp2', 'super_locrian_bb7'],
    'melodic_minor': ['melodic_minor', 'dorian_b2', 'lydian_augmented', 'lydian_dominant', 'mixolydian_b6', 'locrian_natural2', 'super_locrian'],
  };

  for (const [, modes] of Object.entries(modeGroups)) {
    if (modes.includes(scaleKey)) {
      return modes;
    }
  }

  return [scaleKey]; // Return just the scale itself if not part of a mode group
}

/**
 * Search scales by name
 */
export function searchScales(query: string): Array<{ key: string; scale: Scale }> {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  return Object.entries(SCALES)
    .filter(([key, scale]) =>
      scale.name.toLowerCase().includes(normalizedQuery) ||
      key.toLowerCase().includes(normalizedQuery) ||
      scale.category.toLowerCase().includes(normalizedQuery) ||
      (scale.description && scale.description.toLowerCase().includes(normalizedQuery))
    )
    .map(([key, scale]) => ({ key, scale }));
}

/**
 * Get scales by category
 */
export function getScalesByCategory(category: ScaleCategory): Array<{ key: string; scale: Scale }> {
  return Object.entries(SCALES)
    .filter(([_, scale]) => scale.category === category)
    .map(([key, scale]) => ({ key, scale }));
}
