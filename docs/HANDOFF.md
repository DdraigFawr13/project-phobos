# Handoff

Updated: 2026-11-12. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

Planning. Concept is settled in `docs/CONCEPT.md`; the planning interview (`planning-interview` skill) decides the "Open for design" list before any code.

## Plan map

Shown at the start of a session and when asking the owner to approve a PR or a merge (WS-08). One line per step, marked done ✔, now ▶ or later ○.

- ✔ Brainstorm: `docs/CONCEPT.md`.
- ✔ Bootstrap AI-Master-Instructions (D-001).
- ▶ Planning interview: rounds, review, final approval.
- ○ Spec for phase 1 (core runtime) with `write-spec`.
- ○ Core runtime, Lab v0, trainer, Vulcan brain, exporters and recipes (CONCEPT build order).

## Just done

- 2026-11-12 Bootstrap: manifest, sync, starter files, CI with the drift check.

## Next

1. Morgan answers the [final page](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ) (collection `final`: Q1 Lab pass mark, Q2 how to watch training, `approval`) and says "final done".
2. On approval: DECISIONS for the round 2 and final answers (D-004 on), HANDOFF phase = phase 1, then the phase 1 spec with `write-spec` from its step 3.

Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH) (all 13 findings agreed; round 2 answered 2026-11-12, collection `review1`), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ).

## Open questions

- Q1: Morgan agreed with finding 6 (Lab pass mark "close to PID") but answered L1 "Net must beat the PID". Recommended: beat a fixed-gain PID across the whole setpoint range, with outflow through a fixed opening.
- Q2: Morgan wants to watch training (comment on finding 3). Recommended: Lab replays Node training runs; live phone training stays Later.

## Decisions since the last plan update

- 2026-11-12 D-001 harness layers; D-002 concept settled; D-003 round 1 answers.
