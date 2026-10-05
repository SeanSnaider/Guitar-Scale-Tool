/**
 * ReferencePanel.tsx
 *
 * The main Reference Panel container for the Guitar Scale Tool.
 *
 * Composes four sub-cards:
 *   1. ScaleInfoCard  — name, category, description, degree formula, legend
 *   2. IntervalsList  — each note mapped to its interval name
 *   3. RelatedScales  — clickable links to musically related scales
 *   4. PatternSelector — CAGED/3NPS toggle and numbered position buttons
 *
 * Optionally rendered between two layout modes via the `asSidebar` prop:
 *   - `asSidebar=true`  → sticky right-side sidebar (desktop, ≥ 1024 px)
 *   - `asSidebar=false` → full-width tab panel (mobile / dedicated Reference tab)
 *
 * All scale data is read from the global Zustand store. No local state.
 *
 * Styled with Studio Walnut CSS custom properties — no hardcoded hex values.
 */

import React from 'react';
import { SCALES } from '../../data/musicTheory';
import { useGuitarStore } from '../../store/useGuitarStore';
import ScaleInfoCard from './ScaleInfoCard';
import IntervalsList from './IntervalsList';
import RelatedScales from './RelatedScales';
import PatternSelector from './PatternSelector';

// ---- Types ----------------------------------------------------------------

/**
 * Props for ReferencePanel.
 */
interface ReferencePanelProps {
  /**
   * When true, renders as a sticky sidebar with a fixed 320 px width.
   * When false (default), renders as a full-width panel suitable for a tab view.
   */
  asSidebar?: boolean;
}

// ---- Component ------------------------------------------------------------

/**
 * ReferencePanel
 *
 * Renders all reference sub-panels for the currently selected scale.
 * Adapts its layout between sidebar and full-tab modes via the `asSidebar` prop.
 *
 * @param props.asSidebar - Whether to render as a sticky sidebar (default: false).
 * @returns The rendered reference panel element.
 */
function ReferencePanel({ asSidebar = false }: ReferencePanelProps): React.ReactElement {
  const selectedRoot = useGuitarStore((state) => state.selectedRoot);
  const selectedScale = useGuitarStore((state) => state.selectedScale);

  const scale = SCALES[selectedScale];

  /** Sidebar-specific container style applied when `asSidebar` is true. */
  const sidebarStyle: React.CSSProperties = asSidebar
    ? {
        width: '320px',
        flexShrink: 0,
        overflowY: 'auto',
        height: 'calc(100vh - 80px)',
        position: 'sticky',
        top: '64px',
      }
    : {};

  return (
    <aside
      style={{
        background: 'var(--bg-primary)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...sidebarStyle,
      }}
    >
      {/* 1. Core scale identity */}
      <ScaleInfoCard root={selectedRoot} scaleKey={selectedScale} />

      {/* 2. Note → interval mapping */}
      <IntervalsList root={selectedRoot} scaleKey={selectedScale} />

      {/* 3. Common uses — only shown when the scale defines it */}
      {scale?.commonUses && (
        <CommonUsesCard commonUses={scale.commonUses} />
      )}

      {/* 4. Related scales navigation */}
      <RelatedScales scaleKey={selectedScale} root={selectedRoot} />

      {/* 5. Pattern (CAGED / 3NPS) selector */}
      <PatternSelector />
    </aside>
  );
}

// ---- Sub-component --------------------------------------------------------

/**
 * CommonUsesCard
 *
 * Renders a compact card displaying the prose "common uses" text for the
 * current scale. Shown only when `scale.commonUses` is defined.
 *
 * @param props.commonUses - Prose string describing genres and contexts.
 * @returns The rendered common uses card element.
 */
function CommonUsesCard({ commonUses }: { commonUses: string }): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
        }}
      >
        Common Uses
      </p>
      <p
        style={{
          margin: 0,
          fontSize: '13px',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        {commonUses}
      </p>
    </div>
  );
}

export default ReferencePanel;
