/**
 * frontendNative.test.tsx
 *
 * The app runs with no server: practice history lives in useHistoryStore and
 * the Anthropic key is shared app-wide through useApiKeyStore.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MAX_CHORDS, chordStats, useHistoryStore } from '../store/useHistoryStore';
import { API_KEY_STORAGE_KEY, apiKeyProblem, useApiKeyStore } from '../ai/apiKey';
import ApiKeyPanel from '../components/ai/ApiKeyPanel';
import ProgressDashboard from '../components/ProgressDashboard';

const initialHistory = useHistoryStore.getInitialState();

beforeEach(() => {
  localStorage.clear();
  useHistoryStore.setState(initialHistory, true);
  useApiKeyStore.getState().clearApiKey();
});

describe('local practice history', () => {
  it('logs a finished session with its duration, newest first', () => {
    const { logSession } = useHistoryStore.getState();
    logSession({ mode: 'notes', scaleKey: 'C-major', bpm: 90, accuracy: 0.8, startedAt: '2026-10-15T10:00:00.000Z', endedAt: '2026-10-15T10:02:30.000Z' });
    logSession({ mode: 'sequence', scaleKey: 'G-dorian', bpm: 120, accuracy: 1, startedAt: '2026-10-15T11:00:00.000Z', endedAt: '2026-10-15T11:00:10.000Z' });
    const [latest, first] = useHistoryStore.getState().sessions;
    expect(latest.scaleKey).toBe('G-dorian');
    expect(first.durationSeconds).toBe(150);
  });

  it('caps the chord log', () => {
    const { logChord } = useHistoryStore.getState();
    for (let i = 0; i < MAX_CHORDS + 5; i++) logChord({ chord: 'Am', root: 'A', quality: 'minor', confidence: 0.9 });
    expect(useHistoryStore.getState().chords).toHaveLength(MAX_CHORDS);
  });

  it('counts the most common chords', () => {
    const log = ['G', 'Am', 'G', 'C', 'G', 'Am'].map((chord, i) => ({
      id: String(i), chord, root: chord[0], quality: 'major', confidence: 1, detectedAt: '',
    }));
    expect(chordStats(log, 2)).toEqual({ total: 6, mostCommon: [{ chord: 'G', count: 3 }, { chord: 'Am', count: 2 }] });
  });

  it('counts scale attempts', () => {
    const { recordScaleAttempt } = useHistoryStore.getState();
    recordScaleAttempt('C-major', true);
    recordScaleAttempt('C-major', false);
    expect(useHistoryStore.getState().scaleAttempts['C-major']).toMatchObject({ total: 2, correct: 1 });
  });

  it('Progress shows logged sessions without any server', () => {
    useHistoryStore.getState().logSession({
      mode: 'intervals', scaleKey: 'C-major', bpm: 100, accuracy: 0.7, startedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    render(<ProgressDashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(screen.getByText(/Intervals · C Major/)).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });
});

describe('shared API key', () => {
  it('stays in memory unless "remember" is on', () => {
    useApiKeyStore.getState().setApiKey('  sk-ant-api03-abc  ', false);
    expect(useApiKeyStore.getState().apiKey).toBe('sk-ant-api03-abc');
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();

    useApiKeyStore.getState().setApiKey('sk-ant-api03-abc', true);
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('sk-ant-api03-abc');

    useApiKeyStore.getState().clearApiKey();
    expect(useApiKeyStore.getState().apiKey).toBe('');
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
  });

  it('flags subscription tokens and non-keys', () => {
    expect(apiKeyProblem('sk-ant-oat01-xyz')).toMatch(/subscription token/);
    expect(apiKeyProblem('hello')).toMatch(/start with/);
    expect(apiKeyProblem('sk-ant-api03-xyz')).toBeNull();
  });

  it('the panel sets the key for every feature and can remember it', () => {
    render(<ApiKeyPanel />);
    fireEvent.change(screen.getByLabelText('Anthropic API key'), { target: { value: 'sk-ant-api03-panel' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Remember on this device' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set key' }));
    expect(useApiKeyStore.getState()).toMatchObject({ apiKey: 'sk-ant-api03-panel', remembered: true });
    expect(screen.getByText('Key saved on this device')).toBeInTheDocument();
  });

  it('the panel refuses a subscription token', () => {
    render(<ApiKeyPanel />);
    fireEvent.change(screen.getByLabelText('Anthropic API key'), { target: { value: 'sk-ant-oat01-nope' } });
    expect(screen.getByRole('button', { name: 'Set key' })).toBeDisabled();
    expect(screen.getByText(/subscription token/)).toBeInTheDocument();
  });
});
