/**
 * apiKey.ts
 *
 * The user's Anthropic API key, shared by every Claude feature (ChordAI and
 * the Practice Coach). There is no server: the browser calls api.anthropic.com
 * directly with this key.
 *
 * By default the key lives in memory only and is gone on reload. "Remember on
 * this device" writes it to localStorage instead. Anything that can run script
 * on this origin can read localStorage, so remembering is opt-in, and the key
 * is never put in the build (a VITE_ env var would ship it to every visitor).
 */

import { create } from 'zustand';

/** localStorage key for a remembered API key. */
export const API_KEY_STORAGE_KEY = 'scale-teacher-anthropic-key';

/** Reads a remembered key; storage can throw in private mode or when blocked. */
function readRemembered(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeRemembered(key: string | null): void {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE_KEY, key);
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Storage unavailable: the key still works for this session
  }
}

interface ApiKeyState {
  /** The active key, or '' when none is set. */
  apiKey: string;
  /** True when the active key is also saved in localStorage. */
  remembered: boolean;
  /**
   * Sets the key for every Claude feature.
   *
   * @param key - The key as pasted; surrounding whitespace is trimmed.
   * @param remember - Also save it on this device.
   */
  setApiKey: (key: string, remember: boolean) => void;
  /** Forgets the key everywhere (memory and localStorage). */
  clearApiKey: () => void;
}

const initial = readRemembered();

export const useApiKeyStore = create<ApiKeyState>()((set) => ({
  apiKey: initial,
  remembered: initial !== '',
  setApiKey: (key, remember) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    writeRemembered(remember ? trimmed : null);
    set({ apiKey: trimmed, remembered: remember });
  },
  clearApiKey: () => {
    writeRemembered(null);
    set({ apiKey: '', remembered: false });
  },
}));

/**
 * Cheap shape check so an obvious paste mistake is caught before a request.
 * Console API keys start with "sk-ant-api". Claude.ai subscription tokens
 * ("sk-ant-oat...") are for Claude Code and don't work against the API here.
 *
 * @param key - Candidate key.
 * @returns A problem to show, or null if it looks usable.
 */
export function apiKeyProblem(key: string): string | null {
  const k = key.trim();
  if (!k) return null;
  if (k.startsWith('sk-ant-oat')) {
    return 'That looks like a Claude subscription token. Use an API key from console.anthropic.com instead.';
  }
  if (!k.startsWith('sk-ant-')) return 'Anthropic API keys start with "sk-ant-".';
  return null;
}
