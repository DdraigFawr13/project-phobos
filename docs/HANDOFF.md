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

1. Morgan answers [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH) (collection `review1`: 13 findings + round 2 questions P1, N1, N2, T1-T3, L1, M1, X1, W1, V1) and says "review done". Read answers and notes, then a final page if few questions remain.
2. After final approval: DECISIONS for each settled choice, then the phase 1 spec with `write-spec`.

Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS) (answered 2026-11-12, collection `round1`), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH).

## Open questions

- Round 2 (on the review page). Biggest: training method (none named in round 1), number spec (int16 sums overflow int32; JS shift floors, ST division truncates), v1 platforms (round 1 said phone only, but Node is needed).

## Decisions since the last plan update

- 2026-11-12 D-001 harness layers; D-002 concept settled; D-003 round 1 answers.
