/**
 * PlanMarkdown.tsx
 *
 * Renders a Coach plan. react-markdown never renders raw HTML and strips
 * unsafe link protocols by default, which matters here: the text comes from
 * the model, which read web pages to write it. Code blocks that look like
 * guitar tab render as a TabBlock; links open in a new tab.
 */

import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { parseTabLines } from '../../coach/planParser';

/**
 * Tab with fret numbers in bold ink, technique letters (h p b r ~ / \) in
 * lighter italic ink and the string lines muted, so the frets read at arm's
 * length. No accent: orange stays reserved for roots and what's playing.
 * Kept as real text (not an image) so it can be copied and read by screen
 * readers.
 */
function TabBlock({ lines }: { lines: NonNullable<ReturnType<typeof parseTabLines>> }) {
  return (
    <figure className="my-4 overflow-hidden rounded-control border border-line">
      <figcaption className="border-b border-line bg-sunken px-3 py-1.5 text-xs text-muted">Tab</figcaption>
      <pre className="overflow-x-auto bg-surface px-3 py-2.5 font-mono text-[13px] leading-[1.6]">
        {lines.map((l, i) => (
          <div key={i}>
            <span className="font-bold text-ink">{l.string}</span>
            <span className="text-line-strong">|</span>
            {l.frets.split(/(\d+|[hpbr~/\\])/).map((part, j) =>
              /^\d+$/.test(part) ? (
                <span key={j} className="font-bold text-ink">
                  {part}
                </span>
              ) : /^[hpbr~/\\]$/.test(part) ? (
                <span key={j} className="text-ink/70 italic">
                  {part}
                </span>
              ) : (
                <span key={j} className="text-muted/60">
                  {part}
                </span>
              ),
            )}
          </div>
        ))}
      </pre>
    </figure>
  );
}

/** Plain text of a code element's children. */
function codeText(children: ReactNode): string {
  if (isValidElement(children)) {
    return String((children.props as { children?: unknown }).children ?? '').replace(/\n$/, '');
  }
  return String(children ?? '');
}

const COMPONENTS: Components = {
  h1: ({ children }) => <h3 className="mt-6 mb-2 text-[19px] font-extrabold tracking-[-0.02em] first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-6 mb-2 text-[17px] font-bold tracking-[-0.01em] first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-5 mb-1.5 text-[15px] font-bold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-4 mb-1 text-sm font-bold first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="my-2.5 text-[14px] leading-relaxed text-ink/90">{children}</p>,
  ul: ({ children }) => <ul className="my-2.5 list-disc space-y-1 pl-5 text-[14px] leading-relaxed marker:text-muted">{children}</ul>,
  ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed marker:text-muted">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5 text-ink/90">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong underline-offset-2 hover:decoration-ink">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-line-strong pl-3 text-muted">{children}</blockquote>,
  hr: () => <hr className="my-5 border-line" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line px-2 py-1.5 text-left text-xs font-medium text-muted">{children}</th>,
  td: ({ children }) => <td className="border-b border-line px-2 py-1.5">{children}</td>,
  pre: ({ children }) => {
    const text = codeText(children);
    const lines = parseTabLines(text);
    return lines ? (
      <TabBlock lines={lines} />
    ) : (
      <pre className="my-4 overflow-x-auto rounded-control bg-sunken p-3 font-mono text-xs leading-relaxed">{text}</pre>
    );
  },
  code: ({ children }) => <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[12.5px]">{children}</code>,
};

export default function PlanMarkdown({ markdown }: { markdown: string }) {
  return <ReactMarkdown components={COMPONENTS}>{markdown}</ReactMarkdown>;
}
