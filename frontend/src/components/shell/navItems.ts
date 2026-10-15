import { AudioWaveform, ChartNoAxesColumn, Ear, Guitar, LibraryBig } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TabId } from '../../store/useGuitarStore';

export interface NavItem {
  /** The tab id this destination opens. */
  id: TabId;
  label: string;
  icon: LucideIcon;
  /** Store ids that also count as "this destination" (legacy and sub-views). */
  matches: TabId[];
  /** Practice tools first, then reference material. */
  group: 'practice' | 'reference';
}

/** The five destinations, in nav order. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'fretboard', label: 'Practice', icon: Guitar, matches: ['fretboard', 'reference'], group: 'practice' },
  { id: 'ear-training', label: 'Ear training', icon: Ear, matches: ['ear-training'], group: 'practice' },
  { id: 'chordai', label: 'ChordAI', icon: AudioWaveform, matches: ['chordai'], group: 'practice' },
  { id: 'library', label: 'Library', icon: LibraryBig, matches: ['library', 'scales', 'chords'], group: 'reference' },
  { id: 'progress', label: 'Progress', icon: ChartNoAxesColumn, matches: ['progress'], group: 'reference' },
];

/** The destination that owns a store tab id. */
export function navItemFor(tab: TabId): NavItem {
  return NAV_ITEMS.find((item) => item.matches.includes(tab)) ?? NAV_ITEMS[0];
}
