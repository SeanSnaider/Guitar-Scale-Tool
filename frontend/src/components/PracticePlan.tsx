/**
 * PracticePlan.tsx
 *
 * Renders the agent's markdown practice plan using react-markdown.
 * Styled to match the Studio Walnut design system (amber/brown dark theme).
 *
 * Handles two display modes:
 *  - Streaming: shows a live typing indicator while content is arriving.
 *  - Complete: renders the full markdown with syntax-highlighted code blocks.
 *
 * Props:
 *  - answer: final markdown string (null while streaming).
 *  - isStreaming: true while the agent is running.
 */

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PracticePlanProps {
  /** Final markdown answer from the agent. Null while the run is in progress. */
  answer: string | null;
  /** Raw accumulated delta content shown during streaming as a live preview. */
  /** True while the agent is actively running. */
  isStreaming: boolean;
}

// ---------------------------------------------------------------------------
// Markdown component overrides — Studio Walnut palette
// ---------------------------------------------------------------------------

/**
 * Custom renderers that apply Studio Walnut CSS variables to every markdown element.
 * This avoids injecting a separate stylesheet; all styles are co-located here.
 */
const MD_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: '22px',
        fontWeight: 400,
        color: 'var(--accent-primary)',
        marginBottom: '12px',
        marginTop: '24px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '6px',
      }}
    >
      {children}
    </h1>
  ),

  h2: ({ children }) => (
    <h2
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: '17px',
        fontWeight: 400,
        color: 'var(--accent-primary)',
        marginBottom: '8px',
        marginTop: '20px',
      }}
    >
      {children}
    </h2>
  ),

  h3: ({ children }) => (
    <h3
      style={{
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--text-body)',
        marginBottom: '6px',
        marginTop: '14px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {children}
    </h3>
  ),

  p: ({ children }) => (
    <p
      style={{
        fontSize: '14px',
        lineHeight: 1.7,
        color: 'var(--text-body)',
        marginBottom: '10px',
      }}
    >
      {children}
    </p>
  ),

  ul: ({ children }) => (
    <ul
      style={{
        paddingLeft: '20px',
        marginBottom: '10px',
        listStyleType: 'disc',
      }}
    >
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol
      style={{
        paddingLeft: '20px',
        marginBottom: '10px',
        listStyleType: 'decimal',
      }}
    >
      {children}
    </ol>
  ),

  li: ({ children }) => (
    <li
      style={{
        fontSize: '14px',
        lineHeight: 1.7,
        color: 'var(--text-body)',
        marginBottom: '4px',
      }}
    >
      {children}
    </li>
  ),

  strong: ({ children }) => (
    <strong style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
      {children}
    </strong>
  ),

  em: ({ children }) => (
    <em style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
      {children}
    </em>
  ),

  code: ({ children, className }) => {
    // Block code (inside <pre>) vs inline code
    const isBlock = !!className;
    if (isBlock) {
      return (
        <code
          style={{
            display: 'block',
            fontFamily: 'monospace',
            fontSize: '13px',
            color: 'var(--text-body)',
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          fontFamily: 'monospace',
          fontSize: '12px',
          color: 'var(--accent-primary)',
          background: 'var(--bg-elevated)',
          padding: '1px 5px',
          borderRadius: '3px',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {children}
      </code>
    );
  },

  pre: ({ children }) => (
    <pre
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        padding: '12px 14px',
        overflowX: 'auto',
        marginBottom: '12px',
        fontFamily: 'monospace',
        fontSize: '13px',
        lineHeight: 1.6,
        color: 'var(--text-body)',
      }}
    >
      {children}
    </pre>
  ),

  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: '3px solid var(--accent-primary)',
        paddingLeft: '12px',
        marginLeft: 0,
        marginBottom: '10px',
        color: 'var(--text-secondary)',
        fontStyle: 'italic',
      }}
    >
      {children}
    </blockquote>
  ),

  hr: () => (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid var(--border-subtle)',
        margin: '16px 0',
      }}
    />
  ),
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PracticePlan
 *
 * Displays a progress spinner while the FretAgent runs, then the final
 * rendered markdown practice plan.
 *
 * @param answer - Final markdown string from the agent (null while streaming).
 * @param isStreaming - True while the agent is actively running.
 * @returns The rendered plan area.
 */
export default function PracticePlan({
  answer,
  isStreaming,
}: PracticePlanProps) {
  // Render the final answer once available
  if (answer) {
    return (
      <div style={{ padding: '4px 0' }}>
        <ReactMarkdown components={MD_COMPONENTS}>{answer}</ReactMarkdown>
      </div>
    );
  }

  // During streaming, show a spinner while the plan is being generated
  if (isStreaming) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          padding: '48px 0',
        }}
      >
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <span
          style={{
            display: 'inline-block',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: '2px solid var(--border-subtle)',
            borderTopColor: 'var(--accent-primary)',
            animation: 'spin 0.8s linear infinite',
          }}
          aria-hidden="true"
        />
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Generating practice plan…
        </span>
      </div>
    );
  }

  return null;
}
