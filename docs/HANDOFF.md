# Handoff

Updated: 2026-11-19. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

First usable version done (spec [`docs/specs/first-usable.md`](specs/first-usable.md), M1 to M3, verdict No, audit fixed). Now: the Vulcan bench, spec [`docs/specs/vulcan-bench.md`](specs/vulcan-bench.md) approved 2026-11-18 (D-019, D-020, D-021). S1 merged (Vulcan PR #103); S2 merged (PR #13). S3 merged (PR #14, D-023). S4 merged (PR #15, D-024). Verdict: the net is **No** (D-025, Morgan 2026-11-19); today's rule stays in Vulcan. Next: Morgan decides whether to rate the 12 table pairs, and what to try with the net later.

Coordinator mode: Morgan, 2026-11-18, asked the coordinator to run S1 to S4 with recommended options approved and merge each slice when ready.

## Plan map

Shown at the start of a session and when asking the owner to approve a PR or a merge (WS-08). One line per step, marked done ✔, now ▶ or later ○.

- ✔ Brainstorm, bootstrap, planning interview, spec (PR #1, merged).
- ✔ First usable version: Lab S1 to S6 (PRs #2 to #7), shut-valve fix D-018 (#8), M3 audit and fixes (#9, #10).
- ✔ Plan the Vulcan bench: round 1, review, final (Morgan approved 2026-11-18), D-019, D-020.
- ✔ Vulcan bench spec approved with R1 to R10 (Morgan, 2026-11-18): D-021, PR #12.
- ✔ S1 Vulcan line hook (Vulcan PR #103, merged ee016ed).
- ✔ S2 bench runner and today's numbers page (PR #13).
- ✔ S3 net and training plus R10 table (PR #14).
- ✔ S4 blind pairs, floor, report page and verdict tool (PR #15). Verdict No after 8 of 36 pairs (D-025); 5 of 8 sessions used.
- ▶ Open: rate the 12 table pairs (still blind), and plan any later net attempt as D-020's one fix.
- ○ Soon: in-game switch, ambitions test (Vulcan P6.4), work-order swap, Silvanus. Later: Structured Text exporter, Story Generator.

## Just done

- 2026-11-19 Verdict No (D-025). Morgan rated p01 to p08 (all net pairs): net picked 4 of 8. All 8 were one move: eat at food 52%, just above today's line 5200. `verdict:vulcan` on `models/vulcan/picks-2026-11-19.txt`: floor holds on every seed. Coordinator [report](https://claude.ai/artifact/VhdDATUyBuHTS95V1WmBF9).
- 2026-11-19 S4 built (D-024). `npm run pairs:vulcan`: 24 net pairs (5, 5, 5, 5, 4) and 12 table pairs (3, 3, 2, 2, 2), shuffled into p01 to p36, no key in `models/vulcan/pairs.json`; floor years today/net/table plus the noise band in `models/vulcan/floor.json` (band equals D-022). Floor holds for net and table on every seed under D-022; net food change anvil −203 (of 483), smoke −91, tallow −144, wren +106, bryn +119, all inside the band's 358. Shadow moment counts reran identical to S3. Times: shadow years 17.4 min (both models), pairs 109 s, floor 605 s, `npm run check` 8.0 s (115 tests). Page: [Vulcan blind pairs](https://claude.ai/artifact/HcjVD4CHDwFv973tAh9atN) (picks save to its `picks` collection, owner only).

## Next

1. Ask Morgan whether to rate the 12 table pairs on the [report page](https://claude.ai/artifact/HcjVD4CHDwFv973tAh9atN). The page doesn't move on after a pick (tap Next); filter it to the table pairs first so the net's known move doesn't leak. Read picks with the ArtifactData `list` of `picks` (limit 100) and run `npm run verdict:vulcan -- <file>`.
2. A later net attempt is D-020's one fix: plan it as new work (the spec's "act earlier everywhere" risk is what happened).
3. Don't tune the net or the table further against the held-out set: the verdict would stop meaning anything.

Lab: [Phobos Lab](https://claude.ai/artifact/2eQjCCQENdA99wAmgwPsDb) (version 10, D-018). Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), [spec approval](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR).

## Open questions

- codeload.github.com 403s here, so Vulcan's `npm ci` fails; the workaround in `docs/vulcan-setup.md` works (install 11.4 s).
- The pooled noise band is wide (D-022): the net's anvil food falls 42% and still holds. The page shows each seed's own noise beside the pooled band.
- Lab (minor, follows the spec): the net's integral input holds when the valve is ≥ 0.999 or ≤ 0.001, the PI when u leaves [0, 1]. On `1.00→1.75` that leaves a constant 0.0026 offset in I-equivalent. Locked in `tests/check-states.test.ts`.

## Decisions since the last plan update

- 2026-11-19 D-025 Vulcan verdict: the net is No (Morgan).
- 2026-11-19 D-024 S4 pairs, floor and verdict tool (table quotas 3, 3, 2, 2, 2; shuffle makeRng(21); key rebuilt from the draws).
- 2026-11-18 D-023 training score in crisis hours, 4 windows per generation from windows with a crisis hour (coordinator, Morgan's pre-approval).
- 2026-11-18 D-022 noise band measured; R9 reading (a miss counts only beyond 5% and beyond the band's worst change).
- 2026-11-18 D-021 spec approved with R1 to R10 (amends D-019 and D-020's floor).
- 2026-11-18 D-019 Vulcan bench plan, D-020 Vulcan verdict (Morgan, all recommended). Story Generator on the Later list.
- 2026-11-13 Morgan accepted all 8 M3 audit findings, adopted Prettier (F8, D-012) and approved PR #10 (print width 120; Markdown and the mock-up not formatted).
- 2026-11-12/13 D-001 to D-018: see DECISIONS. D-018 valve map reaches both ends at ±0.8. Morgan: try one shut-valve fix after the No. D-017 ES settings after the S6 re-check; D-011 kept (Morgan). D-016 copy data includes disturbances.
