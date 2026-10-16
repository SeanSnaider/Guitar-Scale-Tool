/**
 * useChordAI.ts
 *
 * Custom React hook encapsulating all state and business logic for the
 * ChordAI feature: API key management, audio capture, chord detection,
 * and multi-turn conversation with Anthropic Claude.
 *
 * Keeping logic here keeps ChordAI.tsx focused on rendering only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChordDetector } from '../audio/ChordDetector';
import type { ChordDetectionResult } from '../audio/ChordDetector';
import { recordChord } from '../services/api';

// ─── Public Types ─────────────────────────────────────────────────────────────

/** A single message in the conversation history. */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/** A parsed chord progression extracted from the assistant's JSON block. */
export interface Progression {
  chords: string[];
}

/** Genre options for progression generation. */
export const GENRES = ['rock', 'jazz', 'blues', 'pop', 'country'] as const;
export type Genre = (typeof GENRES)[number];

// ─── Internal Types ───────────────────────────────────────────────────────────

interface AnthropicRequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a music theory expert and guitarist helping users learn chord progressions. When generating progressions, always include a JSON block like:

\`\`\`json
{
  "progression": ["Am", "F", "C", "G"],
  "key": "A minor",
  "tempo": "medium"
}
\`\`\`

Follow the JSON with a clear explanation of the theory and playing tips. Keep responses concise and practical.`;

const LISTEN_DURATION_MS = 2500;
const FRAME_INTERVAL_MS = 100;

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Extracts a chord progression array from markdown-fenced JSON in the
 * assistant's response text.
 *
 * @param text - Raw assistant response string.
 * @returns Array of chord name strings, or null if parsing fails.
 */
export function parseProgression(text: string): string[] | null {
  const match = text.match(/```json\n([\s\S]*?)```/);
  if (!match) return null;
  try {
    const data: unknown = JSON.parse(match[1]);
    if (
      data !== null &&
      typeof data === 'object' &&
      'progression' in data &&
      Array.isArray((data as Record<string, unknown>).progression)
    ) {
      return (data as { progression: string[] }).progression;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * All state and actions exposed by useChordAI.
 */
export interface ChordAIState {
  // API key
  apiKey: string;
  apiKeyInput: string;
  showApiKey: boolean;
  apiKeySet: boolean;
  setApiKeyInput: (v: string) => void;
  setShowApiKey: (v: boolean) => void;
  handleSetApiKey: () => void;
  handleClearApiKey: () => void;

  // Audio devices
  audioDevices: MediaDeviceInfo[];
  selectedDevice: string;
  setSelectedDevice: (id: string) => void;
  getUserMediaSupported: boolean;

  // Listening
  isListening: boolean;
  listeningProgress: number;
  detectedChord: ChordDetectionResult | null;
  handleListen: () => Promise<void>;

  // Generation
  selectedGenre: Genre;
  setSelectedGenre: (g: Genre) => void;
  isGenerating: boolean;
  canGenerate: boolean;
  handleGenerate: () => Promise<void>;

  // Conversation
  messages: Message[];
  inputMessage: string;
  setInputMessage: (v: string) => void;
  handleSendMessage: () => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;

  // Progression
  progression: Progression | null;
  highlightedChord: string | null;
  setHighlightedChord: (c: string | null) => void;

  // Error
  error: string | null;
  /** Which part of the panel the error belongs to, so it renders next to the action that failed. */
  errorScope: ErrorScope | null;
  setError: (e: string | null) => void;
}

/** Where an error came from: the microphone/detection step or the Claude API. */
export type ErrorScope = 'listen' | 'api';

/** Abort Claude requests that take longer than this. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Model for ChordAI. Claude Sonnet 5.5 thinks adaptively by default; thinking
 * counts toward max_tokens, so the cap leaves room for thinking plus the reply.
 * Effort 'low' is the recommended starting point for chat and content
 * generation, and keeps replies quick while you're holding the guitar.
 */
const CLAUDE_MODEL = 'claude-sonnet-5-5';
const CLAUDE_MAX_TOKENS = 16_000;
const CLAUDE_EFFORT = 'low';

/**
 * Turns a getUserMedia / AudioContext failure into a message that names the
 * problem and the fix. DOMException names per the Media Capture spec.
 */
function describeMicError(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access is blocked. Allow it for this site in your browser settings, then try again.';
    case 'NotFoundError':
      return 'No microphone or audio interface found. Plug one in and try again.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The microphone is busy or unavailable. Close other apps using it, then try again.';
    case 'OverconstrainedError':
      return "The selected input device isn't available anymore. Pick another one and try again.";
    default:
      return err instanceof Error && err.message
        ? `Couldn't start the microphone: ${err.message}`
        : "Couldn't start the microphone.";
  }
}

/** Maps an Anthropic API status code to a message with a next step. */
function describeApiStatus(status: number, apiMessage?: string): string {
  if (status === 401) return 'Anthropic rejected that API key. Clear it and set it again.';
  if (status === 403) return "This API key doesn't have permission to use that model.";
  if (status === 404) return `The requested model wasn't found${apiMessage ? ` (${apiMessage})` : ''}.`;
  if (status === 413) return 'The conversation is too long to send. Reload to start a new one.';
  if (status === 429) return 'Rate limited by Anthropic. Wait a moment, then try again.';
  if (status === 529 || status >= 500) {
    return `Anthropic's API is having trouble right now (${status}). Try again in a minute.`;
  }
  return apiMessage ? `Request failed: ${apiMessage}` : `Request failed (${status}).`;
}

/**
 * useChordAI hook.
 *
 * Manages all ChordAI business logic: API key storage (memory only),
 * microphone capture, chord detection, and Claude API conversation.
 *
 * @returns ChordAIState — all state values and action handlers.
 */
export function useChordAI(): ChordAIState {
  // ── API key ──────────────────────────────────────────────────────────────
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(false);

  // ── Audio devices ─────────────────────────────────────────────────────────
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');

  // ── Listening ─────────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [listeningProgress, setListeningProgress] = useState(0);
  const [detectedChord, setDetectedChord] = useState<ChordDetectionResult | null>(null);

  // ── Generation ───────────────────────────────────────────────────────────
  const [selectedGenre, setSelectedGenre] = useState<Genre>('rock');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [error, setErrorText] = useState<string | null>(null);
  const [errorScope, setErrorScope] = useState<ErrorScope | null>(null);
  /** Clears (null) or sets an unscoped error; scoped errors go through `fail`. */
  const setError = (e: string | null) => {
    setErrorText(e);
    if (e === null) setErrorScope(null);
  };
  const fail = (scope: ErrorScope, message: string) => {
    setErrorScope(scope);
    setErrorText(message);
  };
  const [progression, setProgression] = useState<Progression | null>(null);
  const [highlightedChord, setHighlightedChord] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** In-flight Claude request, aborted on unmount so it can't set state afterwards. */
  const requestRef = useRef<AbortController | null>(null);

  // ── Enumerate audio devices on mount ────────────────────────────────────
  /** Re-reads the input list. Labels and ids only appear once mic permission is granted. */
  const refreshDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter(d => d.kind === 'audioinput');
    setAudioDevices(inputs);
    // Keep the current pick if it's still plugged in, else fall back to the first
    setSelectedDevice(prev =>
      inputs.some(d => d.deviceId === prev) ? prev : inputs[0]?.deviceId ?? ''
    );
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return;

    const getDevices = async () => {
      try {
        // A brief permission request is needed for device labels. Stop the
        // tracks right away so the mic (and the browser's recording
        // indicator) is only live while actually listening.
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        probe.getTracks().forEach(t => t.stop());
        await refreshDevices();
      } catch {
        // Permission denied — the Listen button explains how to fix it on click
      }
    };

    getDevices();

    // Interfaces get plugged in mid-session; keep the list current
    const onDeviceChange = () => { void refreshDevices().catch(() => {}); };
    navigator.mediaDevices.addEventListener?.('devicechange', onDeviceChange);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', onDeviceChange);
  }, [refreshDevices]);

  // ── Scroll to bottom when messages change ────────────────────────────────
  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messages]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current !== null) {
        clearInterval(progressIntervalRef.current);
      }
      requestRef.current?.abort();
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  /** Confirms the API key. Key is held in React state only — never persisted. */
  const handleSetApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setApiKeySet(true);
    setApiKeyInput('');
  };

  /** Removes the stored API key from memory. */
  const handleClearApiKey = () => {
    setApiKey('');
    setApiKeySet(false);
    setApiKeyInput('');
  };

  /**
   * Captures audio from the selected input device for LISTEN_DURATION_MS,
   * runs chord detection, and stores the result in state.
   */
  const handleListen = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      fail('listen', 'This browser can\'t access the microphone. Use Chrome, Edge, Firefox, or Safari over HTTPS.');
      return;
    }

    setIsListening(true);
    setListeningProgress(0);
    setError(null);

    const startTime = performance.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - startTime;
      setListeningProgress(Math.min(100, (elapsed / LISTEN_DURATION_MS) * 100));
    }, 80);

    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    // iOS: the audio engine sets the session to 'playback' for practice audio;
    // capture needs 'play-and-record' while listening. Restored afterwards.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    const priorSessionType = session?.type;
    if (session) {
      try { session.type = 'play-and-record'; } catch { /* keep the current type */ }
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Permission may only now have been granted (it was denied or never
      // asked on mount), so labels and devices appear only now.
      void refreshDevices().catch(() => {});
      audioCtx = new AudioContext();
      // The await on getUserMedia can outlive the click's user activation,
      // so the context may start suspended (or 'interrupted' on iOS). A
      // suspended context feeds the analyser silence. Capped at 1 s: an
      // interrupted iOS context can leave resume() pending until the
      // interruption (a call, say) ends.
      if (audioCtx.state !== 'running') {
        await Promise.race([audioCtx.resume(), new Promise(r => setTimeout(r, 1000))]);
      }
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 8192;
      source.connect(analyser);

      const detector = new ChordDetector(analyser, audioCtx.sampleRate);
      const chroma = await detector.collectFrames(LISTEN_DURATION_MS, FRAME_INTERVAL_MS);

      // An all-zero chroma means every bin was below the noise floor: nothing
      // was heard. Matching it would report an arbitrary chord at 0%.
      if (!chroma.some(v => v > 0)) {
        setDetectedChord(null);
        fail(
          'listen',
          "Didn't hear anything. Check the input device and level, then strum and let the chord ring.",
        );
        return;
      }

      const detected = detector.detectChord(chroma);
      setDetectedChord(detected);

      // Persist the detection to the backend (fire-and-forget)
      recordChord(
        detected.chord,
        detected.confidence,
        detected.root,
        detected.quality,
      ).catch(() => {
        // Backend unreachable — silently continue
      });
    } catch (err: unknown) {
      fail('listen', describeMicError(err));
    } finally {
      stream?.getTracks().forEach(t => t.stop());
      if (audioCtx) await audioCtx.close();
      if (session && priorSessionType !== undefined) {
        try { session.type = priorSessionType; } catch { /* leave as is */ }
      }
      if (progressIntervalRef.current !== null) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setListeningProgress(100);
      setIsListening(false);
    }
  };

  /**
   * Calls the Anthropic Messages API with the given conversation history.
   *
   * The `anthropic-dangerous-direct-browser-access` header acknowledges
   * that this is a direct browser-to-API call (no server proxy).
   *
   * @param msgs - Messages to send.
   * @returns Assistant response text.
   * @throws Error if the API returns a non-OK response.
   */
  const callClaude = async (msgs: AnthropicRequestMessage[]): Promise<string> => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
        // Server-side refusal fallback: a declined request is retried on the
        // model Anthropic recommends for that refusal category.
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        output_config: { effort: CLAUDE_EFFORT },
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        // History carries text only. No thinking blocks are replayed, so
        // earlier turns can't trip the preserved-thinking history check.
        messages: msgs,
      }),
    });
    } catch {
      clearTimeout(timeout);
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        if (reason instanceof DOMException && reason.name === 'TimeoutError') {
          throw new Error('Anthropic took too long to respond. Try again.');
        }
        throw new DOMException('Request cancelled', 'AbortError');
      }
      // fetch only rejects on network failure (offline, DNS, CORS)
      throw new Error("Couldn't reach Anthropic. Check your internet connection and try again.");
    }
    clearTimeout(timeout);

    // Error bodies are usually JSON, but proxies and outages can return HTML
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // keep data null; the status code still tells us what happened
    }

    if (!response.ok) {
      const errData = data as { error?: { message?: string } } | null;
      throw new Error(describeApiStatus(response.status, errData?.error?.message));
    }
    const body = data as {
      stop_reason?: string;
      content?: Array<{ type?: string; text?: string }>;
    } | null;

    // A safety decline is a normal 200; check it before reading content
    if (body?.stop_reason === 'refusal') {
      throw new Error('Claude declined this request. Try rephrasing it.');
    }

    // Responses can include thinking (and fallback) blocks; read text blocks by type
    const text = (body?.content ?? [])
      .filter(block => block.type === 'text' && typeof block.text === 'string')
      .map(block => block.text)
      .join('')
      .trim();
    if (!text) {
      throw new Error(
        body?.stop_reason === 'max_tokens'
          ? 'Claude ran out of room before answering. Try again.'
          : 'Claude returned an empty response. Try again.',
      );
    }
    return text;
  };

  /** True for a request we cancelled ourselves (unmount or superseded), which shouldn't show an error. */
  const isCancelled = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

  /**
   * Generates an initial chord progression from the detected chord and genre.
   * Adds both sides of the exchange to the conversation history.
   */
  const handleGenerate = async () => {
    if (!detectedChord || !apiKeySet) return;
    setIsGenerating(true);
    setError(null);

    const userContent = `I just played an ${detectedChord.chord} chord. Generate a ${selectedGenre} chord progression that works well with it. Include the chord names, key, and brief theory explanation.`;
    const newMessages: Message[] = [{ role: 'user', content: userContent }];

    try {
      const response = await callClaude(newMessages);
      const finalMessages: Message[] = [...newMessages, { role: 'assistant', content: response }];
      setMessages(finalMessages);

      const chords = parseProgression(response);
      if (chords) {
        setProgression({ chords });
        setHighlightedChord(null);
      }
    } catch (err: unknown) {
      if (isCancelled(err)) return;
      fail('api', err instanceof Error ? err.message : 'Generation failed. Try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Appends a user follow-up message and gets a Claude response.
   * Updates the progression display if the response contains a new one.
   */
  const handleSendMessage = async () => {
    const trimmed = inputMessage.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setInputMessage('');

    const updatedMessages: Message[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(updatedMessages);

    try {
      const response = await callClaude(updatedMessages);
      const finalMessages: Message[] = [...updatedMessages, { role: 'assistant', content: response }];
      setMessages(finalMessages);

      const chords = parseProgression(response);
      if (chords) {
        setProgression({ chords });
        setHighlightedChord(null);
      }
    } catch (err: unknown) {
      if (isCancelled(err)) return;
      fail('api', err instanceof Error ? err.message : 'Request failed. Try again.');
      setMessages(messages); // Rollback optimistic user message
      setInputMessage(trimmed); // ...and give the user their text back to retry
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    apiKey,
    apiKeyInput,
    showApiKey,
    apiKeySet,
    setApiKeyInput,
    setShowApiKey: (v: boolean) => setShowApiKey(v),
    handleSetApiKey,
    handleClearApiKey,

    audioDevices,
    selectedDevice,
    setSelectedDevice,
    getUserMediaSupported: Boolean(navigator.mediaDevices?.getUserMedia),

    isListening,
    listeningProgress,
    detectedChord,
    handleListen,

    selectedGenre,
    setSelectedGenre,
    isGenerating,
    canGenerate: apiKeySet && detectedChord !== null && !isGenerating,
    handleGenerate,

    messages,
    inputMessage,
    setInputMessage,
    handleSendMessage,
    messagesEndRef,

    progression,
    highlightedChord,
    setHighlightedChord,

    error,
    errorScope,
    setError,
  };
}
