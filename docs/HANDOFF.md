# Handoff

Updated: 2026-11-12. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

Building the first usable version: [`docs/specs/first-usable.md`](specs/first-usable.md), approved 2026-11-12. Next slice: S1.

## Plan map

Shown at the start of a session and when asking the owner to approve a PR or a merge (WS-08). One line per step, marked done ✔, now ▶ or later ○.

- ✔ Brainstorm, bootstrap, planning interview, spec (PR #1, merged).
- ▶ S1 Lab v0: tank and PI live (M1). Starts with `ui-style` and a whole-Lab mock-up.
- ○ S2 gap per level (M1).
- ○ S3 numbers and tables, S4 dense, mask and float reference (M2).
- ○ S5 copy the PI, S6 evolution strategies, replay and verdict (M3).
- ○ Vulcan test bench, then Vulcan brain; Later list in D-004.

## Just done

- 2026-11-12 PR #1 merged: bootstrap, planning (D-003 to D-010), spec approved (D-011 to D-013).
- 2026-11-12 S1 on branch `ccr-e4e66c33-7nff0t`, draft PR #2. Taste board ([Lab look](https://claude.ai/artifact/8tCyT6ng1CGE4dkkCo9NCR)): Morgan kept A Control room, 13 px text, 44 px taps, light and dark. `docs/UI_STYLE.md` and D-014 written.
- 2026-11-12 Whole-Lab mock-up `mockups/lab.html`, published as [Lab mock-up](https://claude.ai/artifact/GNXTPDEiPJ1WgamL8ZwjtF) (published copy adds 3 screenshots). Fact check (37 facts), lint 0 warnings, one fresh check (12 findings, all fixed).

## Next

1. Morgan answers Approve / Change / Rethink on the Lab mock-up. On Approve: put its link in the spec's S1 section, then build S1 per the spec: write the checks first and see them fail (VER-10), then code; `npm run check` timed and its budget in AGENTS.md.
2. After S1, publish `dist/lab.html` as an Artifact and record its URL here.

Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), [spec approval](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR).

## Open questions

- Raise before S6 (found computing the mock-up, throwaway script from the spec): with Kp 1 and ±0.005 m noise, valve travel is about 10 to 11 per fixed-test segment for both PIs, mostly noise, so D-011's travel clause mostly measures noise amplification. Also the retuned PI is worse than the fixed one on `1.00→1.75` (11.79 against 9.74 m·s).

## Decisions since the last plan update

- 2026-11-12 D-014 Lab look: Control room.
- 2026-11-12 D-011 verdict rule (a); D-012 dev dependencies; D-013 spec additions.
- 2026-11-12 D-001 harness; D-002 concept; D-003 round 1; D-004 plan approved; D-005 platforms; D-006 number spec; D-007 accuracy; D-008 training; D-009 Lab pass mark; D-010 files and licence.
