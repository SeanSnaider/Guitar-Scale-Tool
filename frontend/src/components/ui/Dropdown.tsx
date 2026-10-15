/**
 * Dropdown.tsx
 *
 * A styled select dropdown component following the Studio Walnut design system.
 * Renders a labelled `<select>` element with amber-on-dark aesthetics, grouping
 * options into `<optgroup>` elements when the `group` field is present.
 *
 * Usage:
 *   <Dropdown
 *     label="Root Note"
 *     value={selectedRoot}
 *     onChange={setSelectedRoot}
 *     options={ALL_NOTES.map(n => ({ value: n, label: n }))}
 *   />
 */

import React, { useId } from 'react';

/** A single selectable option, optionally grouped. */
export interface DropdownOption {
  value: string;
  label: string;
  /** When provided, options with the same group string are grouped together. */
  group?: string;
}

/** Props for the Dropdown component. */
export interface DropdownProps {
  /** Small label rendered above the select element. */
  label: string;
  /** Currently selected value. */
  value: string;
  /** Called when the user picks a different option. */
  onChange: (value: string) => void;
  /** All available options; may be grouped via the `group` field. */
  options: DropdownOption[];
  /** Optional extra class names applied to the outer wrapper. */
  className?: string;
}

/**
 * Dropdown
 *
 * Studio-Walnut styled select with an amber focus ring, grouped `<optgroup>`
 * support, and a chevron pseudo-element provided via inline background SVG.
 *
 * @param props - {@link DropdownProps}
 * @returns The rendered dropdown element.
 */
export default function Dropdown({
  label,
  value,
  onChange,
  options,
  className = '',
}: DropdownProps): React.ReactElement {
  // Partition options into groups for <optgroup> rendering
  const grouped = React.useMemo<Map<string | undefined, DropdownOption[]>>(() => {
    const map = new Map<string | undefined, DropdownOption[]>();
    for (const opt of options) {
      const key = opt.group ?? undefined;
      const existing = map.get(key);
      if (existing) {
        existing.push(opt);
      } else {
        map.set(key, [opt]);
      }
    }
    return map;
  }, [options]);

  // Chevron SVG encoded as a data URL for the custom arrow
  const chevronUrl =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23A89F90' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")";

  const selectId = useId();

  const hasGroups = grouped.size > 1 || (grouped.size === 1 && grouped.keys().next().value !== undefined);

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Label */}
      <label
        htmlFor={selectId}
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-body)',
          userSelect: 'none',
        }}
      >
        {label}
      </label>

      {/* Select */}
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-input)',
          color: 'var(--accent-glow)',
          padding: '6px 32px 6px 10px',
          borderRadius: 6,
          fontSize: 14,
          fontFamily: 'var(--font-body)',
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          backgroundImage: chevronUrl,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          width: '100%',
          minWidth: 120,
        }}
      >
        {hasGroups
          ? Array.from(grouped.entries()).map(([groupName, groupOpts]) =>
              groupName !== undefined ? (
                <optgroup key={groupName} label={groupName}>
                  {groupOpts.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ) : (
                groupOpts.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              )
            )
          : options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
      </select>
    </div>
  );
}
