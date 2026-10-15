/**
 * AppShell.tsx
 *
 * The app's frame:
 *   - >=1024px: left rail (SideNav) | the current view, transport bar fixed
 *     along the bottom of the view column.
 *   - 768-1023px: SideNav becomes a top bar.
 *   - <768px: compact header on top, transport bar above a bottom tab bar.
 *
 * Every view renders inside one <main> with a visually hidden <h1> naming it.
 * ChordAI and Progress are code-split (React.lazy).
 */
import React, { Suspense, useEffect } from 'react';
import { useGuitarStore } from '../../store/useGuitarStore';
import { SideNav } from '../shell/SideNav';
import { MobileHeader, MobileTabBar } from '../shell/MobileTabBar';
import { TransportBar } from '../shell/TransportBar';
import { navItemFor } from '../shell/navItems';
import PracticeView from '../../views/PracticeView';
import LibraryView from '../../views/LibraryView';
import EarTrainingView from '../ear-training/EarTrainingView';

const ChordAI = React.lazy(() => import('../ChordAI'));
const ProgressDashboard = React.lazy(() => import('../ProgressDashboard'));

/** Shown while a code-split view loads. */
function ViewLoading() {
  return (
    <p aria-busy="true" className="py-16 text-center text-[13px] text-muted">
      Loading…
    </p>
  );
}

/** Standard padding and measure for every view except Practice (edge to edge). */
function ViewFrame({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className={`mx-auto w-full px-[var(--gutter)] pt-6 pb-8 ${narrow ? 'max-w-[760px]' : 'max-w-[1120px]'}`}>
      {children}
    </div>
  );
}

function AppShell() {
  const activeTab = useGuitarStore((s) => s.activeTab);
  const view = navItemFor(activeTab);

  // Name the current view in the browser tab
  useEffect(() => {
    document.title = `${view.label} · Scale Teacher`;
  }, [view.label]);

  let content: React.ReactNode;
  switch (view.id) {
    case 'ear-training':
      content = (
        <ViewFrame narrow>
          <EarTrainingView />
        </ViewFrame>
      );
      break;
    case 'chordai':
      content = (
        <ViewFrame narrow>
          <Suspense fallback={<ViewLoading />}>
            <ChordAI />
          </Suspense>
        </ViewFrame>
      );
      break;
    case 'library':
      content = (
        <ViewFrame>
          <LibraryView />
        </ViewFrame>
      );
      break;
    case 'progress':
      content = (
        <ViewFrame>
          <Suspense fallback={<ViewLoading />}>
            <ProgressDashboard />
          </Suspense>
        </ViewFrame>
      );
      break;
    default:
      content = <PracticeView />;
  }

  return (
    <div className="min-h-dvh bg-ground lg:grid lg:grid-cols-[var(--rail-w)_minmax(0,1fr)]">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SideNav />
      <MobileHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 pb-[calc(var(--transport-h)+var(--tabbar-h)+env(safe-area-inset-bottom))] md:pb-[calc(var(--transport-h)+env(safe-area-inset-bottom))]"
      >
        <h1 className="sr-only">{view.label}</h1>
        {content}
      </main>
      <TransportBar />
      <MobileTabBar />
    </div>
  );
}

export default AppShell;
