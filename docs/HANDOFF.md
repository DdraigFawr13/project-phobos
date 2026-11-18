# Handoff

Updated: 2026-11-18. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

First usable version done (spec [`docs/specs/first-usable.md`](specs/first-usable.md), M1 to M3, verdict No, audit fixed). Now: the Vulcan bench, planned and approved 2026-11-18 ([D-019](DECISIONS.md), [D-020](DECISIONS.md)). Next: its spec.

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
- ✔ Plan the Vulcan bench: round 1, review, final (Morgan approved 2026-11-18), D-019, D-020.
- ▶ Spec for the Vulcan bench (`write-spec`), `docs/specs/vulcan-bench.md`.
- ○ V1 Vulcan hook (Vulcan PR), V2 bench runner, V3 copy and evolve, V4 report and blind verdict. Limit 8 sessions.
- ○ Soon: in-game switch, ambitions test (Vulcan P6.4), work-order swap, Silvanus. Later: Structured Text exporter, Story Generator.

## Just done

- 2026-11-18 Vulcan bench planned (`planning-interview`): [round 1](https://claude.ai/artifact/33G7tNCHcqECgiVCBYNsPz), [review](https://claude.ai/artifact/GUsAa8KHHKnxJFgd7BA73x) (10 findings, adversarial reviewer), [final](https://claude.ai/artifact/NXn8YwE3MfCwxHPPjPvcJt). Morgan approved all recommended options: D-019, D-020.
- 2026-11-13 M3 audit (repo kind) written: two reviewer areas, 7 quotes verified, 4 findings dropped after checking; `npm run check` measured 10.1 to 11.4 s (budget 10 s, F2). Reader cost $0.32. Morgan accepted all 8 and approved PR #9; merged after approval.
- 2026-11-13 M3 audit fixes F1 to F8 on branch `claude/m3-audit-findings-231x7p`: Prettier 3.9.10 added (D-012) and the code reformatted once (print width 120; tests 88 pass, `train:lab` rewrote `models/lab/` byte-identical, browser test passes); `check` re-timed (AGENTS.md); runtime path named in AGENTS.md and NUMBERS.md; `workflow_dispatch` dropped from CI; S6-era entries archived.
- 2026-11-13 Shut-valve fix [D-018](DECISIONS.md), PR #8 merged (42a5234). Held-out total 55.21 m·s against fixed PI 58.89 (retuned 55.52). Still **No**: 1.40→1.90 6.65 vs 5.24 and dist@0.35 4.54 vs 2.96 are > 5% worse. Lab republished (version 10). ES settings: [D-017](DECISIONS.md).

## Next

1. Write `docs/specs/vulcan-bench.md` with `write-spec` from step 3 (D-019, D-020 are the input), check it with fresh agents, get Morgan's approval, then build V1.
2. Don't tune the Lab net further against the held-out set: the verdict would stop meaning anything.

Lab: [Phobos Lab](https://claude.ai/artifact/2eQjCCQENdA99wAmgwPsDb) (version 10, D-018). Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), [spec approval](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR).

## Open questions

- This cloud container gets 403 from codeload.github.com, so `npm ci` fails in Vulcan (its story-generator tarball) and the bench's Vulcan pin will too. Ask to allow that host (environment tools) when V1 starts.
- Not checked: restoring a Vulcan game mid-year headless for month windows (saves are in Vulcan `src/ui/saves.ts`); Vulcan's seed-year time after Phase 5B (20 s measured 2026-10-19).
- For S4 (minor, follows the spec): the net's integral input holds when the valve is ≥ 0.999 or ≤ 0.001, the PI when u leaves [0, 1]. On `1.00→1.75` that leaves a constant 0.0026 offset in I-equivalent. Locked in `tests/check-states.test.ts`.

## Decisions since the last plan update

- 2026-11-18 D-019 Vulcan bench plan, D-020 Vulcan verdict (Morgan, all recommended). Story Generator on the Later list.
- 2026-11-13 Morgan approved PR #10 (audit fixes; Prettier print width 120, Markdown and the mock-up not formatted).
- 2026-11-13 Morgan accepted all 8 M3 audit findings and approved adopting Prettier (F8); the fix session writes it into D-012.
- 2026-11-13 D-018 valve map reaches both ends at ±0.8. Morgan: try one shut-valve fix after the No. D-017 ES settings after the S6 re-check; D-011 kept (Morgan). D-016 copy data includes disturbances.
- 2026-11-12 D-014 Lab look: Control room; D-011 verdict rule (a); D-012 dev dependencies; D-013 spec additions.
- 2026-11-12 D-001 to D-010: harness, concept, round 1, plan, platforms, number spec, accuracy, training, pass mark, files and licence.
