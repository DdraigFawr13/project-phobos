# Handoff

Updated: 2026-11-18. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

First usable version done (spec [`docs/specs/first-usable.md`](specs/first-usable.md), M1 to M3, verdict No, audit fixed). Now: the Vulcan bench, spec [`docs/specs/vulcan-bench.md`](specs/vulcan-bench.md) approved 2026-11-18 (D-019, D-020, D-021). S1 merged (Vulcan PR #103); S2 merged (PR #13). Now: S3 on branch `claude/vulcan-bench-s3` (code pushed, training running).

Coordinator mode: Morgan, 2026-11-18, asked the coordinator to run S1 to S4 with recommended options approved and merge each slice when ready.

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
- ✔ Vulcan bench spec approved with R1 to R10 (Morgan, 2026-11-18): D-021, PR #12.
- ✔ S1 Vulcan line hook (Vulcan PR #103, merged ee016ed).
- ✔ S2 bench runner and today's numbers page (PR #13).
- ▶ S3 net and training (plus R10 table). ○ S4 blind pairs and verdict. Limit 8 sessions to the verdict (session 3 of 8: S2).
- ○ Soon: in-game switch, ambitions test (Vulcan P6.4), work-order swap, Silvanus. Later: Structured Text exporter, Story Generator.

## Just done

- 2026-11-18 S3 in progress: code committed (inputs, lines, table, train, pool, shadow, page; J3/J4 tests seen failing on planted bugs). Training runs `npm run train:vulcan -- --chance`, then `--sigma-check --model net|table`; window worlds cached in `.cache/vulcan/`, snapshots in `models/vulcan/*.snapshot.json` (resume by rerunning the same command). Measured: a 28-day window 8 to 10 s mid-year (spec estimate 4.56 s).
- 2026-11-18 S2 built: `vulcan.pin` (ee016ed), `src/vulcan/` engine, measure, bench, clone, scales, page; `npm run bench:vulcan`, `npm run test:vulcan` (4 tests, J2 plus noise-nudge and clone checks; seen failing first). Anvil equals Vulcan balance at the pin (5, 11, 202, 166, 483, 30, 97, 110). 25 seed-years on 3 threads: 492 s; one anvil year alone 45 s. Noise band and R9 reading: D-022. Page: [today's numbers](https://claude.ai/artifact/R3sL3NbtmcQRNu1St5A17n). Cloud install: `docs/vulcan-setup.md`.
- 2026-11-18 Spec approved by Morgan, all R-items yes (D-021); PR #12 merged.
- 2026-11-18 Spec written and checked (paraphrase, critic, zero-decision; critic and zero-decision rerun twice). Measured: Vulcan seed-year 54.7 s (anvil, b08ffba); mid-year `structuredClone` continues identically. Vulcan installed here via a local story-generator archive (codeload 403).
- 2026-11-18 Vulcan bench planned (`planning-interview`): [round 1](https://claude.ai/artifact/33G7tNCHcqECgiVCBYNsPz), [review](https://claude.ai/artifact/GUsAa8KHHKnxJFgd7BA73x) (10 findings, adversarial reviewer), [final](https://claude.ai/artifact/NXn8YwE3MfCwxHPPjPvcJt). Morgan approved all recommended options: D-019, D-020.

## Next

1. Coordinator merges S2. Then S3 here (spec S3): inputs with `STORE_SCALES` (`src/vulcan/scales.ts`: food 1120, firewood 10 per alive person; firewood peaks at 4 to 5, so that input is coarse), the zero-output net, training. Before each slice, rerun the zero-decision check on its sections (write-spec step 8).
2. Don't tune the Lab net further against the held-out set: the verdict would stop meaning anything.

Lab: [Phobos Lab](https://claude.ai/artifact/2eQjCCQENdA99wAmgwPsDb) (version 10, D-018). Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), [spec approval](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR).

## Open questions

- codeload.github.com 403s here, so Vulcan's `npm ci` fails; the workaround in `docs/vulcan-setup.md` works (install 11.4 s).
- The pooled noise band is wide (D-022: one anvil nudge stopped smelting all year). S4: show per-seed changes beside it.
- Not checked: restoring a Vulcan game mid-year headless for month windows (saves are in Vulcan `src/ui/saves.ts`). (Seed-year time measured at the pin: 42 to 45 s alone, mean 59.8 s with 3 threads busy.)
- For S4 (minor, follows the spec): the net's integral input holds when the valve is ≥ 0.999 or ≤ 0.001, the PI when u leaves [0, 1]. On `1.00→1.75` that leaves a constant 0.0026 offset in I-equivalent. Locked in `tests/check-states.test.ts`.

## Decisions since the last plan update

- 2026-11-18 D-022 noise band measured; R9 reading (a miss counts only beyond 5% and beyond the band's worst change).
- 2026-11-18 D-021 spec approved with R1 to R10 (amends D-019 and D-020's floor).
- 2026-11-18 D-019 Vulcan bench plan, D-020 Vulcan verdict (Morgan, all recommended). Story Generator on the Later list.
- 2026-11-13 Morgan approved PR #10 (audit fixes; Prettier print width 120, Markdown and the mock-up not formatted).
- 2026-11-13 Morgan accepted all 8 M3 audit findings and approved adopting Prettier (F8); the fix session writes it into D-012.
- 2026-11-12/13 D-001 to D-018: see DECISIONS. D-018 valve map reaches both ends at ±0.8. Morgan: try one shut-valve fix after the No. D-017 ES settings after the S6 re-check; D-011 kept (Morgan). D-016 copy data includes disturbances.
