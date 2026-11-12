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

## Next

1. New session, new branch from `main`: build S1 per the spec (write-spec step 8). First run `ui-style` to write `docs/UI_STYLE.md`, then `ui-mockups` for the whole Lab layout (Live, Fixed test, Tables, Integer vs float, Net, Replay); Morgan approves before code. Run S1's checks to see them fail first.
2. After S1, publish `dist/lab.html` as an Artifact and record its URL here.

Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), [spec approval](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR).

## Open questions

- None.

## Decisions since the last plan update

- 2026-11-12 D-011 verdict rule (a); D-012 dev dependencies; D-013 spec additions.
- 2026-11-12 D-001 harness; D-002 concept; D-003 round 1; D-004 plan approved; D-005 platforms; D-006 number spec; D-007 accuracy; D-008 training; D-009 Lab pass mark; D-010 files and licence.
