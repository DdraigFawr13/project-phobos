# Handoff

Updated: 2026-11-12. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

Building the first usable version: [`docs/specs/first-usable.md`](specs/first-usable.md), approved 2026-11-12. S1 done (PR #2 merged). S2 built on branch `ccr-99f48d32-pgq719`, draft PR, waiting for Morgan's check.

## Plan map

Shown at the start of a session and when asking the owner to approve a PR or a merge (WS-08). One line per step, marked done ✔, now ▶ or later ○.

- ✔ Brainstorm, bootstrap, planning interview, spec (PR #1, merged).
- ✔ S1 Lab v0: tank and PI live (M1), PR #2.
- ▶ S2 gap per level (M1).
- ○ S3 numbers and tables, S4 dense, mask and float reference (M2).
- ○ S5 copy the PI, S6 evolution strategies, replay and verdict (M3).
- ○ Vulcan test bench, then Vulcan brain; Later list in D-004.

## Just done

- 2026-11-12 PR #1 merged: bootstrap, planning (D-003 to D-010), spec approved (D-011 to D-013).
- 2026-11-12 S1 on branch `ccr-e4e66c33-7nff0t`, draft PR #2. Taste board ([Lab look](https://claude.ai/artifact/8tCyT6ng1CGE4dkkCo9NCR)): Morgan kept A Control room, 13 px text, 44 px taps, light and dark. `docs/UI_STYLE.md` and D-014 written.
- 2026-11-12 Whole-Lab mock-up `mockups/lab.html`, published as [Lab mock-up](https://claude.ai/artifact/GNXTPDEiPJ1WgamL8ZwjtF) (published copy adds 3 screenshots). Fact check (37 facts), lint 0 warnings, one fresh check (12 findings, all fixed).
- 2026-11-12 Morgan asked for a beginner-readable Lab with full depth: teaching layer added to the mock-up (What you're seeing, Try this, How it works on every tab); rules in UI_STYLE "Teaching layer"; D-015 Proposed until mock-up approval. Second fresh check: 22 findings, 21 fixed. Facts checked now 49.
- 2026-11-12 Mock-up approved; D-015 Accepted. S1 built: `src/rng.ts`, `src/sim/{plant,pi,live}.ts`, `src/lab/*`, `scripts/build-lab.ts`, tests (11, plus `e2e/lab-smoke.mjs`), golden `tests/golden/trace-seed1.json`, CI runs `npm run check` (1.2 s). Lab published: [Phobos Lab](https://claude.ai/artifact/2eQjCCQENdA99wAmgwPsDb). Fresh code review: 11 findings, 6 acted on (RNG known value, disturbance counted in steps, tighter trace checks, pinned-shut PI and plant clamps tested, npm 10.9.9 in CI); tests now 14. `__lab.setNet`/`setSnapshot` are absent until M3 on purpose.
- 2026-11-12 Morgan checked Lab on the phone ("it works great") and approved PR #2. Tabs stay hidden until built (UI_STYLE rule kept; Morgan asked how to reach other pages, answered that they arrive with S2 to S6).

- 2026-11-12 S2 built: `src/sim/{fixed-test,net-inputs,check-states}.ts`, `scripts/fixed-test.ts` (`npm run fixed-test`), Lab tab row and Fixed test tab with teaching text, tests 28 (was 14), e2e compares the page's bars with Node's numbers. Repo numbers equal the mock-up's throwaway script: totals fixed 50.94, retuned 47.58 m·s. 6 planted bugs all caught (VER-10). Lab republished to the same link.

## Next

1. Morgan opens [Phobos Lab](https://claude.ai/artifact/2eQjCCQENdA99wAmgwPsDb), taps Fixed test, Run fixed test, and approves or asks for changes on the S2 PR.
2. After merge: new branch from `main`, build S3 (numbers and tables) per the spec. Write the checks first and see them fail (VER-10).

Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), [spec approval](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR).

## Open questions

- Raise before S6, now measured by S2's repo code: valve travel is 10.20 to 11.04 per training segment for both PIs with noise, and 0.20 to 1.25 with noise off, so noise causes 88 to 98% of it. D-011's travel clause mostly measures noise amplification. The retuned PI is worse on `1.00→1.75` (11.79 against 9.74 m·s) and on held-out `0.15→1.40` (25.25 against 22.36) and `1.40→1.90` (6.40 against 5.24).
- For S4 (minor, follows the spec): the net's integral input holds when the valve is ≥ 0.999 or ≤ 0.001, the PI when u leaves [0, 1]. On `1.00→1.75` that leaves a constant 0.0026 offset in I-equivalent (about 13 LSB on the input); other segments agree within 0.0001. Locked in `tests/check-states.test.ts`.

## Decisions since the last plan update

- 2026-11-12 D-014 Lab look: Control room.
- 2026-11-12 D-011 verdict rule (a); D-012 dev dependencies; D-013 spec additions.
- 2026-11-12 D-001 harness; D-002 concept; D-003 round 1; D-004 plan approved; D-005 platforms; D-006 number spec; D-007 accuracy; D-008 training; D-009 Lab pass mark; D-010 files and licence.
