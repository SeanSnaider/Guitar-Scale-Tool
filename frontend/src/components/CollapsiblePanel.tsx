import { useState, ReactNode } from 'react';

interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

export default function CollapsiblePanel({
  title,
  children,
  defaultOpen = true,
  badge,
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-[var(--surface)] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between
                   hover:bg-[var(--button-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text)]">{title}</span>
          {badge !== undefined && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full
                           bg-[var(--primary)] text-[var(--bg)]">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      <div
        className={`transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}
