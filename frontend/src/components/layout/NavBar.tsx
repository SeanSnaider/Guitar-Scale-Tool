/**
 * NavBar.tsx
 *
 * Sticky top navigation bar for the Guitar Scale Tool application.
 *
 * Renders:
 *  - A logo mark (SVG guitar-string icon) + "Scale Teacher" wordmark on the left.
 *  - 7 navigation tabs that update the global `activeTab` store value.
 *  - On desktop (≥768 px): all 7 tabs are visible inline.
 *  - On mobile (<768 px): the first 4 tabs are visible; the remaining 3 collapse
 *    into a "More ▾" dropdown menu.
 *  - A small ⚙ button on the right that opens the audio controls shelf.
 *
 * Uses CSS custom properties from the Studio Walnut design system for all colours.
 * Tab transitions are 150 ms ease to feel snappy without being jarring.
 */

import { useState, useRef, useEffect } from 'react';
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
 * GuitarStringIcon
 *
 * A minimal SVG representing three guitar strings of varying thickness,
 * used as the app logo mark.
 *
 * @param className - Optional extra CSS classes for sizing.
 */
function GuitarStringIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 20"
      width="24"
      height="20"
      aria-hidden="true"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* High string — thinnest (1 px) */}
      <line x1="0" y1="4" x2="24" y2="4" stroke="#EF9F27" strokeWidth="1" />
      {/* Mid string — medium (1.5 px) */}
      <line x1="0" y1="10" x2="24" y2="10" stroke="#EF9F27" strokeWidth="1.5" />
      {/* Low string — thickest (2.5 px) */}
      <line x1="0" y1="16" x2="24" y2="16" stroke="#EF9F27" strokeWidth="2.5" />
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
  const setIsAudioShelfOpen = useGuitarStore((s) => s.setIsAudioShelfOpen);

  /** Controls visibility of the "More" overflow dropdown on mobile. */
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  /** Ref used to detect clicks outside the dropdown so it can be closed. */
  const moreRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when the user clicks outside it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };

    if (isMoreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  /** Whether any overflow tab is currently active (used to style the "More" button). */
  const isOverflowTabActive = MOBILE_OVERFLOW_TABS.some((t) => t.id === activeTab);

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
      aria-label="Main navigation"
    >
      <div
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          height: '52px',
          gap: '8px',
        }}
      >
        {/* ---- Logo ---- */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            marginRight: '16px',
          }}
        >
          <GuitarStringIcon />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-primary)',
              fontSize: '16px',
              fontWeight: 'normal',
              letterSpacing: '0.01em',
              lineHeight: 1,
            }}
          >
            Scale Teacher
          </span>
        </div>

        {/* ---- Desktop tabs (≥768 px) ---- */}
        <div
          className="hidden md:flex"
          style={{ flex: 1, alignItems: 'center', gap: '2px' }}
          role="tablist"
          aria-label="Navigation tabs"
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

        {/* ---- Mobile primary tabs (<768 px) ---- */}
        <div
          className="flex md:hidden"
          style={{ flex: 1, alignItems: 'center', gap: '2px', overflowX: 'auto' }}
          role="tablist"
          aria-label="Navigation tabs"
        >
          {MOBILE_PRIMARY_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onSelect={handleTabSelect}
            />
          ))}

          {/* "More ▾" overflow button */}
          <div ref={moreRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setIsMoreOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={isMoreOpen}
              style={{
                padding: '6px 10px',
                fontSize: '13px',
                fontFamily: 'var(--font-body)',
                fontWeight: isOverflowTabActive ? 500 : 400,
                color: isOverflowTabActive
                  ? 'var(--accent-primary)'
                  : 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                borderBottom: isOverflowTabActive
                  ? '2px solid var(--accent-primary)'
                  : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 150ms ease',
                whiteSpace: 'nowrap',
                height: '52px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              More ▾
            </button>

            {/* Dropdown panel */}
            {isMoreOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  minWidth: '140px',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  zIndex: 100,
                  overflow: 'hidden',
                  animation: 'fade-in 150ms ease',
                }}
                role="menu"
              >
                {MOBILE_OVERFLOW_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    role="menuitem"
                    onClick={() => handleTabSelect(tab.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 16px',
                      fontSize: '13px',
                      fontFamily: 'var(--font-body)',
                      fontWeight: activeTab === tab.id ? 500 : 400,
                      color:
                        activeTab === tab.id
                          ? 'var(--accent-primary)'
                          : 'var(--text-secondary)',
                      background:
                        activeTab === tab.id ? 'var(--border-subtle)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'color 150ms ease, background 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== tab.id) {
                        (e.currentTarget as HTMLButtonElement).style.color =
                          'var(--accent-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== tab.id) {
                        (e.currentTarget as HTMLButtonElement).style.color =
                          'var(--text-secondary)';
                      }
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---- Audio shelf toggle ---- */}
        <button
          onClick={() => setIsAudioShelfOpen(true)}
          title="Open audio controls"
          aria-label="Open audio controls"
          style={{
            flexShrink: 0,
            marginLeft: '8px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'color 150ms ease, border-color 150ms ease',
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.color = 'var(--accent-primary)';
            btn.style.borderColor = 'var(--border-input)';
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.color = 'var(--text-secondary)';
            btn.style.borderColor = 'var(--border-subtle)';
          }}
        >
          ⚙
        </button>
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
 * An individual navigation tab button.  Applies the `.tab-active` or
 * `.tab-inactive` utility class from the design system plus an inline
 * height so the bottom border aligns flush with the nav bar bottom edge.
 *
 * @param tab      - The tab metadata (id + label).
 * @param isActive - Whether this tab is the currently selected one.
 * @param onSelect - Callback invoked with the tab id when clicked.
 */
function TabButton({ tab, isActive, onSelect }: TabButtonProps) {
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect(tab.id)}
      className={isActive ? 'tab-active' : 'tab-inactive'}
      style={{
        padding: '0 12px',
        height: '52px',
        fontSize: '13px',
        fontFamily: 'var(--font-body)',
        background: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'color 150ms ease, border-color 150ms ease',
        letterSpacing: 'normal',
      }}
    >
      {tab.label}
    </button>
  );
}

export default NavBar;
