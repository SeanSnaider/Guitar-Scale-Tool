# Scale Teacher

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

Chord detection is the part I find most interesting, but it's one tab out of seven. The
rest of the app is a fretboard trainer.

**Interactive fretboard.** 48 scales across 10 categories — the modes, pentatonics, bebop
and jazz scales, plus exotic sets like hirajoshi, persian, and double harmonic. 12 tunings
(standard, drop D/C, DADGAD, four open tunings, half/whole step down, 7- and 8-string).
Notes render as dots, note names, intervals, or position patterns, with CAGED (5 positions)
and three-note-per-string (7 patterns) overlays.

**Ear training.** A separate 10-question quiz flow with four modes: intervals, single
notes, scale identification, and fretboard sequence.

**Scale mastery tracking.** A scale is marked learned after 3 clean runs in a row in
Sequence practice at 120 BPM or faster. Learned is sticky: a later miss resets the run
count but doesn't take the badge back. XP, levels, streaks and achievements sit on top of
that, with a progress dashboard.

**ChordAI.** Detect a chord, pick a genre, and get a progression back from Claude
(Sonnet 5.5). The response carries a fenced JSON block that gets parsed and rendered as
chord chips; follow-up turns keep the conversation going.

**Coach.** FretAgent ([SeanSnaider/FretAgent](https://github.com/SeanSnaider/FretAgent)),
rebuilt to run in the browser. Describe a goal and pick a level; a Claude (Sonnet 5.5) agent
researches it and streams back a 400-600 word practice plan. Its tools:

| Tool | Runs | What it does |
|---|---|---|
| `web_search` | Anthropic (server tool) | Tutorials, techniques, song references. Capped at 2 per plan |
| `web_fetch` | Anthropic (server tool) | Reads one page in full, capped at 8k tokens |
| `music_theory_lookup` | In the page | Answers from the app's own theory engine: all 48 scales, chords from stacked thirds, frets for your current tuning, CAGED windows |
| `research_paper_lookup` | In the page | Keyword search over 12 curated practice-science excerpts (`src/coach/papers.json`) |

The research steps (including Claude's summarised thinking) stream into a trace, the plan
renders as markdown with tab blocks, every scale it names gets a button that opens it on the
fretboard, and finished plans are saved in the browser. The agent loop is capped at 8 model
turns. The prompt is personalised from local progress: your tuning, learned scales, and most
detected chords.

**Persistence.** None on a server. Settings, progress, finished sessions, the chord log
and per-scale attempt counts all live in the browser (localStorage, via Zustand persist).
The logs are capped (100 sessions, 200 chords) so storage can't grow without bound.

**Tests.** Vitest + Testing Library.

Audio synthesis is hand-rolled Web Audio (ADSR envelopes, no Tone.js), and the metronome
uses look-ahead scheduling so it doesn't drift at high BPM.

## Stack

One static single-page app. There is no backend: the only network calls go from the
browser straight to Anthropic, using your own API key.

```
Browser (React SPA, progress in localStorage)
    │
    └── @anthropic-ai/sdk ──► api.anthropic.com   (ChordAI + Coach, your own key;
                                                   Coach also uses web search/fetch)
```

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript (strict), Zustand v5, Tailwind CSS v4, Vite 7 |
| Audio | Web Audio API — `AnalyserNode` FFT, custom ADSR synthesis, look-ahead metronome |
| LLM | Anthropic TypeScript SDK, called directly from the browser |
| Tests | Vitest + Testing Library |
| Hosting | Render (static) |

Calling Anthropic from the browser (`dangerouslyAllowBrowser: true` in the SDK) is a
deliberate trade for a single-user tool with no accounts. You paste your own key into the
app. By default it's held in memory until you reload; "Remember on this device" saves it in
localStorage instead. It's never put in the build: a `VITE_` env var would ship the key to
every visitor of a deployed copy. Anything multi-user would need a server proxy instead.

The key must be a Console API key (`sk-ant-api...`, from console.anthropic.com). A Claude
subscription token from `claude setup-token` is for Claude Code and won't work here.

## Running it

```bash
git clone https://github.com/SeanSnaider/Guitar-Scale-Tool
cd Guitar-Scale-Tool/frontend
npm install
npm run dev                      # http://localhost:5173
```

There are no environment variables. Paste your Anthropic API key into ChordAI (or the
Coach) the first time you use it.

### Tests

```bash
cd frontend && npm test          # vitest run
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