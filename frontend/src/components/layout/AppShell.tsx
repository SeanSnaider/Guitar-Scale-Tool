/**
 * AppShell.tsx
 *
 * Root layout component for the Guitar Scale Tool application.
 *
 * Responsibilities:
 *  - Renders the sticky `<NavBar />` at the top of every page.
 *  - Renders the correct tab content based on `activeTab` from the global store.
 *  - On the Fretboard tab at ≥1024 px, displays a three-zone layout:
 *      [FretboardControls full-width]
 *      [Fretboard + Tablature] | [ReferencePanel sidebar 320 px]
 *      [FooterInfoBar full-width]
 *  - At <1024 px on the Fretboard tab, the Reference panel is hidden; it is
 *    only accessible via its own "Reference" navigation tab.
 *  - ChordAI and ProgressDashboard are code-split (React.lazy) to keep the
 *    initial bundle small.
 *  - `<AudioControlsShelf />` is always mounted at the document root level so
 *    its slide-up animation is not clipped by any parent scroll container.
 *
 * @module layout/AppShell
 */

import React, { Suspense, useEffect } from 'react';
import { useGuitarStore } from '../../store/useGuitarStore';
import NavBar from './NavBar';

// ---- Eagerly imported components ----
import Fretboard from '../Fretboard';
import Tablature from '../Tablature';
import ChordDiagrams from '../ChordDiagrams';
import FretboardControls from '../FretboardControls';
import FooterInfoBar from '../FooterInfoBar';
import ReferencePanel from '../ReferencePanel';
import ScalesBrowser from '../ScalesBrowser';
import EarTrainingView from '../EarTrainingView';
import AudioControlsShelf from '../AudioControlsShelf';

// ---- Code-split components (lazy-loaded) ----
// These are loaded on demand to keep the initial JS bundle lean.

/**
 * Lazily loaded ChordAI tab — heavy AI/audio inference logic bundled separately.
 */
const ChordAI = React.lazy(() => import('../ChordAI'));

/**
 * Lazily loaded ProgressDashboard — chart dependencies bundled separately.
 */
const ProgressDashboard = React.lazy(() => import('../ProgressDashboard'));

// ---- Sub-components ----

/**
 * TabLoadingFallback
 *
 * Shown inside `<Suspense>` while a lazily loaded tab component is being
 * fetched.  Matches the app background so there is no jarring flash.
 *
 * @returns A full-width placeholder div.
 */
function TabLoadingFallback() {
  return (
    <div
      style={{
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px',
      }}
      aria-busy="true"
      aria-label="Loading…"
    >
      Loading…
    </div>
  );
}

// ---- Layout helpers ----

/** Human-readable view names, used for document.title. */
const TAB_TITLES: Record<string, string> = {
  fretboard: 'Fretboard',
  scales: 'Scales',
  chords: 'Chords',
  'ear-training': 'Ear Training',
  reference: 'Reference',
  progress: 'Progress',
  chordai: 'ChordAI',
};

/** Common max-width wrapper applied to every tab's content area. */
const CONTENT_STYLE: React.CSSProperties = {
  maxWidth: '1600px',
  margin: '0 auto',
  paddingTop: 'var(--gutter)',
  paddingBottom: 'var(--gutter)',
  paddingLeft: 'var(--gutter-x-left)',
  paddingRight: 'var(--gutter-x-right)',
};

/**
 * FretboardTabContent
 *
 * The Fretboard tab layout:
 *  - FretboardControls spans full width.
 *  - Below that: a flex row containing the main fretboard area and (on ≥1024 px)
 *    a fixed-width ReferencePanel sidebar.
 *  - FooterInfoBar spans full width at the bottom.
 *
 * @returns The rendered fretboard tab content.
 */
function FretboardTabContent() {
  return (
    <main id="main-content" tabIndex={-1} style={CONTENT_STYLE}>
      <h1 className="sr-only">Fretboard</h1>
      {/* Full-width controls bar */}
      <FretboardControls />

      {/* Two-column layout at desktop breakpoint */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        {/* Main fretboard + tablature column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '12px',
              overflowX: 'auto',
            }}
          >
            <Fretboard />
          </div>

          <div style={{ marginTop: '12px' }}>
            <Tablature />
          </div>
        </div>

        {/* Reference panel sidebar — visible only at ≥1024 px via CSS */}
        <div
          className="hidden lg:block"
          style={{
            width: '320px',
            flexShrink: 0,
          }}
        >
          <ReferencePanel />
        </div>
      </div>

      {/* Full-width footer info */}
      <FooterInfoBar />
    </main>
  );
}

/**
 * ScalesTabContent
 *
 * Renders the searchable scale library browser.
 *
 * @returns The rendered scales tab content.
 */
function ScalesTabContent() {
  return (
    <main id="main-content" tabIndex={-1} style={CONTENT_STYLE}>
      <h1 className="sr-only">Scales</h1>
      <ScalesBrowser />
    </main>
  );
}

/**
 * ChordsTabContent
 *
 * Renders the chord diagrams tab.
 *
 * @returns The rendered chords tab content.
 */
function ChordsTabContent() {
  return (
    <main id="main-content" tabIndex={-1} style={CONTENT_STYLE}>
      <h1 className="sr-only">Chords</h1>
      <ChordDiagrams />
    </main>
  );
}

/**
 * EarTrainingTabContent
 *
 * Renders the ear training exercises tab.
 *
 * @returns The rendered ear training tab content.
 */
function EarTrainingTabContent() {
  return (
    <main id="main-content" tabIndex={-1} style={CONTENT_STYLE}>
      <h1 className="sr-only">Ear Training</h1>
      <EarTrainingView />
    </main>
  );
}

/**
 * ReferenceTabContent
 *
 * Renders the reference panel as a full page on narrow screens where it is
 * not shown as a sidebar.  On wide screens a user would typically navigate
 * here from the Fretboard tab's sidebar.
 *
 * @returns The rendered reference tab content.
 */
function ReferenceTabContent() {
  return (
    <main id="main-content" tabIndex={-1} style={CONTENT_STYLE}>
      <h1 className="sr-only">Reference</h1>
      <ReferencePanel />
    </main>
  );
}

/**
 * ProgressTabContent
 *
 * Renders the lazily loaded progress dashboard.
 *
 * @returns The rendered progress tab content wrapped in a Suspense boundary.
 */
function ProgressTabContent() {
  return (
    <main id="main-content" tabIndex={-1} style={CONTENT_STYLE}>
      <h1 className="sr-only">Progress</h1>
      <Suspense fallback={<TabLoadingFallback />}>
        <ProgressDashboard />
      </Suspense>
    </main>
  );
}

/**
 * ChordAITabContent
 *
 * Renders the lazily loaded ChordAI feature tab.
 *
 * @returns The rendered ChordAI tab content wrapped in a Suspense boundary.
 */
function ChordAITabContent() {
  return (
    <main id="main-content" tabIndex={-1} style={CONTENT_STYLE}>
      <h1 className="sr-only">ChordAI</h1>
      <Suspense fallback={<TabLoadingFallback />}>
        <ChordAI />
      </Suspense>
    </main>
  );
}

// ---- Main component ----

/**
 * AppShell
 *
 * The top-level layout wrapper for the entire Guitar Scale Tool UI.
 * Composes the navigation bar, active tab content, and the always-present
 * audio controls shelf into a single cohesive layout.
 *
 * @returns The full application shell element.
 */
function AppShell() {
  const activeTab = useGuitarStore((s) => s.activeTab);
  const isAudioShelfOpen = useGuitarStore((s) => s.isAudioShelfOpen);

  // Name the current view in the browser tab and for assistive tech
  useEffect(() => {
    document.title = `${TAB_TITLES[activeTab] ?? 'Scale Teacher'} · Scale Teacher`;
  }, [activeTab]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-body)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {/*
        While the audio shelf is open it behaves as a modal: everything behind
        it is inert, so Tab and screen readers stay inside the shelf.
      */}
      <div inert={isAudioShelfOpen} style={{ display: 'contents' }}>
        {/* Sticky navigation */}
        <NavBar />
      </div>

      {/* Tab content area; .app-content reserves room for the fixed Controls bar */}
      <div className="app-content" inert={isAudioShelfOpen}>
        {activeTab === 'fretboard' && <FretboardTabContent />}
        {activeTab === 'scales' && <ScalesTabContent />}
        {activeTab === 'chords' && <ChordsTabContent />}
        {activeTab === 'ear-training' && <EarTrainingTabContent />}
        {activeTab === 'reference' && <ReferenceTabContent />}
        {activeTab === 'progress' && <ProgressTabContent />}
        {activeTab === 'chordai' && <ChordAITabContent />}
      </div>

      {/*
        Audio controls shelf — always mounted so its open/close animation
        works correctly.  Manages its own visibility via isAudioShelfOpen.
      */}
      <AudioControlsShelf />
    </div>
  );
}

export default AppShell;
