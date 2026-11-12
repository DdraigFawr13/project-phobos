# UI style

<!-- Template from the `ui-style` skill. Fill each section from the taste board picks and the project's files; keep these prompt comments. Never write a value from memory (WS-06). -->

Look picked on the [Lab look taste board](https://claude.ai/artifact/8tCyT6ng1CGE4dkkCo9NCR), 2026-11-12: **A Control room** kept; B Strip chart, C Cyanotype and D Valve tag cut (D-014).

## Target devices
<!-- Devices and widths in px, and which width is first (mock-ups and checks start there). Write the minimums as `Minimum text: <n> px` and `Minimum tap: <n> px`; `ui-mockups` reads them for its lint. Take these from the project's docs; if none say, ask Morgan. -->

- Lab: Morgan's phone browser, as a published Artifact page (D-005). First and only width: **400 px** (the spec's browser screenshot width, `docs/specs/first-usable.md` J1 and Verification).
- Wider screens get the same single column, centred, at most 560 px wide.
- Minimum text: 13 px
- Minimum tap: 44 px
- Theme: follow the phone, light and dark (taste board answer `theme`).

## Idea
<!-- The look in two sentences, from the taste board picks. -->

A calm grey panel like a modern plant HMI: grey surfaces, dark ink, numbers in a monospaced face. Colour appears only for the measured level and when something is off normal (a disturbance, a forbidden action, a failed check), so anything coloured deserves a look.

## Tokens
<!-- Colours and spacing as named tokens, for light and dark. Screens use the names, never literal values. -->

Light values come from sample A's code on the taste board. Four were darkened to reach contrast (4.5:1 for text, 3:1 for lines): `--muted` (#5d6870 was 4.39:1 on `--bg`), `--alert` (#9a5a17 was 4.19:1), `--valve` (#8e989f was 2.57:1 on `--panel`). Dark values, `--net` and `--fixed` are new; the whole-Lab mock-up shows them for approval.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #dfe2e4 | #1b2024 | page |
| `--panel` | #eef0f1 | #242a2f | readouts, chart plot area, cards |
| `--ink` | #22292e | #e3e7ea | text, tank outline, setpoint line |
| `--muted` | #56616a | #9aa5ad | labels, axis text, help |
| `--line` | #c9ced2 | #343c42 | grid lines, readout borders |
| `--edge` | #b9c0c5 | #3f484f | panel borders |
| `--control` | #8e989f | #6c7780 | button and slider borders |
| `--level` | #2b5d8a | #7fb0dc | measured level line, focus ring |
| `--water` | #9fb6cc | #3d5f7f | tank fill |
| `--valve` | #7a858d | #808b93 | valve line, fixed-PI bars (retuned-PI bars use `--ink`) |
| `--net` | #6b4f8a | #b39ddb | net tank level, net bars (M3) |
| `--dist` | #e7c79f | #5a4630 | disturbance band behind the chart |
| `--alert` | #8a4f12 | #e0a35c | off-normal text: disturbance on, check failed |

Spacing: 4 px steps. Gaps 6, 8, 12 px; panel padding 12 px; page gutter 16 px (`max(16px, env(safe-area-inset-*))`).

## Type
<!-- Faces, sizes and number settings (tabular figures, units). Copy settings from the accepted specimen, not from memory (adventure-manager LESSONS:10). -->

Faces, from sample A (Google Fonts):
- `IBM Plex Sans` 400 and 600: body, buttons. Fallback `system-ui, sans-serif`.
- `IBM Plex Sans Condensed` 600: panel titles. Fallback `"IBM Plex Sans", sans-serif`.
- `IBM Plex Mono` 500: every number with a unit (readouts, axis ticks, table cells). Fallback `monospace`.

Sizes (the sample's 11 px labels and axis text are raised to the 13 px minimum):
- Panel title 18 px; readout value 20 px; body and buttons 15 px; labels, axis text and help 13 px.
- Readout labels: 13 px, uppercase, letter-spacing 0.08em, `--muted`.
- Numbers: `font-variant-numeric: tabular-nums`. Units after a space: `1.50 m`, `600 s`, `2.01 m·s`. Valve is unitless, 2 decimals. Levels 2 decimals, IAE 2 decimals (spec "Fixed test").

## Controls
<!-- Buttons, sheets, inputs: how each looks and how it answers a tap (done, waiting, or refused and why). -->

- **Button:** `--panel` fill, 1 px `--control` border, radius 3 px, 600 weight, at least 44 px tall. A toggle (Disturbance, Net) shows its on state with a `--ink` fill and `--panel` text, and a line under it in `--alert` or `--muted` saying what it did ("Disturbance on for 60 s: outflow × 1.2.").
- **Slider:** native range input, `accent-color: var(--level)`, 44 px tall, label above with the current value in Plex Mono.
- **Tabs:** a row of buttons at the top of Lab; the current one filled `--ink`. Tabs that need missing data (no `models/lab/`) are hidden, not disabled (spec "Lab").
- **Long work** (Run fixed test): the button reads "Running…" and is disabled until done, then the panel fills in place.
- Every tap answers on the same screen.

## Layout and sizes
<!-- Columns, gutters and spacing at each target width; what moves or hides at each width. -->

- One column at 400 px. Order: tabs, readouts (3 across), chart with the tank on its left, controls, status line.
- Chart: 200 px tall, full column width; tank 40 px wide at the left; time axis 0 to 600 s (the 600 s history, spec "Lab").
- Panels are separated by 12 px gaps, not cards on cards. Only readouts and the chart plot area get `--panel` fill.
- Above 560 px the column stops growing and centres.

## Avoid
<!-- The master Avoid list is linked below. Add this project's own items under Project, each tagged (lint) or (look) and ending with its source in brackets. -->
Master list: `../.claude/skills/ui-style/references/avoid.md` (the path from `docs/`; from another folder, make it relative to that folder).
### Project

- (look) Colour on anything that isn't the level, the net or an off-normal state; grey is the normal look [taste board pick A, 2026-11-12]
- (look) Numbers without units, or in the body face instead of Plex Mono [taste board sample A]

## Pitfalls
<!-- The master Pitfalls are linked below. A LESSONS `ui` entry at count 2 becomes a Project pitfall here, ending with its source in brackets (SRC-05). -->
Master list: `../.claude/skills/ui-style/references/avoid.md`.
### Project

- None yet.

## Where facts live
<!-- The files that hold the names, numbers and options screens show (content files, schemas, rules), plus docs/DECISIONS.md. Mock-ups take facts only from these. -->

- `docs/specs/first-usable.md`: plant, PI, slider range, segment names, panels, test hooks, number formats.
- `docs/DECISIONS.md`: D-005 platform, D-006 number spec, D-007 bounds, D-009 pass mark, D-011 verdict rule.
- From S1 on: `src/sim/plant.ts` and `src/sim/pi.ts` (the numbers the spec states, as code); later slices add `src/sim/fixed-test.ts` and `models/lab/*.json`.

## New-screen checklist
<!-- Run before calling a screen done. Add project items at the end. -->
1. Colours and faces come from Tokens and Type; no literal values.
2. Fits the first target width without sideways scroll; text and taps meet the minimums.
3. Every view state screenshotted (normal, empty, alert, loading).
4. New class names grepped against the CSS.
5. Every tap answers on the same screen (done, waiting, or refused and why).
6. Buttons, alerts and empty states worded on purpose; no Avoid-list copy.
7. The built screen screenshotted at the same width beside its approved mock-up; differences listed for Morgan.
8. Checked in light and dark (Playwright `colorScheme`).
