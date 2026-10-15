---
version: 1
slug: "frontend-src-components-layout-appshell-tsx"
primary_target: "frontend/src/components/layout/AppShell.tsx"
related_targets: []
---

# Scale Teacher app shell (all views)

Scope: the whole app UI (Practice, Ear Training, ChordAI, Library, Progress), replacing the Studio Walnut world.
Visitor mode: Operate.

Audience and job: Sean practicing with a guitar in hand, laptop on a desk or phone on a stand, glancing at arm's length. Primary loop: pick a scale, see it on the fretboard, hear it at tempo, play along; drill by ear; detect a chord and ask Claude for progressions. Secondary: browse the library, check progress.

Constraints: WCAG 2.2 AA (all harden work stays: keyboard grid, labels, live regions, focus), touch targets 44px on coarse pointers, works 320px to 1600px, Tailwind + shared primitives (src/ui), no inline style objects except computed geometry.

IA: left rail on desktop (Practice, Ear Training, ChordAI | Library, Progress); top bar on tablet; bottom tab bar on phones. One persistent transport bar (play scale, BPM, time signature, metronome, beat, sound settings) replaces the Controls shelf and the footer bar. Reference merges into the Practice side column. Library = Scales | Chords.

## Direction contract

THESIS: A practice tool in one neutral scale where orange means only two things: the root, and what is sounding now. Refuses the dark practice-app default (charcoal cards, glowing accent, colour-coded notes).

OWN-WORLD: Ground #FAFAFA, white panels with 1px #E6E6E6 hairlines, ink #111, muted #6B6B6B, sunken #F2F2F2 for segmented tracks. One accent, #F25C05, on roots, the playing note ring, the active tab column and the primary Play button, with ink text on it. Manrope at two weights, JetBrains Mono for tab, BPM and numbers. 7-10px radii, no shadows beyond a 1px ring.

STORY: Sean opens the app, the scale is already on the fretboard, he presses Play (or Space) and watches the orange ring walk the fretboard and the tab in time; he never hunts for tempo or the metronome because they live in one bar.

FIRST VIEWPORT: Desktop 1440x900: 208px rail left; control strip (Root, Scale, Tuning, Display segmented, Position system + chips) across the top of main; Fretboard panel (title, frets/position subtitle, Root/Scale note/Playing legend) as the hero; Tablature panel below; 300px scale column right (current scale, step pattern, formula cells, interval list, position tip); 64px transport bar at the foot of main with the orange Play scale button first.

FORM: Monochrome Proof (competitive challenger chosen over the assigned Mixtape J-card), catalog id digital-design-canon-monochrome-product-marketing; signature move: the playing ring, the only moving orange, synced between tab and fretboard. Seed key 6108c35a.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
