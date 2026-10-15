/**
 * NavBar.tsx
 *
 * Sticky top navigation bar for the Guitar Scale Tool application.
 *
 * Renders:
 *  - A logo mark (SVG fretboard slice) + "Scale Teacher" wordmark on the left.
 *  - 7 navigation tabs that update the global `activeTab` store value.
 *  - On desktop (≥768 px): all 7 tabs are visible inline in a single 52 px row.
 *  - On mobile (<768 px): the logo sits on top, with a full-width row
 *    below holding the first 4 tabs and a "More ▾" menu for the other 3.
 *    Layout lives in the `.app-nav*` rules in index.css.
 *  - Audio controls open from the "Controls" bar at the bottom of the screen
 *    (AudioControlsShelf); the nav has no separate settings button.
 *
 * Uses CSS custom properties from the Studio Walnut design system for all colours.
 * Tab transitions are 150 ms ease to feel snappy without being jarring.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useGuitarStore } from '../../store/useGuitarStore';

// ---- Types ----

/** Discriminated union of every navigable tab id. */
type TabId =
  | 'fretboard'
  | 'scales'
  | 'chords'
  | 'ear-training'
  | 'reference'
  | 'progress'
  | 'chordai';

interface TabDefinition {
  id: TabId;
  label: string;
}

// ---- Constants ----

/** Full ordered list of navigation tabs. */
const ALL_TABS: TabDefinition[] = [
  { id: 'fretboard',    label: 'Fretboard'    },
  { id: 'scales',       label: 'Scales'       },
  { id: 'chords',       label: 'Chords'       },
  { id: 'ear-training', label: 'Ear Training' },
  { id: 'reference',    label: 'Reference'    },
  { id: 'progress',     label: 'Progress'     },
  { id: 'chordai',      label: 'ChordAI'      },
];

/** Tabs shown directly in the nav on mobile (<768 px). */
const MOBILE_PRIMARY_TABS = ALL_TABS.slice(0, 4);

/** Tabs hidden behind "More ▾" on mobile. */
const MOBILE_OVERFLOW_TABS = ALL_TABS.slice(4);

// ---- Sub-components ----

/**
 * FretMark
 *
 * Logo mark: a short slice of fretboard seen face-on. Two fret wires cross
 * three strings, with one amber inlay dot between them. The vertical frets
 * keep it from reading as a three-line menu icon.
 *
 * @param className - Optional extra CSS classes for sizing.
 */
function FretMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Fretboard slice */}
      <rect x="1" y="3" width="22" height="18" rx="3" fill="var(--fretboard-bg)" />
      {/* Fret wires */}
      <line x1="6.5" y1="3" x2="6.5" y2="21" stroke="var(--nut-color)" strokeWidth="1.5" />
      <line x1="17.5" y1="3" x2="17.5" y2="21" stroke="var(--nut-color)" strokeWidth="1.5" />
      {/* Strings, thicker toward the bass side */}
      <line x1="1" y1="7.5" x2="23" y2="7.5" stroke="var(--string-color)" strokeWidth="0.75" />
      <line x1="1" y1="12" x2="23" y2="12" stroke="var(--string-color)" strokeWidth="1" />
      <line x1="1" y1="16.5" x2="23" y2="16.5" stroke="var(--string-color)" strokeWidth="1.4" />
      {/* Inlay dot */}
      <circle cx="12" cy="12" r="3.4" fill="var(--accent-primary)" />
    </svg>
  );
}

// ---- Main component ----

/**
 * NavBar
 *
 * Sticky top navigation bar.  Reads `activeTab` and `setActiveTab` from
 * the global store to highlight the current section and switch views.
 * Also exposes the audio shelf toggle via `setIsAudioShelfOpen`.
 *
 * @returns The rendered sticky navigation bar element.
 */
function NavBar() {
  const activeTab = useGuitarStore((s) => s.activeTab);
  const setActiveTab = useGuitarStore((s) => s.setActiveTab);

  /** Controls visibility of the "More" overflow dropdown on mobile. */
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  /** Ref used to detect clicks outside the dropdown so it can be closed. */
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** Item to focus when the menu opens: 'first' / 'last' for keyboard opens, null for pointer opens. */
  const [initialMenuFocus, setInitialMenuFocus] = useState<'first' | 'last' | null>(null);

  // Close the dropdown on an outside press (mouse or touch) or on Escape
  useEffect(() => {
    if (!isMoreOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreOpen]);

  /**
   * Handles a tab selection event.
   * Updates the store and closes any open overflow menu.
   *
   * @param id - The tab identifier to navigate to.
   */
  const handleTabSelect = (id: TabId) => {
    setActiveTab(id);
    setIsMoreOpen(false);
  };

  // Move focus into the menu when it was opened from the keyboard
  useEffect(() => {
    if (!isMoreOpen || !initialMenuFocus) return;
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (!items?.length) return;
    (initialMenuFocus === 'first' ? items[0] : items[items.length - 1]).focus();
  }, [isMoreOpen, initialMenuFocus]);

  /** Opens the menu from the keyboard (Enter/Space/ArrowDown → first item, ArrowUp → last). */
  const handleMoreKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setInitialMenuFocus(event.key === 'ArrowUp' ? 'last' : 'first');
      setIsMoreOpen(true);
    }
  };

  /** Roving focus inside the open menu, per the WAI-ARIA menu button pattern. */
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'Tab') setIsMoreOpen(false);

    if (next !== null) {
      event.preventDefault();
      items[next].focus();
    }
  };

  /** Whether any overflow tab is currently active (used to style the "More" button). */
  const isOverflowTabActive = MOBILE_OVERFLOW_TABS.some((t) => t.id === activeTab);

  return (
    <nav className="app-nav" aria-label="Main navigation">
      <div className="app-nav__bar">
        {/* ---- Logo ---- */}
        <div
          className="app-nav__brand"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minHeight: 'var(--nav-h)',
          }}
        >
          <FretMark />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-primary)',
              fontSize: '16px',
              fontWeight: 'normal',
              letterSpacing: '0.01em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            Scale Teacher
          </span>
        </div>

        {/* ---- Wide screens (>=768 px): every tab inline ---- */}
        <div
          className="app-nav__tabs app-nav__tabs--wide"
          style={{ gap: '2px' }}
        >
          {ALL_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onSelect={handleTabSelect}
            />
          ))}
        </div>

        {/* ---- Phones (<768 px): full-width row of primary tabs + pinned "More" ---- */}
        <div className="app-nav__tabs app-nav__tabs--narrow">
          <div className="app-nav__scroller">
            {MOBILE_PRIMARY_TABS.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onSelect={handleTabSelect}
              />
            ))}
          </div>

          {/* "More" lives outside the scroller so its menu can overflow the nav */}
          <div ref={moreRef} className="app-nav__more">
            <button
              ref={moreButtonRef}
              type="button"
              id="nav-more-button"
              className={`nav-tab ${isOverflowTabActive ? 'tab-active' : 'tab-inactive'}`}
              onClick={() => {
                setInitialMenuFocus(null);
                setIsMoreOpen((prev) => !prev);
              }}
              onKeyDown={handleMoreKeyDown}
              aria-haspopup="menu"
              aria-expanded={isMoreOpen}
              aria-controls={isMoreOpen ? 'nav-more-menu' : undefined}
              aria-label={
                isOverflowTabActive
                  ? `More: ${MOBILE_OVERFLOW_TABS.find((t) => t.id === activeTab)?.label}`
                  : 'More'
              }
            >
              More <span aria-hidden="true">▾</span>
            </button>

            {isMoreOpen && (
              <div
                ref={menuRef}
                id="nav-more-menu"
                className="app-nav__menu"
                role="menu"
                aria-labelledby="nav-more-button"
                onKeyDown={handleMenuKeyDown}
              >
                {MOBILE_OVERFLOW_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className="app-nav__menu-item"
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    onClick={() => {
                      handleTabSelect(tab.id);
                      moreButtonRef.current?.focus();
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </nav>
  );
}

// ---- TabButton helper ----

interface TabButtonProps {
  tab: TabDefinition;
  isActive: boolean;
  onSelect: (id: TabId) => void;
}

/**
 * TabButton
 *
 * An individual navigation button.  These switch whole views rather than
 * in-page panels, so they are plain buttons marked with `aria-current="page"`
 * instead of ARIA tabs (which would promise arrow-key behaviour and tabpanels).
 * `.nav-tab` sets the height (52 px in the single-row bar, 44 px in the phone
 * tab row) so the bottom border sits flush with the nav edge;
 * `.tab-active` / `.tab-inactive` set the colours.
 *
 * @param tab      - The tab metadata (id + label).
 * @param isActive - Whether this tab is the currently selected one.
 * @param onSelect - Callback invoked with the tab id when clicked.
 */
function TabButton({ tab, isActive, onSelect }: TabButtonProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onSelect(tab.id)}
      className={`nav-tab ${isActive ? 'tab-active' : 'tab-inactive'}`}
    >
      {tab.label}
    </button>
  );
}

export default NavBar;
