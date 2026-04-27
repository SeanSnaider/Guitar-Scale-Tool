/**
 * useChordAI.ts
 *
 * Custom React hook encapsulating all state and business logic for the
 * ChordAI feature: API key management, audio capture, chord detection,
 * and multi-turn conversation with Anthropic Claude.
 *
 * Keeping logic here keeps ChordAI.tsx focused on rendering only.
 */

import { useEffect, useRef, useState } from 'react';
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
  setError: (e: string | null) => void;
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
  const [error, setError] = useState<string | null>(null);
  const [progression, setProgression] = useState<Progression | null>(null);
  const [highlightedChord, setHighlightedChord] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Enumerate audio devices on mount ────────────────────────────────────
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return;

    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(inputs);
        if (inputs.length > 0) setSelectedDevice(inputs[0].deviceId);
      } catch {
        // Permission denied — user will see the button and get an error on click
      }
    };

    getDevices();
  }, []);

  // ── Scroll to bottom when messages change ────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current !== null) {
        clearInterval(progressIntervalRef.current);
      }
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
      setError('Your browser does not support microphone access (getUserMedia).');
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
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 8192;
      source.connect(analyser);

      const detector = new ChordDetector(analyser, audioCtx.sampleRate);
      const chroma = await detector.collectFrames(LISTEN_DURATION_MS, FRAME_INTERVAL_MS);
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
      const msg = err instanceof Error ? err.message : 'Microphone access failed.';
      setError(`Audio error: ${msg}`);
    } finally {
      stream?.getTracks().forEach(t => t.stop());
      if (audioCtx) await audioCtx.close();
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: msgs,
      }),
    });

    const data: unknown = await response.json();
    if (!response.ok) {
      const errData = data as { error?: { message?: string } };
      throw new Error(errData.error?.message ?? `API error: ${response.status}`);
    }
    const ok = data as { content: Array<{ text: string }> };
    return ok.content[0].text;
  };

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
      const msg = err instanceof Error ? err.message : 'Generation failed.';
      setError(`API error: ${msg}`);
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
      const msg = err instanceof Error ? err.message : 'Request failed.';
      setError(`API error: ${msg}`);
      setMessages(messages); // Rollback optimistic user message
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
    setError,
  };
}
