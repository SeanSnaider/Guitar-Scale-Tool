/**
 * ChordAI.tsx
 *
 * AI-powered chord progression generator view.
 *
 * Renders the complete ChordAI UI: microphone chord detection, genre
 * selection, chord progression display, a multi-turn conversation window
 * backed by the Anthropic Claude API, and API key entry.
 *
 * All business logic lives in the `useChordAI` hook. This file is pure rendering.
 * The API key panel is setup, not the task, so it sits last once a key is set
 * and first while one is still needed.
 *
 * Props: none — this component is fully self-contained.
 */

import { useId } from 'react';
import { Mic } from 'lucide-react';
import { useChordAI, GENRES } from '../hooks/useChordAI';
import { Button, Chip, Notice, Panel, Select, TextField, cn, PageTitle } from '../ui';

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Small CSS ring spinner; inherits the surrounding text colour. */
function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="motion-spin inline-block size-3 animate-[spin_0.7s_linear_infinite] rounded-full border-2 border-current border-t-transparent"
    />
  );
}

interface ApiKeyPanelProps {
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
 * ApiKeyPanel renders the Anthropic API key entry form when no key is set,
 * or an "active" line when the key has been provided.
 * The key is stored in memory only — never persisted to disk or localStorage.
 *
 * @param props - API key state and handlers from the useChordAI hook.
 */
function ApiKeyPanel({
  apiKeyInput, showApiKey, apiKeySet,
  onInputChange, onToggleShow, onSetKey, onClearKey, onKeyDown,
}: ApiKeyPanelProps) {
  return (
    <Panel title="Anthropic API key" headingLevel={3}>
      {!apiKeySet ? (
        <div className="flex items-start gap-2">
          <TextField
            className="flex-1"
            label="Anthropic API key"
            hideLabel
            type={showApiKey ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={apiKeyInput}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="sk-ant-..."
            hint="Held in memory only. Never saved."
            trailing={
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleShow}
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                title={showApiKey ? 'Hide key' : 'Show key'}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </Button>
            }
          />
          <Button variant="secondary" onClick={onSetKey} disabled={!apiKeyInput.trim()}>
            Set key
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">Key active for this session</p>
          <Button variant="ghost" size="sm" onClick={onClearKey}>
            Clear
          </Button>
        </div>
      )}
    </Panel>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ChordAI view component.
 *
 * Composes chord detection, the progression generator, the AI conversation
 * and the API key panel.
 *
 * @returns The rendered ChordAI view.
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

  const genreHeadingId = useId();
  const listenError = error && errorScope === 'listen' ? error : null;
  const apiError = error && errorScope !== 'listen' ? error : null;
  const progress = Math.round(listeningProgress);

  const keyPanel = (
    <ApiKeyPanel
      apiKeyInput={apiKeyInput}
      showApiKey={showApiKey}
      apiKeySet={apiKeySet}
      onInputChange={setApiKeyInput}
      onToggleShow={() => setShowApiKey(!showApiKey)}
      onSetKey={handleSetApiKey}
      onClearKey={handleClearApiKey}
      onKeyDown={(e) => e.key === 'Enter' && handleSetApiKey()}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <PageTitle>ChordAI</PageTitle>
        <p className="mt-1 text-[13px] text-muted">
          Play a chord, let the app name it, then ask Claude for progressions.
        </p>
      </header>


      {/* ── Chord detection: the focal stage of this view ── */}
      <section aria-labelledby="detect-title" className="rounded-panel border border-line bg-surface p-5 md:p-7">
        <h3 id="detect-title" className="text-[26px] leading-tight font-extrabold tracking-[-0.03em]">
          Detect a chord
        </h3>
        <p className="mt-1 text-sm text-muted">Strum the chord, let it ring, and press Listen.</p>

        {!getUserMediaSupported ? (
          <p className="mt-5 text-[13px] text-incorrect">
            Your browser does not support microphone access. Use Chrome, Edge, or Firefox over HTTPS.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-5">
            {/* Readout well: the detected chord at display scale, announced when it arrives */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="flex min-h-[168px] flex-col items-center justify-center gap-3 rounded-panel bg-sunken px-5 py-6 text-center"
            >
              {detectedChord && !isListening ? (
                <>
                  <p className="flex flex-wrap items-baseline justify-center gap-x-3">
                    <span className="text-[64px] leading-none font-extrabold tracking-[-0.04em] md:text-[80px]">
                      {detectedChord.chord}
                    </span>
                    <span className="text-[15px] text-muted">{detectedChord.quality}</span>
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div aria-hidden="true" className="h-1 w-28 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full bg-ink"
                        style={{ width: `${Math.round(detectedChord.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-ink tabular">
                      {Math.round(detectedChord.confidence * 100)}% match
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[15px] text-muted">{isListening ? 'Listening…' : 'No chord yet'}</p>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-4">
              {/* Listen button, or the progress bar while recording (same height, no layout shift) */}
              {isListening ? (
                <div className="flex h-14 min-w-[260px] flex-1 flex-col justify-center gap-2 sm:flex-none">
                  <div className="flex justify-between text-xs text-muted">
                    <span>Listening…</span>
                    <span className="font-mono tabular">{progress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Listening"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    className="h-1.5 overflow-hidden rounded-full bg-sunken"
                  >
                    <div
                      className="h-full bg-ink transition-[width] duration-100 ease-linear"
                      style={{ width: `${listeningProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <Button variant="ink" size="xl" icon={Mic} onClick={handleListen} className="max-sm:w-full">
                  Listen for 2.5 seconds
                </Button>
              )}

              {audioDevices.length > 0 && (
                <Select
                  label="Input device"
                  value={selectedDevice}
                  onChange={setSelectedDevice}
                  options={audioDevices.map((d) => ({
                    value: d.deviceId,
                    label: d.label || `Microphone ${d.deviceId.slice(0, 6)}`,
                  }))}
                  className="min-w-[200px] flex-1 sm:max-w-xs"
                />
              )}
            </div>

            {listenError && !isListening && (
              <Notice tone="error" onDismiss={() => setError(null)}>
                {listenError}
              </Notice>
            )}
          </div>
        )}
      </section>

      {/* ── Progression ── */}
      <Panel title="Progression" headingLevel={3}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p id={genreHeadingId} className="text-xs text-muted">
              Genre
            </p>
            <div role="group" aria-labelledby={genreHeadingId} className="flex flex-wrap gap-2">
              {GENRES.map((genre) => (
                <Chip
                  key={genre}
                  pressed={selectedGenre === genre}
                  onClick={() => setSelectedGenre(genre)}
                  className="capitalize"
                >
                  {genre}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button
              variant="ink"
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
            >
              {isGenerating ? (
                <>
                  <Spinner />
                  Generating…
                </>
              ) : (
                'Generate progression'
              )}
            </Button>

            {!apiKeySet && (
              <p className="text-xs text-muted">
                Add your Anthropic API key below to generate progressions.
              </p>
            )}
            {apiKeySet && !detectedChord && (
              <p className="text-xs text-muted">
                Listen for a chord first, then generate a progression.
              </p>
            )}
          </div>

          {/* Generation errors sit by the button; follow-up errors sit by the chat input */}
          {apiError && messages.length === 0 && (
            <Notice tone="error" onDismiss={() => setError(null)}>
              {apiError}
            </Notice>
          )}

          {progression && (
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <div className="flex flex-wrap gap-2">
                {progression.chords.map((chord, i) => {
                  const isHighlighted = highlightedChord === chord;
                  return (
                    <Chip
                      key={i}
                      pressed={isHighlighted}
                      onClick={() => setHighlightedChord(isHighlighted ? null : chord)}
                      className="font-bold"
                    >
                      {chord}
                    </Chip>
                  );
                })}
              </div>

              {highlightedChord && (
                <div className="rounded-control bg-sunken py-5 text-center">
                  <span className="text-[32px] leading-none font-bold tracking-[-0.02em]">
                    {highlightedChord}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* ── Conversation ── */}
      {messages.length > 0 && (
        <Panel title="Conversation" headingLevel={3}>
          <div className="flex flex-col gap-4">
            <div
              role="log"
              aria-label="Conversation with Claude"
              aria-live="polite"
              aria-relevant="additions"
              className="flex max-h-80 flex-col gap-2.5 overflow-y-auto"
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-control px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]',
                      msg.role === 'user' ? 'bg-ink text-surface' : 'bg-sunken text-ink',
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isGenerating && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-control bg-sunken px-3.5 py-2.5 text-[13px] text-muted">
                    <Spinner />
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {apiError && (
              <Notice tone="error" onDismiss={() => setError(null)}>
                {apiError}
              </Notice>
            )}

            <div className="flex items-start gap-2 border-t border-line pt-4">
              <TextField
                className="flex-1"
                label="Follow-up message to Claude"
                hideLabel
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder='Try "make it darker" or "add a turnaround"...'
                disabled={isGenerating}
              />
              <Button
                variant="ink"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isGenerating}
              >
                Send
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {keyPanel}
    </div>
  );
}
