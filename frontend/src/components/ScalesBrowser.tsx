/**
 * ScalesBrowser.tsx
 *
 * The Library's Scales section: browse, search, and filter every built-in
 * scale. Loading a scale puts it on the fretboard and returns to Practice.
 *
 * Features:
 * - Text search across scale name, key, category and description
 * - Category filter chips (All + each ScaleCategory), applied on top of the
 *   search results
 * - A grid of scale cards: name, category, description, formula, a 12-cell
 *   interval strip showing the scale's shape, and a "Load on fretboard" action
 *
 * Dependencies:
 * - useGuitarStore: selectedScale, setSelectedScale, setActiveTab,
 *   scaleSearchQuery, setScaleSearchQuery, selectedCategory, setSelectedCategory
 * - musicTheory: SCALES, SCALE_CATEGORIES, searchScales
 */

import { useId, useMemo } from 'react';
import { Check } from 'lucide-react';
import { useGuitarStore } from '../store/useGuitarStore';
import {
  SCALES,
  SCALE_CATEGORIES,
  searchScales,
  type Scale,
} from '../data/musicTheory';
import { Button, Chip, TextField, cn, PageTitle } from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A scale with its registry key attached. */
interface ScaleEntry {
  key: string;
  scale: Scale;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_NAME = new Map(SCALE_CATEGORIES.map((c) => [c.id, c.name]));

/**
 * Formats a degrees array into a spaced formula string.
 *
 * @param degrees - Degree labels e.g. ["1", "2", "b3", "4", "5", "b6", "b7"].
 * @returns A space-separated formula string like "1  2  b3  4  5  b6  b7".
 */
function formatFormula(degrees: string[]): string {
  return degrees.join('  ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * IntervalStrip draws the scale's shape: one cell per semitone above the
 * root, filled where the scale has a degree, the root cell in accent.
 * Decorative; the text formula is the accessible version.
 */
function IntervalStrip({ intervals }: { intervals: number[] }) {
  const inScale = new Set(intervals.map((iv) => iv % 12));
  return (
    <div aria-hidden="true" className="flex gap-[3px]">
      {Array.from({ length: 12 }, (_, semis) => (
        <span
          key={semis}
          className={cn(
            'size-2.5 rounded-[2px]',
            semis === 0 ? 'bg-accent' : inScale.has(semis) ? 'bg-ink' : 'border border-line-strong',
          )}
        />
      ))}
    </div>
  );
}

/** Props for a single scale card in the browser grid. */
interface ScaleCardProps {
  entry: ScaleEntry;
  isSelected: boolean;
  onLoad: (key: string) => void;
}

/**
 * ScaleCard renders a single scale listing with name, category, description
 * (clamped to 2 lines), formula, interval strip, and a load button.
 */
function ScaleCard({ entry, isSelected, onLoad }: ScaleCardProps) {
  const { key, scale } = entry;
  // The button's name stays its visible text (WCAG 2.5.3); the scale name
  // reaches screen readers as its description.
  const headingId = useId();
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-panel border bg-surface p-4 transition-colors duration-150',
        isSelected ? 'border-ink' : 'border-line hover:border-control',
      )}
    >
      <div>
        <h3 id={headingId} className="text-[15px] leading-snug font-bold text-ink">
          {scale.name}
        </h3>
        <p className="text-xs text-muted">{CATEGORY_NAME.get(scale.category) ?? scale.category}</p>
      </div>

      {scale.description && <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">{scale.description}</p>}

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[13px] whitespace-pre-wrap text-ink">{formatFormula(scale.degrees)}</p>
        <IntervalStrip intervals={scale.intervals} />
      </div>

      {/* "Loaded" stays focusable and still opens Practice; it just reads as done. */}
      <Button
        size="sm"
        variant={isSelected ? 'ghost' : 'secondary'}
        icon={isSelected ? Check : undefined}
        onClick={() => onLoad(key)}
        aria-describedby={headingId}
        className={cn('mt-auto self-start', isSelected && 'border border-line')}
      >
        {isSelected ? 'Loaded' : 'Load on fretboard'}
      </Button>
    </li>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ScalesBrowser component.
 *
 * Renders the Scales section: a search field, category chips, a live result
 * count, and the grid of scale cards.
 */
export default function ScalesBrowser() {
  const selectedScale = useGuitarStore((s) => s.selectedScale);
  const setSelectedScale = useGuitarStore((s) => s.setSelectedScale);
  const setActiveTab = useGuitarStore((s) => s.setActiveTab);
  const scaleSearchQuery = useGuitarStore((s) => s.scaleSearchQuery);
  const setScaleSearchQuery = useGuitarStore((s) => s.setScaleSearchQuery);
  const selectedCategory = useGuitarStore((s) => s.selectedCategory);
  const setSelectedCategory = useGuitarStore((s) => s.setSelectedCategory);

  const visibleScales = useMemo<ScaleEntry[]>(() => {
    // Search narrows the set; a pressed category chip narrows it further
    const base: ScaleEntry[] = scaleSearchQuery.trim()
      ? searchScales(scaleSearchQuery)
      : Object.entries(SCALES).map(([key, scale]) => ({ key, scale }));
    return selectedCategory ? base.filter((e) => e.scale.category === selectedCategory) : base;
  }, [scaleSearchQuery, selectedCategory]);

  /** Loads the scale onto the fretboard and switches to Practice. */
  const handleLoad = (key: string) => {
    setSelectedScale(key);
    setActiveTab('fretboard');
  };

  const clearFilters = () => {
    setScaleSearchQuery('');
    setSelectedCategory(null);
  };

  const query = scaleSearchQuery.trim();
  const categoryName = selectedCategory ? CATEGORY_NAME.get(selectedCategory as Scale['category']) ?? selectedCategory : null;

  return (
    <div className="flex flex-col gap-5">
      <PageTitle>Scale library</PageTitle>

      <div className="flex flex-col gap-3">
        <TextField
          type="search"
          label="Search scales"
          hideLabel
          value={scaleSearchQuery}
          onChange={(e) => setScaleSearchQuery(e.target.value)}
          placeholder="Search scales..."
          className="w-full sm:max-w-sm"
        />

        <div role="group" aria-label="Scale category" className="flex flex-wrap gap-2">
          <Chip pressed={selectedCategory === null} onClick={() => setSelectedCategory(null)}>
            All
          </Chip>
          {SCALE_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <Chip
                key={cat.id}
                pressed={isActive}
                onClick={() => setSelectedCategory(isActive ? null : cat.id)}
                title={cat.description}
              >
                {cat.name}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Result count (announced politely as the filter changes) */}
        <p role="status" className="text-[13px] text-muted">
          <span className="tabular font-mono text-ink">{visibleScales.length}</span> scale
          {visibleScales.length !== 1 ? 's' : ''}
          {query ? ` matching "${query}"` : ''}
          {categoryName ? ` in ${categoryName}` : ''}
        </p>

        {visibleScales.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-4 py-10 text-center">
            <p className="text-sm text-muted">No scales found. Try a different search term or category.</p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {query && categoryName ? 'Clear search and category' : categoryName ? 'Clear category' : 'Clear search'}
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {visibleScales.map((entry) => (
              <ScaleCard
                key={entry.key}
                entry={entry}
                isSelected={entry.key === selectedScale}
                onLoad={handleLoad}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
