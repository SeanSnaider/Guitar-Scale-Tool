import { useGuitarStore } from '../../store/useGuitarStore';
import { cn } from '../../ui';
import { NAV_ITEMS, navItemFor } from './navItems';
import { BrandMark } from './BrandMark';

/**
 * MobileTabBar
 *
 * Bottom navigation on phones (<768px): all five destinations, icon over
 * label, thumb-reachable and clear of the home indicator.
 */
export function MobileTabBar() {
  const activeTab = useGuitarStore((s) => s.activeTab);
  const setActiveTab = useGuitarStore((s) => s.setActiveTab);
  const current = navItemFor(activeTab);

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-[var(--tabbar-h)] grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = item.id === current.id;
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px]',
                  active ? 'font-bold text-ink' : 'text-muted',
                )}
              >
                {active && <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 rounded-full bg-ink" />}
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Compact top bar on phones: the wordmark and the current view's name. */
export function MobileHeader() {
  const activeTab = useGuitarStore((s) => s.activeTab);
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-ground/95 px-4 backdrop-blur-sm md:hidden">
      <span className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.01em]">
        <BrandMark size={20} />
        Scale Teacher
      </span>
      <span className="text-[13px] text-muted">{navItemFor(activeTab).label}</span>
    </header>
  );
}
