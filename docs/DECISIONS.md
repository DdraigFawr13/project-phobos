# Decisions

Settled rules for this project. Not a changelog: an entry stays while the rule is in force. Change a rule here in the same change that changes the behaviour. Mark ideas Proposed until the owner approves them; mark retired entries SUPERSEDED with a pointer, never delete them.

## D-001 Harness: AI-Master-Instructions, full profile

- **Status:** Accepted (2026-11-12)
- **Decision:** Use AI-Master-Instructions v4.14.2, full profile, layers `core`, `stacks/node-web`, `project-types/simulator`.
- **Why:** Phobos has a multi-phase plan, a browser Lab and a TypeScript runtime; the simulator type covers a pure engine, reproducible traces, causes and the safety boundary that `docs/CONCEPT.md` names. Morgan chose all three on 2026-11-12.

## D-002 Concept settled by the brainstorm

- **Status:** Accepted (2026-11-12)
- **Decision:** The "Settled" list in `docs/CONCEPT.md` § Design brief holds: combined concept and build order (core runtime, Lab v0, trainer, Vulcan brain, exporters and agent recipes); TypeScript runtime on exact integer maths; every learned block beats a plain baseline or is dropped; MIT/Apache-2.0 ports with credit, GPL and unlicensed code as ideas only; Vulcan targets about 30 colonists.
- **Why:** agreed in brainstorm round 1 (CONCEPT.md links the pages).

## D-003 Planning round 1 answers

- **Status:** Accepted (2026-11-12); the plan as a whole still needs final approval.
- **Decision:** £0 compute (free CPU, Morgan's desktop or laptop too). Trainer TypeScript first, Python only if a block can't be trained. int16 weights with scale and shift per layer; integer layers within 1% of output range of the float reference. Lab v0: one tank, inflow valve, fixed outflow, on a published Artifact page, with live curves, net vs PID, setpoint slider and disturbance, weights heat map and training loss. Vulcan takes Phobos as a git dependency pinned to a tag; shared weights now, per-colonist later; cause line decided in the Vulcan phase. Structured Text tested in Controls-Simulator's simulator in CI, CODESYS by hand. Priorities as recommended (Morgan: "go with what you recommend").
- **Why:** Morgan's round 1 answers, [round 1 page](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS). Open follow-ups are on the [review 1 page](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH).

## D-004 Plan approved: first usable version in three milestones

- **Status:** Accepted (2026-11-12)
- **Decision:** Milestones: (1) Lab v0 with the tank and a fixed-gain PID; (2) integer runtime: dense layer, action mask, exp/tanh tables, golden tests; (3) trained net in Lab beside the PID with a training replay. Then the Vulcan test bench, then the Vulcan brain; the Later list holds live phone training, Structured Text exporter, agent recipes, SwiGLU, KAN, Silvanus and trait inputs for personality types. A milestone is one thing Morgan can see working, about 1 to 3 sessions.
- **Why:** Morgan approved the [final page](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ) ("Approved, start building"); the review found the round 1 Now list was several milestones (finding 4, agreed).

## D-005 Platforms

- **Status:** Accepted (2026-11-12)
- **Decision:** Lab runs on a phone browser as a published Artifact page; training and tests run in Node (Morgan's laptop or a cloud session, £0); Vulcan's desktop browser from its phase; Silvanus later.
- **Why:** round 1 ticked phone only, but training and tests need Node (finding 1, agreed; answer P1).

## D-006 Number spec

- **Status:** Accepted (2026-11-12)
- **Decision:** int16 values and weights; sums in plain JS numbers with a bound checked per layer, below 2^53; saturate, never wrap; power-of-two scales so every rescale is a shift; one rounding rule shared by the runtime and any exporter, and an exporter refuses a layer whose bound exceeds the target's integer width. Lowest index wins ties; one seeded integer RNG; same-seed trace test. Tables and golden values are generated once in Node and committed.
- **Why:** an int16 × int16 product is up to about 2^30, so int32 sums overflow and BigInt is slow; a JS shift floors while Structured Text integer division truncates (findings 2, 7, 8, agreed; answer N1).

## D-007 Accuracy bound

- **Status:** Accepted (2026-11-12)
- **Decision:** Each integer layer within 1% of its output range of the float reference, and the integer model picks the same action as the float model on 99% of a fixed set of test states.
- **Why:** per-layer error compounds across layers and time steps (finding 5, agreed; answer N2).

## D-008 Training

- **Status:** Accepted (2026-11-12)
- **Decision:** Lab's net first copies the PID (supervised), then improves by evolution strategies. A block moves to a Python trainer only if its gradient check fails or one training run takes over 10 minutes on Morgan's laptop. Colonists' training method is decided in the Vulcan phase. Morgan watches training as a replay in Lab: loss curve plus a slider through weight snapshots showing how the net drives the tank; live phone training is Later.
- **Why:** round 1 named no training method (finding 3, agreed; answers T1, T2, T3, Q2; Morgan: "I want to observe the training in some way as well").

## D-009 Lab pass mark and plant

- **Status:** Accepted (2026-11-12)
- **Decision:** The tank drains through a fixed opening, so outflow depends on level (replaces round 1's "fixed outflow"). Lab's net passes if it beats a fixed-gain PID, tuned at one level, across the whole setpoint range. Milestone 1 shows that PID at several levels so Morgan can judge whether the gap is worth closing.
- **Why:** answer Q1, settling the clash between finding 6 and answer L1; Morgan's note: "I need to see if this would be worth implementing".

## D-010 Files, licence, personalities

- **Status:** Accepted (2026-11-12)
- **Decision:** Weights in Phobos JSON with a format version (no safetensors). Licence MIT. Personality types later come from trait inputs to shared weights. Apache-2.0 ports carry the licence, NOTICE and stated changes. CfC gets a patent check before it enters Vulcan.
- **Why:** answers W1, X1, V1; findings 10, 11 (agreed).

## D-011 Lab verdict rule

- **Status:** Accepted (2026-11-12)
- **Decision:** Lab's net is "worth it" when, on the held-out setpoints and noise seeds, its total IAE is lower than the fixed PI's, no held-out segment is more than 5% worse, and its valve travel is at most 2× the fixed PI's. The verdict panel always also shows the retuned PI.
- **Why:** Morgan chose option (a) on the [spec approval page](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR); it keeps D-009. Retuning changes only Ti = 40·√level, so the retuned PI is shown to judge whether the net learned more than gain scheduling.

## D-012 Dev dependencies

- **Status:** Accepted (2026-11-12)
- **Decision:** typescript 7.0.2, esbuild 0.28.2, @types/node 22.x and prettier 3.9.10 (added 2026-11-13, M3 audit F8) as exact-pinned dev dependencies; tests use Node's built-in runner on Node 22.23.4 with type stripping; Playwright is the container's copy. No runtime dependencies.
- **Why:** Morgan approved (SAFE-01). The type check, the `.ts` test run and the single-file bundle were tried in the planning session. Prettier: Morgan approved it on 2026-11-13 so WEB-03's format check can run; `npm run check` runs `prettier --check --cache`, print width 120, and `.prettierignore` keeps synced, generated, golden and Markdown files out.

## D-013 Spec additions

- **Status:** Accepted (2026-11-12)
- **Decision:** Tank 1 m² × 2 m, draining through a fixed opening (k = 0.05 m^2.5/s); Lab net 4 inputs → 16 tanh → 1 (97 weights), with the error integral kept in float outside the integer runtime; evolution strategies tune the integer net directly; browser tests run locally and in PR screenshots, not in CI. Details: `docs/specs/first-usable.md`.
- **Why:** the spec had to decide these; Morgan accepted them on the approval page.

## D-014 Lab look: Control room

- **Status:** Accepted (2026-11-12)
- **Decision:** Lab uses look A "Control room" (grey HMI panel, IBM Plex Sans and Plex Mono, colour only for the level, the net and off-normal states). First width 400 px; minimum text 13 px; minimum tap 44 px; light and dark follow the phone. Tokens and rules: `docs/UI_STYLE.md`.
- **Why:** Morgan kept A and cut B, C and D on the [taste board](https://claude.ai/artifact/8tCyT6ng1CGE4dkkCo9NCR), and picked the recommended sizes and theme there.

## D-015 Lab teaches a beginner

- **Status:** Accepted (2026-11-12, with the [Lab mock-up](https://claude.ai/artifact/GNXTPDEiPJ1WgamL8ZwjtF))
- **Decision:** Every Lab tab has a plain "What you're seeing" note, a "Try this" prompt, and a tap-to-open "How it works" section with the mechanism, equations and a word list. Rules: `docs/UI_STYLE.md` "Teaching layer".
- **Why:** Morgan asked that Lab be "clearly readable for a beginner like me but still has the necessary depth for me to fully comprehend what is going on and learn about the topic". Plain text always visible and depth on a tap keeps the 400 px screen readable.

## D-016 Copy data includes disturbances

- **Status:** Accepted (2026-11-13, Morgan chose "Fix in PR #6")
- **Decision:** Each of the copy phase's 50 PI runs has one 60 s disturbance (outflow × 1.2) starting at a uniform random time in [0, 340] s. A test runs the copied net in control at 0.10, 0.25, 0.50, 1.00, 1.50 and 1.90 m and requires it within 0.02 m after 900 s and 1,800 s.
- **Why:** Morgan saw the first S5 net settle at about 0.20 m for a 0.10 m setpoint. Without disturbances the error-so-far input always matched the level, so the net ignored it and had no integral action (measured: that input from 0.20 to −1.80 moved the valve 0.198 → 0.231). With disturbances: 0.10 m → 0.109 m at 900 s, 0.102 m at 1,800 s. Open-loop mean gap to the PI rose 0.0146 → 0.0170 (limit 0.05).

## D-017 ES settings after the S6 re-check

- **Status:** Accepted (2026-11-13, S6 re-check the spec asked for; D-011 unchanged, Morgan kept noise in valve travel)
- **Decision:** ES noise 32 LSB (was 64) and step 128 (was 512); 50 generations of 32 (16 antithetic pairs), rng seed 17, Box-Muller, centred ranks, unchanged. Training IAE is logged at generation 0 (the copied net) and after every generation. Members are scored on worker threads; scores return in order, so the files don't depend on the number of workers. `shr` divides by a stored 2^n instead of computing `2 ** n` per call (same results, about 7× faster on 15 M inputs).
- **Why:** measured from the copied net (training IAE 57.18 m·s; fixed PI 50.94): at 64/512 training IAE swung 54.6 to 58.3 between generations and ended at 55.93; 64/128 ended at 54.11; 128/256 at 54.21; 32/128 at 53.49, falling every generation. Picked on training IAE only, never held-out (the verdict's set). Valve travel: Morgan chose to keep D-011 as written (noise included), because twitching at noise wears a real valve and the clause catches a net that buys IAE with gain.

## D-018 Valve map reaches both ends at ±0.8

- **Status:** Accepted (2026-11-13, Morgan asked to try the shut-valve fix after S6's No)
- **Decision:** The Lab net's valve is (1.25·y + 1) / 2, clamped to [0, 1]; in Q12, (5y + 16384) / 32768. y = 0 is still half open; y ≤ −0.8 is shut and y ≥ 0.8 fully open. The copy loss uses the same map before clamping. Everything else (data, settings, ES, D-011's verdict) is unchanged.
- **Why:** with (y + 1) / 2 a shut valve needed tanh to reach −1, where its slope is zero, so the copied net never shut the valve (at least 0.06 open on held-out 0.75→0.15; mean gap 0.0546 where the PI's valve was shut in the copy data). Measured after the change: that gap 0.0187; held-out total IAE 63.49 → 55.21 m·s (fixed PI 58.89, retuned 55.52); training IAE after ES 53.49 → 47.84; in control within 0.0008 m at 0.10 to 1.90 m. The verdict is still No: 1.40→1.90 (6.65 against 5.24) and dist@0.35 (4.54 against 2.96) are more than 5% worse.

## D-019 Vulcan bench plan: the net moves each colonist's needs-ladder lines

- **Status:** Accepted (2026-11-18; amended by D-021 R1, R2, R6, R8; Morgan: "Approved as recommended" on the [final page](https://claude.ai/artifact/NXn8YwE3MfCwxHPPjPvcJt); rounds: [round 1](https://claude.ai/artifact/33G7tNCHcqECgiVCBYNsPz), [review](https://claude.ai/artifact/GUsAa8KHHKnxJFgd7BA73x))
- **Decision:** The first Vulcan test swaps a choice colonists already make (Vulcan has no ambitions yet, V-146). One shared net moves each person's lines on Vulcan's needs ladder (`src/engine/people/mind.ts`: danger, food, drink, warmth, sleep, work, leisure) from their traits, needs, the hour, the season and the stores; never past a warning line, danger stays first (Vulcan V-109). Training: copy today's lines, then ES scored on fewer crisis days (hungry, cold, tired) with output no worse, on month windows from every season, training seeds ledger, gwerin, harrow, cairn, ashford. Vulcan gets a hook with today's lines as the default; the bench, training and report live in Phobos, which pins a Vulcan commit as a dev dependency. A ledger line only where the net differs from today's rule, naming its top inputs as the net's reading. Steps: Vulcan hook, bench runner, copy and evolve, report and verdict. Hard limit: 8 sessions to the first verdict, then stop and decide with Morgan. After the verdict: Soon the in-game switch, the ambitions test (Vulcan P6.4), the work-order swap and Silvanus; Later the Structured Text exporter and Story Generator.
- **Why:** Morgan wants "realistic behavior and not just running around meeting quotas" and to see where the two models diverge. Round 1 scored quotas and picked work order within a level; the review showed that rewards quotas, and that in the bench every job ties at level 3 (Vulcan `work.json` `"start":3`). Story Generator was weighed and put Later: its history works yearly on odds with no number to train against.

## D-020 Vulcan verdict: Morgan's blind pairs and a numbers floor

- **Status:** Accepted (2026-11-18, same approval as D-019; floor amended by D-021 R9)
- **Decision:** Both must pass. (1) Morgan picks the net in at least 16 of 24 blind pairs (A and B unlabelled) of moments where, in shadow mode, the net would choose differently from today's rule. (2) On anvil, smoke, tallow, wren and bryn, full game years, with free runs: food in store at year end, alive at year end and days to each metal-chain first are each no more than 5% worse than today's rule; a first that never happens counts as worst. On No: one fix judged the same way (as D-018), then drop the net and keep today's rule.
- **Why:** shadow mode compares the same moment, where free runs drift apart by chance. Blind stops favouring the new thing. 24 pairs: a coin-flipper reaches 16 of 24 7.6% of the time (12 pairs: 19.4%; binomial, computed 2026-11-18). The floor keeps D-011's 5% rule.

## D-021 Vulcan bench spec approved, with R1 to R10

- **Status:** Accepted (2026-11-18, Morgan: "Approved, start building" and yes to every R-item on the [spec approval page](https://claude.ai/artifact/RdcHFgUYYEeYiudpe247nY))
- **Decision:** [`docs/specs/vulcan-bench.md`](specs/vulcan-bench.md) is the build spec, slices S1 to S4. R1: the copy is a zero output layer, not copy training. R2: each line moves at most 1000 either way (of 10,000), replacing D-019's "never past a warning line". R3: lines once per game hour. R4: window output = food in store and hours worked, each at least 95% of today's. R5: 2 shared windows per generation. R6: the bench reads a Vulcan checkout and checks `vulcan.pin`, replacing D-019's dev dependency. R7: Vulcan-dependent tests run locally (`test:vulcan`), not in CI. R8: the cause line lives in the shadow log; Vulcan's ledger gets it with the in-game switch. R9 (amends D-020's floor): alive no lower than today's; a miss smaller than today's noise band (S2) doesn't count. R10: a table of line offsets by season and trait (70 numbers), trained the same way, enters 12 more blind pairs against today; the net's verdict stays on its 24.
- **Why:** rest's line (2500) is already under its warning line (3000); symmetric bounds leave no tell in blind pairs; the npm route 403s in cloud sessions; one death of 5 is a 20% drop; Phobos AGENTS.md asks every learned block for a plain baseline. Measured 2026-11-18 at Vulcan b08ffba: 54.7 s per seed-year; a mid-year `structuredClone` continues identically.

## D-022 Vulcan noise band measured, and how R9 uses it

- **Status:** Accepted (2026-11-18, S2 build session under coordinator mode: Morgan approved the spec's recommended options in advance, D-021 R9; this entry records the measurement and the reading S2 took of "a miss inside today's noise band")
- **Decision:** Today's noise band is the min and max change from today's year, per floor number, pooled over 15 runs: each held-out seed (anvil, smoke, tallow, wren, bryn) 3 more years, each adding 1000 to the food line of the first, second or third person by id during game day 1 only. Measured at Vulcan `ee016ed` (`vulcan.pin`): food −358 to +258; alive −1 to 0; days to `metal.smelted` −1 to +307, `smithy.built` −1 to +240, `smith.made` −21 to +227 (a first that never happens is day 337). In S4's floor, alive misses when the net's is lower than today's (any amount). Food and the three metal days miss only when both hold: more than 5% worse than today's (D-020's integer rule) **and** worse by more than the band's largest worse-side change (food 358, smelted 307, smithy 240, made 227). Results: [today's numbers page](https://claude.ai/artifact/R3sL3NbtmcQRNu1St5A17n).
- **Why:** R9 says a miss smaller than today's noise band doesn't count; the worse-side extreme of the band is the largest change chance alone produced. Caveat: one day-1 nudge on anvil already moved smelting from day 30 to never and food by −358, so the pooled band is wide and the floor's metal days are weak on fast seeds; S4 should show per-seed changes beside the pooled band so Morgan can see it.

## D-023 Vulcan training score in crisis hours, 4 windows from crisis windows

- **Status:** Accepted 2026-11-18, coordinator under Morgan's pre-approval of recommended options; Morgan may override. Amends the spec's "Training" (R4, R5) for the training score only; the sigma pick is recorded here when the check has run.
- **Decision:** Training windows are drawn only from (seed, month) windows where today's rule has at least one crisis hour; each generation draws 4 windows shared by all members (was 2). Crisis in the training score and in chance (a) counts person-hours: an alive person with food, rest or warmth's `low` flag set at an hour's end, summed over the three needs (was person-days). The score stays crisis × 1000 + (1000 − r) with the R4 penalty unchanged; crisis days (as balance.mjs) stay for the floor and the pages. Chance (a) is re-measured on 5 sets of 4 windows × 3 day-1 nudges. Sigma rule unchanged: at least half the members differ at generation 1 and the best member beats the chance spread in a majority of its 5 generations; smallest such sigma, then the larger final lead, then the smaller alpha. If the net and table full runs would exceed 6 h, generations are cut to fit, saying so.
- **Why:** the first sigma check (S3, 2026-11-18, on person-days and 2 windows) found no setting that beats chance: chance spread 3000, and in 3 of 5 draws today's score was at most 3001, so no member could lead by more (PR #14). Whole days quantise a window to 0 to 3 crisis days. Measured: a 28-day window takes 8 to 10 s mid-year (spec estimate 4.56 s); a 2-window generation 78 to 160 s on 4 workers.
- **Sigma pick, net (2026-11-18, S3, at Vulcan ee016ed):** sigma **1024**, alpha **128**. Chance spread 32001 (`models/vulcan/chance.json`). Every setting had 100% of members differ at generation 1. Best member's lead over today per generation (`models/vulcan/sigma-net.json`): 64/128 18000 30000 29997 47000 21976 (beats 1); 64/512 18000 30993 −45037 44000 45954 (2); 256/128 18000 25000 9000 43000 31951 (1); 256/512 18000 29000 −21000 42985 49972 (2); 1024/128 18000 32996 30998 42985 56956 (3, final lead +12000); 1024/512 18000 50000 43000 46992 71984 (4, final 0). Smallest qualifying sigma is 1024; alpha 128 for its larger final lead. Full runs: 45 generations each (not 50): the mean measured generation, 222.6 s on 4 workers, puts 50 + 50 at 6.3 h, over the 6 h cap (estimate 5.65 h for 45 + 45).
- **Sigma pick, table (2026-11-18, S3, at Vulcan ee016ed):** sigma **64**, alpha **128**. Same chance spread 32001; every setting had 100% of members differ at generation 1. Leads per generation (`models/vulcan/sigma-table.json`): 64/128 18000 37996 −8025 44979 44962 (beats 3, final +9000); 64/512 18000 59000 17999 41999 41987 (3, final +2999); 256/128 (4, +15000); 256/512 (4, +10000); 1024/128 (4, +4000); 1024/512 (4, +23000). All six qualify; the smallest sigma is 64, and alpha 128 for its larger final lead.

## D-024 Vulcan blind pairs, floor and verdict tool (S4)

- **Status:** Accepted 2026-11-19, S4 build session under coordinator mode (Morgan pre-approved the spec's recommended options, D-021). The verdict itself is recorded here once Morgan has rated the pairs and `npm run verdict:vulcan` has run.
- **Decision:** `npm run pairs:vulcan` picks 24 net moments (5, 5, 5, 5, 4) and 12 table moments (3, 3, 2, 2, 2: the first two seeds take the odd ones) from the held-out shadow years by the spec's season cycle, follows today's rule and the policy 6 game hours from each (the moment's own minute, then each clock hour, each followed by ledger lines naming the person), and writes `models/vulcan/pairs.json` with no key. Sides: `makeRng(19)` per net pair, `makeRng(20)` per table pair (policy on A when under 0.5); `makeRng(21)` shuffles all 36 into p01 to p36. `verdict:vulcan` rebuilds the key from those draws alone (`pairKey()`; it depends only on the pair counts), so it needs no Vulcan run. Picks: the report page's `picks` collection, one doc per pair id, `v` A or B, owner-only writes; `picks.json` is the ArtifactData list output saved as is (its text or JSON). Floor: free years today, net and table plus today's noise band rerun on the 5 held-out seeds (`models/vulcan/floor.json`), judged by D-022; the table's floor and its score out of 12 are printed, never judged.
- **Measured (2026-11-19, Vulcan ee016ed):** the noise band rerun equals D-022's. Today's floor numbers equal S2's (anvil food 483, smelted 30, smithy 97, made 110). Net change from today (food, alive, smelted, smithy, made): anvil −203 0 −4 0 +5; smoke −91 0 +2 +2 +4; tallow −144 0 +7 +2 −26; wren +106 0 0 −1 −1; bryn +119 0 +1 +1 +4. Table: anvil −201 0 +3 −7 −15; smoke −11 0 +1 +1 +2; tallow −65 0 +7 +2 −26; wren +139 0 +1 +1 0; bryn +21 0 +5 +6 +7. Floor holds for both on every seed. Caveat: the net's anvil food falls 42% (483 → 280) and tallow's 12%, and they count as holding only because the band's worst food change is 358 (D-022's caveat).
- **Why:** the spec leaves the table's quotas, the shuffle and the pair-text detail open; seeded draws keep the page blind and the verdict reproducible without a rerun.
