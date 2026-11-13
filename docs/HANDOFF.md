# Handoff

Updated: 2026-11-13. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

Building the first usable version: [`docs/specs/first-usable.md`](specs/first-usable.md), approved 2026-11-12. S1 to S6 done (PRs #2 to #7 merged); S6 ended milestone M3 and the spec. The verdict was No. The shut-valve fix (D-018, PR #8 merged) left it No, but much closer. Next: M3 audit offer, then the Vulcan phase.

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
- ▶ M3 audit (report written, Morgan's replies pending), then plan the Vulcan phase.
- ○ Vulcan test bench, then Vulcan brain; Later list in D-004.

## Just done

- 2026-11-13 M3 audit (repo kind) written: two reviewer areas, 7 quotes verified, 4 findings dropped after checking; `npm run check` measured 10.1 to 11.4 s (budget 10 s, F2). Reader cost $0.32.
- 2026-11-13 Morgan approved PR #6 and asked for S6 in a new session. Older entries: `docs/archive/handoff-2026-11.md`.
- 2026-11-13 Morgan approved PR #7 (S6) and asked to try the shut-valve fix. PR #7 merged (7087015) after its ready CI run passed; auto-merge was refused while the check was pending.
- 2026-11-13 Shut-valve fix built on `valve-range` (D-018): valve = (1.25·y + 1) / 2, clamped, in copy loss and runtime map. Held-out total 63.49 → 55.21 m·s (fixed PI 58.89, retuned 55.52); 0.75→0.15 16.92 → 10.13 (PI 11.61). Still **No**: 1.40→1.90 6.65 vs 5.24 and dist@0.35 4.54 vs 2.96 are > 5% worse. Travel 39.25 vs 52.37. Training IAE after ES 47.84 (PI 50.94). In control within 0.0008 m. Tests 88 (2 new: the map, and the copied net reaching both valve ends, which the old net missed at 0.0546 against 0.03); check 6.6 s; `train:lab` 41.1 s. Lab republished (version 10). Morgan approved PR #8; merged (42a5234) after its ready CI run passed. Morgan asked for the M3 audit in a new session.
- 2026-11-13 Valve travel: Morgan kept D-011 as written (noise included). Measured trial: fixed PI 52.37, ES net 37.07 held-out travel; noise off 3.84 and 3.52.
- 2026-11-13 ES re-check (D-017): the spec's noise 64 / step 512 swung training IAE 54.6 to 58.3; 32/128 fell every generation, 57.18 → 53.49 m·s (fixed PI 50.94). `shr` now divides by a stored 2^n (same results, 7× faster).
- 2026-11-13 S6 built: `src/train/{es,pool,lab-files}.ts`, `src/sim/{verdict,replay}.ts`, `scripts/train-lab.ts` (copy, ES on worker threads, verdict), `models/lab/` (weights.json is now ES; ES log, 10 ES snapshots, `esExample`, `verdict.json`), Replay tab `src/lab/replay-panel.ts` (curve, 20-snapshot slider, held-out replay tank on seed 101, verdict tables and checks, ES worked example from the real generation 1). Tests 86 (was 71); check 6.0 to 6.6 s; browser 5.6 to 6.0 s; `train:lab` 40.2 s (D-008 limit 10 min). Tests failed first; 9 planted bugs caught.
- 2026-11-13 Verdict (held-out, seeds 101 to 105): **No.** Net 63.49 m·s against fixed PI 58.89 (retuned 55.52); worse than 5% on 0.75→0.15 (16.92 vs 11.61), 1.40→1.90 (8.32 vs 5.24) and dist@0.35 (4.48 vs 2.96); better on 0.15→1.40 (17.21 vs 22.36). Travel 37.52 vs 52.37 (0.72×). ES net in control: within 0.0088 m at 0.10 to 1.90 m (limit 0.02).
- 2026-11-13 Why the net loses at low levels (measured, 0.75→0.15, seed 101): the PI shuts the valve (min 0.0000) and is below 0.17 m at 106 s; the copied and ES nets never go below 0.0637 and 0.0599 and stay above 0.17 m all 300 s. Inference, not tested: the copy phase never taught it to shut fully, and 50 small ES steps can't move it that far.
- 2026-11-13 Choices beyond the spec: J5's "state().net.valve" is `state().replay.valve` (the Replay tank restarts at 0 s on each snapshot, so two snapshots compare from the same state); training IAE logged at generation 0 too (51 entries); `log.json` carries `esExample`; the Replay curve shows the fixed PI's training IAE dashed. Lab republished to the same link (version 9).

## Next

1. M3 audit: [`docs/audit/2026-11-13-repo.md`](audit/2026-11-13-repo.md), 8 findings, none high, on branch `claude/m3-audit-g5wtpw`. Wait for Morgan to say "audit replies done" on the [audit page](https://claude.ai/artifact/LReALAkrkSJ5goxG6GzA7G), read collection `audit-2026-11-13`, fill Outcome, add accepted items here. Fixes go in a later PR on a new branch.
2. Then plan the Vulcan phase (test bench, then brain) with the `planning-interview` skill; Morgan said one fix, then Vulcan either way. Don't tune the Lab net further against the held-out set: the verdict would stop meaning anything.

Lab: [Phobos Lab](https://claude.ai/artifact/2eQjCCQENdA99wAmgwPsDb) (version 9, S6). Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), [spec approval](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR).

## Open questions

- For S4 (minor, follows the spec): the net's integral input holds when the valve is ≥ 0.999 or ≤ 0.001, the PI when u leaves [0, 1]. On `1.00→1.75` that leaves a constant 0.0026 offset in I-equivalent. Locked in `tests/check-states.test.ts`.

## Decisions since the last plan update

- 2026-11-13 D-018 valve map reaches both ends at ±0.8. Morgan: try one shut-valve fix after the No. D-017 ES settings after the S6 re-check; D-011 kept (Morgan). D-016 copy data includes disturbances.
- 2026-11-12 D-014 Lab look: Control room; D-011 verdict rule (a); D-012 dev dependencies; D-013 spec additions.
- 2026-11-12 D-001 to D-010: harness, concept, round 1, plan, platforms, number spec, accuracy, training, pass mark, files and licence.
