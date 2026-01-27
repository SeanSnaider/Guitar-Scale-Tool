import { useState, useMemo } from 'react';
import { useGuitarStore } from '../store/useGuitarStore';
import {
  ALL_NOTES,
  SCALES,
  SCALE_CATEGORIES,
  TUNINGS,
  searchScales,
  getScalesByCategory,
  type ScaleCategory,
} from '../data/musicTheory';

export default function Controls() {
  const {
    selectedRoot,
    setSelectedRoot,
    selectedScale,
    setSelectedScale,
    displayMode,
    setDisplayMode,
    showNonScaleNotes,
    setShowNonScaleNotes,
    positionSystem,
    setPositionSystem,
    selectedPosition,
    setSelectedPosition,
    numFrets,
    setNumFrets,
    currentTuning,
    setCurrentTuning,
    scaleSearchQuery,
    setScaleSearchQuery,
    selectedCategory,
    setSelectedCategory,
  } = useGuitarStore();

  const [isScaleDropdownOpen, setIsScaleDropdownOpen] = useState(false);

  // Filter scales based on search and category
  const filteredScales = useMemo(() => {
    if (scaleSearchQuery) {
      return searchScales(scaleSearchQuery);
    }
    if (selectedCategory) {
      return getScalesByCategory(selectedCategory as ScaleCategory);
    }
    return Object.entries(SCALES).map(([key, scale]) => ({ key, scale }));
  }, [scaleSearchQuery, selectedCategory]);

  // Get current scale info
  const currentScale = SCALES[selectedScale];

  // Position options based on system
  const positionCount = positionSystem === 'caged' ? 5 : 7;

  return (
    <div className="space-y-4">
      {/* Root Note Selector */}
      <div className="p-4 bg-[var(--surface)] rounded-lg">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">
          Root Note
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 justify-items-center">
          {ALL_NOTES.map(note => (
            <button
              key={note}
              onClick={() => setSelectedRoot(note)}
              className={`
                w-full min-w-[40px] px-2 py-2 rounded-lg text-sm font-medium transition-all text-center
                ${selectedRoot === note
                  ? 'bg-[var(--primary)] text-[var(--bg)] shadow-md'
                  : note.includes('#')
                    ? 'bg-[var(--elevated)] text-[var(--text-muted)] hover:bg-[var(--border)]'
                    : 'bg-[var(--button)] text-[var(--text)] hover:bg-[var(--button-hover)]'
                }
              `}
            >
              {note}
            </button>
          ))}
        </div>
      </div>

      {/* Scale Selector */}
      <div className="p-4 bg-[var(--surface)] rounded-lg">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">
          Scale Type
        </label>

        {/* Search Input */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search scales..."
            value={scaleSearchQuery}
            onChange={e => {
              setScaleSearchQuery(e.target.value);
              setSelectedCategory(null);
            }}
            className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg
                       text-[var(--text)] placeholder-[var(--text-subtle)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          {scaleSearchQuery && (
            <button
              onClick={() => setScaleSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                         hover:text-[var(--text)] p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setScaleSearchQuery('');
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all
              ${!selectedCategory && !scaleSearchQuery
                ? 'bg-[var(--primary)] text-[var(--bg)]'
                : 'bg-[var(--button)] text-[var(--text-muted)] hover:bg-[var(--button-hover)]'
              }`}
          >
            All
          </button>
          {SCALE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setScaleSearchQuery('');
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                ${selectedCategory === cat.id
                  ? 'bg-[var(--primary)] text-[var(--bg)]'
                  : 'bg-[var(--button)] text-[var(--text-muted)] hover:bg-[var(--button-hover)]'
                }`}
              title={cat.description}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Scale Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsScaleDropdownOpen(!isScaleDropdownOpen)}
            className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-lg
                       text-left text-[var(--text)] flex items-center justify-between
                       hover:border-[var(--primary)] transition-colors"
          >
            <div>
              <span className="font-medium">{currentScale?.name}</span>
              <span className="text-xs text-[var(--text-muted)] ml-2">
                ({currentScale?.category})
              </span>
            </div>
            <span className={`transition-transform ${isScaleDropdownOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {isScaleDropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-[var(--elevated)] border border-[var(--border)]
                            rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredScales.map(({ key, scale }) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedScale(key);
                    setIsScaleDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-[var(--button-hover)] transition-colors
                    ${selectedScale === key ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'text-[var(--text)]'}`}
                >
                  <div className="font-medium text-sm">{scale.name}</div>
                  {scale.description && (
                    <div className="text-xs text-[var(--text-muted)]">{scale.description}</div>
                  )}
                </button>
              ))}
              {filteredScales.length === 0 && (
                <div className="px-4 py-3 text-sm text-[var(--text-muted)] text-center">
                  No scales found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Display Options */}
      <div className="p-4 bg-[var(--surface)] rounded-lg">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">
          Display Mode
        </label>
        <div className="flex gap-2">
          {(['dots', 'notes', 'intervals'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setDisplayMode(mode)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all capitalize
                ${displayMode === mode
                  ? 'bg-[var(--primary)] text-[var(--bg)]'
                  : 'bg-[var(--button)] text-[var(--text)] hover:bg-[var(--button-hover)]'
                }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Show non-scale notes toggle */}
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showNonScaleNotes}
            onChange={e => setShowNonScaleNotes(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border)] bg-[var(--input)]
                       text-[var(--primary)] focus:ring-[var(--primary)]"
          />
          <span className="text-sm text-[var(--text-muted)]">Show non-scale notes (dimmed)</span>
        </label>
      </div>

      {/* Position System */}
      <div className="p-4 bg-[var(--surface)] rounded-lg">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">
          Position System
        </label>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => {
              setPositionSystem('caged');
              setSelectedPosition(1);
            }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${positionSystem === 'caged'
                ? 'bg-[var(--primary)] text-[var(--bg)]'
                : 'bg-[var(--button)] text-[var(--text)] hover:bg-[var(--button-hover)]'
              }`}
          >
            CAGED (5)
          </button>
          <button
            onClick={() => {
              setPositionSystem('3nps');
              setSelectedPosition(1);
            }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${positionSystem === '3nps'
                ? 'bg-[var(--primary)] text-[var(--bg)]'
                : 'bg-[var(--button)] text-[var(--text)] hover:bg-[var(--button-hover)]'
              }`}
          >
            3NPS (7)
          </button>
        </div>

        {/* Position Selector */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedPosition(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${selectedPosition === null
                ? 'bg-[var(--secondary)] text-[var(--bg)]'
                : 'bg-[var(--button)] text-[var(--text-muted)] hover:bg-[var(--button-hover)]'
              }`}
          >
            All
          </button>
          {Array.from({ length: positionCount }, (_, i) => i + 1).map(pos => (
            <button
              key={pos}
              onClick={() => setSelectedPosition(pos)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${selectedPosition === pos
                  ? 'bg-[var(--primary)] text-[var(--bg)]'
                  : 'bg-[var(--button)] text-[var(--text-muted)] hover:bg-[var(--button-hover)]'
                }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Tuning & Frets */}
      <div className="p-4 bg-[var(--surface)] rounded-lg">
        <div className="grid grid-cols-2 gap-4">
          {/* Tuning */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-2">
              Tuning
            </label>
            <select
              value={Object.keys(TUNINGS).find(
                k => TUNINGS[k].notes.join(',') === currentTuning.notes.join(',')
              ) || 'standard'}
              onChange={e => setCurrentTuning(TUNINGS[e.target.value])}
              className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg
                         text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              {Object.entries(TUNINGS).map(([key, tuning]) => (
                <option key={key} value={key}>
                  {tuning.name}
                </option>
              ))}
            </select>
          </div>

          {/* Frets */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-2">
              Frets: {numFrets}
            </label>
            <input
              type="range"
              min={12}
              max={24}
              value={numFrets}
              onChange={e => setNumFrets(parseInt(e.target.value))}
              className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer
                         accent-[var(--primary)]"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
              <span>12</span>
              <span>24</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
