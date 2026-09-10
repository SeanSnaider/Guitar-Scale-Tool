# Guitar Learning Tool

A browser-based guitar practice app that listens to what you play. Strum a chord into
your mic and it names it, using FFT analysis in the browser with no backend inference and
no ML model.

https://guitar-scale-tool.onrender.com/
---

## Why I built it

I've been playing guitar for a few years and most practice tools are either static
reference charts or tab players. Neither knows whether you actually played the thing
correctly. I wanted the app to close the loop: you play, it hears you, it tells you what
came out.

The interesting part turned out to be that chord recognition doesn't require machine
learning. Twelve numbers and a dot product get you most of the way there.

## How chord detection works

The pipeline lives in `ChordDetector.ts` and runs entirely in the browser.

### 1. FFT to frequency bins

An `AnalyserNode` fed from the microphone gives a frequency-domain snapshot of the
incoming signal. Each bin `i` corresponds to frequency `i * (sampleRate / fftSize)` Hz and
holds a magnitude in dB.

Two filters run per bin:

- **Range gate**: anything below 60 Hz or above 5000 Hz is discarded. Guitar
  fundamentals start around 82 Hz on a standard-tuned low E, and useful harmonic content
  falls off well before 5 kHz. Everything outside that is room noise or hiss.
- **Noise floor**: bins below -80 dB are dropped before they can accumulate.

Surviving bins get converted from dB back to linear magnitude with `10^(dB/20)`.

### 2. Frequency bins to a chroma vector

This is the core reduction. A chord is defined by its **pitch classes**, not by which
octave each note lands in. A C major chord is C, E, and G whether you play it open or up
at the 8th fret. So the hundreds of frequency bins collapse into twelve buckets.

Each bin's frequency maps to a MIDI note number:

```
midi = 12 * log2(freq / 440) + 69
pitchClass = round(midi) mod 12
```

The bin's magnitude accumulates into that pitch class. The resulting 12-element vector
gets normalized so the loudest pitch class is 1.0. That's a **chroma vector**, and it
throws away octave and timbre while keeping the harmonic identity of what was played.

### 3. Time averaging

A single FFT frame is noisy. Pick attack, string bloom, and fret buzz all distort one
snapshot. So detection collects a frame every 100ms for 2.5 seconds, roughly 25 frames,
and averages them. This trades latency for stability, and for a practice tool where you
hold a chord anyway, that's the right trade.

### 4. Template matching by cosine similarity

Nine chord qualities are defined as binary 12-vectors with the root at index 0:

```
major      [1,0,0,0,1,0,0,1,0,0,0,0]   root, major 3rd, perfect 5th
minor      [1,0,0,1,0,0,0,1,0,0,0,0]   root, minor 3rd, perfect 5th
dominant7  [1,0,0,0,1,0,0,1,0,0,1,0]
...plus major7, minor7, diminished, augmented, sus2, sus4
```

Each is rotated through all 12 roots at startup, giving 108 templates total. The rotation
is just an index shift: for root `r`, position `p` takes `base[(p - r + 12) % 12]`.

Detection compares the measured chroma vector against all 108 templates by cosine
similarity and returns the highest scorer with its score as a confidence value. Cosine
similarity is the right metric here because it's magnitude-invariant: playing louder
shouldn't change which chord you played, and normalizing the dot product by both vectors'
magnitudes makes loudness drop out.

## Other features

Chord detection is the part I find most interesting, but it's one tab out of eight. The
rest of the app is a fretboard trainer.

**Interactive fretboard.** 48 scales across 10 categories — the modes, pentatonics, bebop
and jazz scales, plus exotic sets like hirajoshi, persian, and double harmonic. 12 tunings
(standard, drop D/C, DADGAD, four open tunings, half/whole step down, 7- and 8-string).
Notes render as dots, note names, intervals, or position patterns, with CAGED (5 positions)
and three-note-per-string (7 patterns) overlays.

**Practice mode.** Three exercise types — note identification, scale sequence, and interval
recognition — each at easy, medium, or hard difficulty, run against a metronome.

**Ear training.** A separate 10-question quiz flow with four modes: intervals, single
notes, scale identification, and fretboard sequence.

**Scale mastery tracking.** The backend owns the progression rule: a scale is marked
learned after 3 consecutive correct attempts at BPM ≥ 120. `is_learned` is sticky once
earned — a later miss resets your streak but doesn't take the badge back. XP, levels, and
achievement unlocks sit on top of that in the Zustand store, with a progress dashboard.

**ChordAI.** Detect a chord, pick a genre, and get a progression back from Claude. Before
the first request the app pulls your chord stats and scale mastery from the backend in
parallel and formats them into a practice-history block appended to the system prompt, so
suggestions are grounded in what you've actually been playing. The response carries a
fenced JSON block that gets parsed and rendered on the fretboard; follow-up turns keep the
conversation going.

**Practice Coach.** An Express sidecar streams a multi-turn agent over SSE (`thought`,
`chunk`, `answer` events), with music-theory lookup and research-paper search available as
tools mid-stream.

**Persistence.** FastAPI + SQLite behind 4 routers and 13 endpoints, storing practice
sessions, scale mastery, scale attempts, and chord detections. Scoped by a client-generated
`X-Session-ID` header — no accounts, no auth, local-first.

**Tests.** 318 Vitest cases on the frontend and 50 async pytest cases against an in-memory
SQLite database on the backend.

Audio synthesis is hand-rolled Web Audio (ADSR envelopes, no Tone.js), and the metronome
uses look-ahead scheduling so it doesn't drift at high BPM.

## Stack

Three services that run independently. The frontend talks to both backends; they never
talk to each other.

```
Browser (React SPA)
    │
    ├── REST, X-Session-ID header ──► FastAPI ──► SQLite
    │
    ├── HTTP + SSE ─────────────────► Agent server (Express) ──► Claude
    │
    └── direct fetch ───────────────► api.anthropic.com   (ChordAI, user's own key)
```

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript (strict), Zustand v5, Tailwind CSS v4, Vite 7 |
| Audio | Web Audio API — `AnalyserNode` FFT, custom ADSR synthesis, look-ahead metronome |
| Backend | FastAPI 0.115, SQLAlchemy 2.0 async, aiosqlite, Pydantic v2, uvicorn |
| Agent server | Express 5, Subconscious streaming SDK, Zod |
| LLM | Anthropic Messages API, called directly from the browser |
| Tests | Vitest + Testing Library (frontend), pytest-asyncio (backend) |
| Hosting | Render |

The ChordAI panel calls `api.anthropic.com` straight from the browser with
`anthropic-dangerous-direct-browser-access`. That's a deliberate trade for a local-first
tool with no accounts: you paste your own key, it lives in React state only, and it is
never persisted or sent anywhere else. Anything multi-user would need a server proxy
instead.

## Running it

The frontend runs on its own. Start the backend if you want progress to persist, and the
agent server if you want the Practice Coach tab.

```bash
git clone https://github.com/SeanSnaider/Guitar-Scale-Tool
cd Guitar-Scale-Tool
```

**Frontend** — http://localhost:5173

```bash
cd frontend
npm install
npm run dev
```

**Backend** — http://localhost:8000

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Tables are created on startup; there's no migration step.

**Agent server** — http://localhost:3001

```bash
cd agent-server
npm install
echo "SUBCONSCIOUS_API_KEY=your-key-here" > .env
npm run dev
```

Vite proxies `/api/agent` and `/api/tools` to this service, so the browser never hits it
directly.

### Environment

| Where | Variable | Default |
|---|---|---|
| `frontend` | `VITE_API_URL` | `http://localhost:8000` |
| `backend/.env` | `DATABASE_URL` | `sqlite+aiosqlite:///./guitar_learning.db` |
| `backend/.env` | `CORS_ORIGINS` | `http://localhost:5173` |
| `agent-server/.env` | `SUBCONSCIOUS_API_KEY` | none — required |
| `agent-server/.env` | `PORT` / `CORS_ORIGIN` / `TOOL_BASE_URL` | `3001` / `http://localhost:5173` / `http://localhost:3001` |

There is no `ANTHROPIC_API_KEY` variable. The Claude key for ChordAI is pasted into the UI
at runtime and held in memory only.

### Tests

```bash
cd frontend && npm test          # vitest run
cd backend && pytest             # pytest-asyncio, in-memory SQLite
```

Detection needs microphone permission. Works best with a direct audio interface, but a
decent built-in mic is usable. One gotcha: browsers only grant `getUserMedia` over HTTPS or
`localhost`, so opening the dev server at a LAN IP like `192.168.x.x` silently gives you no
microphone. Use `localhost`.

## Known limitations

These are real and I'd rather name them than have you find them.

**Harmonics inflate major chords.** A plucked string produces a fundamental plus
overtones. The 3rd harmonic sits a fifth above, the 5th harmonic a major third above. So
a single C note deposits energy into C, G, and E, which is indistinguishable from a C
major triad in chroma space. The detector has no harmonic suppression, so single notes
tend to read as major chords and minor chords can get pulled toward major. Harmonic
product spectrum or spectral whitening would help.

**Low notes are under-resolved.** Bin width is `sampleRate / fftSize`, a fixed number of
Hz. Semitone spacing is proportional to frequency. At 44.1 kHz with an 8192-point FFT,
bin width is about 5.4 Hz, while a semitone at the low E string's 82 Hz spans only about
4.9 Hz. Below roughly 90 Hz a single bin covers more than a semitone, so the bass end
smears. A constant-Q transform is the correct fix, since its bins are logarithmically
spaced to match pitch.

**No confidence threshold.** `detectChord` always returns its best guess, so silence
returns C major with confidence 0 rather than "nothing detected." Should reject below a
minimum score.

**Inversions and bass notes are invisible.** Chroma folding discards octave, which means
C/E and C are the same vector. Correct by design for chord identity, wrong if you want
slash chords.

**2.5 seconds is not instant.** The averaging window means this identifies held chords,
not chord changes as they happen.

## What I'd do differently

I'd have made "nothing detected" a real return value from the start.

`detectChord` walks 108 templates, keeps the highest cosine similarity, and returns it. It
has no way to say no. Point it at silence and it hands back C major with a confidence of 0,
which is not a low-confidence answer — it's a non-answer wearing an answer's shape. The
signature promised a chord, so the implementation had to invent one.

The fix is small: a minimum score, and a result type that can be empty. What makes it worth
naming is that it wasn't a bug I introduced later, it was a decision I made in the type
before writing a line of the algorithm, and every caller inherited it. The UI now shows a
confidence number partly because I needed somewhere to leak the uncertainty the return type
wouldn't carry. Next time I'd let the type admit failure first and make the happy path fit
around that, rather than the other way round.