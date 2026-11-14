# Handoff

Updated: 2026-11-14. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

Building the first usable version: [`docs/specs/first-usable.md`](specs/first-usable.md), approved 2026-11-12. S1 to S6 done (PRs #2 to #7 merged); S6 ended milestone M3 and the spec. The verdict was No. The shut-valve fix (D-018, PR #8 merged) left it No, but much closer. M3 audit done (PR #9) and its fixes merged (PR #10). On 2026-11-14 Morgan put a Silvanus bench ahead of the Vulcan bench (D-019). Next: plan the Silvanus bench once Silvanus's M2e Choices ships.

## Plan map

Shown at the start of a session and when asking the owner to approve a PR or a merge (WS-08). One line per step, marked done ✔, now ▶ or later ○.

- ✔ Brainstorm, bootstrap, planning interview, spec (PR #1, merged).
- ✔ S1 Lab v0: tank and PI live (M1), PR #2.
- ✔ S2 gap per level (M1), PR #3.
- ✔ S3 numbers and tables (M2), PR #4.
- ✔ S4 dense, mask and float reference (M2), PR #5.
- ✔ S5 copy the PI (M3), PR #6.
- ✔ S6 evolution strategies, replay and verdict (M3), PR #7.
- ✔ Shut-valve fix, judged by the same verdict (Morgan, 2026-11-13): D-018, PR #8.
- ✔ M3 audit: 8 findings, all accepted (Morgan, 2026-11-13), PR #9.
- ✔ Fix the audit findings F1 to F8 (Morgan approved, 2026-11-13), PR #10.
- ✔ Silvanus integration ideas (Morgan accepted, 2026-11-14): D-019.
- ▶ Wait for Silvanus M2e, then plan the Silvanus bench: balance tuner, then proactive trader.
- ○ Vulcan test bench, then Vulcan brain; Later list in D-004.

## Just done

- 2026-11-14 M3 audit request: not re-run, it was done on 2026-11-13 (PR #9, fixes PR #10). A tests-kind audit was offered (estimate $7.52, 2 areas); no answer yet. Silvanus ideas page: [Phobos in Silvanus: ideas](https://claude.ai/artifact/T1D4NsM1RRARVsxYvqbjB9); Morgan accepted the recommendation (D-019).
- 2026-11-13 M3 audit (repo kind) written: two reviewer areas, 7 quotes verified, 4 findings dropped after checking; `npm run check` measured 10.1 to 11.4 s (budget 10 s, F2). Reader cost $0.32. Morgan accepted all 8 and approved PR #9; merged after approval.
- 2026-11-13 M3 audit fixes F1 to F8 on branch `claude/m3-audit-findings-231x7p`: Prettier 3.9.10 added (D-012) and the code reformatted once (print width 120; tests 88 pass, `train:lab` rewrote `models/lab/` byte-identical, browser test passes); `check` re-timed (AGENTS.md); runtime path named in AGENTS.md and NUMBERS.md; `workflow_dispatch` dropped from CI; S6-era entries archived.
- 2026-11-13 Shut-valve fix [D-018](DECISIONS.md), PR #8 merged (42a5234). Held-out total 55.21 m·s against fixed PI 58.89 (retuned 55.52). Still **No**: 1.40→1.90 6.65 vs 5.24 and dist@0.35 4.54 vs 2.96 are > 5% worse. Lab republished (version 10). ES settings: [D-017](DECISIONS.md).

## Next

1. Once Silvanus's M2e Choices ships, plan the Silvanus bench (D-019) with the `planning-interview` skill, on a new branch from `main`. Factions for Silvanus are being planned there first (Silvanus D-041, round `factions1`); a faction net is a later candidate.
2. Don't tune the Lab net further against the held-out set: the verdict would stop meaning anything.

Lab: [Phobos Lab](https://claude.ai/artifact/2eQjCCQENdA99wAmgwPsDb) (version 10, D-018). Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), [spec approval](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR).

## Open questions

- For S4 (minor, follows the spec): the net's integral input holds when the valve is ≥ 0.999 or ≤ 0.001, the PI when u leaves [0, 1]. On `1.00→1.75` that leaves a constant 0.0026 offset in I-equivalent. Locked in `tests/check-states.test.ts`.

## Decisions since the last plan update

- 2026-11-14 D-019 Silvanus bench before the Vulcan bench: tuner first, then proactive trader (Morgan: "Ok let's start with what you say").
- 2026-11-13 Morgan approved PR #10 (audit fixes; Prettier print width 120, Markdown and the mock-up not formatted).
- 2026-11-13 Morgan accepted all 8 M3 audit findings and approved adopting Prettier (F8); the fix session writes it into D-012.
- 2026-11-13 D-018 valve map reaches both ends at ±0.8. Morgan: try one shut-valve fix after the No. D-017 ES settings after the S6 re-check; D-011 kept (Morgan). D-016 copy data includes disturbances.
- 2026-11-12 D-014 Lab look: Control room; D-011 verdict rule (a); D-012 dev dependencies; D-013 spec additions.
- 2026-11-12 D-001 to D-010: harness, concept, round 1, plan, platforms, number spec, accuracy, training, pass mark, files and licence.
