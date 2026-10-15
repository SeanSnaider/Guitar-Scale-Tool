/**
 * ScalesBrowser.tsx
 *
 * Full Scales tab — lets users browse, search, and filter all built-in scales.
 * Selecting a scale loads it onto the fretboard and navigates to the Fretboard tab.
 *
 * Features:
 * - Text search across scale name, key, category and description
 * - Category filter pills (All + each ScaleCategory)
 * - Scrollable grid of scale cards showing name, category badge, description,
 *   degree formula, and a "Load on Fretboard" action
 * - Currently selected scale is highlighted with an amber border
 *
 * Dependencies:
 * - useGuitarStore: selectedRoot, selectedScale, setSelectedScale, setActiveTab,
 *   scaleSearchQuery, setScaleSearchQuery, selectedCategory, setSelectedCategory
 * - musicTheory: SCALES, SCALE_CATEGORIES, searchScales, getScalesByCategory
 */

import { useMemo } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import {
  SCALES,
  SCALE_CATEGORIES,
  searchScales,
  getScalesByCategory,
  type ScaleCategory,
} from '../data/musicTheory';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A resolved scale entry with its registry key attached. */
interface ScaleEntry {
  key: string;
  name: string;
  category: ScaleCategory;
  description: string;
  degrees: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a degrees array into a spaced formula string.
 *
 * @param degrees - Degree labels e.g. ["1", "2", "b3", "4", "5", "b6", "b7"].
 * @returns A space-separated formula string like "1  2  b3  4  5  b6  b7".
 */
function formatFormula(degrees: string[]): string {
  return degrees.join('  ');
}

/**
 * Builds the full flat list of all SCALES entries for browsing when no
 * search query is active.
 *
 * @returns Array of ScaleEntry objects sorted by category then name.
 */
function getAllScaleEntries(): ScaleEntry[] {
  return Object.entries(SCALES).map(([key, scale]) => ({
    key,
    name: scale.name,
    category: scale.category,
    description: scale.description ?? '',
    degrees: scale.degrees,
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Props for a single scale card in the browser grid. */
interface ScaleCardProps {
  entry: ScaleEntry;
  isSelected: boolean;
  onLoad: (key: string) => void;
}

/**
 * ScaleCard renders a single scale listing with name, category badge,
 * description (clamped to 2 lines), degree formula, and a load button.
 *
 * @param entry - The scale data to display.
 * @param isSelected - Whether this scale is currently active on the fretboard.
 * @param onLoad - Callback invoked with the scale key when the user clicks "Load on Fretboard".
 */
function ScaleCard({ entry, isSelected, onLoad }: ScaleCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        borderRadius: '8px',
        padding: '16px',
        border: isSelected
          ? '1px solid var(--accent-primary)'
          : '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Scale name + category badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <span
          style={{
            fontSize: '15px',
            fontWeight: isSelected ? 600 : 400,
            color: isSelected ? 'var(--accent-primary)' : 'var(--text-body)',
            lineHeight: 1.3,
          }}
        >
          {entry.name}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            padding: '2px 6px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {entry.category}
        </span>
      </div>

      {/* Description */}
      {entry.description && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            margin: 0,
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as React.CSSProperties}
        >
          {entry.description}
        </p>
      )}

      {/* Degree formula */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          color: 'var(--accent-glow)',
          letterSpacing: '0.02em',
        }}
      >
        {formatFormula(entry.degrees)}
      </div>

      {/* Load button */}
      <button
        type="button"
        onClick={() => onLoad(entry.key)}
        aria-label={isSelected ? `${entry.name}, currently loaded` : `Load ${entry.name} on fretboard`}
        style={{
          marginTop: '4px',
          background: isSelected ? 'var(--accent-primary)' : 'var(--bg-elevated)',
          color: isSelected ? 'var(--on-accent)' : 'var(--text-secondary)',
          fontWeight: isSelected ? 600 : 400,
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '13px',
          cursor: 'pointer',
          transition: 'background 0.15s ease, color 0.15s ease',
          alignSelf: 'flex-start',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)';
          }
        }}
      >
        {isSelected ? 'Currently Loaded' : 'Load on Fretboard'}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ScalesBrowser component.
 *
 * Renders the full Scales tab: a search bar, category filter pills,
 * and a scrollable grid of scale cards. Selecting a scale loads it on
 * the fretboard and navigates to the Fretboard tab.
 *
 * @returns The rendered scales browser panel.
 */
export default function ScalesBrowser() {
  const {
    selectedScale,
    setSelectedScale,
    setActiveTab,
    scaleSearchQuery,
    setScaleSearchQuery,
    selectedCategory,
    setSelectedCategory,
  } = useGuitarStore();

  /**
   * Resolves the list of scale entries to display based on the current
   * search query and active category filter.
   */
  const visibleScales = useMemo<ScaleEntry[]>(() => {
    if (scaleSearchQuery.trim()) {
      // Search mode: category filter is ignored while a query is present
      return searchScales(scaleSearchQuery).map(({ key, scale }) => ({
        key,
        name: scale.name,
        category: scale.category,
        description: scale.description ?? '',
        degrees: scale.degrees,
      }));
    }

    if (selectedCategory) {
      return getScalesByCategory(selectedCategory as ScaleCategory).map(({ key, scale }) => ({
        key,
        name: scale.name,
        category: scale.category,
        description: scale.description ?? '',
        degrees: scale.degrees,
      }));
    }

    return getAllScaleEntries();
  }, [scaleSearchQuery, selectedCategory]);

  /**
   * Loads the given scale key onto the fretboard and switches to the Fretboard tab.
   *
   * @param key - The SCALES registry key to activate.
   */
  const handleLoad = (key: string) => {
    setSelectedScale(key);
    setActiveTab('fretboard');
  };

  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        minHeight: '100%',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Page header */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          fontWeight: 400,
          color: 'var(--accent-glow)',
          margin: '0 0 20px 0',
        }}
      >
        Scale Library
      </h2>

      {/* Search input */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="search"
          aria-label="Search scales"
          value={scaleSearchQuery}
          onChange={(e) => setScaleSearchQuery(e.target.value)}
          placeholder="Search scales..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-input)',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '16px', // 16px keeps iOS Safari from zooming on focus
            color: 'var(--text-body)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-primary)33';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-input)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Category filter pills */}
      <div
        role="group"
        aria-label="Scale category"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '20px',
        }}
      >
        {/* "All" pill */}
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          aria-pressed={selectedCategory === null}
          style={{
            background: selectedCategory === null ? 'var(--accent-primary)' : 'var(--bg-elevated)',
            color: selectedCategory === null ? 'var(--on-accent)' : 'var(--text-secondary)',
            fontWeight: selectedCategory === null ? 600 : 400,
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
        >
          All
        </button>

        {SCALE_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(isActive ? null : cat.id)}
              aria-pressed={isActive}
              title={cat.description}
              style={{
                background: isActive ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: isActive ? 'var(--on-accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Result count (announced politely as the filter changes) */}
      <div
        role="status"
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          marginBottom: '12px',
        }}
      >
        {visibleScales.length} scale{visibleScales.length !== 1 ? 's' : ''}
        {scaleSearchQuery.trim() ? ` matching "${scaleSearchQuery.trim()}"` : ''}
      </div>

      {/* Scale grid */}
      {visibleScales.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}
        >
          No scales found. Try a different search term or category.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
          }}
        >
          {visibleScales.map((entry) => (
            <ScaleCard
              key={entry.key}
              entry={entry}
              isSelected={entry.key === selectedScale}
              onLoad={handleLoad}
            />
          ))}
        </div>
      )}
    </div>
  );
}
