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

/** A richer related-scale reference for the Reference Panel. */
export interface RelatedScaleRef {
  /** The key in SCALES (e.g. "minor_pentatonic"). */
  key: string;
  /** Human-readable display label (e.g. "Minor Pentatonic"). */
  label: string;
  /** Musical relationship description (e.g. "Relative minor", "Parent scale"). */
  relationship: string;
}

export interface Scale {
  name: string;
  intervals: number[];
  degrees: string[];
  category: ScaleCategory;
  description?: string;
  /** Prose description of genres and contexts where this scale is commonly used. */
  commonUses?: string;
  /**
   * Rich related-scale references for the Reference Panel.
   * Changed from string[] to RelatedScaleRef[] to carry relationship labels.
   */
  relatedScales?: RelatedScaleRef[];
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
    commonUses: 'Pop, rock, classical, country — the most versatile scale in Western music',
    relatedScales: [
      { key: 'minor', label: 'Natural Minor', relationship: 'Relative minor' },
      { key: 'major_pentatonic', label: 'Major Pentatonic', relationship: 'Pentatonic subset' },
      { key: 'mixolydian', label: 'Mixolydian', relationship: 'Parallel mode (b7)' },
    ],
  },

  'minor': {
    name: 'Natural Minor (Aeolian)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
    category: 'minor',
    description: 'The relative minor of major - sad and introspective',
    commonUses: 'Rock, metal, classical, folk — dark and emotive foundation',
    relatedScales: [
      { key: 'major', label: 'Major', relationship: 'Relative major' },
      { key: 'minor_pentatonic', label: 'Minor Pentatonic', relationship: 'Pentatonic subset' },
      { key: 'harmonic_minor', label: 'Harmonic Minor', relationship: 'Raised 7th variant' },
    ],
  },
  'harmonic_minor': {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', '7'],
    category: 'harmonic',
    description: 'Natural minor with raised 7th - exotic, Middle Eastern flavor',
    commonUses: 'Classical, metal, flamenco, Middle Eastern music — dramatic cadences',
    relatedScales: [
      { key: 'minor', label: 'Natural Minor', relationship: 'Natural form' },
      { key: 'phrygian_dominant', label: 'Phrygian Dominant', relationship: '5th mode of this scale' },
    ],
  },
  'melodic_minor': {
    name: 'Melodic Minor',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    degrees: ['1', '2', 'b3', '4', '5', '6', '7'],
    category: 'melodic',
    description: 'Natural minor with raised 6th and 7th - jazzy and sophisticated',
    commonUses: 'Jazz, classical, modern fusion — smooth ascending lines',
    relatedScales: [
      { key: 'minor', label: 'Natural Minor', relationship: 'Natural form' },
      { key: 'lydian_dominant', label: 'Lydian Dominant', relationship: '4th mode of this scale' },
    ],
  },

  'major_pentatonic': {
    name: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    degrees: ['1', '2', '3', '5', '6'],
    category: 'pentatonic',
    description: '5-note major scale - universally pleasing, very common in rock',
    commonUses: 'Country, blues, rock, pop — universally pleasing 5-note pattern',
    relatedScales: [
      { key: 'major', label: 'Major', relationship: 'Parent scale' },
      { key: 'minor_pentatonic', label: 'Minor Pentatonic', relationship: 'Relative pentatonic' },
    ],
  },
  'minor_pentatonic': {
    name: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10],
    degrees: ['1', 'b3', '4', '5', 'b7'],
    category: 'pentatonic',
    description: 'The "blues box" - essential for rock and blues guitar',
    commonUses: 'Rock, blues, R&B — the essential blues box',
    relatedScales: [
      { key: 'minor', label: 'Natural Minor', relationship: 'Parent scale' },
      { key: 'major_pentatonic', label: 'Major Pentatonic', relationship: 'Relative pentatonic' },
      { key: 'blues', label: 'Blues Scale', relationship: 'Add b5 blue note' },
    ],
  },

  'ionian': {
    name: 'Ionian',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ['1', '2', '3', '4', '5', '6', '7'],
    category: 'modes',
    description: 'Mode 1 - Same as major scale',
    commonUses: 'Pop, rock, classical — identical to the major scale, the brightest mode',
    relatedScales: [
      { key: 'major', label: 'Major', relationship: 'Same scale (different name)' },
    ],
  },
  'dorian': {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'],
    category: 'modes',
    description: 'Mode 2 - Minor with raised 6th, jazzy/funky feel',
    commonUses: 'Jazz, funk, rock — minor with a bright 6th (think Carlos Santana)',
    relatedScales: [
      { key: 'minor', label: 'Natural Minor', relationship: 'Brighter b6→6' },
      { key: 'major', label: 'Major', relationship: 'Parent major (2nd mode)' },
    ],
  },
  'phrygian': {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    degrees: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
    category: 'modes',
    description: 'Mode 3 - Spanish/Flamenco sound with flat 2nd',
    commonUses: 'Metal, flamenco, Spanish music — dark sound with flat 2nd',
    relatedScales: [
      { key: 'minor', label: 'Natural Minor', relationship: 'Darker b2 variant' },
      { key: 'phrygian_dominant', label: 'Phrygian Dominant', relationship: 'Raised 3rd variant' },
    ],
  },
  'lydian': {
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    degrees: ['1', '2', '3', '#4', '5', '6', '7'],
    category: 'modes',
    description: 'Mode 4 - Dreamy, floating quality with raised 4th',
    commonUses: 'Film scores, prog rock, dream pop — magical floating quality',
    relatedScales: [
      { key: 'major', label: 'Major', relationship: 'Raised 4th variant' },
      { key: 'lydian_dominant', label: 'Lydian Dominant', relationship: 'Lowered 7th variant' },
    ],
  },
  'mixolydian': {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degrees: ['1', '2', '3', '4', '5', '6', 'b7'],
    category: 'modes',
    description: 'Mode 5 - Dominant scale, great for blues rock',
    commonUses: 'Blues rock, Celtic, classic rock — major scale with a blues-friendly b7',
    relatedScales: [
      { key: 'major', label: 'Major', relationship: 'Lowered 7th variant' },
      { key: 'blues', label: 'Blues Scale', relationship: 'Blues subset' },
    ],
  },
  'aeolian': {
    name: 'Aeolian',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
    category: 'modes',
    description: 'Mode 6 - Same as natural minor',
    commonUses: 'Rock, pop, classical — identical to natural minor, brooding and emotive',
    relatedScales: [
      { key: 'minor', label: 'Natural Minor', relationship: 'Same scale (different name)' },
    ],
  },
  'locrian': {
    name: 'Locrian',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    degrees: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
    category: 'modes',
    description: 'Mode 7 - Diminished feel, unstable and dark',
    commonUses: 'Metal (diminished chords), modern jazz — rarely used, very unstable',
    relatedScales: [
      { key: 'phrygian', label: 'Phrygian', relationship: 'Lowered 5th variant' },
    ],
  },

  'locrian_natural6': {
    name: 'Locrian Natural 6',
    intervals: [0, 1, 3, 5, 6, 9, 10],
    degrees: ['1', 'b2', 'b3', '4', 'b5', '6', 'b7'],
    category: 'harmonic',
    description: 'Mode 2 of Harmonic Minor',
    commonUses: 'Jazz harmony, advanced improvisation — half-diminished with a bright natural 6',
  },
  'ionian_augmented': {
    name: 'Ionian Augmented',
    intervals: [0, 2, 4, 5, 8, 9, 11],
    degrees: ['1', '2', '3', '4', '#5', '6', '7'],
    category: 'harmonic',
    description: 'Mode 3 of Harmonic Minor - major with raised 5th',
    commonUses: 'Film scores, neo-classical metal — bright tension from the augmented 5th',
  },
  'dorian_sharp4': {
    name: 'Dorian #4',
    intervals: [0, 2, 3, 6, 7, 9, 10],
    degrees: ['1', '2', 'b3', '#4', '5', '6', 'b7'],
    category: 'harmonic',
    description: 'Mode 4 of Harmonic Minor - Romanian scale',
    commonUses: 'Eastern European folk, fusion jazz — the distinctive tritone gives an exotic edge',
  },
  'phrygian_dominant': {
    name: 'Phrygian Dominant',
    intervals: [0, 1, 4, 5, 7, 8, 10],
    degrees: ['1', 'b2', '3', '4', '5', 'b6', 'b7'],
    category: 'harmonic',
    description: 'Mode 5 of Harmonic Minor - Spanish/Middle Eastern',
    commonUses: 'Flamenco, metal, Middle Eastern music — intense Spanish/Arabic color',
    relatedScales: [
      { key: 'harmonic_minor', label: 'Harmonic Minor', relationship: 'Parent scale' },
      { key: 'phrygian', label: 'Phrygian', relationship: 'Raised 3rd variant' },
    ],
  },
  'lydian_sharp2': {
    name: 'Lydian #2',
    intervals: [0, 3, 4, 6, 7, 9, 11],
    degrees: ['1', '#2', '3', '#4', '5', '6', '7'],
    category: 'harmonic',
    description: 'Mode 6 of Harmonic Minor',
    commonUses: 'Neo-classical, avant-garde jazz — extremely exotic, two augmented intervals',
  },
  'super_locrian_bb7': {
    name: 'Super Locrian bb7',
    intervals: [0, 1, 3, 4, 6, 8, 9],
    degrees: ['1', 'b2', 'b3', 'b4', 'b5', 'b6', 'bb7'],
    category: 'harmonic',
    description: 'Mode 7 of Harmonic Minor - ultralocrian',
    commonUses: 'Jazz theory, academic study — the most dissonant mode, rarely used in practice',
  },

  'dorian_b2': {
    name: 'Dorian b2 (Phrygian #6)',
    intervals: [0, 1, 3, 5, 7, 9, 10],
    degrees: ['1', 'b2', 'b3', '4', '5', '6', 'b7'],
    category: 'melodic',
    description: 'Mode 2 of Melodic Minor',
    commonUses: 'Jazz, fusion — a minor modal color with Phrygian darkness and Dorian brightness',
  },
  'lydian_augmented': {
    name: 'Lydian Augmented',
    intervals: [0, 2, 4, 6, 8, 9, 11],
    degrees: ['1', '2', '3', '#4', '#5', '6', '7'],
    category: 'melodic',
    description: 'Mode 3 of Melodic Minor - bright and tense',
    commonUses: 'Film scores, prog rock — exotic tension from simultaneous #4 and #5',
  },
  'lydian_dominant': {
    name: 'Lydian Dominant',
    intervals: [0, 2, 4, 6, 7, 9, 10],
    degrees: ['1', '2', '3', '#4', '5', '6', 'b7'],
    category: 'melodic',
    description: 'Mode 4 of Melodic Minor - overtone scale',
    commonUses: 'Jazz fusion, funk — dominant 7th chord sound with a dreamy raised 4th',
    relatedScales: [
      { key: 'melodic_minor', label: 'Melodic Minor', relationship: 'Parent scale' },
      { key: 'lydian', label: 'Lydian', relationship: 'Lowered 7th variant' },
    ],
  },
  'mixolydian_b6': {
    name: 'Mixolydian b6',
    intervals: [0, 2, 4, 5, 7, 8, 10],
    degrees: ['1', '2', '3', '4', '5', 'b6', 'b7'],
    category: 'melodic',
    description: 'Mode 5 of Melodic Minor - Hindu scale',
    commonUses: 'Indian classical music, jazz — melodic minor applied over dominant chords',
  },
  'locrian_natural2': {
    name: 'Locrian Natural 2',
    intervals: [0, 2, 3, 5, 6, 8, 10],
    degrees: ['1', '2', 'b3', '4', 'b5', 'b6', 'b7'],
    category: 'melodic',
    description: 'Mode 6 of Melodic Minor - half-diminished scale',
    commonUses: 'Jazz, bossa nova — the preferred choice over Locrian for m7b5 chords',
  },
  'super_locrian': {
    name: 'Super Locrian (Altered)',
    intervals: [0, 1, 3, 4, 6, 8, 10],
    degrees: ['1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
    category: 'melodic',
    description: 'Mode 7 of Melodic Minor - altered dominant scale',
    commonUses: 'Jazz — the essential altered dominant scale, maximum tension before resolution',
  },

  'blues': {
    name: 'Blues Scale',
    intervals: [0, 3, 5, 6, 7, 10],
    degrees: ['1', 'b3', '4', 'b5', '5', 'b7'],
    category: 'blues',
    description: 'Minor pentatonic with added blue note (b5)',
    commonUses: 'Blues, rock, jazz — minor pentatonic with the essential blue note (b5)',
    relatedScales: [
      { key: 'minor_pentatonic', label: 'Minor Pentatonic', relationship: 'Remove b5 blue note' },
      { key: 'major_blues', label: 'Major Blues', relationship: 'Major variant' },
    ],
  },
  'major_blues': {
    name: 'Major Blues',
    intervals: [0, 2, 3, 4, 7, 9],
    degrees: ['1', '2', 'b3', '3', '5', '6'],
    category: 'blues',
    description: 'Major pentatonic with added b3 (blue note)',
    commonUses: 'Country blues, rockabilly, rock and roll — bright with a characteristic blues bend',
    relatedScales: [
      { key: 'major_pentatonic', label: 'Major Pentatonic', relationship: 'Remove b3 blue note' },
      { key: 'blues', label: 'Blues Scale', relationship: 'Minor variant' },
    ],
  },

  'bebop_dominant': {
    name: 'Bebop Dominant',
    intervals: [0, 2, 4, 5, 7, 9, 10, 11],
    degrees: ['1', '2', '3', '4', '5', '6', 'b7', '7'],
    category: 'jazz',
    description: 'Mixolydian with passing tone - essential jazz scale',
    commonUses: 'Jazz, swing, bebop — 8-note scale that aligns chord tones on beats for fluent lines',
  },
  'bebop_major': {
    name: 'Bebop Major',
    intervals: [0, 2, 4, 5, 7, 8, 9, 11],
    degrees: ['1', '2', '3', '4', '5', 'b6', '6', '7'],
    category: 'jazz',
    description: 'Major scale with added b6',
    commonUses: 'Jazz, big band — major scale bebop approach for major 6th and maj7 chords',
  },
  'bebop_minor': {
    name: 'Bebop Minor',
    intervals: [0, 2, 3, 5, 7, 8, 9, 10],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', '6', 'b7'],
    category: 'jazz',
    description: 'Dorian with added b6',
    commonUses: 'Jazz — 8-note minor scale for smooth lines over minor 7th chords',
  },
  'diminished_whole_half': {
    name: 'Diminished (Whole-Half)',
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
    degrees: ['1', '2', 'b3', '4', 'b5', 'b6', '6', '7'],
    category: 'jazz',
    description: 'Symmetric scale - alternating whole/half steps',
    commonUses: 'Jazz, classical — over diminished 7th chords, symmetrical and eerie',
  },
  'diminished_half_whole': {
    name: 'Diminished (Half-Whole)',
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    degrees: ['1', 'b2', 'b3', '3', 'b5', '5', '6', 'b7'],
    category: 'jazz',
    description: 'Symmetric scale - alternating half/whole steps',
    commonUses: 'Jazz — the go-to scale over dominant 7b9 chords, tense and chromatic',
  },
  'whole_tone': {
    name: 'Whole Tone',
    intervals: [0, 2, 4, 6, 8, 10],
    degrees: ['1', '2', '3', '#4', '#5', 'b7'],
    category: 'jazz',
    description: 'Symmetric scale - all whole steps, dreamy and ambiguous',
    commonUses: 'Jazz, impressionist classical — over augmented chords, floating and unresolved',
  },

  'hungarian_minor': {
    name: 'Hungarian Minor',
    intervals: [0, 2, 3, 6, 7, 8, 11],
    degrees: ['1', '2', 'b3', '#4', '5', 'b6', '7'],
    category: 'exotic',
    description: 'Gypsy scale - dramatic and Eastern European',
    commonUses: 'Gypsy jazz, flamenco, Eastern European folk — highly dramatic with two augmented seconds',
  },
  'hungarian_major': {
    name: 'Hungarian Major',
    intervals: [0, 3, 4, 6, 7, 9, 10],
    degrees: ['1', '#2', '3', '#4', '5', '6', 'b7'],
    category: 'exotic',
    description: 'Bright, exotic major variation',
    commonUses: 'Jazz, world music fusion — bright with an exotic augmented 2nd twist',
  },
  'double_harmonic': {
    name: 'Double Harmonic (Byzantine)',
    intervals: [0, 1, 4, 5, 7, 8, 11],
    degrees: ['1', 'b2', '3', '4', '5', 'b6', '7'],
    category: 'exotic',
    description: 'Middle Eastern sound - Arabic/Byzantine scale',
    commonUses: 'Middle Eastern music, Byzantine chant, metal — intense with two augmented seconds',
  },
  'persian': {
    name: 'Persian',
    intervals: [0, 1, 4, 5, 6, 8, 11],
    degrees: ['1', 'b2', '3', '4', 'b5', 'b6', '7'],
    category: 'exotic',
    description: 'Ancient Persian scale - haunting quality',
    commonUses: 'Middle Eastern fusion, ambient music — deeply exotic, rarely heard in Western music',
  },
  'japanese_hirajoshi': {
    name: 'Hirajoshi',
    intervals: [0, 2, 3, 7, 8],
    degrees: ['1', '2', 'b3', '5', 'b6'],
    category: 'exotic',
    description: 'Japanese pentatonic - melancholic and ethereal',
    commonUses: 'Japanese traditional music, new age — wide leaps create a meditative, sparse feel',
  },
  'japanese_in': {
    name: 'In Scale',
    intervals: [0, 1, 5, 7, 8],
    degrees: ['1', 'b2', '4', '5', 'b6'],
    category: 'exotic',
    description: 'Japanese Sakura scale - traditional and delicate',
    commonUses: 'Japanese traditional music — the "Sakura" scale, delicate and ceremonial',
  },
  'japanese_yo': {
    name: 'Yo Scale',
    intervals: [0, 2, 5, 7, 9],
    degrees: ['1', '2', '4', '5', '6'],
    category: 'exotic',
    description: 'Japanese folk scale - bright and pastoral',
    commonUses: 'Japanese folk songs, children\'s music — bright and pentatonic without half steps',
  },
  'chinese': {
    name: 'Chinese Scale',
    intervals: [0, 4, 6, 7, 11],
    degrees: ['1', '3', '#4', '5', '7'],
    category: 'exotic',
    description: 'Traditional Chinese pentatonic',
    commonUses: 'Chinese traditional music, ambient — major thirds and raised 4th create a unique color',
  },
  'egyptian': {
    name: 'Egyptian',
    intervals: [0, 2, 5, 7, 10],
    degrees: ['1', '2', '4', '5', 'b7'],
    category: 'exotic',
    description: 'Suspended pentatonic - ancient mystical quality',
    commonUses: 'World music, ambient, fusion — suspended sound with no 3rd creates modal ambiguity',
  },
  'balinese': {
    name: 'Balinese',
    intervals: [0, 1, 3, 7, 8],
    degrees: ['1', 'b2', 'b3', '5', 'b6'],
    category: 'exotic',
    description: 'Indonesian gamelan-inspired scale',
    commonUses: 'World music, gamelan-inspired ambient — haunting half-step clusters and open 5th',
  },
  'enigmatic': {
    name: 'Enigmatic',
    intervals: [0, 1, 4, 6, 8, 10, 11],
    degrees: ['1', 'b2', '3', '#4', '#5', 'b7', '7'],
    category: 'exotic',
    description: 'Invented by Verdi - mysterious and chromatic',
    commonUses: 'Classical, avant-garde — Verdi\'s puzzle scale, highly chromatic and unresolved',
  },
  'neapolitan_major': {
    name: 'Neapolitan Major',
    intervals: [0, 1, 3, 5, 7, 9, 11],
    degrees: ['1', 'b2', 'b3', '4', '5', '6', '7'],
    category: 'exotic',
    description: 'Classical Italian scale - romantic and melancholic',
    commonUses: 'Baroque, romantic classical — associated with Neapolitan harmony and operatic drama',
  },
  'neapolitan_minor': {
    name: 'Neapolitan Minor',
    intervals: [0, 1, 3, 5, 7, 8, 11],
    degrees: ['1', 'b2', 'b3', '4', '5', 'b6', '7'],
    category: 'exotic',
    description: 'Harmonic minor with flat 2nd',
    commonUses: 'Classical, neo-classical metal — harmonic minor with darker Phrygian opening',
  },
  'prometheus': {
    name: 'Prometheus',
    intervals: [0, 2, 4, 6, 9, 10],
    degrees: ['1', '2', '3', '#4', '6', 'b7'],
    category: 'exotic',
    description: 'Scriabin\'s mystic scale - ethereal and modern',
    commonUses: 'Impressionist classical, ambient — Scriabin\'s "mystic chord" unfolded as a scale',
  },
  'arabian': {
    name: 'Arabian',
    intervals: [0, 2, 4, 5, 6, 8, 10],
    degrees: ['1', '2', '3', '4', 'b5', 'b6', 'b7'],
    category: 'exotic',
    description: 'Arabic maqam-inspired scale',
    commonUses: 'Middle Eastern music, world fusion — maqam-inspired with a characteristic tritone',
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

/**
 * Semitone offsets of the five CAGED shapes measured from the E shape (root
 * on the lowest string), in the order they appear moving up the neck:
 * E, D, C, A, G. Used for scales that are not five-note scales.
 */
const CAGED_SHAPE_OFFSETS = [0, 2, 5, 7, 9];

/** Frets covered by a CAGED box / pentatonic box (start..start+4). */
const CAGED_WINDOW_SPAN = 4;

/** Frets covered by a three-notes-per-string pattern (start..start+5). */
const THREE_NPS_WINDOW_SPAN = 5;

/**
 * Computes CAGED or 3NPS position windows for the selected key and scale.
 *
 * The static CAGED_POSITIONS / THREE_NPS_POSITIONS tables are C-major fret
 * windows, so on their own they highlight the wrong frets in every other
 * key. Here Position 1 is anchored on the root's location on the lowest
 * string and the rest follow the scale up the neck:
 *  - CAGED + five-note scale: one box per scale degree (A minor pentatonic
 *    box 1 sits at frets 4-8 around the root on fret 5);
 *  - CAGED + other scales: the five CAGED shapes, starting from the E shape;
 *  - 3NPS + seven-note scale: pattern k starts on scale degree k;
 *  - 3NPS + other scales: the table's offsets, shifted to the key.
 * Windows are folded into frets 0-11; use isFretInPosition to also match
 * the same pattern an octave higher.
 *
 * @param system     - 'caged' or '3nps'.
 * @param rootNote   - Root note in sharp spelling.
 * @param scaleKey   - Key into SCALES.
 * @param tuningNotes - Note indices per string, lowest string first.
 * @returns Positions with the same ids, names and colours as the static
 *          tables but key-relative start/end frets.
 */
export function getScalePositions(
  system: 'caged' | '3nps',
  rootNote: string,
  scaleKey: string,
  tuningNotes: readonly number[]
): ScalePosition[] {
  const template = system === 'caged' ? CAGED_POSITIONS : THREE_NPS_POSITIONS;
  const rootIndex = ALL_NOTES.indexOf(rootNote as NoteName);
  const intervals = SCALES[scaleKey]?.intervals;
  if (rootIndex === -1 || !intervals || tuningNotes.length === 0) return template;

  /** Fret of the root on the lowest string (0-11). */
  const rootFret = (rootIndex - tuningNotes[0] + 12) % 12;

  return template.map((position, i) => {
    let offset: number;
    let span = CAGED_WINDOW_SPAN;
    if (system === 'caged') {
      // The root sits one fret inside the box (under the second finger).
      offset = (intervals.length === 5 ? intervals[i] : CAGED_SHAPE_OFFSETS[i]) - 1;
    } else {
      span = THREE_NPS_WINDOW_SPAN;
      offset = intervals.length === 7
        ? intervals[i]
        : position.startFret - template[0].startFret;
    }
    // A box that would start "behind" the nut (open-string root) starts at 0;
    // anything past fret 11 folds back an octave.
    const rawStart = rootFret + offset;
    const startFret = rawStart < 0 ? 0 : rawStart % 12;
    return { ...position, startFret, endFret: startFret + span };
  });
}

/**
 * Whether a fret falls inside a position window, including the same
 * pattern repeated an octave (12 frets) higher.
 *
 * @param fret     - Fret number on any string.
 * @param position - A position from getScalePositions.
 * @returns True if the fret is inside the window or its octave repeat.
 */
export function isFretInPosition(fret: number, position: ScalePosition): boolean {
  return [fret, fret - 12].some(
    (f) => f >= position.startFret && f <= position.endFret
  );
}

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
 * @deprecated Use midiToFrequency(stringFretToMidi(...)) for fretboard positions.
 */
export function getNoteFrequency(note: string, octave: number = 4): number {
  const noteIndex = ALL_NOTES.indexOf(note as NoteName);
  if (noteIndex === -1) return 0;

  // A4 = 440Hz, A is at index 9
  const semitonesFromA4 = noteIndex - 9 + (octave - 4) * 12;
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

/**
 * Convert a string/fret position to a MIDI note number.
 *
 * This is the single source of truth for pitch — eliminates the octave
 * disagreement bug that arose from calling getNoteFrequency and getNoteOctave
 * separately. Supports 6, 7, and 8-string guitars by aligning against the
 * 8-string standard tuning reference array.
 *
 * Standard tuning open-string MIDI (8-string reference, low to high):
 *   F#1=30  B1=35  E2=40  A2=45  D3=50  G3=55  B3=59  E4=64
 *
 * @param stringIndex - 0 = lowest-pitched string, (strings-1) = highest
 * @param fret        - fret number (0 = open)
 * @param tuning      - note indices per string (0=C … 11=B), defaults to standard
 * @returns MIDI note number (middle C = 60)
 */
export function stringFretToMidi(
  stringIndex: number,
  fret: number,
  tuning: readonly number[] = STANDARD_TUNING
): number {
  // Reference MIDI and note-index arrays for 8-string standard tuning
  const REF_MIDI: readonly number[] = [30, 35, 40, 45, 50, 55, 59, 64];
  const REF_IDX:  readonly number[] = [ 6, 11,  4,  9,  2,  7, 11,  4];

  // Align: a 6-string guitar maps to positions 2–7 of the 8-string reference
  const base = 8 - tuning.length;
  const refMidi = REF_MIDI[base + stringIndex];
  const refIdx  = REF_IDX[base + stringIndex];

  // Semitone offset from standard, resolved to nearest interval (within ±6)
  let offset = ((tuning[stringIndex] - refIdx) + 12) % 12;
  if (offset > 6) offset -= 12;

  return refMidi + offset + fret;
}

/**
 * Convert a MIDI note number to frequency in Hz.
 * Reference: A4 = MIDI 69 = 440 Hz.
 *
 * @param midi - MIDI note number
 * @returns Frequency in Hz
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Get the scientific-pitch octave of a note on the fretboard (standard tuning).
 *
 * Derived from the MIDI number so it can never disagree with playback
 * (MIDI 60 = C4, so octave = floor(midi / 12) - 1).
 *
 * @deprecated Use stringFretToMidi + midiToFrequency instead.
 * @param stringIndex - 0 = low E, 5 = high e.
 * @param fret        - Fret number (0 = open string).
 * @returns The octave number, e.g. 3 for C on the low E string's 8th fret.
 */
export function getNoteOctave(stringIndex: number, fret: number): number {
  return Math.floor(stringFretToMidi(stringIndex, fret) / 12) - 1;
}

/**
 * Assigns octaves to a list of note names so they form an ascending line.
 *
 * Every time a note's pitch class is at or below the previous note's, the
 * octave increases - so A B C D in octave 3 becomes A3 B3 C4 D4 rather than
 * dropping back down to C3. Use this for scale runs and root-position chords.
 *
 * @param notes       - Note names in sharp spelling (e.g. "A", "C#").
 * @param startOctave - Octave of the first note.
 * @returns The notes paired with their octave, in input order. Unknown note
 *          names are skipped.
 */
export function getAscendingOctaves(
  notes: readonly string[],
  startOctave: number
): Array<{ note: string; octave: number }> {
  const result: Array<{ note: string; octave: number }> = [];
  let octave = startOctave;
  let previousIndex = -1;

  for (const note of notes) {
    const index = ALL_NOTES.indexOf(note as NoteName);
    if (index === -1) continue;
    if (previousIndex !== -1 && index <= previousIndex) octave += 1;
    result.push({ note, octave });
    previousIndex = index;
  }
  return result;
}

/**
 * Seven-note parent scale used to harmonise scales that are not themselves
 * seven-note scales (pentatonics, blues and bebop scales are subsets or
 * passing-tone extensions of these). Scales without a clear parent, such as
 * whole-tone or the symmetric diminished scales, have no diatonic harmony.
 */
const HARMONY_PARENT_SCALE: Record<string, string> = {
  major_pentatonic: 'major',
  minor_pentatonic: 'minor',
  blues: 'minor',
  major_blues: 'major',
  bebop_dominant: 'mixolydian',
  bebop_major: 'major',
  bebop_minor: 'dorian',
};

/** Triad type keyed by "third,fifth" semitone distances above the chord root. */
const TRIAD_BY_INTERVALS: Record<string, string> = {
  '4,7': 'major',
  '3,7': 'minor',
  '3,6': 'diminished',
  '4,8': 'augmented',
};

/** Seventh-chord type keyed by triad type plus the seventh's semitone distance. */
const SEVENTH_BY_TRIAD: Record<string, string> = {
  'major,11': 'major7',
  'major,10': 'dominant7',
  'minor,10': 'minor7',
  'minor,11': 'minor_major7',
  'diminished,10': 'half_diminished',
  'diminished,9': 'diminished7',
};

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Builds the Roman-numeral label for a scale degree: uppercase for major and
 * augmented triads, lowercase for minor and diminished, with ° / + suffixes.
 *
 * @param index - Zero-based scale degree.
 * @param type  - Triad type key (major, minor, diminished, augmented).
 * @returns The degree label, e.g. "ii", "vii°" or "III+".
 */
function romanNumeralFor(index: number, type: string): string {
  const numeral = ROMAN_NUMERALS[index];
  if (type === 'minor') return numeral.toLowerCase();
  if (type === 'diminished') return `${numeral.toLowerCase()}°`;
  if (type === 'augmented') return `${numeral}+`;
  return numeral;
}

/**
 * Get the diatonic triads (and their seventh chords) of a scale.
 *
 * Chord qualities are derived by stacking thirds within the scale itself,
 * so every mode and seven-note scale gets its correct harmony (D Dorian:
 * i ii III IV v vi° VII; A harmonic minor: i ii° III+ iv V VI vii°).
 * Pentatonic, blues and bebop scales are harmonised with their parent
 * seven-note scale (see HARMONY_PARENT_SCALE). Degrees whose stacked thirds
 * do not form a standard triad (possible in some exotic scales) are omitted.
 *
 * @param rootNote - Root of the scale, in sharp spelling.
 * @param scaleKey - Key into SCALES.
 * @returns One entry per playable degree; empty for unknown scales or scales
 *          with no seven-note harmony.
 */
export function getDiatonicChords(rootNote: string, scaleKey: string): Array<{
  root: string;
  degree: string;
  type: string;
  seventh: string;
}> {
  const harmonyKey = HARMONY_PARENT_SCALE[scaleKey] ?? scaleKey;
  const scale = SCALES[harmonyKey];
  if (!scale || scale.intervals.length !== 7) return [];

  const scaleNotes = getScaleNotes(rootNote, scale.intervals);
  const intervals = scale.intervals;
  /** Semitones from degree `from` up to degree `from + steps` (wrapping). */
  const distance = (from: number, steps: number): number =>
    (intervals[(from + steps) % 7] - intervals[from] + 12) % 12;

  return scaleNotes.flatMap((note, index) => {
    const type = TRIAD_BY_INTERVALS[`${distance(index, 2)},${distance(index, 4)}`];
    if (!type) return [];
    const seventh = SEVENTH_BY_TRIAD[`${type},${distance(index, 6)}`] ?? type;
    return [{ root: note, degree: romanNumeralFor(index, type), type, seventh }];
  });
}

/**
 * Relationships in SCALES[...].relatedScales that mean "the same notes from a
 * different root" (relative keys, modes, parent scales) - as opposed to
 * parallel relationships, which keep the root.
 */
const SHARED_NOTES_RELATIONSHIP = /relative|parent|mode of this scale/i;

/**
 * Chooses the root to use when the player follows a related-scale link.
 *
 * Parallel relationships ("Parallel mode (b7)", "Minor variant") keep the
 * current root. Shared-note relationships move to the root whose scale
 * contains the same notes: C major -> "Relative minor" gives A, A harmonic
 * minor -> "5th mode of this scale" gives E. When the current root already
 * works (A minor pentatonic -> parent A natural minor), it is kept.
 *
 * @param currentRoot - The active root note.
 * @param currentKey  - The active SCALES key.
 * @param related     - The related-scale entry being followed.
 * @returns The root note for the related scale.
 */
export function resolveRelatedScaleRoot(
  currentRoot: string,
  currentKey: string,
  related: RelatedScaleRef
): string {
  const current = SCALES[currentKey];
  const target = SCALES[related.key];
  if (!current || !target || !SHARED_NOTES_RELATIONSHIP.test(related.relationship)) {
    return currentRoot;
  }

  const currentNotes = new Set(getScaleNotes(currentRoot, current.intervals));
  /** True when one note set contains the other (subset, superset or equal). */
  const nested = (root: string): boolean => {
    const targetNotes = new Set(getScaleNotes(root, target.intervals));
    const [small, large] =
      targetNotes.size <= currentNotes.size ? [targetNotes, currentNotes] : [currentNotes, targetNotes];
    return [...small].every((note) => large.has(note));
  };

  if (nested(currentRoot)) return currentRoot;
  return ALL_NOTES.find((root) => nested(root)) ?? currentRoot;
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
    .filter(([, scale]) => scale.category === category)
    .map(([key, scale]) => ({ key, scale }));
}

/**
 * Returns the interval name for a given number of semitones above the root.
 *
 * Maps 0–11 semitones to their standard Western music theory interval names.
 * Returns 'Unknown' for any value outside that range.
 *
 * @param semitones - Number of semitones above the root (0–11).
 * @returns The interval name, e.g. "Perfect 5th".
 */
export function getIntervalName(semitones: number): string {
  const INTERVAL_NAMES: Record<number, string> = {
    0: 'Root',
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
  return INTERVAL_NAMES[semitones] ?? 'Unknown';
}
