/**
 * Joins class names, skipping falsy values.
 *
 * @example cn('px-3', isActive && 'bg-ink text-surface', className)
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
