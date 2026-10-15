/**
 * ChordAI.tsx
 *
 * AI-powered chord progression generator panel.
 *
 * Renders the complete ChordAI UI: API key entry, microphone chord detection,
 * genre selection, chord progression display, and a multi-turn conversation
 * window backed by the Anthropic Claude API.
 *
 * All business logic lives in the `useChordAI` hook. This file is pure rendering.
 * Styling: Studio Walnut theme — dark surfaces, amber accents, Georgia headings.
 *
 * Props: none — this component is fully self-contained.
 */

import { useId } from 'react';
import { useChordAI, GENRES } from '../hooks/useChordAI';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns inline style properties for a confidence badge based on the score.
 *
 * @param confidence - Confidence score from 0 to 1.
 * @returns React CSSProperties for background, text color, and border color.
 */
function confidenceBadgeStyle(confidence: number): React.CSSProperties {
  if (confidence >= 0.8) {
    return {
      background: 'var(--correct-soft)',
      color: 'var(--correct)',
      border: '1px solid var(--correct-line)',
    };
  }
  if (confidence >= 0.6) {
    return {
      background: 'var(--accent-soft)',
      color: 'var(--accent-primary)',
      border: '1px solid var(--accent-line)',
    };
  }
  return {
    background: 'var(--incorrect-soft)',
    color: 'var(--incorrect)',
    border: '1px solid var(--incorrect-line)',
  };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

/** Card container used throughout the panel. */
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderRadius: '8px',
  padding: '16px',
  border: '1px solid var(--border-subtle)',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Inline error shown next to the action that failed. role="alert" makes
 * screen readers announce it as soon as it appears.
 */
function ErrorNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      style={{
        background: 'var(--incorrect-soft)',
        border: '1px solid var(--incorrect-line)',
        borderRadius: '8px',
        padding: '12px 14px',
        fontSize: '13px',
        color: 'var(--text-body)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <p style={{ margin: 0, lineHeight: 1.45 }}>{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
          flexShrink: 0,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

interface ApiKeySectionProps {
  apiKeyInput: string;
  showApiKey: boolean;
  apiKeySet: boolean;
  onInputChange: (v: string) => void;
  onToggleShow: () => void;
  onSetKey: () => void;
  onClearKey: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * ApiKeySection renders the Anthropic API key entry form when no key is set,
 * or an "active" banner when the key has been provided.
 * The key is stored in memory only — never persisted to disk or localStorage.
 *
 * @param props - API key state and handlers from the useChordAI hook.
 */
function ApiKeySection({
  apiKeyInput, showApiKey, apiKeySet,
  onInputChange, onToggleShow, onSetKey, onClearKey, onKeyDown,
}: ApiKeySectionProps) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--text-body)',
            margin: 0,
            flex: 1,
          }}
        >
          Anthropic API Key
        </h3>
        {apiKeySet && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--correct)',
              background: 'var(--correct-soft)',
              border: '1px solid var(--correct-line)',
              padding: '2px 8px',
              borderRadius: '10px',
            }}
          >
            Active
          </span>
        )}
      </div>

      {!apiKeySet ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            Key is held in memory only — never saved to disk or local storage.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                aria-label="Anthropic API key"
                autoComplete="off"
                spellCheck={false}
                value={apiKeyInput}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="sk-ant-..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 36px 8px 12px',
                  fontSize: '13px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-input)',
                  borderRadius: '6px',
                  color: 'var(--text-body)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-input)';
                }}
              />
              <button
                type="button"
                onClick={onToggleShow}
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                title={showApiKey ? 'Hide key' : 'Show key'}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  padding: '2px',
                }}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <button
              onClick={onSetKey}
              disabled={!apiKeyInput.trim()}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                borderRadius: '6px',
                border: 'none',
                cursor: apiKeyInput.trim() ? 'pointer' : 'not-allowed',
                background: 'var(--accent-primary)',
                color: 'var(--on-accent)',
                fontWeight: 600,
                opacity: apiKeyInput.trim() ? 1 : 0.45,
                transition: 'opacity 0.15s ease',
                flexShrink: 0,
              }}
            >
              Set Key
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            API key is active (memory only). Reload the page to clear it.
          </p>
          <button
            onClick={onClearKey}
            style={{
              fontSize: '12px',
              color: 'var(--incorrect)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ChordAI panel component.
 *
 * Composes ApiKeySection, chord detection controls, genre selector,
 * chord progression display, and the AI conversation interface.
 *
 * @returns The rendered ChordAI panel.
 */
export default function ChordAI() {
  const {
    apiKeyInput, showApiKey, apiKeySet,
    setApiKeyInput, setShowApiKey, handleSetApiKey, handleClearApiKey,

    audioDevices, selectedDevice, setSelectedDevice, getUserMediaSupported,

    isListening, listeningProgress, detectedChord, handleListen,

    selectedGenre, setSelectedGenre, isGenerating, canGenerate, handleGenerate,

    messages, inputMessage, setInputMessage, handleSendMessage, messagesEndRef,

    progression, highlightedChord, setHighlightedChord,

    error, errorScope, setError,
  } = useChordAI();

  const deviceSelectId = useId();
  const chatInputId = useId();
  const genreHeadingId = useId();
  const listenError = error && errorScope === 'listen' ? error : null;
  const apiError = error && errorScope !== 'listen' ? error : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '680px',
        margin: '0 auto',
        padding: '4px',
      }}
    >
      {/* ── Header ── */}
      <div style={cardStyle}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: 400,
            color: 'var(--accent-glow)',
            margin: '0 0 6px 0',
          }}
        >
          ChordAI
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Play a chord, detect it with your mic, then let Claude suggest progressions.
        </p>
      </div>

      {/* ── API Key ── */}
      <ApiKeySection
        apiKeyInput={apiKeyInput}
        showApiKey={showApiKey}
        apiKeySet={apiKeySet}
        onInputChange={setApiKeyInput}
        onToggleShow={() => setShowApiKey(!showApiKey)}
        onSetKey={handleSetApiKey}
        onClearKey={handleClearApiKey}
        onKeyDown={(e) => e.key === 'Enter' && handleSetApiKey()}
      />

      {/* ── Chord Detection ── */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          Chord Detection
        </h3>

        {!getUserMediaSupported ? (
          <p
            style={{
              fontSize: '13px',
              color: 'var(--incorrect)',
              margin: 0,
            }}
          >
            Your browser does not support microphone access. Use Chrome, Edge, or Firefox over HTTPS.
          </p>
        ) : (
          <>
            {/* Device selector */}
            {audioDevices.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor={deviceSelectId} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Input Device
                </label>
                <select
                  id={deviceSelectId}
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-input)',
                    borderRadius: '6px',
                    color: 'var(--text-body)',
                    cursor: 'pointer',
                  }}
                >
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Listen button or progress bar */}
            {isListening ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Listening...</span>
                  <span>{Math.round(listeningProgress)}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Listening"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(listeningProgress)}
                  style={{
                    height: '6px',
                    background: 'var(--bg-primary)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${listeningProgress}%`,
                      background: 'var(--accent-primary)',
                      transition: 'width 100ms linear',
                    }}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleListen}
                aria-label="Listen for 2.5 seconds"
                style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--accent-primary)',
                  color: 'var(--on-accent)',
                  transition: 'opacity 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
              >
                <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>&#9679;</span>
                Listen 2.5s
              </button>
            )}

            {/* Detection result, announced when it arrives */}
            <div role="status" aria-live="polite" aria-atomic="true">
            {detectedChord && !isListening && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--bg-elevated)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {detectedChord.chord}
                  </span>
                  <span
                    style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {detectedChord.quality}
                  </span>
                </div>
                <span
                  style={{
                    ...confidenceBadgeStyle(detectedChord.confidence),
                    fontSize: '12px',
                    padding: '3px 10px',
                    borderRadius: '10px',
                    fontWeight: 500,
                  }}
                >
                  {Math.round(detectedChord.confidence * 100)}% confidence
                </span>
              </div>
            )}
            </div>

            {listenError && !isListening && (
              <ErrorNotice message={listenError} onDismiss={() => setError(null)} />
            )}
          </>
        )}
      </div>

      {/* ── Genre + Generate ── */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3
          id={genreHeadingId}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          Genre
        </h3>

        <div
          role="group"
          aria-labelledby={genreHeadingId}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
        >
          {GENRES.map((genre) => {
            const isActive = selectedGenre === genre;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => setSelectedGenre(genre)}
                aria-pressed={isActive}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 400,
                  borderRadius: '14px',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: isActive ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: isActive ? 'var(--on-accent)' : 'var(--text-secondary)',
                  textTransform: 'capitalize',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                {genre}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          aria-busy={isGenerating}
          title={
            !apiKeySet
              ? 'Set your API key first'
              : !detectedChord
              ? 'Listen for a chord first'
              : undefined
          }
          style={{
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            cursor: canGenerate ? 'pointer' : 'not-allowed',
            background: canGenerate ? 'var(--accent-hover)' : 'var(--bg-elevated)',
            color: canGenerate ? 'var(--on-accent)' : 'var(--text-muted)',
            opacity: canGenerate ? 1 : 0.55,
            transition: 'opacity 0.15s ease, background 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          {isGenerating ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                aria-hidden="true"
                className="motion-spin"
                style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid var(--on-accent)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              Generating...
            </span>
          ) : (
            'Generate Progression'
          )}
        </button>

        {!apiKeySet && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
            Set your Anthropic API key above to generate progressions.
          </p>
        )}
        {apiKeySet && !detectedChord && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
            Listen for a chord first, then generate a progression.
          </p>
        )}

        {/* Generation errors sit by the button; follow-up errors sit by the chat input */}
        {apiError && messages.length === 0 && (
          <ErrorNotice message={apiError} onDismiss={() => setError(null)} />
        )}
      </div>

      {/* ── Progression Display ── */}
      {progression && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            Progression
          </h3>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {progression.chords.map((chord, i) => {
              const isHighlighted = highlightedChord === chord;
              return (
                <button
                  className="motion-scale"
                  key={i}
                  type="button"
                  onClick={() => setHighlightedChord(isHighlighted ? null : chord)}
                  aria-pressed={isHighlighted}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: isHighlighted
                      ? '1px solid var(--accent-primary)'
                      : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: isHighlighted ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                    color: isHighlighted ? 'var(--on-accent)' : 'var(--text-body)',
                    transform: isHighlighted ? 'scale(1.06)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {chord}
                </button>
              );
            })}
          </div>

          {highlightedChord && (
            <div
              style={{
                padding: '12px',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: 'var(--accent-primary)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {highlightedChord}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Conversation ── */}
      {messages.length > 0 && (
        <div
          style={{
            ...cardStyle,
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
              Conversation
            </h3>
          </div>

          <div
            role="log"
            aria-label="Conversation with Claude"
            aria-live="polite"
            aria-relevant="additions"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              maxHeight: '320px',
              overflowY: 'auto',
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    ...(msg.role === 'user'
                      ? {
                          background: 'var(--accent-primary)',
                          color: 'var(--on-accent)',
                        }
                      : {
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-body)',
                          border: '1px solid var(--border-subtle)',
                        }),
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {apiError && (
            <div style={{ padding: '12px 16px 0' }}>
              <ErrorNotice message={apiError} onDismiss={() => setError(null)} />
            </div>
          )}

          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '8px',
            }}
          >
            <label htmlFor={chatInputId} className="sr-only">
              Follow-up message to Claude
            </label>
            <input
              id={chatInputId}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder='Try "make it darker" or "add a turnaround"...'
              disabled={isGenerating}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-input)',
                borderRadius: '6px',
                color: 'var(--text-body)',
                opacity: isGenerating ? 0.5 : 1,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-input)';
              }}
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isGenerating}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: inputMessage.trim() && !isGenerating ? 'pointer' : 'not-allowed',
                background: 'var(--accent-primary)',
                color: 'var(--on-accent)',
                opacity: inputMessage.trim() && !isGenerating ? 1 : 0.4,
                transition: 'opacity 0.15s ease',
                flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
