/**
 * BrandMark
 *
 * The logo: an ink tile with one inlay dot, the single marker a guitarist
 * reads on every neck. Decorative; the wordmark beside it carries the name.
 */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
      <rect width="22" height="22" rx="6" className="fill-ink" />
      <circle cx="11" cy="11" r="4" className="fill-surface" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 text-[15px] font-bold tracking-[-0.01em] text-ink">
      <BrandMark />
      Scale Teacher
    </span>
  );
}
