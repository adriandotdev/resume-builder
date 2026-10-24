---
name: Resume Builder
description: A quiet putty desk where white sheets do the work, set in black ink with one proofing teal.
colors:
  ink: "#0a0a0a"
  desk: "#dedad3"
  paper: "#ffffff"
  tick: "#256f82"
  tick-hover: "#1f5f70"
  tick-soft: "#e3eef0"
  highlighter: "#f2d15c"
  red-pen: "#a8291f"
  red-pen-soft: "#fbe4e0"
  text-muted: "#56524c"
  surface-well: "#f4f2ee"
  surface-sunk: "#d3cec6"
  active-desk: "#cfc9c0"
  line: "#e4e0d9"
  line-strong: "#7d776d"
  paper-edge: "#c9c3b9"
  ats-ink: "#17212b"
typography:
  display:
    fontFamily: "Young Serif, Georgia, Times New Roman, serif"
    fontSize: "clamp(2.75rem, 1.5rem + 4.4vw, 5.5rem)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Young Serif, Georgia, Times New Roman, serif"
    fontSize: "clamp(2rem, 1.4rem + 2vw, 3.25rem)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Young Serif, Georgia, Times New Roman, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.2
  base:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  hint:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  rule: "1px"
  paper: "2px"
  item: "8px"
  control: "10px"
  inset: "12px"
  panel: "16px"
  sheet: "16px"
  pill: "999px"
spacing:
  gutter: "12px"
  header: "56px"
  tap: "44px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    height: "44px"
  button-accent:
    backgroundColor: "{colors.tick}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    height: "44px"
  button-accent-hover:
    backgroundColor: "{colors.tick-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    height: "44px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
    height: "44px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
  badge:
    backgroundColor: "{colors.tick-soft}"
    textColor: "{colors.tick}"
    rounded: "{rounded.pill}"
    height: "24px"
  badge-pen:
    backgroundColor: "{colors.red-pen-soft}"
    textColor: "{colors.red-pen}"
---

# Design System: Resume Builder

## Overview

**Creative North Star: "The Clean Desk"**

A putty-colored desk with white sheets of paper laid on it. The app is the desk: calm, neutral, and out of the way. The sheets carry the work, and the resume itself is the loudest thing on screen. Everything is set in serif type with black ink, and a single teal marks the one action or the one selected thing. The feel is a well-kept stationery table, not a software dashboard.

The system is flat and tonal. Surfaces are told apart by a step in tone or a 1px edge, never by shadow at rest. Controls are full pills, sheets are softly rounded, and the resume paper keeps a nearly square 2px corner so it reads as real paper. The resume itself is not themed; it sets its own colors and fonts and must never inherit app tokens. Two small marks tell the story of the product: the highlighter yellow, which shows what an ATS parser reads, and the red pen, which appears only where something needs fixing.

**Key Characteristics:**
- Putty ground, white sheets, black ink; one teal for the action.
- Flat at rest; only floating things (menus, dialogs, drawers, toasts) cast a shadow.
- Serif voice throughout: Young Serif for display, Source Serif 4 for text.
- Pill controls, 44px minimum targets, 16px sheets.
- The resume paper is untouched by app styling.

## Colors

A restrained neutral palette with one cool accent and two functional marks. Dark mode is opt-in through `data-theme="dark"` and inverts the desk to near-black while keeping the same roles.

### Primary
- **Proofing Teal** (`tick`, #256f82): the one action and the selected mark. Filled accent buttons, the drop line when reordering, the selected template ring, and the CTA panel on the landing page. Hover steps to Deep Teal (`tick-hover`, #1f5f70). Teal Wash (`tick-soft`, #e3eef0) is the quiet tint behind badges and selected template wells. In dark mode link and badge text lifts to #7fc6d6.

### Secondary
- **Highlighter Yellow** (`highlighter`, #f2d15c): marks what an ATS extracts. Used for text selection and the "ATS view" sweep across the sample resume. Never a button or a status color.

### Tertiary
- **Red Pen** (`red-pen`, #a8291f): only for what needs fixing: destructive actions, ATS warnings, errors. Pen Wash (`red-pen-soft`, #fbe4e0) is its tinted badge background.

### Neutral
- **Putty Desk** (`desk`, #dedad3): the page ground, the header, and the app frame. Dark mode: #111111.
- **Bleached Sheet** (`paper`, #ffffff): every sheet, panel, dialog and the resume itself. Dark mode surface: #1a1a1a.
- **Press Black** (`ink`, #0a0a0a): text, primary buttons, the selected segment. Dark mode flips to #efeeec.
- **Faded Graphite** (`text-muted`, #56524c): secondary text and captions.
- **Inset Well** (`surface-well`, #f4f2ee): a recessed area inside a sheet, such as segmented-control tracks and the preview pane.
- **Sunk Desk** (`surface-sunk`, #d3cec6): one step below the desk, used behind the landing stage.
- **Worn Desk** (`active-desk`, #cfc9c0): hover and selected state for items sitting on the desk.
- **Paper Fold** (`line`, #e4e0d9): card and sheet edges.
- **Control Edge** (`line-strong`, #7d776d): borders on interactive controls, kept at 3:1 on paper.
- **Paper Edge** (`paper-edge`, #c9c3b9): the 1px outline that makes a resume page read as paper on the desk.
- **Plain-Text Ink** (`ats-ink`, #17212b): text in the editor's ATS text preview, which is a white paper surface in both themes, so it does not follow the app ink.

### Named Rules
**The One Teal Rule.** Teal marks the single action or the single selected item in a region. It is never used for decoration, headings or large backgrounds, with one exception: the landing page's final call-to-action panel.

**The Marks Stay Meaningful Rule.** Highlighter means "a parser reads this"; red pen means "fix this". Neither is borrowed for emphasis.

**The Untouched Paper Rule.** App tokens never reach the resume. `.resume` owns its own colors and fonts, and the app's stylesheet declares no element selectors (h1, p, li, a) so the resume DOM and its PDF text layer stay unchanged.

## Typography

**Display Font:** Young Serif (with Georgia, Times New Roman, serif)
**Body Font:** Source Serif 4 (with Georgia, Times New Roman, serif), optical size axis on
**Label/Mono Font:** none; labels use the body serif at weight 500

**Character:** A warm, slightly heavy display serif over a quiet text serif. The pairing reads as printed matter, which suits a product whose output is a printed page. Both fonts are self-hosted at build time; nothing contacts a font service.

### Hierarchy
- **Display** (400, clamp(2.75rem, 1.5rem + 4.4vw, 5.5rem), 0.98): the landing hero, the showcase halves and the final call to action. Tracking −0.02em. Scales up at 1600px+ to 6–8.5rem.
- **Headline** (400, clamp(2rem, 1.4rem + 2vw, 3.25rem), 0.98): landing section headings ("how it works", questions).
- **Title** (400, 1.5rem rising to 2rem at 640px, 1.1): app screen titles, wordmark (1.25–1.375rem), start-card title.
- **Body** (400, clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem), 1.6): landing reading text. App UI body is 1rem; hints are 0.875rem at 1.45.
- **Label** (500, 0.9375rem, 1.2): buttons, navigation, segmented options. Field labels are 0.875rem at 600. Two small steps sit below Label: **Hint** (0.875rem, 1.45) for field hints and secondary lines, and **Caption** (0.8125rem, 500) for badges, bottom-bar and rail-tab labels.

### Named Rules
**The Five Steps Rule.** The landing page uses five type steps only: small, body, lead, head, display. New sizes are not invented per section.

**The Measure Rule.** Reading text is held to about 62ch (`.measure`) and balanced or pretty-wrapped. Numbers in counters and tables use tabular lining figures.

## Layout

The app is a desk with sheets inset by a 12px gutter. Screens put their work on one framed white sheet (`app-sheet`, padding 24/16 on phones, 28 on tablets and up). The sticky 56px header sits on the desk with no rule and no blur.

The landing page is a split stage: a reading sheet on one side and the sample resume on a sunk-putty field on the other. Below 1024px the stage stacks on top at 50svh with the reading sheet overlapping it by 24px; at 1024px it becomes two equal columns with a sticky stage. Following sections use large, deliberate vertical gaps (120px on phones, 200px on desktop, 140px on large screens) and a 12-column grid from 900px for the questions and call-to-action blocks.

The editor changes shape by width. Phones: a full-screen preview sheet and a bottom bar. 768–1023px: tools in a left drawer (max 440px) with a scrim. 1024px+: a two-column grid, tools (clamp(420px, 38vw, 560px)) beside a sticky preview, both as sheets. The template gallery is a grid of 1, 2, 3 and 4 columns at 0, 560, 1024 and 1280px.

At 1600px+ the whole landing scale steps up (type, padding, form widths) so a 1920×1080 screen is filled rather than floating small.

## Elevation & Depth

Flat and tonal. Depth is a step in tone (desk → sheet → well) or a 1px edge, never a shadow at rest. Only things that float above the page cast a shadow, and they share one value.

### Shadow Vocabulary
- **Pop** (`box-shadow: 0 4px 10px rgb(10 10 10 / 0.08), 0 18px 40px -12px rgb(10 10 10 / 0.3)`): menus, dialogs, toasts, the tablet tools drawer, and a section card while it is being dragged. Heavier in dark mode.

### Named Rules
**The Flat-At-Rest Rule.** Nothing casts a shadow until it floats. Template thumbnails lift 3px on hover with a transform, not a shadow. Resume pages sit on the desk with a 1px paper-edge outline.

## Shapes

Soft sheets, round controls, almost-square paper.
- **Pill** (999px): every button, segmented control, switch, badge, toast and nav link. 
- **Control** (10px): text fields, selects, textareas, template pickers.
- **Sheet / Panel** (16px): the app frame, panels, dialogs, the landing stage, and showcase and call-to-action blocks. The landing page uses this one radius for every sheet on the desk.
- **Inset** (12px): wells, section cards, the template well, bottom-bar buttons.
- **Item** (8px): menu items inside a menu.
- **Rule** (1px): the underline marks on tabs and chips.
- Control (10px) also covers rail tiles and the color field.
- **Paper** (2px): resume pages and thumbnails, so they read as paper rather than as UI cards.

## Components

### Buttons
- **Shape:** full pill (999px), 44px minimum height and width, 1.1rem horizontal padding; large variant 52px.
- **Primary:** Press Black fill, white text. Hover drops opacity to 0.86 rather than changing hue.
- **Accent:** Proofing Teal fill, white text; hover steps to Deep Teal. Used for the one action in a region.
- **Secondary (default):** white fill with a Control Edge border; hover fills with Inset Well.
- **Quiet / Danger:** quiet is borderless with an Inset Well hover; danger is Red Pen text and border.
- **Press:** scales to 0.97 on active. Disabled drops to 50% opacity.

### Segmented controls and switches
- Radio-style groups (template picker, accent swatches) are one tab stop each: arrow keys, Home and End move focus and select, wrapping at the ends. The selected swatch adds a surface-colored center dot so the choice is not shown by the ring alone.
- A tray of Inset Well holding pill options; the selected option fills Press Black with white text. Native radios are stretched over the label so the whole pill is the target.
- Switches are a 34×20 track with a 13px thumb; on state fills Press Black. Both keep 44px hit areas.

### Inputs / Fields
- **Style:** 1px Control Edge border, white fill, 10px radius, 44px minimum height, 1rem text. Labels sit above at 0.875rem/600; hints below in Faded Graphite.
- **Focus:** a 2px ink outline, flush to the border (offset 0). Selects use a custom chevron and 2.5rem right padding.
- **Error:** Red Pen text and wash; always paired with words, never color alone.
- **Autofill:** contact fields declare their purpose (name, job title, email, phone); free-text fields keep autofill off.
- **Storage warning:** the blocked-storage notice is Red Pen text with an icon, announced as an alert.

### Panels and section cards
- White fill, 1px Paper Fold edge, 16px radius (panel) or 12px (section card). Hover on a section card darkens the edge to Control Edge; dragging adds the Pop shadow and an ink edge.

### Tabs and chips
- Chips are text with a 2px underline when pressed, on a Paper Fold baseline. Rail tabs in the editor are 10px-radius tiles with an Inset Well selected state and a 2px ink underline (a vertical bar on desktop).

### Navigation
- Header on the desk: wordmark in Young Serif, pill nav links with a Worn Desk hover and a 2px ink underline for the current page. On phones the editor uses a four-button bottom bar on the desk; the active button fills ink.

### Template thumbnail (signature)
- A resume page at 2px radius with a Paper Edge outline, sitting inside an Inset Well. On hover the paper rises 3px; the selected template's well turns Teal Wash and the picker gains a 2px teal inset ring. The thumbnail renders live from sample data.

### ATS lens (signature)
- A flat highlighter sweep that draws across each line of the sample resume, left to right, to show what a parser reads. It shows on the landing page only, scoped to a wrapper so the resume DOM is untouched.

### Toasts and dialogs
- Toasts are Press Black pills at the bottom left. Dialogs are native `<dialog>` elements, 560px wide (up to 1000px for wide ones), 16px radius, Pop shadow, ink-tinted scrim. Both settle in with an 8px rise.

## Do's and Don'ts

### Do:
- **Do** keep the desk neutral and let the white sheet carry the content; put the work on a sheet, not on the desk.
- **Do** use Proofing Teal for the single action or selected item in a region, and Press Black for the rest of the controls.
- **Do** keep every interactive target at least 44px and every control border at 3:1 contrast (Control Edge #7d776d).
- **Do** separate surfaces by tone or a 1px edge; reserve the Pop shadow for what floats.
- **Do** use the shared easings: `--ease-out` for feedback, `--ease-settle` for paper arriving, `--ease-pen` for the highlighter sweep. Honor `prefers-reduced-motion`.
- **Do** run `scripts/contrast.mjs` after any token change; light and dark must both pass WCAG 2.2 AA.

### Don't:
- **Don't** theme the resume paper or add element selectors (h1, p, li, a) to the app stylesheet; the resume DOM and its PDF text layer must not change.
- **Don't** use highlighter yellow or red pen as decoration or emphasis; they carry meaning.
- **Don't** add shadows at rest, gradient fills, glass blur, or drop shadows on cards. The only gradient is the one-color image used to draw the highlighter sweep.
- **Don't** add icons, tables, images, `position: relative` on text blocks, or wide letter-spacing inside the resume body; they scramble the PDF text layer.
- **Don't** add a sans-serif UI face or a third typeface; the serif voice is the product's tone.
- **Don't** introduce testimonials, logos, user counts or badges that imply guaranteed ATS results.
