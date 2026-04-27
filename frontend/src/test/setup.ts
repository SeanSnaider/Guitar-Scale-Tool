/**
 * Vitest global test setup.
 * Imports jest-dom matchers (toBeInTheDocument, etc.) and mocks
 * browser APIs that are unavailable in jsdom.
 */
import '@testing-library/jest-dom';

// Mock Web Audio API — not available in jsdom
const mockAudioContext = {
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    type: 'sine',
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  })),
  createBiquadFilter: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    type: 'lowpass',
    frequency: { value: 0 },
    Q: { value: 0 },
  })),
  destination: {},
  currentTime: 0,
  state: 'suspended',
  resume: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
};

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext),
});

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext),
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
});
