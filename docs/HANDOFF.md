# Handoff

Updated: 2026-11-13. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

Building the first usable version: [`docs/specs/first-usable.md`](specs/first-usable.md), approved 2026-11-12. S1 done (PR #2 merged). S2 done (PR #3 merged). S3 done (PR #4 merged). S4 done (PR #5 merged). S5 built, in review (draft PR). Next slice after approval: S6.

## Plan map

Shown at the start of a session and when asking the owner to approve a PR or a merge (WS-08). One line per step, marked done ✔, now ▶ or later ○.

- ✔ Brainstorm, bootstrap, planning interview, spec (PR #1, merged).
- ✔ S1 Lab v0: tank and PI live (M1), PR #2.
- ✔ S2 gap per level (M1), PR #3.
- ✔ S3 numbers and tables (M2), PR #4.
- ✔ S4 dense, mask and float reference (M2), PR #5.
- ▶ S5 copy the PI (M3), draft PR in review.
- ○ S6 evolution strategies, replay and verdict (M3).
- ○ Vulcan test bench, then Vulcan brain; Later list in D-004.

## Just done

- 2026-11-12 S4 built: `src/runtime/{dense,select,net}.ts`, `src/ref/{dense,agreement}.ts`, `src/model/{random,nets,weights}.ts`, `src/sim/net-controller.ts`, Integer vs float tab with teaching text (worked example computed in the page), `tests/runtime.test.ts`, `tests/weights.test.ts`, golden `tests/golden/runtime-testnet.json`. Tests 60 (was 42); check 1.44 to 1.47 s; browser test 4.5 s. Tests failed first (modules missing); 14 planted bugs all caught. Measured: test net layer gaps 0.028% and 0.007%, same action 100.0% (actions 1 and 3 only: exactly the 2 distinct the spec asks for); Lab-shaped net gaps 0.026% and 0.026%, valve within 0.01 on 100.0%, largest gap 0.0005. Equal to the mock-up's script. Lab republished (version 6). Loader also rejects an unknown kind/act and a broken layer chain (beyond the spec's list; NUMBERS.md says so).

- 2026-11-13 Morgan approved PR #5 and asked for S5 in a new session. Older entries: `docs/archive/handoff-2026-11.md`.
- 2026-11-13 S5 built on branch `s5-copy-pi`: `src/train/copy.ts`, `scripts/train-lab.ts` (`npm run train:lab`), `models/lab/{copy-weights,weights,log,snapshots}.json`, `src/sim/live.ts` net tank (seed 2), Net tab `src/lab/net-panel.ts` (toggle, two tanks, heat map, teaching text with a live worked example), `scripts/build-lab.ts` exports `buildLabHtml` and inlines models via `__LAB_MODELS__`. Tests 71 (was 60); check 3.40 to 3.48 s; browser 4.1 to 4.5 s. Tests failed first (modules and files missing); 10 planted bugs all caught.
- 2026-11-13 S5 measured (after D-016): training 1.12 s (`npm run train:lab`, D-008 limit 10 min). Loss 0.0741 → 0.00209 at step 200 → 0.00074 at 2,000. Mean |valve − PI valve| on the check states 0.0170 (limit 0.05); integer within 0.01 of float on 100.0% (D-007); J4 net tank 1.003 m after 300 s. In control it holds 0.10 to 1.90 m within 0.009 m at 900 s (new test, limit 0.02). Shifts 14 and 14.
- 2026-11-13 Choices beyond the spec: the data shuffle uses a fresh rng seed 11; batches are taken in order from the shuffled data, wrapping round; the log records full-data loss; weight meta `{ trainer: "copy", seed: 13 }`; the Net tab adds a setpoint slider (the mock-up had none); heat-map negatives are grey `--valve` (ink turned white in dark). Lab republished to the same link (version 7).
- 2026-11-13 Morgan found on the phone that the net could not hold 0.10 m (settled near 0.20 m): it ignored its error-so-far input because the copy data had no disturbances. Fixed by D-016 (one 60 s disturbance per run), with a closed-loop test at 0.10 to 1.90 m; Lab republished (version 8).

## Next

1. Morgan reviews the S5 draft PR and the Net tab on the phone. On approval: HANDOFF merged state, mark ready, auto-merge (GIT-08).
2. Then a new session for S6 (evolution strategies, Replay tab, verdict) per the spec. Raise the valve-travel question below first.

Lab: [Phobos Lab](https://claude.ai/artifact/2eQjCCQENdA99wAmgwPsDb) (version 8, S5 with D-016). Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), [spec approval](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR).

## Open questions

- Raise before S6, now measured by S2's repo code: valve travel is 10.20 to 11.04 per training segment for both PIs with noise, and 0.20 to 1.25 with noise off, so noise causes 88 to 98% of it. D-011's travel clause mostly measures noise amplification. The retuned PI is worse on `1.00→1.75` (11.79 against 9.74 m·s) and on held-out `0.15→1.40` (25.25 against 22.36) and `1.40→1.90` (6.40 against 5.24).
- For S4 (minor, follows the spec): the net's integral input holds when the valve is ≥ 0.999 or ≤ 0.001, the PI when u leaves [0, 1]. On `1.00→1.75` that leaves a constant 0.0026 offset in I-equivalent (about 13 LSB on the input); other segments agree within 0.0001. Locked in `tests/check-states.test.ts`.

## Decisions since the last plan update

- 2026-11-13 D-016 copy data includes disturbances (Morgan, on PR #6). None in S3.
- 2026-11-12 D-014 Lab look: Control room.
- 2026-11-12 D-011 verdict rule (a); D-012 dev dependencies; D-013 spec additions.
- 2026-11-12 D-001 harness; D-002 concept; D-003 round 1; D-004 plan approved; D-005 platforms; D-006 number spec; D-007 accuracy; D-008 training; D-009 Lab pass mark; D-010 files and licence.
