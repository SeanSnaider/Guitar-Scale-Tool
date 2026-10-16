/**
 * fakeAudioContext.ts
 *
 * A minimal recording stand-in for AudioContext, enough for AudioEngine,
 * GuitarSynth and Metronome. Nodes remember their connections and every
 * AudioParam call, and the test drives `currentTime` and `state` by hand.
 */
import { vi } from 'vitest';

export class FakeParam {
  calls: Array<[string, ...number[]]> = [];
  constructor(public value = 0) {}
  setValueAtTime(v: number, t: number) { this.calls.push(['setValueAtTime', v, t]); this.value = v; return this; }
  linearRampToValueAtTime(v: number, t: number) { this.calls.push(['linearRampToValueAtTime', v, t]); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { this.calls.push(['exponentialRampToValueAtTime', v, t]); return this; }
  setTargetAtTime(v: number, t: number, c: number) { this.calls.push(['setTargetAtTime', v, t, c]); return this; }
  cancelScheduledValues(t: number) { this.calls.push(['cancelScheduledValues', t]); return this; }
}

export class FakeNode {
  connections: FakeNode[] = [];
  disconnected = false;
  connect(n: FakeNode) { this.connections.push(n); return n; }
  disconnect() { this.connections = []; this.disconnected = true; }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

export class FakeOsc extends FakeNode {
  type = 'sine';
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
}

export class FakeAudioContext {
  currentTime = 0;
  state: string = 'running';
  onstatechange: (() => void) | null = null;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  oscs: FakeOsc[] = [];
  resume = vi.fn(async () => {});
  close = vi.fn(async () => { this.state = 'closed'; });

  createGain() { const g = new FakeGain(); this.gains.push(g); return g; }
  createOscillator() { const o = new FakeOsc(); this.oscs.push(o); return o; }
  createBiquadFilter() { return new FakeFilter(); }
  createDynamicsCompressor() { return new FakeCompressor(); }

  /** Change state and fire onstatechange, as a browser would. */
  setState(s: string) { this.state = s; this.onstatechange?.(); }
}

/** The fake, typed as the real thing for constructors that take an AudioContext. */
export const asCtx = (c: FakeAudioContext) => c as unknown as AudioContext;
export const asNode = (n: FakeNode) => n as unknown as AudioNode;
