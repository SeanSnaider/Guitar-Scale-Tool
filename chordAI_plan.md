# ChordAI — AI-Powered Chord Progression Generator

## Project Overview

**ChordAI** is a full-stack web application that listens to a guitar chord played through an audio interface (like a Focusrite Scarlett), identifies the chord using audio analysis, and then uses an LLM (Claude via the Anthropic API) to generate genre-aware chord progressions, explain the music theory behind its suggestions, recommend voicings/fingerings, and support conversational follow-ups like "make it darker" or "add a jazz turnaround."

### Why This Project?

This project is designed to be a resume centerpiece that demonstrates:

- **AI/LLM integration** — structured prompting, multi-turn conversation, and tool-use with the Anthropic API
- **Audio/signal processing** — real-time browser audio capture, WebSocket streaming, and chord recognition
- **Full-stack engineering** — React frontend, FastAPI backend, MongoDB persistence, WebSocket communication
- **Domain expertise** — music theory knowledge baked into both the prompting and the UI

### Resume One-Liner (Draft)

> Built an AI-powered chord progression generator that captures live guitar audio via Web Audio API, identifies chords using librosa-based analysis, and generates genre-aware progressions with music theory explanations through the Anthropic API, featuring multi-turn conversational refinement and interactive fretboard visualization.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React, TypeScript, Tailwind CSS, Zustand | Your familiar stack from Guitar Learning Tool and Disrupt |
| **Audio Capture** | Web Audio API, MediaStream API | Browser-native audio input — no plugins needed |
| **Audio Transport** | WebSockets (native browser WebSocket API) | Real-time binary audio data from browser → backend |
| **Backend** | FastAPI (Python) | Async-native, great WebSocket support, your existing stack |
| **Chord Detection** | librosa + custom chord matching (Python) | Industry-standard audio analysis library |
| **AI/LLM** | Anthropic API (Claude) | Structured outputs, multi-turn conversation, tool use |
| **Database** | MongoDB | Flexible schema for progressions, user sessions, history |
| **Audio Playback** | Web Audio API + Tone.js | Play back suggested progressions with realistic guitar sounds |
| **Build Tool** | Vite | Fast dev server, you already use it |
| **Deployment** | Vercel (frontend) + Railway or Render (backend) | Simple deployment for portfolio demos |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (React)                      │
│                                                          │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │ Audio    │──▶│ WebSocket    │──▶│ UI Components   │  │
│  │ Capture  │   │ Client       │   │ - Fretboard     │  │
│  │ (Web     │   │ (sends PCM   │   │ - Chat Panel    │  │
│  │  Audio   │   │  audio       │   │ - Progression   │  │
│  │  API)    │   │  chunks)     │   │   Display       │  │
│  └──────────┘   └──────┬───────┘   │ - Audio Player  │  │
│                        │           └─────────────────┘  │
└────────────────────────┼────────────────────────────────┘
                         │ WebSocket (binary audio + JSON)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                       │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │ WebSocket    │──▶│ Chord        │──▶│ Anthropic   │  │
│  │ Handler      │   │ Detection    │   │ API Client  │  │
│  │ (receives    │   │ (librosa +   │   │ (Claude     │  │
│  │  audio)      │   │  chroma)     │   │  messages)  │  │
│  └──────────────┘   └──────────────┘   └──────┬──────┘  │
│                                                │         │
│                                        ┌───────▼───────┐ │
│                                        │   MongoDB     │ │
│                                        │ - Sessions    │ │
│                                        │ - Progressions│ │
│                                        │ - History     │ │
│                                        └───────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### How Data Flows (Step by Step)

1. **User opens app** → browser requests microphone/audio input permission
2. **User selects their Focusrite** (or other audio interface) from a device dropdown
3. **User plays a chord** → Web Audio API captures raw audio as PCM data (essentially a stream of numbers representing the sound wave)
4. **Frontend sends audio** → via WebSocket, the browser sends ~2-3 seconds of audio data to the backend
5. **Backend analyzes audio** → librosa extracts a "chromagram" (a fingerprint of which notes are present) and matches it to known chord shapes
6. **Chord is identified** → backend sends `{ "chord": "Am7", "confidence": 0.87 }` back to the frontend via WebSocket
7. **User selects a genre** (e.g., jazz, blues, pop) and hits "Generate Progression"
8. **Backend calls Claude** → sends the detected chord + genre + conversation history to the Anthropic API
9. **Claude responds** → returns a structured JSON with the progression, theory explanation, voicings, etc.
10. **Frontend displays results** → shows chord names, fretboard diagrams, theory explanation, and offers audio playback
11. **User can follow up** → "make it darker", "swap the ii chord for a diminished" → multi-turn conversation with Claude

---

## Detailed Component Design

### 1. Audio Capture (Frontend)

#### What It Does
Captures live audio from the user's audio interface (Focusrite, etc.) through the browser.

#### Key Concepts to Understand

- **Web Audio API**: A browser-built-in system for processing audio. Think of it as a graph of audio "nodes" that you connect together — a source node (your microphone) connects to processing nodes and eventually to a destination (your speakers or an analyzer).
- **MediaStream API**: The browser API that asks the user for permission to access their microphone/audio input, similar to how a video call app asks for camera access.
- **PCM Data**: "Pulse Code Modulation" — just raw audio as an array of floating-point numbers between -1.0 and 1.0. Each number is a "sample" representing the amplitude of the sound wave at that instant. At 44100 Hz sample rate, you get 44,100 numbers per second.
- **AudioWorklet**: A way to run custom audio processing code in a separate thread so it doesn't block the UI. We'll use this to capture audio chunks efficiently.

#### Implementation

```typescript
// Frontend: src/audio/AudioCapture.ts

/**
 * This class handles getting audio from the user's audio interface.
 *
 * How it works:
 * 1. We ask the browser for access to the user's audio input device
 * 2. The browser gives us a MediaStream (a stream of audio data)
 * 3. We connect that stream to the Web Audio API's processing graph
 * 4. An AudioWorklet captures chunks of raw audio data
 * 5. We send those chunks to the backend via WebSocket
 */
class AudioCapture {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;

  /**
   * Lists all available audio input devices.
   * This is how the user picks their Focusrite vs built-in mic.
   */
  async getInputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  }

  /**
   * Start capturing audio from a specific device.
   * @param deviceId - The ID of the audio input device (from getInputDevices)
   */
  async startCapture(deviceId: string): Promise<void> {
    // Step 1: Ask browser for audio access with specific settings
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        sampleRate: 44100,        // CD quality — 44,100 samples per second
        channelCount: 1,          // Mono — we only need one channel for chord detection
        echoCancellation: false,  // Turn OFF — we want raw guitar signal, not processed voice
        noiseSuppression: false,  // Turn OFF — same reason
        autoGainControl: false,   // Turn OFF — we want the actual signal level
      }
    });

    // Step 2: Create the Web Audio API context
    // Think of this as the "workspace" where all audio processing happens
    this.audioContext = new AudioContext({ sampleRate: 44100 });

    // Step 3: Create a "source node" from the microphone stream
    const source = this.audioContext.createMediaStreamSource(this.stream);

    // Step 4: Load and connect the AudioWorklet (runs in separate thread)
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');
    const processor = new AudioWorkletNode(this.audioContext, 'audio-processor');

    // Step 5: Connect: microphone → processor
    source.connect(processor);

    // Step 6: Listen for audio chunks from the processor
    processor.port.onmessage = (event) => {
      // event.data is a Float32Array of audio samples
      // We'll send this to the backend via WebSocket
      this.onAudioChunk(event.data);
    };
  }

  /** Called when we have a chunk of audio ready to send */
  private onAudioChunk(samples: Float32Array): void {
    // This will be connected to the WebSocket sender
    // We'll implement this connection in the WebSocket section
  }

  /** Stop capturing and release the microphone */
  async stopCapture(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    await this.audioContext?.close();
  }
}
```

```javascript
// Frontend: public/audio-processor.js
//
// This is an AudioWorklet processor. It runs in a SEPARATE THREAD from your
// main React code. That's important because audio processing needs to happen
// in real-time without any interruption — if your React component re-renders,
// it shouldn't cause audio glitches.
//
// The processor collects audio samples into a buffer, and when the buffer is
// full (about 2-3 seconds of audio), it sends the whole chunk to the main
// thread for analysis.

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 44100 * 2.5; // 2.5 seconds at 44100 Hz = 110,250 samples
  }

  /**
   * This method is called automatically by the browser ~344 times per second.
   * Each call gives us 128 audio samples to process.
   *
   * @param inputs - Array of input channels. inputs[0][0] is mono audio data.
   * @returns true to keep processing, false to stop
   */
  process(inputs) {
    const input = inputs[0][0]; // First input, first channel (mono)
    if (input) {
      // Add these 128 samples to our buffer
      this.buffer.push(...input);

      // When we have enough samples (2.5 seconds worth), send them
      if (this.buffer.length >= this.bufferSize) {
        this.port.postMessage(new Float32Array(this.buffer));
        this.buffer = []; // Clear buffer for next chunk
      }
    }
    return true; // Keep processing
  }
}

registerProcessor('audio-processor', AudioProcessor);
```

---

### 2. WebSocket Communication

#### What Is a WebSocket?

Normal HTTP requests are like sending letters — you send a request, wait for a response, done. WebSockets are like a phone call — you open a connection once, and then both sides can send messages back and forth at any time. This is crucial for audio because:

- We need to send audio data continuously (not one request at a time)
- The server needs to push results back as soon as they're ready
- We don't want the overhead of creating a new HTTP connection for every audio chunk

#### Implementation

```typescript
// Frontend: src/audio/WebSocketClient.ts

/**
 * Manages the WebSocket connection to the backend.
 *
 * Message protocol:
 * - BINARY messages: raw audio data (Float32Array → ArrayBuffer)
 * - TEXT messages: JSON commands and responses
 *
 * The frontend sends:
 *   - Binary: audio chunks from AudioCapture
 *   - JSON: { type: "analyze" } to trigger chord analysis
 *   - JSON: { type: "generate", genre: "jazz", message: "..." } for LLM requests
 *
 * The backend sends:
 *   - JSON: { type: "chord_detected", chord: "Am7", confidence: 0.87 }
 *   - JSON: { type: "progression", data: { ... } }
 *   - JSON: { type: "error", message: "..." }
 */
class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  connect(sessionId: string): void {
    // Connect to the FastAPI backend's WebSocket endpoint
    this.ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);

    // WebSocket has built-in event handlers:
    this.ws.onopen = () => console.log('Connected to backend');

    this.ws.onmessage = (event) => {
      // Parse the JSON message and route to the right handler
      const message = JSON.parse(event.data);
      const handler = this.messageHandlers.get(message.type);
      if (handler) handler(message);
    };

    this.ws.onclose = () => {
      // Auto-reconnect after 3 seconds if connection drops
      setTimeout(() => this.connect(sessionId), 3000);
    };
  }

  /** Send raw audio data as binary */
  sendAudio(samples: Float32Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // .buffer gives us the raw ArrayBuffer underlying the Float32Array
      // WebSocket can send binary data directly — very efficient
      this.ws.send(samples.buffer);
    }
  }

  /** Send a JSON command */
  sendCommand(type: string, data: Record<string, any> = {}): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  /** Register a handler for a specific message type */
  on(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }
}
```

```python
# Backend: app/websocket/handler.py

"""
WebSocket handler for the FastAPI backend.

This is the server side of the WebSocket connection. It:
1. Receives binary audio data from the browser
2. Buffers it until we have enough for analysis
3. Runs chord detection when requested
4. Sends results back to the frontend

FastAPI's WebSocket support is built on top of Starlette, which uses
Python's asyncio for non-blocking I/O. This means one server can handle
many simultaneous WebSocket connections efficiently.
"""

from fastapi import WebSocket, WebSocketDisconnect
import numpy as np

class AudioWebSocketHandler:
    def __init__(self, chord_detector, llm_client):
        self.chord_detector = chord_detector
        self.llm_client = llm_client
        self.audio_buffer = bytearray()  # Raw bytes accumulate here

    async def handle(self, websocket: WebSocket, session_id: str):
        await websocket.accept()

        try:
            while True:
                # WebSocket messages can be text (JSON) or bytes (audio)
                message = await websocket.receive()

                if "bytes" in message:
                    # Binary message = audio data
                    self.audio_buffer.extend(message["bytes"])

                elif "text" in message:
                    # Text message = JSON command
                    data = json.loads(message["text"])

                    if data["type"] == "analyze":
                        # Convert raw bytes back to numpy array of floats
                        # np.frombuffer reinterprets the bytes as float32 numbers
                        audio_data = np.frombuffer(
                            bytes(self.audio_buffer), dtype=np.float32
                        )
                        self.audio_buffer.clear()

                        # Run chord detection
                        result = self.chord_detector.detect(audio_data)
                        await websocket.send_json({
                            "type": "chord_detected",
                            "chord": result.chord,
                            "confidence": result.confidence,
                            "notes": result.notes  # e.g., ["A", "C", "E", "G"]
                        })

                    elif data["type"] == "generate":
                        # Call Claude for progression generation
                        response = await self.llm_client.generate_progression(
                            chord=data["chord"],
                            genre=data["genre"],
                            message=data.get("message", ""),
                            session_id=session_id
                        )
                        await websocket.send_json({
                            "type": "progression",
                            "data": response
                        })

        except WebSocketDisconnect:
            pass  # Client disconnected — clean up handled by FastAPI
```

---

### 3. Chord Detection (Backend)

#### What It Does

Takes raw audio data and figures out what chord is being played. This is the signal processing core of the application.

#### Key Concepts

- **librosa**: A Python library for audio analysis. Think of it as "pandas but for sound." It can extract features like pitch, tempo, and spectral content from audio.
- **Chromagram**: The key feature we extract. A chromagram is a 12-row matrix where each row represents one of the 12 musical notes (C, C#, D, ..., B). For each time window, it tells you how "present" each note is. If you play an Am7 chord (A, C, E, G), the rows for A, C, E, and G will have high values.
- **Chroma Vector**: A single column of the chromagram — a 12-element array showing the energy of each pitch class at one moment. We average these across the whole audio clip to get a single "fingerprint."
- **Template Matching**: We pre-define what each chord's chroma vector *should* look like (e.g., C major = high C, E, G) and compare our detected vector to all templates to find the best match.

#### Implementation

```python
# Backend: app/audio/chord_detector.py

"""
Chord detection using librosa chromagram analysis.

How this works at a high level:
1. Take raw audio samples (array of floats)
2. Compute a chromagram — a 12-bin representation of which notes are present
3. Average the chromagram over time to get a single "chord fingerprint"
4. Compare that fingerprint to known chord templates
5. Return the best matching chord

This approach works well for clean, single-chord audio (which is what we get
from a guitar through a Focusrite — minimal background noise).
"""

import librosa
import numpy as np
from dataclasses import dataclass

@dataclass
class ChordResult:
    chord: str            # e.g., "Am7"
    confidence: float     # 0.0 to 1.0
    notes: list[str]      # e.g., ["A", "C", "E", "G"]
    root: str             # e.g., "A"
    quality: str          # e.g., "minor seventh"


class ChordDetector:
    # The 12 pitch classes in Western music
    NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
        self.chord_templates = self._build_chord_templates()

    def detect(self, audio: np.ndarray) -> ChordResult:
        """
        Main detection method.

        Parameters:
            audio: numpy array of float32 samples, mono, 44100 Hz

        Returns:
            ChordResult with the detected chord and metadata
        """
        # Step 1: Compute the chromagram
        # hop_length=512 means we analyze every 512 samples (~11.6ms at 44100Hz)
        # This gives us a 12 x N matrix where N is the number of time windows
        chromagram = librosa.feature.chroma_cqt(
            y=audio,
            sr=self.sample_rate,
            hop_length=512,
            n_chroma=12  # 12 pitch classes
        )

        # Step 2: Average across time to get a single 12-element vector
        # This collapses the time dimension — we just want to know
        # "overall, which notes are present in this audio clip?"
        chroma_vector = np.mean(chromagram, axis=1)

        # Step 3: Normalize to 0-1 range so we can compare fairly
        chroma_vector = chroma_vector / (np.max(chroma_vector) + 1e-8)

        # Step 4: Compare against every known chord template
        best_match = None
        best_score = -1

        for chord_name, template in self.chord_templates.items():
            # Cosine similarity: how "aligned" are these two vectors?
            # 1.0 = perfect match, 0.0 = completely different
            score = np.dot(chroma_vector, template) / (
                np.linalg.norm(chroma_vector) * np.linalg.norm(template) + 1e-8
            )
            if score > best_score:
                best_score = score
                best_match = chord_name

        # Step 5: Build the result
        return ChordResult(
            chord=best_match,
            confidence=float(best_score),
            notes=self._get_chord_notes(best_match),
            root=best_match[0] if best_match[1] != '#' else best_match[:2],
            quality=self._get_chord_quality(best_match)
        )

    def _build_chord_templates(self) -> dict[str, np.ndarray]:
        """
        Build chroma templates for common chord types.

        Each template is a 12-element array where 1.0 means "this note is
        in the chord" and 0.0 means "this note is not." We build these
        using interval patterns (semitone distances from the root).

        For example, a major chord has intervals [0, 4, 7]:
        - Root (0 semitones up)
        - Major third (4 semitones up)
        - Perfect fifth (7 semitones up)
        """
        # Interval patterns for each chord quality
        # Numbers are semitones above the root
        chord_types = {
            '':       [0, 4, 7],           # Major triad (C, E, G)
            'm':      [0, 3, 7],           # Minor triad (C, Eb, G)
            '7':      [0, 4, 7, 10],       # Dominant 7th (C, E, G, Bb)
            'maj7':   [0, 4, 7, 11],       # Major 7th (C, E, G, B)
            'm7':     [0, 3, 7, 10],       # Minor 7th (C, Eb, G, Bb)
            'dim':    [0, 3, 6],           # Diminished (C, Eb, Gb)
            'aug':    [0, 4, 8],           # Augmented (C, E, G#)
            'sus2':   [0, 2, 7],           # Suspended 2nd (C, D, G)
            'sus4':   [0, 5, 7],           # Suspended 4th (C, F, G)
            'm7b5':   [0, 3, 6, 10],      # Half-diminished (C, Eb, Gb, Bb)
            'dim7':   [0, 3, 6, 9],        # Fully diminished 7th
            '9':      [0, 4, 7, 10, 14],   # Dominant 9th
            'add9':   [0, 4, 7, 14],       # Add 9
            '6':      [0, 4, 7, 9],        # Major 6th
            'm6':     [0, 3, 7, 9],        # Minor 6th
        }

        templates = {}
        for root_idx, root_name in enumerate(self.NOTE_NAMES):
            for quality, intervals in chord_types.items():
                chord_name = f"{root_name}{quality}"
                template = np.zeros(12)
                for interval in intervals:
                    # (root_idx + interval) % 12 wraps around the 12 notes
                    template[(root_idx + interval) % 12] = 1.0
                templates[chord_name] = template

        return templates

    def _get_chord_notes(self, chord_name: str) -> list[str]:
        """Extract the note names from a chord template."""
        template = self.chord_templates.get(chord_name, np.zeros(12))
        return [self.NOTE_NAMES[i] for i in range(12) if template[i] > 0]

    def _get_chord_quality(self, chord_name: str) -> str:
        """Human-readable quality description."""
        quality_map = {
            '': 'major', 'm': 'minor', '7': 'dominant seventh',
            'maj7': 'major seventh', 'm7': 'minor seventh',
            'dim': 'diminished', 'aug': 'augmented',
            'sus2': 'suspended second', 'sus4': 'suspended fourth',
            'm7b5': 'half-diminished', 'dim7': 'diminished seventh',
        }
        # Parse the quality suffix from the chord name
        for suffix, name in sorted(quality_map.items(), key=lambda x: -len(x[0])):
            if chord_name.endswith(suffix):
                return name
        return 'unknown'
```

---

### 4. LLM Integration (Anthropic API)

#### What It Does

This is the AI brain of the application. It takes the detected chord, the user's selected genre, and any conversational context, and generates musically intelligent chord progressions with explanations.

#### Key Concepts

- **Anthropic API**: The API for Claude. You send messages (like a chat), and Claude responds. You'll need an API key from console.anthropic.com.
- **System Prompt**: A special first message that sets Claude's behavior and personality. This is where we inject all the music theory knowledge and output format requirements.
- **Structured Output**: We'll instruct Claude to respond in JSON format so we can parse the response programmatically, rather than getting free-form text we'd have to parse.
- **Multi-turn Conversation**: We store the conversation history and send it with each request, so Claude remembers what it suggested before and can refine.
- **Token Usage**: Each API call costs money based on input/output tokens (roughly, 1 token ≈ 4 characters). We'll want to be mindful of this, especially with long conversation histories.

#### Implementation

```python
# Backend: app/llm/anthropic_client.py

"""
Anthropic API client for chord progression generation.

This module handles all communication with Claude. The key design decisions:

1. SYSTEM PROMPT: We give Claude a detailed "persona" as a music theory expert.
   This dramatically improves the quality of suggestions vs a generic prompt.

2. STRUCTURED OUTPUT: We ask Claude to respond in JSON with a specific schema.
   This lets our frontend parse and display the data reliably.

3. CONVERSATION HISTORY: We maintain a list of messages per session so Claude
   can understand follow-up requests like "make it darker" or "use jazz voicings."

4. GENRE CONTEXT: Each genre has specific music theory rules (jazz uses extended
   chords, blues uses dominant 7ths, etc.) that we inject into the prompt.
"""

import anthropic
from typing import Optional
import json


# Genre-specific context injected into the prompt
GENRE_CONTEXTS = {
    "jazz": {
        "description": "Jazz harmony",
        "theory_notes": """
            - Emphasize ii-V-I progressions, tritone substitutions, and modal interchange
            - Use extended chords (7ths, 9ths, 11ths, 13ths) extensively
            - Consider chord-scale relationships (dorian over ii, mixolydian over V, etc.)
            - Voice leading is paramount — minimize movement between chord tones
            - Common devices: secondary dominants, backdoor ii-V, Coltrane changes
        """,
        "example_progressions": "Dm7 → G7 → Cmaj7 | Am7 → D7 → Gmaj7 → Cmaj7"
    },
    "blues": {
        "description": "Blues harmony",
        "theory_notes": """
            - 12-bar blues structure is foundational (I7-I7-I7-I7-IV7-IV7-I7-I7-V7-IV7-I7-V7)
            - Dominant 7th chords on every degree
            - Quick-change variations, turnarounds, and stop-time sections
            - Consider minor blues (i7-iv7-i7-i7-iv7-iv7-i7-i7-bVI7-V7-i7-V7)
            - Blues shuffles and swing feel implications
        """,
        "example_progressions": "A7 → D7 → A7 → A7 → D7 → D7 → A7 → A7 → E7 → D7 → A7 → E7"
    },
    "pop": {
        "description": "Pop harmony",
        "theory_notes": """
            - Focus on diatonic progressions (I, IV, V, vi are the core chords)
            - The "four-chord song" (I-V-vi-IV) and its rotations are very common
            - Emphasis on singability and predictability
            - Borrowed chords from parallel minor for emotional color
            - Pre-chorus lift patterns, post-chorus drops
        """,
        "example_progressions": "C → G → Am → F | C → Am → F → G"
    },
    "rock": {
        "description": "Rock harmony",
        "theory_notes": """
            - Power chords and open chords dominate
            - Mixolydian mode (bVII chord) is extremely common
            - Pentatonic-based riffs and progressions
            - Consider: I-bVII-IV (rock cadence), I-bIII-IV, I-IV-V
            - Distortion-friendly voicings (avoid major 3rds in heavy contexts)
        """,
        "example_progressions": "E → D → A → E | G → F → C → G"
    },
    "r&b": {
        "description": "R&B / Neo-soul harmony",
        "theory_notes": """
            - Rich extended chords: maj9, min11, dom13
            - Chromatic passing chords and approach chords
            - Gospel-influenced progressions (IV/V, diminished passing chords)
            - Erykah Badu / D'Angelo style: stacked 4ths, quartal harmony
            - Emphasis on groove and rhythmic placement of chord changes
        """,
        "example_progressions": "Fmaj9 → Em7 → Am9 → Gm9 → C13"
    },
    "classical": {
        "description": "Classical / Western art music harmony",
        "theory_notes": """
            - Strict voice leading rules (avoid parallel 5ths/octaves)
            - Functional harmony: T(onic) → PD(predominant) → D(ominant) → T
            - Consider: Neapolitan chords (bII6), augmented 6th chords
            - Cadence types: PAC, IAC, HC, deceptive, plagal
            - Sequences (circle of 5ths, ascending 2nds, descending 3rds)
        """,
        "example_progressions": "I → IV → viio6 → I6 → IV → V → I"
    },
    "folk": {
        "description": "Folk / Singer-songwriter harmony",
        "theory_notes": """
            - Open chord voicings (especially CAGED shapes)
            - Droning open strings create modal color
            - Mixolydian and dorian modes common
            - Fingerpicking-friendly voicings
            - Suspensions and add chords (sus2, sus4, add9) for texture
        """,
        "example_progressions": "G → Cadd9 → Em7 → Dsus4 → D"
    },
}


# The system prompt — this is the most important part of the LLM integration.
# A well-crafted system prompt is the difference between generic and excellent output.
SYSTEM_PROMPT = """You are ChordAI, an expert music theory assistant and chord progression generator.

Your role is to:
1. Generate chord progressions that incorporate a user's detected chord
2. Tailor progressions to specific genres with authentic harmonic language
3. Explain the music theory behind your choices in an educational way
4. Suggest guitar voicings and fingerings when asked
5. Refine suggestions based on conversational feedback

RESPONSE FORMAT — you MUST respond with valid JSON matching this schema:

{
  "progression": {
    "chords": ["Am7", "Dm9", "G13", "Cmaj7"],
    "roman_numerals": ["vi7", "ii9", "V13", "Imaj7"],
    "key": "C major",
    "time_signature": "4/4",
    "bars_per_chord": 1,
    "total_bars": 4
  },
  "theory_explanation": "This is a vi-ii-V-I turnaround in C major. The Am7 (your detected chord) serves as the vi chord, setting up a classic jazz resolution...",
  "genre_notes": "In jazz, extending the ii and V chords to 9ths and 13ths adds color while maintaining the fundamental voice leading...",
  "voicings": [
    {
      "chord": "Am7",
      "frets": [null, 0, 2, 0, 1, 0],
      "fingers": [null, null, 2, null, 1, null],
      "position": "open",
      "notes_low_to_high": ["A", "E", "A", "C", "E"]
    }
  ],
  "follow_up_suggestions": [
    "Try making it darker by substituting the ii chord",
    "Add a turnaround at the end",
    "Extend this to an 8-bar section"
  ]
}

RULES:
- Always incorporate the user's detected chord naturally into the progression
- Provide at least one voicing per chord in the progression
- Frets array is 6 elements [low E, A, D, G, B, high E], null = don't play
- Be educational but not condescending
- When refining, explain what changed and why
- Roman numeral analysis should be relative to the identified key
"""


class AnthropicChordClient:
    def __init__(self, api_key: str):
        # The anthropic library handles HTTP requests, auth, retries, etc.
        self.client = anthropic.Anthropic(api_key=api_key)

        # Store conversation history per session
        # Key: session_id, Value: list of message dicts
        self.conversations: dict[str, list[dict]] = {}

    async def generate_progression(
        self,
        chord: str,
        genre: str,
        message: str = "",
        session_id: str = ""
    ) -> dict:
        """
        Generate a chord progression using Claude.

        Parameters:
            chord: The detected chord (e.g., "Am7")
            genre: The selected genre (e.g., "jazz")
            message: Optional follow-up message from the user
            session_id: For maintaining conversation history

        Returns:
            Parsed JSON response from Claude
        """
        # Get or create conversation history for this session
        if session_id not in self.conversations:
            self.conversations[session_id] = []

        history = self.conversations[session_id]

        # Build the genre context
        genre_ctx = GENRE_CONTEXTS.get(genre, GENRE_CONTEXTS["pop"])

        # Build the user message
        if message:
            # Follow-up message (e.g., "make it darker")
            user_content = f"[Current chord: {chord} | Genre: {genre}] {message}"
        else:
            # Initial generation request
            user_content = (
                f"I played a {chord} chord on my guitar. "
                f"Generate a chord progression in the {genre_ctx['description']} style "
                f"that incorporates this chord.\n\n"
                f"Genre context:\n{genre_ctx['theory_notes']}\n"
                f"Example progressions in this genre: {genre_ctx['example_progressions']}"
            )

        # Add user message to history
        history.append({"role": "user", "content": user_content})

        # Call Claude
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",    # Good balance of quality and speed
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=history                      # Send full conversation history
        )

        # Extract the text response
        assistant_message = response.content[0].text

        # Add assistant response to history
        history.append({"role": "assistant", "content": assistant_message})

        # Parse the JSON response
        # Claude should respond with pure JSON, but sometimes wraps it in markdown
        cleaned = assistant_message.strip()
        if cleaned.startswith("```"):
            # Remove markdown code fences if present
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]

        return json.loads(cleaned)

    def clear_session(self, session_id: str) -> None:
        """Clear conversation history for a session."""
        self.conversations.pop(session_id, None)
```

---

### 5. MongoDB Data Models

#### What We Store and Why

```python
# Backend: app/models/schemas.py

"""
MongoDB document schemas.

MongoDB is a "document database" — instead of tables with fixed columns (like SQL),
you store JSON-like documents in collections. Each document can have different fields.

We use motor (async MongoDB driver for Python) with Pydantic models for validation.

Why MongoDB for this project:
- Chord progressions have variable structure (different numbers of chords, voicings, etc.)
- Conversation histories are naturally document-shaped (list of messages)
- No complex joins needed — each session is self-contained
- Easy to iterate on the schema as the project evolves
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class Voicing(BaseModel):
    """Guitar chord voicing — maps directly to a fretboard diagram."""
    chord: str                                    # "Am7"
    frets: list[Optional[int]]                    # [None, 0, 2, 0, 1, 0] — 6 strings
    fingers: Optional[list[Optional[int]]] = None # [None, None, 2, None, 1, None]
    position: str = "open"                        # "open", "barre", or fret number
    notes_low_to_high: list[str] = []             # ["A", "E", "A", "C", "E"]


class Progression(BaseModel):
    """A generated chord progression with all its metadata."""
    chords: list[str]                # ["Am7", "Dm9", "G13", "Cmaj7"]
    roman_numerals: list[str]        # ["vi7", "ii9", "V13", "Imaj7"]
    key: str                         # "C major"
    time_signature: str = "4/4"
    bars_per_chord: int = 1
    total_bars: int = 4
    voicings: list[Voicing] = []


class SessionDocument(BaseModel):
    """
    A complete user session — stored as one document in MongoDB.

    This captures everything about one "sitting" with the app:
    the chords they played, what they asked for, and what was generated.
    """
    session_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Audio analysis results
    detected_chords: list[dict] = []  # [{ chord: "Am7", confidence: 0.87, timestamp: ... }]

    # Generated progressions (user might generate several per session)
    progressions: list[dict] = []     # Full LLM response objects

    # Conversation history (for multi-turn with Claude)
    messages: list[dict] = []         # [{ role: "user", content: "..." }, ...]

    # User preferences for this session
    genre: str = "jazz"
    tempo: Optional[int] = None


class SavedProgression(BaseModel):
    """
    A progression the user explicitly saved (favorited).
    Separate collection for quick retrieval.
    """
    user_id: Optional[str] = None     # If you add auth later
    session_id: str
    name: str                         # User-given name, e.g., "Jazz Ballad in C"
    progression: Progression
    genre: str
    theory_explanation: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    tags: list[str] = []              # ["jazz", "ballad", "ii-V-I"]
```

---

### 6. Frontend Components

#### Component Tree

```
App
├── Header
│   ├── Logo
│   └── SessionControls (new session, history)
│
├── AudioPanel
│   ├── DeviceSelector (dropdown of audio inputs)
│   ├── AudioVisualizer (waveform / level meter)
│   ├── RecordButton (tap to capture chord)
│   └── ChordDisplay (shows detected chord + confidence)
│
├── ControlPanel
│   ├── GenreSelector (grid of genre buttons)
│   ├── GenerateButton
│   └── TempoSlider (optional)
│
├── ResultsPanel
│   ├── ProgressionDisplay
│   │   ├── ChordCards (one per chord, clickable)
│   │   ├── RomanNumeralAnalysis
│   │   └── PlaybackControls (play, stop, tempo)
│   │
│   ├── FretboardDiagram (interactive, shows voicings)
│   │
│   └── TheoryExplanation (collapsible)
│
├── ChatPanel (right sidebar)
│   ├── MessageList (conversation with Claude)
│   ├── SuggestionChips ("make it darker", "add turnaround")
│   └── MessageInput
│
└── HistoryDrawer (saved progressions)
```

#### Key Component: ProgressionDisplay

```tsx
// Frontend: src/components/ProgressionDisplay.tsx

/**
 * Displays a generated chord progression as a series of interactive cards.
 *
 * Each chord card shows:
 * - The chord symbol (e.g., "Am7")
 * - The roman numeral analysis (e.g., "vi7")
 * - A mini fretboard preview
 * - Click to see full voicing on the main fretboard
 *
 * The whole row is also playable — clicking "play" will sound out
 * the progression using Tone.js with a guitar-like sound.
 */

import { useState } from 'react';

interface ProgressionData {
  chords: string[];
  roman_numerals: string[];
  key: string;
  time_signature: string;
  bars_per_chord: number;
  voicings: Voicing[];
}

interface Props {
  progression: ProgressionData;
  onChordSelect: (index: number) => void; // Callback when user clicks a chord
  isPlaying: boolean;
  currentChordIndex: number; // Which chord is currently playing (-1 if none)
}

export function ProgressionDisplay({
  progression,
  onChordSelect,
  isPlaying,
  currentChordIndex
}: Props) {
  return (
    <div className="space-y-4">
      {/* Key and time signature header */}
      <div className="flex items-center gap-4 text-sm text-gray-400">
        <span>Key: {progression.key}</span>
        <span>Time: {progression.time_signature}</span>
        <span>{progression.bars_per_chord} bar(s) per chord</span>
      </div>

      {/* Chord cards in a row */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {progression.chords.map((chord, index) => (
          <button
            key={index}
            onClick={() => onChordSelect(index)}
            className={`
              flex-shrink-0 p-4 rounded-xl border-2 transition-all
              min-w-[120px] text-center cursor-pointer
              ${currentChordIndex === index
                ? 'border-blue-500 bg-blue-500/10 scale-105'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
              }
            `}
          >
            {/* Chord symbol */}
            <div className="text-2xl font-bold text-white">
              {chord}
            </div>

            {/* Roman numeral */}
            <div className="text-sm text-gray-400 mt-1">
              {progression.roman_numerals[index]}
            </div>

            {/* Bar indicator */}
            <div className="flex gap-1 justify-center mt-2">
              {Array.from({ length: progression.bars_per_chord }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-gray-600" />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

### 7. Audio Playback (Tone.js)

#### What It Does

Plays back the generated chord progression so the user can hear what it sounds like. Uses Tone.js, a library built on top of Web Audio API that makes it much easier to create musical sounds.

#### Key Concepts

- **Tone.js**: A framework for creating interactive music in the browser. It gives you synthesizers, samplers, effects, and scheduling tools. Think of it as "a virtual instrument rack in JavaScript."
- **Sampler**: A Tone.js instrument that plays back recorded audio samples. We'll use guitar samples so the playback sounds like an actual guitar, not a synthesizer.
- **Transport**: Tone.js's built-in sequencer/timeline. You schedule events (like "play chord X at beat 4") and the Transport handles timing.

```typescript
// Frontend: src/audio/ProgressionPlayer.ts

/**
 * Plays back chord progressions using Tone.js.
 *
 * How it works:
 * 1. We create a Tone.js PolySynth (can play multiple notes at once)
 * 2. We schedule each chord in the progression on Tone.js's Transport timeline
 * 3. When the user hits play, the Transport starts and triggers chords at the right time
 *
 * NOTE: Browsers require a user gesture (click/tap) before playing audio.
 * Tone.start() must be called from a click handler. This is a browser security policy,
 * not a Tone.js limitation.
 */

import * as Tone from 'tone';

// Maps chord names to arrays of note names that Tone.js can play
// Tone.js uses scientific pitch notation: "C4" = middle C, "A3" = A below middle C
const CHORD_TO_NOTES: Record<string, string[]> = {
  'C':     ['C3', 'E3', 'G3', 'C4', 'E4'],
  'Cm':    ['C3', 'Eb3', 'G3', 'C4', 'Eb4'],
  'Am':    ['A2', 'E3', 'A3', 'C4', 'E4'],
  'Am7':   ['A2', 'E3', 'G3', 'C4', 'E4'],
  'Dm7':   ['D3', 'A3', 'C4', 'F4'],
  'G7':    ['G2', 'B3', 'D4', 'F4'],
  'Cmaj7': ['C3', 'E3', 'G3', 'B3', 'E4'],
  // ... (we'll build a more complete mapping, or derive from voicing fret data)
};

class ProgressionPlayer {
  private synth: Tone.PolySynth;
  private onChordChange: ((index: number) => void) | null = null;

  constructor() {
    // PolySynth = "polyphonic synthesizer" = can play multiple notes simultaneously
    // We use an AM (amplitude modulation) synth which has a warm, guitar-ish tone
    this.synth = new Tone.PolySynth(Tone.AMSynth, {
      maxPolyphony: 6,  // Guitar has 6 strings
      voice: {
        envelope: {
          attack: 0.02,   // How quickly the note starts (seconds)
          decay: 0.3,     // How quickly it fades from peak to sustain
          sustain: 0.4,   // Volume level while held (0-1)
          release: 1.5    // How long it takes to fade out after release
        }
      }
    }).toDestination();  // .toDestination() connects to speakers
  }

  /**
   * Schedule and play a chord progression.
   *
   * @param chords - Array of chord names ["Am7", "Dm7", "G7", "Cmaj7"]
   * @param bpm - Tempo in beats per minute
   * @param barsPerChord - How many bars each chord lasts
   * @param onChordChange - Callback fired when the current chord changes (for UI highlighting)
   */
  async play(
    chords: string[],
    bpm: number = 120,
    barsPerChord: number = 1,
    onChordChange?: (index: number) => void
  ): Promise<void> {
    // IMPORTANT: Must be called from a user gesture (click handler)
    await Tone.start();

    this.onChordChange = onChordChange || null;

    // Set the tempo
    Tone.getTransport().bpm.value = bpm;

    // Clear any previously scheduled events
    Tone.getTransport().cancel();

    // Schedule each chord
    // "0:0:0" means "bar 0, beat 0, sixteenth 0" in Tone.js time notation
    chords.forEach((chord, index) => {
      const time = `${index * barsPerChord}:0:0`;
      const notes = CHORD_TO_NOTES[chord] || CHORD_TO_NOTES['C']; // Fallback

      Tone.getTransport().schedule((scheduledTime) => {
        // Play the chord (all notes at once)
        this.synth.triggerAttackRelease(
          notes,
          `${barsPerChord}m`,  // Duration: number of measures
          scheduledTime
        );
        // Notify the UI
        this.onChordChange?.(index);
      }, time);
    });

    // Schedule stopping after the last chord finishes
    const totalBars = chords.length * barsPerChord;
    Tone.getTransport().schedule(() => {
      this.stop();
      this.onChordChange?.(-1);
    }, `${totalBars}:0:0`);

    // Start playback
    Tone.getTransport().start();
  }

  stop(): void {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    this.synth.releaseAll();
  }
}

export default ProgressionPlayer;
```

---

### 8. FastAPI Application Setup

```python
# Backend: app/main.py

"""
FastAPI application entry point.

FastAPI is a modern Python web framework that:
- Is async-native (uses Python's asyncio)
- Has built-in WebSocket support
- Auto-generates API documentation at /docs
- Uses Pydantic for request/response validation

To run this server locally:
    cd backend
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

"uvicorn" is an ASGI server — it's the actual program that listens for HTTP/WebSocket
connections and passes them to your FastAPI app. Think of it as the equivalent of
how you'd use "java -jar" to run a Java web app, except uvicorn is the server runtime.

"--reload" watches your files and auto-restarts when you make changes (dev only).
"""

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
from contextlib import asynccontextmanager

from app.audio.chord_detector import ChordDetector
from app.llm.anthropic_client import AnthropicChordClient
from app.websocket.handler import AudioWebSocketHandler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager — runs code on startup and shutdown.
    This is where we initialize connections to external services.
    """
    # STARTUP
    app.state.mongo = AsyncIOMotorClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    app.state.db = app.state.mongo.chordai  # "chordai" is the database name

    app.state.chord_detector = ChordDetector()
    app.state.llm_client = AnthropicChordClient(
        api_key=os.getenv("ANTHROPIC_API_KEY")
    )

    yield  # App runs here

    # SHUTDOWN
    app.state.mongo.close()


app = FastAPI(title="ChordAI", version="1.0.0", lifespan=lifespan)

# CORS middleware — allows your React frontend (running on localhost:5173)
# to make requests to this backend (running on localhost:8000).
# Without this, the browser blocks "cross-origin" requests for security.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint — one connection per user session.
    The session_id in the URL lets us track different users/sessions.
    """
    handler = AudioWebSocketHandler(
        chord_detector=app.state.chord_detector,
        llm_client=app.state.llm_client,
    )
    await handler.handle(websocket, session_id)


# REST endpoints for non-real-time operations
@app.get("/api/sessions/{session_id}/progressions")
async def get_saved_progressions(session_id: str):
    """Get all saved progressions for a session."""
    db = app.state.db
    progressions = await db.saved_progressions.find(
        {"session_id": session_id}
    ).to_list(100)
    return progressions


@app.post("/api/progressions/save")
async def save_progression(data: dict):
    """Save a progression to favorites."""
    db = app.state.db
    result = await db.saved_progressions.insert_one(data)
    return {"id": str(result.inserted_id)}


@app.get("/api/genres")
async def get_genres():
    """Return available genres and their descriptions."""
    from app.llm.anthropic_client import GENRE_CONTEXTS
    return {
        genre: {"description": ctx["description"]}
        for genre, ctx in GENRE_CONTEXTS.items()
    }
```

---

## Project Structure

```
chordai/
├── frontend/                     # React application
│   ├── public/
│   │   └── audio-processor.js    # AudioWorklet (must be in public/)
│   ├── src/
│   │   ├── audio/
│   │   │   ├── AudioCapture.ts       # Mic/interface input handling
│   │   │   ├── WebSocketClient.ts    # WebSocket communication
│   │   │   └── ProgressionPlayer.ts  # Tone.js playback
│   │   ├── components/
│   │   │   ├── AudioPanel.tsx         # Device selection + recording UI
│   │   │   ├── AudioVisualizer.tsx    # Waveform display
│   │   │   ├── ChatPanel.tsx          # Conversation with Claude
│   │   │   ├── ChordDisplay.tsx       # Shows detected chord
│   │   │   ├── ControlPanel.tsx       # Genre selection + generate button
│   │   │   ├── FretboardDiagram.tsx   # Interactive fretboard
│   │   │   ├── GenreSelector.tsx      # Genre grid
│   │   │   ├── ProgressionDisplay.tsx # Chord card row
│   │   │   └── TheoryExplanation.tsx  # Collapsible theory section
│   │   ├── store/
│   │   │   └── useAppStore.ts         # Zustand global state
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                      # FastAPI application
│   ├── app/
│   │   ├── audio/
│   │   │   └── chord_detector.py     # librosa chord detection
│   │   ├── llm/
│   │   │   └── anthropic_client.py   # Claude API integration
│   │   ├── models/
│   │   │   └── schemas.py            # Pydantic/MongoDB schemas
│   │   ├── websocket/
│   │   │   └── handler.py            # WebSocket message handling
│   │   └── main.py                   # FastAPI app entry point
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml            # Runs backend + MongoDB together
├── .env.example                  # Template for environment variables
├── README.md
└── Makefile                      # Common commands (make dev, make test, etc.)
```

---

## Development Phases

### Phase 1: Foundation (Week 1-2)
**Goal: Get audio in and chord out.**

- [ ] Set up project structure (frontend + backend repos)
- [ ] Initialize React app with Vite, Tailwind, TypeScript
- [ ] Initialize FastAPI backend with basic health check endpoint
- [ ] Set up MongoDB (local via Docker)
- [ ] Implement `AudioCapture` class — get audio from Focusrite in browser
- [ ] Build `AudioVisualizer` component — see the waveform to confirm audio is flowing
- [ ] Implement `ChordDetector` with librosa — test with audio files first
- [ ] Set up WebSocket connection between frontend and backend
- [ ] Wire it together: play chord → see detected chord in UI

**Milestone: Play a chord on your guitar, see "Am7 (87% confidence)" in the browser.**

### Phase 2: AI Integration (Week 3-4)
**Goal: Detected chords produce intelligent progressions.**

- [ ] Set up Anthropic API key and client
- [ ] Write and iterate on the system prompt (this is worth spending time on!)
- [ ] Implement `AnthropicChordClient` with structured JSON output
- [ ] Build the `GenreSelector` component
- [ ] Build the `ProgressionDisplay` component (chord cards)
- [ ] Wire: detect chord → select genre → generate → display progression
- [ ] Add `TheoryExplanation` collapsible component
- [ ] Test with various chords and genres, refine prompts

**Milestone: Play Am7, select "jazz", get a ii-V-I progression with theory explanation.**

### Phase 3: Conversation & Voicings (Week 5-6)
**Goal: Multi-turn refinement and visual fretboard.**

- [ ] Implement conversation history in `AnthropicChordClient`
- [ ] Build `ChatPanel` with message list and input
- [ ] Add `SuggestionChips` ("make it darker", "add a turnaround", etc.)
- [ ] Build `FretboardDiagram` component (interactive SVG or canvas)
- [ ] Display voicings on fretboard when clicking chord cards
- [ ] Store sessions and progressions in MongoDB
- [ ] Add "Save Progression" functionality

**Milestone: Generate a progression, say "make it darker", see refined results with fretboard voicings.**

### Phase 4: Audio Playback & Polish (Week 7-8)
**Goal: Hear the progressions and polish for portfolio.**

- [ ] Integrate Tone.js `ProgressionPlayer`
- [ ] Add playback controls (play, stop, tempo slider)
- [ ] Highlight current chord during playback
- [ ] Add `HistoryDrawer` for saved progressions
- [ ] Responsive design pass (mobile-friendly)
- [ ] Error handling and loading states throughout
- [ ] Deploy: Vercel (frontend) + Railway (backend) + MongoDB Atlas (database)
- [ ] Record demo video for portfolio / README

**Milestone: Full end-to-end flow working, deployed, and demo-ready.**

### Phase 5: Stretch Goals (Optional)
- [ ] MIDI export (download progressions as .mid files)
- [ ] Multiple chord detection (play a sequence, detect all chords)
- [ ] User accounts and auth (save progressions across sessions)
- [ ] Guitar sampler (use recorded guitar samples instead of synth for playback)
- [ ] Custom tuning support (drop D, open G, etc.)
- [ ] Rhythm/strumming pattern suggestions from Claude
- [ ] Real-time chord transcription mode (continuous listening)
- [ ] Mobile PWA support (use phone mic as input)

---

## Environment Setup Guide

### Prerequisites

What you need installed on your machine:

| Tool | What It Is | Why You Need It | Install |
|------|-----------|----------------|---------|
| **Node.js** (v18+) | JavaScript runtime for running code outside the browser | Runs your React dev server and build tools | `https://nodejs.org` |
| **npm** | Node Package Manager — comes with Node.js | Installs JavaScript libraries (like `pip` for Python) | Comes with Node.js |
| **Python** (3.11+) | You know this one | Runs the FastAPI backend | You already have this |
| **pip** | Python package manager | Installs Python libraries | Comes with Python |
| **Docker** | A tool that runs applications in isolated "containers" | Runs MongoDB without installing it directly on your machine | `https://docker.com` |
| **Docker Compose** | A tool for defining multi-container setups | Lets you start MongoDB + backend with one command | Comes with Docker Desktop |

### Step-by-Step Setup

```bash
# 1. Clone and enter the project
mkdir chordai && cd chordai

# 2. BACKEND SETUP
mkdir -p backend/app/{audio,llm,models,websocket}

# Create a Python virtual environment
# (keeps this project's packages separate from your system Python)
python -m venv venv

# Activate it:
# On Mac/Linux:
source venv/bin/activate
# On Windows (WSL):
source venv/bin/activate

# Install Python dependencies
pip install fastapi uvicorn[standard] anthropic motor librosa numpy pydantic python-dotenv websockets

# Save them to requirements.txt so others can install them too
pip freeze > backend/requirements.txt

# 3. FRONTEND SETUP
# npm create vite@latest is a command that scaffolds a new React project
# It creates the folder structure, config files, and basic code for you
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install                              # Install base dependencies
npm install zustand tone tailwindcss     # Install project-specific packages
npm install -D @types/node               # TypeScript type definitions

# Set up Tailwind CSS (a utility-first CSS framework you're familiar with)
npx tailwindcss init -p

cd ..

# 4. DOCKER SETUP (for MongoDB)
# Create docker-compose.yml (see below)
# Then start MongoDB:
docker compose up -d    # -d means "detached" (runs in background)

# 5. ENVIRONMENT VARIABLES
cp .env.example .env
# Edit .env and add your Anthropic API key
```

### Docker Compose File

```yaml
# docker-compose.yml
#
# Docker Compose lets you define and run multiple containers with one file.
# Here we define a MongoDB container. When you run `docker compose up`,
# Docker downloads the MongoDB image (if needed) and starts it.
#
# Think of a container as a tiny, isolated virtual machine that runs just
# one application. Your MongoDB runs inside this container, separate from
# your main operating system.

version: "3.8"

services:
  mongodb:
    image: mongo:7              # Use MongoDB version 7
    container_name: chordai-mongo
    ports:
      - "27017:27017"           # Map container port 27017 to your machine's port 27017
                                 # This means your Python code connects to localhost:27017
    volumes:
      - mongo-data:/data/db     # Persist data so it survives container restarts
    environment:
      MONGO_INITDB_DATABASE: chordai  # Create a database called "chordai" on first run

volumes:
  mongo-data:                   # Named volume — Docker manages the actual storage location
```

### Environment Variables

```bash
# .env.example
# Copy this to .env and fill in your values
# NEVER commit .env to git (add it to .gitignore)

ANTHROPIC_API_KEY=sk-ant-...    # Get from console.anthropic.com
MONGODB_URI=mongodb://localhost:27017
```

### Running the Project

```bash
# Terminal 1: Start MongoDB
docker compose up -d

# Terminal 2: Start the backend
cd backend
source ../venv/bin/activate     # Make sure virtual environment is active
uvicorn app.main:app --reload --port 8000
# Backend now running at http://localhost:8000
# API docs auto-generated at http://localhost:8000/docs

# Terminal 3: Start the frontend
cd frontend
npm run dev
# Frontend now running at http://localhost:5173

# To stop MongoDB:
docker compose down             # Stops containers but keeps data
docker compose down -v          # Stops AND deletes all data
```

---

## Key Technical Decisions & Tradeoffs

### Why librosa + Template Matching (Not a Neural Network)?

A deep learning model for chord recognition (like a CNN trained on spectrograms) would be more accurate, but:
- Requires a large labeled training dataset of guitar audio
- Much more complex to set up and debug
- Template matching works well for clean, single-chord guitar audio (which is our use case)
- You can always upgrade to a neural model later as a "Phase 5" improvement
- The AI story of this project is the LLM integration, not the chord detection

### Why WebSockets (Not REST)?

You could technically do this with REST (record audio → POST to `/api/analyze`), but WebSockets are better because:
- Lower latency (no HTTP overhead per request)
- Bidirectional (server can push results as they're ready)
- Natural fit for streaming audio data
- More impressive on a resume — shows you understand real-time architecture

### Why Anthropic/Claude (Not OpenAI)?

Either would work fine, but Claude has some advantages for this project:
- Excellent at following structured output formats (our JSON schema)
- Strong at creative/analytical tasks (music theory explanations)
- The `anthropic` Python library is clean and well-documented
- Differentiates your resume from the sea of "I used GPT" projects

### Why Not Real-Time Continuous Detection?

Continuous "always listening" chord detection would require:
- Onset detection (figuring out when a new chord starts)
- Running chord detection many times per second
- Handling transitions and silence
- Much more complex WebSocket protocol

The "tap to record" approach is simpler, more reliable, and still demo-able. You can always add continuous mode as a stretch goal.

---

## Estimated API Costs

Rough estimates for the Anthropic API:

| Action | Input Tokens | Output Tokens | Cost (Sonnet) |
|--------|-------------|---------------|---------------|
| Initial progression generation | ~800 | ~600 | ~$0.006 |
| Follow-up refinement | ~1200 | ~600 | ~$0.009 |
| 10-message session | ~3000 | ~2000 | ~$0.03 |

At these rates, heavy personal development/testing would cost maybe $5-10 total. Very affordable.

---

## Resume Integration Tips

Once built, update your resume's Projects section:

```
ChordAI — React, TypeScript, FastAPI, Anthropic API, librosa, MongoDB, WebSockets
Independent Project                                                     [Month Year] - Present
● Built AI chord progression generator that captures live guitar audio via Web Audio API,
  detects chords using chromagram analysis, and generates genre-aware progressions
  through Claude API with multi-turn conversational refinement
● Engineered real-time audio pipeline: browser AudioWorklet → WebSocket → librosa
  chromagram analysis, achieving [X]% chord detection accuracy on clean guitar input
● Designed structured LLM prompting system supporting 7 genres with music-theory-aware
  context injection, producing progressions with roman numeral analysis and voicing suggestions
● Implemented interactive fretboard visualization and Tone.js audio playback with
  synchronized chord highlighting across [X] voicing patterns
```

---

## Next Steps

1. **Set up the project structure** — Create the directories, initialize React + FastAPI
2. **Get audio flowing** — This is the first "hard" milestone. Once you can see a waveform from your Focusrite in the browser, everything else builds on top of it
3. **Test chord detection in isolation** — Record yourself playing chords, save as .wav files, run them through the ChordDetector in a Python script before worrying about WebSockets
4. **Iterate on the Claude system prompt** — The quality of your prompts directly determines the quality of the output. Spend time in the Anthropic console testing prompts before wiring them into the app