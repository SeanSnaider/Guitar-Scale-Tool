import { useGuitarStore } from '../../store/useGuitarStore';
import { cn } from '../../ui';
import { NAV_ITEMS, navItemFor } from './navItems';
import { Wordmark } from './BrandMark';

/**
 * SideNav
 *
 * Primary navigation for tablet and desktop.
 * - >=1024px: a full-height left rail (practice tools, a divider, reference).
 * - 768-1023px: a horizontal top bar.
 * Phones use MobileTabBar instead; this component hides itself below 768px.
 *
 * Destinations switch whole views, so items are buttons marked with
 * aria-current="page" rather than ARIA tabs.
 */
export function SideNav() {
  const activeTab = useGuitarStore((s) => s.activeTab);
  const setActiveTab = useGuitarStore((s) => s.setActiveTab);
  const tuningName = useGuitarStore((s) => s.currentTuning.name);
  const current = navItemFor(activeTab);

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'hidden md:flex',
        // Tablet: top bar
        'sticky top-0 z-40 items-center gap-6 border-b border-line bg-ground/95 px-6 backdrop-blur-sm md:h-14',
        // Desktop: left rail
        'lg:h-dvh lg:flex-col lg:items-stretch lg:gap-0 lg:border-r lg:border-b-0 lg:px-3 lg:pt-5 lg:pb-4',
      )}
    >
      <div className="lg:px-2 lg:pb-6">
        <Wordmark />
      </div>

      <ul className="flex items-center gap-1 lg:flex-col lg:items-stretch lg:gap-0.5">
        {NAV_ITEMS.map((item, i) => {
          const active = item.id === current.id;
          const Icon = item.icon;
          const startsReference = item.group === 'reference' && NAV_ITEMS[i - 1]?.group === 'practice';
          return (
            <li key={item.id} className={cn(startsReference && 'lg:mt-3 lg:border-t lg:border-line lg:pt-3')}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'flex h-9 w-full items-center gap-2.5 rounded-control border px-2.5 text-sm whitespace-nowrap transition-colors duration-150',
                  active
                    ? 'border-line bg-surface font-bold text-ink'
                    : 'border-transparent text-muted hover:bg-sunken hover:text-ink',
                )}
              >
                <Icon size={16} strokeWidth={2} aria-hidden="true" className="hidden lg:block" />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-auto hidden px-2.5 text-xs text-muted lg:block">{tuningName} tuning · A440</p>
    </nav>
  );
}
