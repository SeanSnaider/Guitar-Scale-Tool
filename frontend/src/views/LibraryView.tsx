/**
 * LibraryView
 *
 * Reference material in one destination: the scale library and the diatonic
 * chord diagrams. The old 'scales' / 'chords' tab ids open their section.
 */
import ScalesBrowser from '../components/ScalesBrowser';
import ChordDiagrams from '../components/ChordDiagrams';
import { useGuitarStore } from '../store/useGuitarStore';
import { SegmentedControl } from '../ui';

const SECTIONS = [
  { value: 'scales', label: 'Scales' },
  { value: 'chords', label: 'Chords' },
] as const;

export default function LibraryView() {
  const activeTab = useGuitarStore((s) => s.activeTab);
  const setActiveTab = useGuitarStore((s) => s.setActiveTab);
  const section = activeTab === 'chords' ? 'chords' : 'scales';

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        ariaLabel="Library section"
        options={SECTIONS}
        value={section}
        onChange={(v) => setActiveTab(v)}
        className="self-start"
      />
      {section === 'scales' ? <ScalesBrowser /> : <ChordDiagrams />}
    </div>
  );
}
