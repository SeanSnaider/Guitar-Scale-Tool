---
name: Scale Teacher
description: A light, monochrome guitar practice tool where orange means only the root, what is sounding now, and Play.
colors:
  ground: "#FAFAFA"
  surface: "#FFFFFF"
  sunken: "#F2F2F2"
  board: "#F4F4F4"
  line: "#E6E6E6"
  line-strong: "#D4D4D4"
  control: "#8F8F8F"
  string: "#A8A8A8"
  muted: "#6B6B6B"
  ink: "#111111"
  accent: "#F25C05"
  on-accent: "#111111"
  accent-ink: "#C2410C"
  accent-soft: "color-mix(in srgb, #F25C05 10%, transparent)"
  correct: "#15803D"
  correct-soft: "color-mix(in srgb, #15803D 10%, transparent)"
  incorrect: "#B91C1C"
  incorrect-soft: "color-mix(in srgb, #B91C1C 8%, transparent)"
typography:
  display:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  body-sm:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tnum"
rounded:
  segment: "5px"
  control: "7px"
  panel: "10px"
  pill: "9999px"
spacing:
  gutter: "24px"
  gutter-phone: "16px"
  panel-pad: "20px"
  rail: "208px"
  aside: "300px"
  transport: "64px"
  transport-phone: "56px"
  tabbar: "60px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.sunken}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
  segmented-track:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.control}"
    padding: "2px"
    height: "36px"
  segmented-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.segment}"
    padding: "0 10px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
  chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-pad}"
  note-root:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    size: "26px"
  note-scale:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    size: "24px"
  note-outside-root:
    backgroundColor: "{colors.board}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "26px"
  note-outside:
    backgroundColor: "{colors.board}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    size: "24px"
  nav-item-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
---

# Design System: Scale Teacher

## Overview

**Creative North Star: "Monochrome Proof"**

Scale Teacher is a practice tool read at arm's length with a guitar in hand. The whole interface is ink on a near-white ground, one neutral scale from #FAFAFA to #111, so that the single accent can carry meaning instead of decoration. Orange marks the root, marks what is sounding right now, and marks the one button that makes sound start. Everything else (selection, emphasis, the main action of a view) is done in ink.

Density is that of a working instrument panel: hairline-bordered white panels on a pale ground, compact 32 to 36px controls on fine pointers that grow to 44px on touch, numbers in a tabular mono face so tempo and frets never jitter. The fretboard is the hero surface; the tablature and the transport bar sit around it. The one authored motion moment is the playing ring walking the fretboard and the tab in time; every other transition is quick state feedback.

The world explicitly refuses the dark practice-app default: no charcoal cards, no glowing accents, no colour-coded notes or positions.

**Key Characteristics:**
- One neutral scale plus a single accent with exactly three meanings.
- Flat, hairline-bordered surfaces; no elevation shadows.
- Manrope for everything readable, JetBrains Mono for tab, BPM, formulas and counts.
- Hollow rings, never fades, for notes outside the selected position.
- One persistent transport bar owns all sound.

## Colors

A monochrome ink-on-paper scale with one hot orange that is rationed by meaning, not by area.

### Primary
- **Signal Orange** (accent): Fills root notes on the fretboard, chord diagrams, interval lists and formula cells; draws the playing ring; fills the transport's Play scale button. Text and icons on it are always On-Accent Ink, never white.
- **On-Accent Ink** (on-accent): The label colour on any orange fill (5.7:1).
- **Burnt Orange Text** (accent-ink): Orange used as text, such as root fret numbers in the tab and the word "orange" in legends (5.2:1 on white). Signal Orange is never used for text.
- **Orange Wash** (accent-soft): The 10% tint behind the tab column that is sounding now. Never used as a general highlight.

### Neutral
- **Ground** (ground): The page behind everything, and the translucent sticky headers.
- **Surface** (surface): Panels, the transport bar, the phone tab bar, the active segment, the active nav item.
- **Sunken** (sunken): Segmented-control tracks, hover fills for ghost and secondary buttons, info notices.
- **Board** (board): The fretboard wood, and the fill inside hollow outside-position rings.
- **Hairline** (line): Decorative 1px panel borders, nav dividers, list rules.
- **Strong Line** (line-strong): Fret wires, tab string lines, unpressed chip borders, the off state of a switch.
- **Control Grey** (control): Every interactive border (selects, text fields, secondary buttons, the sound popover) and the 1.5px ring on outside-position notes. It holds 3:1 against white; Hairline does not, so Hairline never bounds a control alone.
- **String Grey** (string): Guitar strings only.
- **Muted** (muted): Secondary text, labels, inactive nav, non-scale note labels (4.6:1 on sunken).
- **Ink** (ink): Primary text, scale notes, pressed chips, the ink button, switch on state, focus outline, outside-root rings.

### Semantic
- **Correct** (correct) / **Correct Wash** (correct-soft) and **Incorrect** (incorrect) / **Incorrect Wash** (incorrect-soft): Ear-training answers and success/error notices only, always paired with text and an icon.

### Named Rules
**The Three Meanings Rule.** Orange means the root, what is sounding now, or the transport's Play scale button. Nothing else is orange: not selection, not hover, not a view's main action, not a link, not a badge.

**The One Orange Ring Rule.** The playing ring is the only orange ring in the app. Any other ring (outside notes, highlighted intervals, focus) is ink or Control Grey.

**The One Orange Button Rule.** Play scale is the single orange button. A view's main action uses the ink button.

**The No Hex Rule.** Components use Tailwind utilities generated from the @theme tokens. No component hard-codes a hex value.

## Typography

**Display Font:** Manrope Variable (with Manrope, ui-sans-serif, system-ui)
**Body Font:** Manrope Variable
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace, SF Mono, Menlo)

**Character:** A tight, slightly geometric grotesque that goes very heavy and tightly tracked at display sizes, paired with a plain mono for anything that is a number a guitarist reads in time.

### Hierarchy
- **Display** (800, 32px phone / 40px from 768px, 1.05, -0.035em): The view heading, rendered only through PageTitle. One per view.
- **Headline** (800, 26px, 1.1, -0.03em): The current scale's name at the top of the Practice side column and ChordAI's detect heading.
- **Title** (700, 15px, -0.01em): Panel headings, the wordmark, the sound popover heading. A panel subtitle follows inline in 13px Muted at 500.
- **Body** (500, 14px, 1.5): Default text.
- **Body small** (500, 13px): Chips, segments, notices, descriptions, the transport's scale readout.
- **Label** (500, 12px, Muted): Field labels above selects, text fields and sliders. Sentence case, no tracking.
- **Mono** (12 to 13px, tabular figures): Tab fret numbers, BPM, time signatures, step patterns, semitone counts, slider readouts.

Large numeric readouts (the detected chord name, ear-training answers, progress stats) are local display moments sized to their view, not additional ramp steps.

### Named Rules
**The PageTitle Rule.** Every view's display heading comes from PageTitle; nothing else sets type at display size as a heading.

**The No Kicker Rule.** No eyebrow or kicker labels above headings, no small uppercase tracked labels. Labels are sentence-case 12px Muted text attached to the control they name.

**The Tabular Rule.** Any number that updates in place uses tabular figures.

## Layout

Desktop (from 1024px) is a three-zone grid: a 208px left rail, the main column (content capped at 1120px, 760px for narrow views, 24px gutters), and on Practice from 1280px a 300px side column for the current scale. A 64px transport bar is fixed to the foot of the main column on every view. From 768 to 1023px the rail becomes a 56px sticky top bar. Below 768px the app uses a 48px sticky header, a 60px bottom tab bar clear of the home indicator, a 56px transport bar above it, and 16px gutters; the layout holds down to 320px, where Play scale collapses to its icon.

Spacing inside panels is 20px, with headers at 16px top. Inside a panel, groups separate with spacing and dividers, never with another panel. Touch devices raise fretboard row height from 40 to 46px and minimum cell width from 30 to 42px, and expand note tap areas by 8px without changing their drawn size.

## Elevation & Depth

The system is flat. Depth is conveyed by tone (Ground behind Surface, Sunken tracks under white segments) and by 1px edges. The only box-shadows in the build are 1px rings: the active segment's 1px Hairline ring, and the highlighted-interval ring on a note (a 2px Board gap and an ink ring), used as rings so they never collide with the focus outline. The sound popover is lifted by a Control Grey border, not a shadow. Sticky headers use a 95% Ground fill with a light backdrop blur.

### Named Rules
**The Edge Not Shadow Rule.** Nothing casts a shadow. If a surface needs separation, give it a 1px border or a tonal step.

**The No Nesting Rule.** Panels never nest. A bordered sub-block inside a non-panel column (such as the position tip in the side column) is a plain rule-bordered section, not a Panel.

## Shapes

Corners are gently softened and come in a small fixed set: 7px on controls (buttons, fields, selects, segmented tracks, nav items, notices), 5px on the segments inside a track, 10px on panels and the popover, and full pills for chips, switches, beat dots and note markers. Borders are always 1px except on note rings (2px for the playing ring and outside roots, 1.5px for other outside notes). The brand mark is an ink tile with one white inlay dot, the single marker a guitarist reads on every neck.

## Components

### Buttons
Solid, compact and bold-labelled; disabled buttons keep their shape at 45% opacity so layout never shifts.
- **Shape:** gently rounded (7px).
- **Primary (accent):** Signal Orange with On-Accent Ink label. Reserved for the transport's Play scale button; hover drops brightness to 95%, active to 90%.
- **Ink:** Ink fill, white label, 85% ink on hover. The main action of any view (Start session, Listen).
- **Secondary:** White with a Control Grey border; Sunken on hover. The default.
- **Ghost:** No border, Muted label; Sunken fill and ink label on hover. Tertiary and icon-only actions.
- **Sizes:** sm 32px (13px), md 36px (14px), lg 44px (15px), xl 56px (17px) for a view's focal action. Icon-only buttons are square at the same heights; Lucide icons at 15 to 20px, stroke 2.
- **Focus:** a 2px ink outline offset 2px, everywhere.

### Chips
- **Style:** 32px pill, 1px Strong Line border, Muted 13px label on white; hover moves to a Control Grey border and ink text.
- **State:** pressed chips go solid ink with a bold white label (aria-pressed). Never orange.

### Segmented control
A Sunken track with a 1px Hairline border and 2px inset; the selected segment is a white 5px-radius tile with a 1px Hairline ring and bold ink text, the rest Muted. Each segment is a toggle button with aria-pressed inside a named group. Mono variant for position numbers.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** Surface on Ground.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Hairline.
- **Internal Padding:** 20px; header holds a 15px bold title, an inline Muted subtitle, and right-aligned actions or a legend.

### Inputs / Fields
- **Style:** 36px (32px small) white fields with a 1px Control Grey border and 7px radius; native select with a Muted chevron. A real 12px Muted label always sits above, visually hidden only when context names it.
- **Hover / Focus:** border goes ink on hover; focus is the global 2px ink outline.
- **Disabled:** 50% opacity. Switch: 30x18 pill, Strong Line off, ink on, label inside the hit area. Slider: native range in ink with a mono readout.

### Notices
Inline 7px-radius messages next to what they concern: info on Sunken with a Hairline border, success and error on their 8 to 10% washes with 30% tone borders and an icon. Errors use role="alert".

### Navigation
- **Desktop rail:** wordmark, then practice destinations, a Hairline divider, then reference destinations; 36px items with 16px icons. Active is a white tile with a Hairline border and bold ink label (aria-current="page"); inactive is Muted with a Sunken hover. Tuning readout pinned at the foot.
- **Tablet:** the same items as a sticky top bar without icons.
- **Phone:** a five-item bottom tab bar, 20px icon over an 11px label; active is bold ink with a 2px ink bar at the top edge.

### Transport bar
The one place for sound, fixed to the bottom of the work area on every view: Play scale (the orange button, Space shortcut) first, then the scale readout, a mono BPM stepper, time signature select, metronome switch, beat dots (sounding beat ink with a short tick, downbeat Control Grey, others Strong Line), and a ghost settings button that opens the sound popover above it (non-modal, focus moves in, Escape or outside click closes and returns focus).

### Fretboard notes (signature)
- **Root:** 26px Signal Orange disc, On-Accent Ink 800 label.
- **Scale note:** 24px ink disc, white 700 label.
- **Outside position:** hollow rings on Board, never faded fills. Outside roots get a 2px inset ink ring and a black 900 label; other outside notes a 1.5px inset Control Grey ring with a Muted label.
- **Non-scale notes:** bare Muted labels with no circle, off by default behind a switch.
- **Playing ring:** a 2px Signal Orange ring 5px outside the note that lands with a 220ms decelerating scale-in each time playback reaches it. Its tablature twin fills the sounding fret number in Signal Orange and washes its column in Orange Wash with a 2px orange top bar. Under reduced motion the ring appears without movement.
- **Highlighted interval:** an ink ring separated from the note by a 2px Board gap.

### Motion
Short state transitions at 100 to 150ms on colour and background. Entrances use fade-in or a 6px rise-in at about 160ms on cubic-bezier(0.16, 1, 0.3, 1). Under prefers-reduced-motion, spatial movement is removed (slides become fades, loops and scale pulses stop) while colour feedback stays.

## Do's and Don'ts

### Do:
- **Do** keep orange to its three meanings: root fills, the sounding-now marker (the playing ring and its tab twin), and the Play scale button, with On-Accent Ink on every orange fill.
- **Do** use Burnt Orange Text (#C2410C) whenever orange is text.
- **Do** use the ink button for a view's main action.
- **Do** draw notes outside the selected position as hollow rings: 2px ink with a black label for outside roots, 1.5px Control Grey (#8F8F8F) for the rest.
- **Do** bound every interactive control with Control Grey (#8F8F8F) or a fill, so its edge holds 3:1.
- **Do** give every control a 44px target on coarse pointers; dense fretboard and tab notes opt out only by supplying their own expanded hit area.
- **Do** use the kit's ARIA patterns: aria-pressed segments and chips in named groups, role="switch", real labels on every field, role="alert" for errors, aria-current for nav.
- **Do** build with Tailwind utilities on the @theme tokens; inline styles only for computed geometry (fret widths, progress bar widths, string thickness).
- **Do** set view headings with PageTitle.

### Don't:
- **Don't** add a second orange button, an orange ring other than the playing ring, or orange for selection, hover or links.
- **Don't** fade notes to show they are outside the position.
- **Don't** colour-code notes, positions or patterns.
- **Don't** use shadows beyond 1px edge rings; lift the popover with a border.
- **Don't** nest panels.
- **Don't** put eyebrow or kicker labels above headings, or use small uppercase tracked labels.
- **Don't** hard-code hex values in components.
- **Don't** let colour or sound be the only channel for a result; pair it with text.
