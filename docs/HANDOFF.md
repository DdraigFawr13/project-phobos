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

1. Morgan fills [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS) (collection `round1`) and says "round 1 done"; read answers and notes, then the review round.
2. The repo has no `main`: only `ccr-29e6caaf-hdhv3m` (concept commit). PR waits on Morgan's choice of base.

## Open questions

- Hard limits (time per week, cloud training money, platforms): still blank; default free CPU training only.
- Everything under CONCEPT.md "Open for design".

## Decisions since the last plan update

- 2026-11-12 D-001 harness layers; D-002 concept settled.
