# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: Sean, practicing guitar.** He's the main user, and it's a real daily practice tool. He plays with the guitar in his hands and looks at the screen between phrases or while holding a chord. Desktop and mobile get roughly equal use:
- a laptop on a desk, with a mic or a Focusrite Scarlett interface;
- a phone or tablet on a music stand.

**Secondary: reviewers.** Hiring managers and engineers who open the public Render link. They spend a few minutes on it, judging both the engineering and whether the product actually works. The app has to hold up on their first click, but their needs never outrank the practice use case.

## Product Purpose

Scale Teacher is a guitar practice app that listens to what you play. Most practice tools are static reference charts or tab players that can't tell whether you played the thing correctly. Scale Teacher closes that loop: you play into the mic, it hears you, and it tells you what came out.

Around that core it works as a fretboard trainer:
- scales and positions on an interactive fretboard;
- chord diagrams;
- ear training;
- a metronome;
- progress tracking.

Success means Sean reaches for it during real practice, and a reviewer comes away understanding the mechanism and trusting that it works.

## Positioning

Chord recognition runs entirely in the browser, with no ML model and no inference server. The pipeline:
1. An FFT turns the audio into frequency bins.
2. Range and noise gates drop bins outside 60 Hz to 5 kHz and below -80 dB.
3. The bins fold into a 12-bin chroma vector.
4. About 2.5 seconds of frames are averaged.
5. The result is matched by cosine similarity against 108 chord templates (9 qualities × 12 roots).

The mechanism is simple and explainable, and the app is honest about how it works. ChordAI builds on detection: it sends the detected chord and the player's practice history to Claude, which returns genre-aware progressions rendered on the fretboard.

## Operating Context

- The guitar is in hand, so attention is split. The screen gets read at arm's length in short glances. Input comes from a trackpad or keyboard between takes, or a tap on a phone propped on a stand.
- Audio comes in through the browser's microphone API, either a built-in mic or an audio interface (Focusrite Scarlett). Output is hand-written Web Audio synthesis (ADSR envelopes) plus a look-ahead metronome.
- The app is local-first, with no accounts. ChordAI calls `api.anthropic.com` directly from the browser using the user's own API key. The key is held in memory only and never persisted.
- It's deployed as a static frontend on Render: https://guitar-scale-tool.onrender.com/

## Capabilities and Constraints

**Current tabs:**
- **Fretboard:** 48 scales in 10 categories, 12 tunings including 7- and 8-string. Display modes are dots, note names, intervals and patterns, with CAGED and 3NPS position overlays. Tablature sits alongside.
- **Scales:** library browser.
- **Chords:** diatonic chord diagrams.
- **Ear Training:** 10-question sessions in four modes (intervals, notes, scales, sequence).
- **Reference:** scale info.
- **Progress:** XP, levels, streaks, scale mastery.
- **ChordAI:** chord detection plus Claude-generated progressions with conversational follow-ups.

**Persistence is being moved off the FastAPI + SQLite backend.** Treat the backend as legacy. Don't design new features around it, and don't put copy in the UI that tells users to start a server. Where persistence will end up (client-side or elsewhere) is **undecided**.

**Practice Coach** is an agent-driven coaching feature. It exists outside this branch and is expected to come back. It isn't currently in the app, so don't present it as a live feature until it returns.

**Terminology:**
- The product name is **Scale Teacher**. Use it everywhere: the nav wordmark, the document title and the docs. "Guitar Learning Tool" and "guitar-scale-tool" are stale names.
- Tab names: Fretboard, Scales, Chords, Ear Training, Reference, Progress, ChordAI.

**Tech constraints:** React 19, TypeScript strict, Zustand, Tailwind v4, Vite. Chord detection must stay in the browser.

## Brand Commitments

- Name: Scale Teacher.
- Explaining the mechanism plainly, rather than presenting it as magic, is part of the product's identity.

## Evidence on Hand

- A chord detection accuracy suite, with a GuitarSet benchmark and synthetic tests, in `frontend/src/test/chordDetectorAccuracy.test.ts`.
- The README explains the pipeline step by step, which reviewers can use as material.
- There are **no** testimonials, user counts, press or third-party reviews. Don't invent any. Accuracy figures may only be quoted from benchmark results that have actually been run.

## Product Principles

1. **Close the loop.** The app earns its place by hearing what was played and responding. Feedback beats static reference wherever there's a choice.
2. **Readable with a guitar in your hands.** Assume a glance at arm's length and one free hand. Key state and results must be legible and reachable on both a laptop and a phone on a stand.
3. **Show the mechanism.** Be honest about how detection works and how confident it is. Never imply ML or certainty the system doesn't have.
4. **Local-first, no accounts.** The user's data and API key stay with the user. Don't add flows that require sign-up or a server to get core value.
5. **Survives the first click.** Every tab works on the public link, with no developer-facing copy, dead ends or broken states, because a reviewer's first impression is part of the product.

## Accessibility & Inclusion

The target is WCAG 2.2 AA, as a hard requirement:
- every control works from the keyboard and shows a visible focus indicator;
- form controls have labels;
- right/wrong answers and detection results are announced to screen readers;
- text and non-text contrast meet AA;
- motion respects `prefers-reduced-motion`.

Audio-centric features (ear training, chord detection) still need visible and announced text results. Sound and color must never be the only channel.
