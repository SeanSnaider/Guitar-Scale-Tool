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

/**
 * A scale position as a fret window RELATIVE TO THE ROOT on the lowest
 * string: `startFret`/`endFret` are offsets for a root at fret 0, so the
 * shape is moved to the actual key (and repeated every 12 frets) by
 * practice/positions.ts. Do not compare them with absolute frets directly.
 */
export interface ScalePosition {
  id: number;
  name: string;
  startFret: number;
  endFret: number;
}

// CAGED system: five overlapping shapes, offsets from the root on the lowest string
export const CAGED_POSITIONS: ScalePosition[] = [
  { id: 1, name: 'Position 1', startFret: 0, endFret: 4 },
  { id: 2, name: 'Position 2', startFret: 2, endFret: 6 },
  { id: 3, name: 'Position 3', startFret: 4, endFret: 8 },
  { id: 4, name: 'Position 4', startFret: 7, endFret: 11 },
  { id: 5, name: 'Position 5', startFret: 9, endFret: 13 },
];

/**
 * 3 notes per string: one pattern per scale degree (pattern k starts on
 * degree k on the lowest string). Kept for callers that list pattern names;
 * the cells are computed from pitches in practice/positions.ts, not from
 * these windows.
 */
export const THREE_NPS_POSITIONS: ScalePosition[] = [
  { id: 1, name: 'Pattern 1', startFret: 0, endFret: 4 },
  { id: 2, name: 'Pattern 2', startFret: 2, endFret: 6 },
  { id: 3, name: 'Pattern 3', startFret: 4, endFret: 8 },
  { id: 4, name: 'Pattern 4', startFret: 5, endFret: 9 },
  { id: 5, name: 'Pattern 5', startFret: 7, endFret: 11 },
  { id: 6, name: 'Pattern 6', startFret: 9, endFret: 13 },
  { id: 7, name: 'Pattern 7', startFret: 11, endFret: 15 },
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
  const rootIndex = ALL_NOTES.indexOf((FLAT_TO_SHARP[rootNote] ?? rootNote) as NoteName);
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
  const index1 = ALL_NOTES.indexOf((FLAT_TO_SHARP[note1] ?? note1) as NoteName);
  const index2 = ALL_NOTES.indexOf((FLAT_TO_SHARP[note2] ?? note2) as NoteName);
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

/** A chord built on one degree of a scale. */
export interface DiatonicChord {
  root: string;
  /** Roman numeral: case and °/+ follow the triad's quality (I, ii, vii°, III+). */
  degree: string;
  /** CHORD_TYPES key for the triad, or 'other' when it isn't a standard triad. */
  type: string;
  /** CHORD_TYPES key for the seventh chord, or 'other'. */
  seventh: string;
  /** Triad intervals in semitones from the chord root, e.g. [0, 4, 7]. */
  intervals: number[];
  /** Chord symbol suffix, e.g. '', 'm', 'dim', 'aug', '(b5)'. */
  symbol: string;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Finds the CHORD_TYPES key whose intervals equal `intervals`, if any. */
function chordTypeFor(intervals: number[]): string | undefined {
  return Object.entries(CHORD_TYPES).find(
    ([, def]) => def.intervals.length === intervals.length && def.intervals.every((v, i) => v === intervals[i]),
  )?.[0];
}

/** Describes a non-standard triad by its 3rd and 5th, e.g. [0,4,6] -> '(b5)'. */
function oddTriadSymbol([, third, fifth]: number[]): string {
  const t = third === 3 ? 'm' : third === 2 ? 'sus2' : third === 5 ? 'sus4' : '';
  const f = fifth === 6 ? 'b5' : fifth === 8 ? '#5' : fifth === 7 ? '' : `${fifth}st`;
  return t + (f ? `(${f})` : '');
}

/**
 * Diatonic chords of a 7-note scale: each degree's triad and seventh are
 * built by stacking the scale's own thirds (degrees i, i+2, i+4, i+6), and
 * the quality is read from the resulting semitone gaps. So Dorian gets
 * i ii III IV v vi° VII and harmonic minor gets III+ and V, which a fixed
 * major/minor table cannot express.
 *
 * Scales without exactly 7 notes aren't built from stacked thirds, so they
 * return [] (the caller explains why).
 */
export function getDiatonicChords(rootNote: string, scaleKey: string): DiatonicChord[] {
  const scale = SCALES[scaleKey];
  if (!scale || scale.intervals.length !== 7) return [];

  const notes = getScaleNotes(rootNote, scale.intervals);
  const iv = scale.intervals;
  const above = (i: number, steps: number) => {
    const j = (i + steps) % 7;
    return (iv[j] - iv[i] + 12) % 12;
  };

  return notes.map((note, i) => {
    const triad = [0, above(i, 2), above(i, 4)];
    const seventh = [...triad, above(i, 6)];
    const type = chordTypeFor(triad) ?? 'other';
    const seventhType = chordTypeFor(seventh) ?? 'other';
    const isMajorLike = triad[1] === 4;
    let degree = isMajorLike ? ROMAN[i] : ROMAN[i].toLowerCase();
    if (type === 'diminished') degree += '°';
    if (type === 'augmented') degree += '+';
    return {
      root: note,
      degree,
      type,
      seventh: seventhType,
      intervals: triad,
      symbol: type === 'other' ? oddTriadSymbol(triad) : CHORD_TYPES[type].symbol,
    };
  });
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

// ─────────────────────────────────────────────────────────────────────────────
// Interval names from degree labels
// ─────────────────────────────────────────────────────────────────────────────

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', 'octave', '9th', '10th', '11th', '12th', '13th'];

/**
 * The interval name for a scale degree label ("b3" -> "Minor 3rd",
 * "#4" -> "Augmented 4th", "bb7" -> "Diminished 7th"). Unlike
 * getIntervalName(semitones), this respects the scale's own spelling, so
 * Lydian's #4 is an augmented 4th, not a tritone, and Super Locrian's b4 is a
 * diminished 4th, not a major 3rd.
 */
export function intervalNameForDegree(degree: string): string {
  const m = /^(b{0,2}|#{0,2})(\d+)$/.exec(degree);
  if (!m) return degree;
  const [, acc, numStr] = m;
  const num = Number(numStr);
  if (num === 1 && !acc) return 'Root';
  const perfectClass = [1, 4, 5].includes(((num - 1) % 7) + 1);
  const ord = ORDINAL[num] ?? `${num}th`;
  if (perfectClass) {
    if (!acc) return `Perfect ${ord}`;
    if (acc === 'b') return `Diminished ${ord}`;
    if (acc === '#') return `Augmented ${ord}`;
    return `${acc.startsWith('b') ? 'Doubly diminished' : 'Doubly augmented'} ${ord}`;
  }
  if (!acc) return `Major ${ord}`;
  if (acc === 'b') return `Minor ${ord}`;
  if (acc === 'bb') return `Diminished ${ord}`;
  if (acc === '#') return `Augmented ${ord}`;
  return `Doubly augmented ${ord}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spelling (display only; internal note math stays on sharp names)
// ─────────────────────────────────────────────────────────────────────────────

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

/** Normalizes a flat name to the sharp name used internally ("Bb" -> "A#"). */
export function toSharpName(note: string): string {
  return FLAT_TO_SHARP[note] ?? note;
}

/** Spells pitch class `pc` on `letter` ("E" + pc 3 -> "Eb"); null if more than a double accidental away. */
function spellOn(letter: string, pc: number): string | null {
  let diff = (pc - LETTER_PC[letter] + 12) % 12;
  if (diff > 6) diff -= 12;
  return diff in ACCIDENTAL ? letter + ACCIDENTAL[diff] : null;
}

function accidentalWeight(names: string[]): number {
  return names.reduce((w, n) => w + (n.length - 1), 0);
}

/**
 * Spells a scale by key: each degree goes on the letter its degree label
 * names ("b3" -> the 3rd letter, flattened as needed), so 7-note scales use
 * one letter per degree (F major -> F G A Bb C D E; Eb major -> Eb F G Ab Bb C D).
 * The root is spelled whichever way (sharp or flat name) needs fewer
 * accidentals: A# major is shown as Bb major.
 *
 * @returns Spelled names in scale order, aligned with getScaleNotes().
 */
export function spellScale(rootNote: string, scaleKey: string): string[] {
  const scale = SCALES[scaleKey];
  const root = toSharpName(rootNote);
  const rootPc = ALL_NOTES.indexOf(root as NoteName);
  if (!scale || rootPc === -1) return [];

  const spellFrom = (rootName: string): string[] | null => {
    const rootLetterIdx = LETTERS.indexOf(rootName[0]);
    const out: string[] = [];
    for (let i = 0; i < scale.intervals.length; i++) {
      const m = /(\d+)$/.exec(scale.degrees[i] ?? '');
      const steps = m ? Number(m[1]) - 1 : i;
      const letter = LETTERS[(rootLetterIdx + steps) % 7];
      const name = spellOn(letter, (rootPc + scale.intervals[i]) % 12);
      if (!name) return null;
      out.push(name);
    }
    return out;
  };

  const candidates = [root, ENHARMONIC_MAP[root]].filter(Boolean).map((r) => spellFrom(r as string)).filter((c): c is string[] => !!c);
  if (candidates.length === 0) return getScaleNotes(root, scale.intervals);
  return candidates.reduce((best, c) => (accidentalWeight(c) < accidentalWeight(best) ? c : best));
}

/**
 * A display namer for the current key: scale tones use spellScale(); other
 * notes use the same side (flats or sharps) as the key. Accepts sharp names.
 */
export function makeNoteNamer(rootNote: string, scaleKey: string): (sharpName: string) => string {
  const scale = SCALES[scaleKey];
  const spelled = spellScale(rootNote, scaleKey);
  const byPc = new Map<number, string>();
  if (scale) {
    const rootPc = ALL_NOTES.indexOf(toSharpName(rootNote) as NoteName);
    scale.intervals.forEach((iv, i) => byPc.set((rootPc + iv) % 12, spelled[i]));
  }
  const flatSide = spelled.some((n) => n.includes('b')) && !spelled.some((n) => n.includes('#'));
  return (sharpName: string) => {
    const pc = ALL_NOTES.indexOf(toSharpName(sharpName) as NoteName);
    if (pc === -1) return sharpName;
    return byPc.get(pc) ?? (flatSide ? ENHARMONIC_MAP[sharpName] ?? sharpName : sharpName);
  };
}

/**
 * The root a related scale should be shown on. Relatives and modes share the
 * current scale's pitch-class set, so their root is wherever that set
 * matches (C major -> A natural minor). Parallel relationships share no set,
 * so the root stays the same (C major -> C minor).
 */
export function relatedScaleRoot(rootNote: string, scaleKey: string, relatedKey: string): string {
  const current = SCALES[scaleKey];
  const related = SCALES[relatedKey];
  if (!current || !related) return rootNote;
  const pcs = (root: string, intervals: number[]) => new Set(getScaleNotes(root, intervals));
  const target = pcs(rootNote, current.intervals);
  const same = (a: Set<string>) => a.size === target.size && [...a].every((n) => target.has(n));
  if (same(pcs(rootNote, related.intervals))) return rootNote;
  return ALL_NOTES.find((r) => same(pcs(r, related.intervals))) ?? rootNote;
}
