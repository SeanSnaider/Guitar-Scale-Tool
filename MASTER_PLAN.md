# Guitar Learning Tool — Master Implementation Plan

> **Status**: Planning — awaiting Figma wireframes for UI sections marked `[WIREFRAME PLACEHOLDER]`
> **Last Updated**: 2026-04-03
> **Stack**: React + TypeScript + Vite + Tailwind + Zustand (frontend) | FastAPI + MongoDB + Motor (backend)

---

## Table of Contents

1. [Goals & Scope](#1-goals--scope)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Backend Architecture — FastAPI + MongoDB](#4-backend-architecture--fastapi--mongodb)
5. [Audio Revamp — Custom ADSR Synthesis](#5-audio-revamp--custom-adsr-synthesis)
6. [BPM Tablature Playback — Guitar Pro Style](#6-bpm-tablature-playback--guitar-pro-style)
7. [Focusrite Integration — Real-Time Scale Feedback](#7-focusrite-integration--real-time-scale-feedback)
8. [ChordAI Tab Integration](#8-chordai-tab-integration)
9. [Interactive Games](#9-interactive-games)
10. [UI Overhaul](#10-ui-overhaul)
11. [API Design](#11-api-design)
12. [Data Models — MongoDB](#12-data-models--mongodb)
13. [Implementation Phases](#13-implementation-phases)
14. [Open Questions / Wireframe Placeholders](#14-open-questions--wireframe-placeholders)

---

## 1. Goals & Scope

### Primary Goals

| Goal | Description |
|------|-------------|
| BPM Playback | Play scale notes through the tablature note-by-note with an animated playhead, like Guitar Pro |
| Audio Revamp | Fix octave calculation bugs, replace `setTimeout`-based scheduling with AudioContext look-ahead, improve guitar timbre |
| Backend | Add FastAPI + MongoDB backend to persist progress, custom scales, session history |
| ChordAI Tab | Integrate the existing ChordAI plan as a new tab: live chord detection via Focusrite + AI progression generation |
| Games | Interval training, fretboard memorization, and real-time scale correctness via Focusrite microphone input |
| UI Overhaul | Complete visual redesign — placeholder for Figma wireframes once ready |

### Out of Scope (This Plan)

- Supabase / PostgreSQL / Prisma (rejected in favour of MongoDB)
- User accounts / authentication (local-first for now)
- Mobile native app
- MIDI controller support (beyond Focusrite audio)

---

## 2. Tech Stack

### Frontend

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | React 19 + TypeScript | Existing stack, keep |
| Build | Vite 7 | Already in use |
| Styling | Tailwind CSS v4 | Already in use |
| State | Zustand v5 | Already in use |
| Audio | Web Audio API (custom, no Tone.js) | Lower latency, full ADSR control, no bundle bloat |
| Audio Scheduling | AudioContext look-ahead scheduler | Drift-free timing vs `setInterval` |
| WebSocket | Native browser WebSocket API | Real-time Focusrite audio + ChordAI |
| HTTP Client | `fetch` with typed wrappers | No extra dependency needed |

### Backend

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | FastAPI (Python 3.11+) | ChordAI's existing stack, async-native, great WebSocket support |
| Database | MongoDB (Atlas or local) | ChordAI's existing stack, flexible schema |
| ODM | Motor (async) | Non-blocking MongoDB driver for FastAPI |
| Validation | Pydantic v2 | FastAPI-native, strict models |
| Audio Analysis | librosa + numpy | Chord detection from Focusrite audio stream |
| AI | Anthropic Python SDK | ChordAI progression generation |
| WebSocket | FastAPI WebSocket | Real-time audio streaming |
| Auth | None for now (local session ID) | Deferred to future |

---

## 3. Project Structure

```
guitar-learning-tool/
├── frontend/                          # React app (current repo root moves here)
│   ├── src/
│   │   ├── api/                       # Typed fetch wrappers for all backend endpoints
│   │   │   ├── client.ts              # Base fetch client with error handling
│   │   │   ├── scales.ts
│   │   │   ├── progress.ts
│   │   │   ├── chordAI.ts
│   │   │   └── games.ts
│   │   ├── audio/
│   │   │   ├── AudioEngine.ts         # Revamped — look-ahead scheduler, proper octaves
│   │   │   ├── GuitarSynth.ts         # Guitar-specific synthesis (ADSR + harmonics)
│   │   │   ├── Metronome.ts           # Extracted, look-ahead scheduling
│   │   │   └── AudioInput.ts          # Focusrite/mic capture + WebSocket streaming
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx        # Top nav, tab bar, sidebar layout
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── StatsBar.tsx
│   │   │   ├── fretboard/
│   │   │   │   ├── Fretboard.tsx       # Existing (revamped)
│   │   │   │   └── FretboardNote.tsx   # Extracted note component
│   │   │   ├── tablature/
│   │   │   │   ├── Tablature.tsx       # Existing (revamped + BPM playhead)
│   │   │   │   └── Playhead.tsx        # New: animated cursor
│   │   │   ├── controls/
│   │   │   │   ├── Controls.tsx
│   │   │   │   ├── MetronomePanel.tsx
│   │   │   │   └── AudioControls.tsx
│   │   │   ├── chords/
│   │   │   │   └── ChordDiagrams.tsx
│   │   │   ├── practice/
│   │   │   │   └── PracticeMode.tsx
│   │   │   ├── games/
│   │   │   │   ├── GamesHub.tsx        # New: game selector
│   │   │   │   ├── IntervalTrainer.tsx # New
│   │   │   │   ├── FretboardQuiz.tsx   # New
│   │   │   │   ├── ScaleSpeller.tsx    # New
│   │   │   │   ├── EarTrainer.tsx      # New
│   │   │   │   └── LiveScaleChecker.tsx # New: Focusrite + WebSocket
│   │   │   └── chordAI/
│   │   │       ├── ChordAITab.tsx       # New: top-level tab
│   │   │       ├── AudioCapture.tsx     # Focusrite device selector + capture
│   │   │       ├── ChordDisplay.tsx     # Detected chord + confidence
│   │   │       ├── ProgressionPanel.tsx # AI-generated progression
│   │   │       └── ConversationPanel.tsx # Multi-turn chat with Claude
│   │   ├── data/
│   │   │   └── musicTheory.ts          # Existing (octave bug fixes applied here)
│   │   ├── hooks/
│   │   │   ├── useScalePlayback.ts     # New: BPM playback + playhead state
│   │   │   ├── useFocusrite.ts         # New: audio device enumeration + capture
│   │   │   └── useWebSocket.ts         # New: typed WebSocket hook
│   │   ├── store/
│   │   │   └── useGuitarStore.ts       # Existing (extended with new state)
│   │   └── types/
│   │       ├── api.ts                  # API response types
│   │       └── music.ts                # Shared music theory types
│   └── public/
│
└── backend/                            # FastAPI app (new)
    ├── app/
    │   ├── main.py                     # FastAPI app factory
    │   ├── config.py                   # Settings (pydantic-settings)
    │   ├── database.py                 # Motor MongoDB client
    │   ├── routers/
    │   │   ├── scales.py               # GET /scales, POST /custom-scales
    │   │   ├── progress.py             # GET/POST /progress
    │   │   ├── games.py                # GET/POST /games/sessions
    │   │   └── chord_ai.py             # POST /chord-ai/session, WS /chord-ai/stream
    │   ├── models/
    │   │   ├── scale.py                # Pydantic + MongoDB models
    │   │   ├── progress.py
    │   │   ├── game_session.py
    │   │   └── chord_ai.py
    │   ├── services/
    │   │   ├── chord_detection.py      # librosa chord analysis
    │   │   ├── anthropic_client.py     # Claude API integration
    │   │   └── music_theory.py         # Server-side theory helpers
    │   └── websockets/
    │       ├── audio_stream.py         # Focusrite audio WS handler
    │       └── chord_ai_stream.py      # ChordAI WS handler
    ├── requirements.txt
    └── .env.example
```

---

## 4. Backend Architecture — FastAPI + MongoDB

### Why Motor (async MongoDB)?

FastAPI is async-native. Motor is the official async MongoDB Python driver. Using it means:
- Non-blocking DB calls (no thread pool overhead)
- Works natively in `async def` route handlers
- Integrates with FastAPI's dependency injection for DB connections

### Database Connection Pattern

```python
# backend/app/database.py
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient | None = None

async def get_database():
    """Dependency injected into FastAPI route handlers."""
    return client[settings.mongodb_db_name]

async def connect_db():
    global client
    client = AsyncIOMotorClient(settings.mongodb_url)

async def disconnect_db():
    if client:
        client.close()
```

### Session Identity (No Auth)

Without user accounts, a session ID is generated on first load and stored in `localStorage`. All API calls include this as a header (`X-Session-ID`). Progress, game scores, and custom scales are all scoped to this ID.

This means:
- Progress is local to the browser (same as current Zustand `localStorage` persist)
- The backend gives you persistence across sessions on the same machine
- Easy to upgrade to real auth later (swap session ID for JWT)

### API Design Principles

- All responses follow: `{ success: boolean, data?: T, error?: string }`
- Pagination: `{ data: T[], meta: { total, page, limit } }`
- All IDs use MongoDB's `_id` (returned as string in JSON)
- CORS configured for `localhost:5173` (Vite dev) and production domain

---

## 5. Audio Revamp — Custom ADSR Synthesis

### Current Problems

1. **Octave bug** — `getNoteOctave(stringIndex, fret)` in `musicTheory.ts` is detached from the actual MIDI note calculation. The AudioEngine calls it separately from `getNoteFrequency`, and they can disagree.
2. **Drift** — `playScale()` uses `await sleep(beatDuration * 1000)` (setTimeout). This drifts by 10-20ms per note. Over 16 notes at 120 BPM it becomes noticeable.
3. **Metronome drift** — `setInterval` is used, same problem.
4. **Thin sound** — Two oscillators (triangle + sine) sound like a theremin, not a guitar.

### Fix 1 — Single Source of Truth for MIDI Notes

Replace the split `getNoteFrequency(note, octave)` + `getNoteOctave(string, fret)` pattern with a single function:

```typescript
/**
 * Convert string index + fret to MIDI note number.
 * Standard tuning open MIDI notes (low to high): E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
 */
function stringFretToMidi(stringIndex: number, fret: number, tuning: number[]): number {
  // tuning[] stores note indices (0=C, 1=C#, ..., 11=B)
  // We need MIDI note numbers for each open string
  const OPEN_STRING_MIDI_STANDARD = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
  // If custom tuning, calculate offset from standard
  const STANDARD_OPEN = [4, 9, 2, 7, 11, 4]; // E A D G B E note indices
  const semitoneOffset = tuning[stringIndex] - STANDARD_OPEN[stringIndex];
  return OPEN_STRING_MIDI_STANDARD[stringIndex] + semitoneOffset + fret;
}

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
```

This eliminates the octave inconsistency completely — one function, one formula.

### Fix 2 — Look-Ahead Scheduler (No More setTimeout Drift)

The Web Audio API has a high-precision clock (`audioContext.currentTime`). The correct pattern for drift-free playback is to schedule all notes in advance using this clock, then use `requestAnimationFrame` only for visual updates.

```typescript
// Schedule notes ahead of time using audioContext.currentTime
// Never use setTimeout/setInterval for audio timing

scheduleScalePlayback(notes: TabNote[], bpm: number, startTime: number) {
  const beatDuration = 60 / bpm;
  notes.forEach((note, i) => {
    const noteStartTime = startTime + i * beatDuration;
    this.scheduleNote(note.midi, noteStartTime, beatDuration * 0.85);
    // Store schedule for visual cursor sync
    this.scheduledBeats.push({ index: i, time: noteStartTime });
  });
}

// Visual cursor uses rAF + currentTime to find position
updatePlayhead() {
  const now = this.audioContext.currentTime;
  const currentBeat = this.scheduledBeats.findIndex(b => b.time > now) - 1;
  this.onPlayheadUpdate?.(currentBeat);
  requestAnimationFrame(() => this.updatePlayhead());
}
```

### Fix 3 — Guitar-Like Timbre

Guitar synthesis without samples. The approach: Karplus-Strong is ideal (physically models plucked string) but complex. A good approximation with Web Audio API:

```
Architecture per note:
  Sawtooth osc (fundamental)  ─┐
  Sawtooth osc (detuned +5¢)  ─┤── GainNode (mix) ── BiquadFilter (lowpass) ── ADSR GainNode ── output
  Sine osc (2nd harmonic)     ─┘

ADSR values for guitar pluck:
  Attack:  0.002s  (nearly instant — physical pluck)
  Decay:   0.08s   (fast decay from peak)
  Sustain: 0.25    (25% of peak — guitar sustains quieter)
  Release: 0.6s    (string rings out)

Lowpass filter:
  Frequency: 3000 Hz (softer strings are lower, brighter is higher)
  Q: 1.5
```

The detuned oscillator pair (+5 cents) creates the natural chorus/beating of a real string. The lowpass simulates the string's natural high-frequency rolloff.

### Fix 4 — Metronome Look-Ahead

Replace `setInterval` metronome with a look-ahead scheduler (standard Web Audio pattern):

```typescript
// Schedule 100ms ahead, check every 25ms
// This tolerates JavaScript timer imprecision while keeping low latency

private lookaheadMs = 100.0;    // How far ahead to schedule
private scheduleIntervalMs = 25.0; // How often to check

private schedulerLoop() {
  const lookaheadTime = this.audioContext.currentTime + this.lookaheadMs / 1000;
  while (this.nextBeatTime < lookaheadTime) {
    this.scheduleBeat(this.nextBeatTime);
    this.nextBeatTime += 60 / this.bpm;
  }
  this.timerID = setTimeout(() => this.schedulerLoop(), this.scheduleIntervalMs);
}
```

---

## 6. BPM Tablature Playback — Guitar Pro Style

### How It Works

1. User selects a scale → tablature renders all notes as columns
2. User sets BPM via the metronome slider
3. User clicks **Play** on the tablature
4. A **vertical playhead line** appears at column 0 and advances one column per beat
5. As the playhead passes each column, the note(s) in that column play
6. Notes that are currently "under" the playhead are highlighted differently (bright accent)
7. The tablature auto-scrolls horizontally if the scale has many notes

### Playhead Component

The `Playhead` component:
- Is absolutely positioned over the tab grid
- Its `left` CSS property is driven by `currentBeatIndex / totalBeats * 100%`
- `currentBeatIndex` is updated via `requestAnimationFrame` + `audioContext.currentTime`
- It does **not** use React state for position (too slow) — uses a `ref` and direct DOM style mutation

```tsx
// useScalePlayback.ts hook API
interface ScalePlayback {
  isPlaying: boolean;
  currentBeat: number;        // -1 when stopped
  totalBeats: number;
  play: () => void;
  stop: () => void;
  bpm: number;
  setBpm: (bpm: number) => void;
}
```

### Tab Layout Change

Current tablature renders notes as flex columns filling width. This needs to change to **fixed-width columns** so the playhead position maps cleanly to a pixel offset:

```
Each column = 40px wide
Column i starts at: i * 40px from left edge of tab container
Playhead left: currentBeat * 40px
```

### BPM Controls on Tablature

The tablature panel gets a compact transport bar:
```
[◀◀] [▶ Play / ■ Stop] [BPM: 80 ▼ ▲] [↑ Asc] [↑↓ Both] [↓ Desc]
```

This is **separate from** the sidebar metronome. The metronome continues to be for practice/rhythm. The tablature transport is specifically for scale playback.

**Question for wireframe**: Should the metronome click alongside the scale playback, or be independent?

---

## 7. Focusrite Integration — Real-Time Scale Feedback

### Architecture

```
Browser (mic input)
  └── MediaDevices.getUserMedia({ audio: { deviceId: focusriteDeviceId } })
  └── AudioWorkletProcessor (captures PCM float32 chunks)
  └── WebSocket → sends raw PCM data to backend

Backend (FastAPI WebSocket)
  └── Receives PCM chunks (16kHz, mono, float32)
  └── Accumulates buffer until ~2 seconds of audio
  └── Runs librosa chromagram analysis
  └── Returns detected note name + confidence
  └── Compares against expected note in sequence
  └── Sends back: { detected: "E", expected: "E", correct: true, position: 3 }

Browser (receives result)
  └── Highlights the current note GREEN (correct) or RED (wrong)
  └── Advances playhead to next expected note
  └── Shows accuracy score in real time
```

### Two Use Cases

#### Use Case A — Live Scale Checker (Games tab)

The user picks a scale, presses "Live Practice", and plays the notes on their guitar. Each note they play is evaluated against the next expected note in the scale. The fretboard shows:
- Green dot: correctly played note
- Red dot: wrong note
- Pulsing yellow dot: the **next expected** note

This is a **call-and-response** model — the backend waits for each note, validates it, then signals "next".

#### Use Case B — ChordAI Chord Detection (ChordAI tab)

The user plays a full chord. The backend analyses ~2-3 seconds of audio, identifies the chord (using chroma vector → template matching), and triggers Claude to suggest progressions. This is the existing ChordAI plan, largely unchanged.

### AudioWorklet vs ScriptProcessor

Use `AudioWorkletProcessor` (modern, runs off main thread) not `ScriptProcessorNode` (deprecated, runs on main thread and causes latency spikes).

```javascript
// frontend/src/audio/AudioInput.ts
// AudioWorklet captures 128-frame buffers at native sample rate
// Downsample to 16kHz (sufficient for note detection), convert to Float32Array
// Send via WebSocket as binary frames
```

### Device Selection

Show a device picker dropdown populated via `navigator.mediaDevices.enumerateDevices()`. Filter for `audioinput` devices. The Focusrite Scarlett will appear as "Scarlett 2i2 USB" or similar. Store the selected `deviceId` in the store.

---

## 8. ChordAI Tab Integration

> Source plan: `chordAI_plan.md` — full implementation details are captured here.

### Changes from Original ChordAI Plan

| Original Plan | This Integration |
|--------------|-----------------|
| MongoDB | MongoDB ✅ (same) |
| FastAPI WebSocket | FastAPI WebSocket ✅ (same) |
| librosa chord detection | librosa chord detection ✅ (same) |
| Separate app | New tab in this app |
| Anthropic API (Claude) | Anthropic API ✅ (same) |
| Focusrite Scarlett | Shared with Games tab (same `AudioInput.ts`) |

### Tab Layout (placeholder for Figma)

```
[WIREFRAME PLACEHOLDER — ChordAI Tab]

Left panel (30%):
  - Device selector (Focusrite dropdown, populated via enumerateDevices)
  - Record button (hold to capture ~2.5s of audio)
  - Detected chord display: "Am7 (87% confidence)"
  - Genre selector: jazz | blues | pop | rock | r&b | classical | folk
  - Generate Progression button

Center panel (40%):
  - AI-generated chord progression (chord names as clickable boxes)
  - Each chord box → shows fretboard diagram + voicing fingering
  - Roman numeral analysis + key label
  - Theory explanation section (collapsible)
  - Genre notes section (collapsible)
  - Playback button → uses BPM playback system from Phase 1

Right panel (30%):
  - Multi-turn conversation panel
  - User can type "make it darker" / "add a ii-V-I" / "use jazz voicings"
  - Chat bubble history (user + Claude turns)
  - Follow-up suggestions from Claude displayed as clickable chips
  - New Session / Clear History button
```

### WebSocket Protocol

```
Binary messages:  Float32Array audio chunks → backend accumulates in buffer
Text messages:    JSON commands

Client → Server:
  { type: "analyze" }                          → triggers chord detection on buffered audio
  { type: "generate", chord: "Am7",
    genre: "jazz", message: "..." }            → triggers Claude progression generation
  { type: "clear_session" }                    → resets conversation history

Server → Client:
  { type: "chord_detected", chord: "Am7",
    confidence: 0.87, notes: ["A","C","E","G"] }
  { type: "progression", data: { ...schema } }  → see Claude Response Schema below
  { type: "error", message: "..." }
```

### Claude Response Schema (Structured JSON)

Claude is instructed to respond with this exact JSON shape:

```json
{
  "progression": {
    "chords": ["Am7", "Dm9", "G13", "Cmaj7"],
    "roman_numerals": ["vi7", "ii9", "V13", "Imaj7"],
    "key": "C major",
    "time_signature": "4/4",
    "bars_per_chord": 1,
    "total_bars": 4
  },
  "theory_explanation": "This is a vi-ii-V-I turnaround in C major...",
  "genre_notes": "In jazz, extending the ii and V chords to 9ths and 13ths...",
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
    "Add a turnaround at the end"
  ]
}
```

`frets` array is 6 elements `[low E, A, D, G, B, high E]`, `null` = don't play that string.

### Supported Genres

| Genre | Key Theory Notes |
|-------|-----------------|
| jazz | ii-V-I, tritone subs, extended chords (9ths/11ths/13ths), voice leading |
| blues | 12-bar structure, dominant 7ths on every degree, turnarounds |
| pop | I-V-vi-IV and rotations, borrowed chords from parallel minor |
| rock | Power chords, Mixolydian bVII, pentatonic-based progressions |
| r&b | maj9/min11/dom13, chromatic passing chords, gospel-influenced |
| classical | Strict voice leading, functional harmony (T→PD→D→T), cadence types |
| folk | Open CAGED shapes, droning open strings, sus2/sus4/add9 for texture |

### Chord Detection Approach

Uses **librosa chromagram + cosine similarity template matching** (not monophonic pyin):

1. Compute `librosa.feature.chroma_cqt` — 12×N matrix (one row per pitch class)
2. Average across time → single 12-element chroma vector
3. Normalize to 0–1 range
4. Cosine similarity against pre-built templates for all 12 roots × 15 chord qualities (180 templates total)
5. Return best match + confidence score

Supported qualities: `major`, `minor`, `7`, `maj7`, `m7`, `dim`, `aug`, `sus2`, `sus4`, `m7b5`, `dim7`, `9`, `add9`, `6`, `m6`

### API Endpoints for ChordAI

```
POST   /api/chord-ai/sessions         # Create new session
GET    /api/chord-ai/sessions         # List sessions for this device
GET    /api/chord-ai/sessions/{id}    # Get session with full history + progressions
DELETE /api/chord-ai/sessions/{id}    # Delete session
POST   /api/chord-ai/sessions/{id}/save-progression  # Save a progression (favorites)
GET    /api/chord-ai/saved            # List saved/favorited progressions
WS     /ws/chord-ai/{session_id}      # Audio stream in + chord/progression out
```

---

## 9. Interactive Games

### Proposed Games List

> **Priority 1** (implement first — user confirmed):
> - Interval Trainer
> - Fretboard Memorization
> - Live Scale Checker (Focusrite)

> **Priority 2** (propose after P1 is done):
> - Scale Speller
> - Ear Trainer (identify scale by sound)
> - Rhythm Clicker

> **Priority 3** (future):
> - Chord Progression Ear Training
> - Sight Reading (tab notation)
> - Speed Run (fastest correct scale playback)

---

### Game 1 — Interval Trainer (Priority 1)

**Concept**: Two notes play in sequence. User identifies the interval.

**Modes**:
- `Listen`: Hear an interval, click the correct name from a grid (Perfect 4th, Major 3rd, etc.)
- `Ascending / Descending` toggle
- `Harmonic` toggle (both notes at once)

**Difficulty levels**:
- Beginner: only unison, octave, perfect 4th/5th
- Intermediate: all major/minor intervals
- Advanced: augmented/diminished, chromatic intervals

**Scoring**: Points per correct answer, streak multiplier, time pressure (optional timer).

**UI layout** `[WIREFRAME PLACEHOLDER — Interval Trainer]`

---

### Game 2 — Fretboard Memorization (Priority 1)

**Concept**: A dot appears on a random fret position. User names the note (or vice versa — a note name is shown and user clicks the correct fret).

**Modes**:
- `Find the note`: Note name shown → click correct fret position on fretboard
- `Name the note`: Fret position highlighted → type/click the note name
- `String focus`: Limit to one string at a time for focused practice

**Difficulty levels**:
- Open strings only
- Frets 1-5
- Frets 1-12 (natural notes only)
- Full fretboard (all 24 frets, sharps/flats included)

**Scoring**: Time-based (faster = more points), streak bonuses.

**UI layout** `[WIREFRAME PLACEHOLDER — Fretboard Quiz]`

---

### Game 3 — Live Scale Checker (Priority 1, requires Focusrite)

Described in Section 7. Summary:
- User plays through a scale on their guitar
- Backend validates each note via WebSocket audio analysis
- Visual feedback on fretboard (green/red/next-expected)
- End screen shows accuracy % and any notes that were wrong

---

### Game 4 — Scale Speller (Priority 2)

**Concept**: Given a root note and scale name, type out all the notes in order.

**Example**: "Spell the D Dorian mode" → user clicks D E F G A B C D

**UI**: Note buttons arranged as a piano keyboard or inline note selector.

---

### Game 5 — Ear Trainer (Priority 2)

**Concept**: A scale plays through the audio engine. User identifies which scale it is.

**Example**: Plays 7 notes → user selects "Natural Minor" from options.

Builds on the BPM playback system — same audio scheduling code, just triggered by the game.

---

### Game 6 — Rhythm Clicker (Priority 2)

**Concept**: A pattern of notes plays with the metronome. User taps the rhythm back on a single key.

Measures timing accuracy: how many ms off each tap was. Shows "Perfect", "Good", "Off" feedback.

---

### Games Hub Page

A grid of game cards. Each card shows:
- Game name and icon
- Short description
- Your high score / best streak
- `Play` button

`[WIREFRAME PLACEHOLDER — Games Hub]`

---

## 10. UI Overhaul

### Navigation Structure

Current: `Fretboard | Chords | Practice` tabs in the header.

New (proposed — pending wireframes):

```
Top navigation bar:
  [🎸 Fretboard] [📖 Theory] [🎮 Games] [🤖 ChordAI] [⚙️ Settings]

Within Fretboard tab:
  Left sidebar: Scale/Root picker, tuning, position system
  Center: Fretboard visualization
  Below fretboard: Tablature with transport controls (Play/BPM)
  Right sidebar: Metronome, audio controls

Within Theory tab:
  Chord diagrams, scale reference, interval charts

Within Games tab:
  Games hub → individual games

Within ChordAI tab:
  3-panel layout (described in section 8)

Within Settings tab:
  Audio device picker, theme, tuning, custom scales
```

`[WIREFRAME PLACEHOLDER — Full App Shell]`
`[WIREFRAME PLACEHOLDER — Fretboard Tab]`
`[WIREFRAME PLACEHOLDER — Theory Tab]`
`[WIREFRAME PLACEHOLDER — Settings Tab]`

### Design Principles (Before Wireframes)

- Dark mode as default (music production aesthetic)
- High contrast accents for interactive elements
- Fretboard takes up maximum horizontal space
- Tablature always visible below fretboard (not hidden behind a tab)
- Mobile: collapse sidebars into bottom drawer
- No emoji in nav (icons only — use Lucide React or similar)

### Typography & Color

`[WIREFRAME PLACEHOLDER — Design System]`

Suggestions to evaluate in Figma:
- Dark background: `#0f0f14` (near-black with slight blue tint)
- Surface: `#1a1a24`
- Accent: guitar-inspired amber/gold `#f59e0b` as primary
- Secondary: electric blue `#3b82f6`
- Scale root notes: amber
- Scale tone notes: muted blue

---

## 11. API Design

### Base URL: `http://localhost:8000/api`

### Scale Endpoints

```
GET  /scales                    # All built-in scales (from Python musicTheory)
GET  /scales/{key}              # Single scale info + intervals + degrees
POST /scales/custom             # Save a custom scale { name, intervals, degrees }
GET  /scales/custom             # List user's custom scales
DELETE /scales/custom/{id}      # Delete custom scale
```

### Progress Endpoints

```
GET  /progress                  # User's learned scales, stats, streaks
POST /progress/scale-learned    # Mark scale as learned { root, scale, position }
POST /progress/practice-session # Log a practice session { minutes, scales }
POST /progress/xp               # Award XP { amount, reason }
GET  /progress/achievements     # List unlocked achievements
```

### Games Endpoints

```
GET  /games/sessions             # List game sessions
POST /games/sessions             # Start a new game session { game_type, difficulty }
PATCH /games/sessions/{id}       # Update session (submit answer, end game)
GET  /games/leaderboard/{game}   # Personal best scores per game
```

### ChordAI Endpoints

```
POST /chord-ai/sessions          # Create ChordAI session
GET  /chord-ai/sessions          # List past sessions
GET  /chord-ai/sessions/{id}     # Get session with full conversation
WS   /ws/chord-ai/{session_id}   # Bidirectional: audio in, chord+AI out
WS   /ws/scale-check/{session_id}# Real-time scale note validation
```

### Response Envelope

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}
```

---

## 12. Data Models — MongoDB

### Collections

#### `sessions`
```json
{
  "_id": "ObjectId",
  "session_id": "uuid-string",   // localStorage key
  "created_at": "ISODate",
  "last_seen": "ISODate"
}
```

#### `progress`
```json
{
  "_id": "ObjectId",
  "session_id": "uuid-string",
  "learned_scales": ["C-major-1", "A-minor-2"],
  "stats": {
    "total_scales_learned": 12,
    "current_streak": 3,
    "longest_streak": 7,
    "total_practice_minutes": 240,
    "last_practice_date": "2026-04-03",
    "xp": 340,
    "level": 4,
    "achievements": ["first_scale", "week_streak"]
  },
  "custom_scales": [
    {
      "id": "custom_123",
      "name": "My Blues Scale",
      "intervals": [0, 3, 5, 6, 7, 10],
      "degrees": ["1", "b3", "4", "b5", "5", "b7"],
      "created_at": "ISODate"
    }
  ]
}
```

#### `game_sessions`
```json
{
  "_id": "ObjectId",
  "session_id": "uuid-string",
  "game_type": "interval_trainer",
  "difficulty": "intermediate",
  "started_at": "ISODate",
  "ended_at": "ISODate",
  "score": 85,
  "total_questions": 20,
  "correct_answers": 17,
  "answers": [
    { "question": "major_third", "user_answer": "major_third", "correct": true, "time_ms": 1200 }
  ]
}
```

#### `chord_ai_sessions`
```json
{
  "_id": "ObjectId",
  "session_id": "uuid-string",
  "created_at": "ISODate",
  "updated_at": "ISODate",
  "detected_chords": [
    { "chord": "Am7", "confidence": 0.87, "timestamp": "ISODate" }
  ],
  "genre": "jazz",
  "tempo": 120,
  "progressions": [
    {
      "chords": ["Am7", "Dm9", "G13", "Cmaj7"],
      "roman_numerals": ["vi7", "ii9", "V13", "Imaj7"],
      "key": "C major",
      "time_signature": "4/4",
      "bars_per_chord": 1,
      "total_bars": 4,
      "voicings": [
        {
          "chord": "Am7",
          "frets": [null, 0, 2, 0, 1, 0],
          "fingers": [null, null, 2, null, 1, null],
          "position": "open",
          "notes_low_to_high": ["A", "E", "A", "C", "E"]
        }
      ]
    }
  ],
  "messages": [
    { "role": "user", "content": "Generate a jazz progression from Am7" },
    { "role": "assistant", "content": "{ ...structured JSON response... }" }
  ]
}
```

#### `saved_progressions`
```json
{
  "_id": "ObjectId",
  "session_id": "uuid-string",
  "name": "Jazz Ballad in C",
  "genre": "jazz",
  "theory_explanation": "This is a vi-ii-V-I turnaround...",
  "progression": { "chords": [...], "roman_numerals": [...], "key": "C major", "voicings": [...] },
  "tags": ["jazz", "ballad", "ii-V-I"],
  "created_at": "ISODate"
}
```

---

## 13. Implementation Phases

### Phase 0 — Audio Revamp (Prerequisite for everything else)
**Why first**: The BPM playback, games, and scale checker all depend on reliable audio. Fix the foundation before building on top of it.

- [ ] Fix octave calculation: replace `getNoteOctave` with `stringFretToMidi` + `midiToFrequency`
- [ ] Extract `GuitarSynth.ts`: dual detuned sawtooth + lowpass + ADSR
- [ ] Rewrite look-ahead scheduler in `AudioEngine.ts`: no more `setTimeout` for timing
- [ ] Rewrite metronome: look-ahead scheduler, drift-free
- [ ] Extract `Metronome.ts` from `App.tsx`
- [ ] Test: all 6 strings, frets 0–24, correct frequencies (verify against tuner app)

### Phase 1 — BPM Tablature Playback
- [ ] Refactor tablature to fixed-width columns (40px per note)
- [ ] Build `useScalePlayback` hook: schedule all notes ahead via AudioContext
- [ ] Build `Playhead.tsx`: rAF-driven, ref-based DOM updates (no React re-renders)
- [ ] Add transport bar to tablature: Play, Stop, BPM input
- [ ] Wire playhead to highlight notes in tablature as they play
- [ ] Wire playhead to highlight notes on fretboard simultaneously

### Phase 2 — Backend Setup
- [ ] Create `backend/` directory, FastAPI app skeleton
- [ ] Motor MongoDB connection + health check endpoint
- [ ] Session ID middleware (reads/creates `X-Session-ID` header)
- [ ] Progress router: save/load learned scales, stats
- [ ] Custom scales router
- [ ] Frontend: create `src/api/client.ts` with typed fetch wrapper
- [ ] Migrate Zustand `persist` to sync with backend (keep localStorage as cache)

### Phase 3 — Games (Interval Trainer + Fretboard Memorization)
- [ ] Games Hub page with card grid
- [ ] Interval Trainer: UI + audio engine hooks + scoring + backend session persistence
- [ ] Fretboard Memorization: fretboard interaction mode + timer + scoring
- [ ] Backend: `game_sessions` collection + endpoints

### Phase 4 — Focusrite Integration + Live Scale Checker
- [ ] `AudioInput.ts`: AudioWorklet-based capture, device enumeration, WebSocket sender
- [ ] `useFocusrite.ts` hook: device picker, start/stop capture
- [ ] Backend WebSocket handler: receive PCM, librosa analysis, note detection
- [ ] `LiveScaleChecker.tsx` game: expected note sequence, real-time feedback
- [ ] Visual feedback on fretboard: green/red/next-expected highlighting

### Phase 5 — ChordAI Tab
- [ ] `backend/audio/chord_detector.py`: `ChordDetector` class — librosa `chroma_cqt` + cosine similarity against 180 chord templates (12 roots × 15 qualities)
- [ ] `backend/llm/anthropic_client.py`: `AnthropicChordClient` — system prompt, genre contexts (jazz/blues/pop/rock/r&b/classical/folk), structured JSON response schema, multi-turn conversation history per session
- [ ] `backend/websockets/chord_ai_stream.py`: `AudioWebSocketHandler` — binary audio buffering → `analyze` command → `generate` command → streams Claude response back
- [ ] `backend/routers/chord_ai.py`: REST endpoints (session CRUD + save progression)
- [ ] `backend/models/chord_ai.py`: Pydantic models — `Voicing`, `Progression`, `SessionDocument`, `SavedProgression`
- [ ] `src/hooks/useWebSocket.ts`: Generic typed WebSocket hook with auto-reconnect (shared with Phase 4)
- [ ] `src/components/chordAI/ChordAITab.tsx`: 3-panel layout shell
- [ ] `src/components/chordAI/AudioCapture.tsx`: Device selector + hold-to-record button + detected chord display
- [ ] `src/components/chordAI/ProgressionPanel.tsx`: Clickable chord boxes → fretboard voicing diagram, roman numerals, theory explanation (collapsible), genre notes (collapsible), playback button wired to Phase 1 BPM system
- [ ] `src/components/chordAI/ConversationPanel.tsx`: Chat bubbles, follow-up suggestion chips, new session button
- [ ] Add ChordAI tab to top navigation in `App.tsx`
- [ ] Session persistence in MongoDB (`chord_ai_sessions` + `saved_progressions` collections)

### Phase 6 — UI Overhaul (After Wireframes)
- [ ] `[BLOCKED: waiting for Figma wireframes]`
- [ ] Once wireframes arrive: implement new app shell, navigation, and component layouts
- [ ] Remaining games (Scale Speller, Ear Trainer, Rhythm Clicker)

---

## 14. Open Questions / Wireframe Placeholders

### Waiting for Figma

| Section | Placeholder ID | Notes |
|---------|----------------|-------|
| Full App Shell | `[WIREFRAME: app-shell]` | Top nav, sidebar layout, breakpoints |
| Fretboard Tab | `[WIREFRAME: fretboard-tab]` | Fretboard + tablature together |
| Theory Tab | `[WIREFRAME: theory-tab]` | Chord diagrams, scale reference |
| Games Hub | `[WIREFRAME: games-hub]` | Card grid |
| Interval Trainer | `[WIREFRAME: interval-trainer]` | Question layout, answer grid |
| Fretboard Quiz | `[WIREFRAME: fretboard-quiz]` | Fretboard interaction mode |
| ChordAI Tab | `[WIREFRAME: chord-ai]` | 3-panel layout |
| Settings Tab | `[WIREFRAME: settings]` | Device picker, audio, theme |
| Design System | `[WIREFRAME: design-system]` | Colors, typography, component library |

### Decisions Still Needed

1. **Metronome during scale playback**: Should the metronome click audibly while the scale plays, or is the BPM transport visual-only?
2. **Tab vs fretboard sync during playback**: When the playhead moves in the tab, should it also highlight the current note position on the full fretboard (not just the tablature)?
3. **Multi-octave scale playback**: Should the tablature player go through the full 3NPS pattern (which spans all 6 strings), or play a simple single-octave scale?
4. **Ear Trainer note source**: When no Focusrite is connected, fall back to generated audio for all ear training games?
5. **Games tab with Focusrite**: Show a "connect device" prompt if no audio interface is detected before entering the Live Scale Checker?
