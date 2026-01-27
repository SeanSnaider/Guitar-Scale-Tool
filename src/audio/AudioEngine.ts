import { getNoteFrequency, getNoteOctave, getScaleNotes, SCALES, STANDARD_TUNING, getNoteAtPosition } from '../data/musicTheory';

export interface AudioSettings {
  masterVolume: number;
  noteVolume: number;
  metronomeVolume: number;
  sustainLength: number;
  attackTime: number;
  releaseTime: number;
}

export interface NoteInfo {
  note: string;
  octave: number;
  frequency: number;
  stringIndex?: number;
  fret?: number;
}

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noteGain: GainNode | null = null;
  private metronomeGain: GainNode | null = null;
  private activeOscillators: Map<string, OscillatorNode> = new Map();
  private metronomeInterval: number | null = null;
  private isInitialized = false;

  private settings: AudioSettings = {
    masterVolume: 0.7,
    noteVolume: 0.8,
    metronomeVolume: 0.6,
    sustainLength: 1.5,
    attackTime: 0.02,
    releaseTime: 0.3,
  };

  // Callback for metronome beat (for visual feedback)
  public onMetronomeBeat: ((beat: number, isAccent: boolean) => void) | null = null;

  // Callback for scale playback progress
  public onScaleNotePlay: ((noteIndex: number) => void) | null = null;

  /**
   * Initialize the audio context (must be called after user interaction)
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.settings.masterVolume;
      this.masterGain.connect(this.audioContext.destination);

      // Create note gain node
      this.noteGain = this.audioContext.createGain();
      this.noteGain.gain.value = this.settings.noteVolume;
      this.noteGain.connect(this.masterGain);

      // Create metronome gain node
      this.metronomeGain = this.audioContext.createGain();
      this.metronomeGain.gain.value = this.settings.metronomeVolume;
      this.metronomeGain.connect(this.masterGain);

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      return false;
    }
  }

  /**
   * Update audio settings
   */
  updateSettings(newSettings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    if (this.masterGain) {
      this.masterGain.gain.value = this.settings.masterVolume;
    }
    if (this.noteGain) {
      this.noteGain.gain.value = this.settings.noteVolume;
    }
    if (this.metronomeGain) {
      this.metronomeGain.gain.value = this.settings.metronomeVolume;
    }
  }

  /**
   * Play a single note with guitar-like envelope
   */
  playNote(note: string, octave: number = 4, duration?: number): void {
    if (!this.audioContext || !this.noteGain) {
      this.initialize().then(() => this.playNote(note, octave, duration));
      return;
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const frequency = getNoteFrequency(note, octave);
    if (frequency === 0) return;

    const noteKey = `${note}${octave}`;

    // Stop existing note if playing
    this.stopNote(noteKey);

    const now = this.audioContext.currentTime;
    const sustainTime = duration ?? this.settings.sustainLength;

    // Create oscillators for a richer guitar-like sound
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();

    // Main oscillator - slightly detuned for richness
    osc1.type = 'triangle';
    osc1.frequency.value = frequency;

    // Harmonic oscillator - one octave up, quieter
    osc2.type = 'sine';
    osc2.frequency.value = frequency * 2;

    // Create gain nodes for envelope and mixing
    const envGain = this.audioContext.createGain();
    const mixGain = this.audioContext.createGain();

    // Mix the oscillators (main louder than harmonic)
    osc1.connect(mixGain);
    const harmGain = this.audioContext.createGain();
    harmGain.gain.value = 0.3;
    osc2.connect(harmGain);
    harmGain.connect(mixGain);

    mixGain.connect(envGain);
    envGain.connect(this.noteGain);

    // Apply ADSR envelope (simplified for guitar pluck)
    envGain.gain.setValueAtTime(0, now);
    // Attack
    envGain.gain.linearRampToValueAtTime(1, now + this.settings.attackTime);
    // Decay to sustain level
    envGain.gain.exponentialRampToValueAtTime(0.7, now + this.settings.attackTime + 0.1);
    // Sustain then release
    envGain.gain.exponentialRampToValueAtTime(0.001, now + sustainTime);

    // Start and stop oscillators
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + sustainTime + 0.1);
    osc2.stop(now + sustainTime + 0.1);

    // Store for potential early stopping
    this.activeOscillators.set(noteKey, osc1);

    // Clean up after note finishes
    osc1.onended = () => {
      this.activeOscillators.delete(noteKey);
    };
  }

  /**
   * Play a note at a specific fretboard position
   */
  playNoteAtPosition(stringIndex: number, fret: number, tuning: readonly number[] = STANDARD_TUNING): void {
    const note = getNoteAtPosition(stringIndex, fret, tuning);
    const octave = getNoteOctave(stringIndex, fret);
    this.playNote(note, octave);
  }

  /**
   * Stop a specific note
   */
  stopNote(noteKey: string): void {
    const osc = this.activeOscillators.get(noteKey);
    if (osc && this.audioContext) {
      try {
        osc.stop(this.audioContext.currentTime);
      } catch {
        // Already stopped
      }
      this.activeOscillators.delete(noteKey);
    }
  }

  /**
   * Stop all playing notes
   */
  stopAllNotes(): void {
    if (!this.audioContext) return;

    for (const [key, osc] of this.activeOscillators) {
      try {
        osc.stop(this.audioContext.currentTime);
      } catch {
        // Already stopped
      }
      this.activeOscillators.delete(key);
    }
  }

  /**
   * Play a scale (ascending, descending, or both)
   */
  async playScale(
    rootNote: string,
    scaleKey: string,
    direction: 'ascending' | 'descending' | 'both' = 'ascending',
    bpm: number = 120,
    startOctave: number = 3
  ): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    const scale = SCALES[scaleKey];
    if (!scale) return;

    const scaleNotes = getScaleNotes(rootNote, scale.intervals);
    const beatDuration = 60 / bpm; // seconds per beat

    let notesToPlay: Array<{ note: string; octave: number }> = [];

    // Build note sequence based on direction
    if (direction === 'ascending' || direction === 'both') {
      // Ascending: go up one octave
      notesToPlay = scaleNotes.map((note, i) => ({
        note,
        octave: startOctave + (i >= scaleNotes.indexOf(scaleNotes.find(n => n === 'C') || '') && scaleNotes.indexOf(scaleNotes.find(n => n === 'C') || '') > 0 ? 1 : 0),
      }));
      // Add root at the top
      notesToPlay.push({ note: rootNote, octave: startOctave + 1 });
    }

    if (direction === 'descending' || direction === 'both') {
      // Descending: go back down
      const descendingNotes = [...scaleNotes].reverse().map((note, i) => ({
        note,
        octave: startOctave + (i < scaleNotes.length - scaleNotes.indexOf(scaleNotes.find(n => n === 'C') || '') ? 1 : 0),
      }));

      if (direction === 'both') {
        // Skip the top note (already played)
        notesToPlay = [...notesToPlay, ...descendingNotes.slice(1)];
      } else {
        // Start from the top
        notesToPlay = [{ note: rootNote, octave: startOctave + 1 }, ...descendingNotes];
      }
    }

    // Play each note in sequence
    for (let i = 0; i < notesToPlay.length; i++) {
      const { note, octave } = notesToPlay[i];

      this.playNote(note, octave, beatDuration * 0.9);

      // Notify callback
      if (this.onScaleNotePlay) {
        this.onScaleNotePlay(i);
      }

      // Wait for next beat
      if (i < notesToPlay.length - 1) {
        await this.sleep(beatDuration * 1000);
      }
    }

    // Clear callback
    if (this.onScaleNotePlay) {
      this.onScaleNotePlay(-1);
    }
  }

  /**
   * Start the metronome
   */
  startMetronome(bpm: number, timeSignature: [number, number] = [4, 4], accentFirst: boolean = true): void {
    this.stopMetronome();

    if (!this.audioContext) {
      this.initialize().then(() => this.startMetronome(bpm, timeSignature, accentFirst));
      return;
    }

    const [beatsPerMeasure] = timeSignature;
    const beatDuration = 60 / bpm; // seconds per beat
    let currentBeat = 0;

    const tick = () => {
      if (!this.audioContext || !this.metronomeGain) return;

      const isAccent = accentFirst && currentBeat === 0;

      // Create click sound
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.value = isAccent ? 1000 : 800; // Higher pitch for accent

      osc.connect(gain);
      gain.connect(this.metronomeGain);

      const now = this.audioContext.currentTime;
      gain.gain.setValueAtTime(isAccent ? 0.8 : 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.start(now);
      osc.stop(now + 0.05);

      // Notify callback for visual feedback
      if (this.onMetronomeBeat) {
        this.onMetronomeBeat(currentBeat, isAccent);
      }

      currentBeat = (currentBeat + 1) % beatsPerMeasure;
    };

    // Play first tick immediately
    tick();

    // Set up interval for subsequent ticks
    this.metronomeInterval = window.setInterval(tick, beatDuration * 1000);
  }

  /**
   * Stop the metronome
   */
  stopMetronome(): void {
    if (this.metronomeInterval !== null) {
      clearInterval(this.metronomeInterval);
      this.metronomeInterval = null;
    }
  }

  /**
   * Check if metronome is running
   */
  isMetronomeRunning(): boolean {
    return this.metronomeInterval !== null;
  }

  /**
   * Play a metronome click (for single-beat preview)
   */
  playClick(isAccent: boolean = false): void {
    if (!this.audioContext || !this.metronomeGain) {
      this.initialize().then(() => this.playClick(isAccent));
      return;
    }

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.value = isAccent ? 1000 : 800;

    osc.connect(gain);
    gain.connect(this.metronomeGain);

    const now = this.audioContext.currentTime;
    gain.gain.setValueAtTime(isAccent ? 0.8 : 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Get audio context state
   */
  getState(): AudioContextState | 'uninitialized' {
    return this.audioContext?.state ?? 'uninitialized';
  }

  /**
   * Resume audio context (needed after user interaction)
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Helper: Sleep for a duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopMetronome();
    this.stopAllNotes();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.masterGain = null;
    this.noteGain = null;
    this.metronomeGain = null;
    this.isInitialized = false;
  }
}

// Export singleton instance
export const audioEngine = new AudioEngine();

// Also export the class for testing or multiple instances
export { AudioEngine };
