# Vulcan bench: a net that moves each colonist's needs-ladder lines

- **Status:** Draft
- **Planned in:** [round 1](https://claude.ai/artifact/33G7tNCHcqECgiVCBYNsPz), [review](https://claude.ai/artifact/GUsAa8KHHKnxJFgd7BA73x), [final](https://claude.ai/artifact/NXn8YwE3MfCwxHPPjPvcJt), 2026-11-18. **Decisions:** D-019, D-020; D-006 (numbers), D-011 (5% rule), D-013 (local-only browser tests), D-017 (ES settings).

Facts below were measured on 2026-11-18 against Vulcan `b08ffba` (Vulcan `main`), unless marked.

## Problem

Morgan wants Vulcan colonists with "more organic responses and proactive behavior that doesn't just happen because it's next on their list … realistic behavior and not just running around meeting quotas. I want to see where the two models diverge and I will say which is most realistic" (round 1). Today a colonist's minute (`src/engine/people/mind.ts` `think`) is a fixed ladder: danger, feast, food, drink, watch, warmth, sleep, work, leisure. Each rung fires when a need crosses one line that is the same for everyone (`life.json` `seek`), except warmth, which traits and memories move (`warmLineOf`, V-109). Vulcan has no ambitions yet (V-146), so Phobos's proactive test can't run; this bench tests the ladder's lines instead.

## Terms

- **Line:** the need value below which a rung fires. Needs run 0 to 10,000 (`life.json` `scale`). Today: food `seek` 5200, water `seek` 5500, rest `seek` 2500, recreation `seek` 3500; warmth fires below `warmLineOf` (3000, hardy 2400, plus memory points). Warning line (`low`): 3000 for every need.
- **Today's rule:** Vulcan with no hook, or with a hook that returns today's line.
- **Shadow mode:** a run under today's rule where the net's lines are also computed every game hour and logged, but not used.
- **Moment:** a person-minute in shadow mode where stepping the same world one tick with the net's lines gives a different `doing` from today's rule.
- **Crisis days:** person-days with the need's `low` flag set at any hour, for food, rest and warmth (the same count as `tools/balance.mjs` `lowDays`).
- **Window:** 28 game days (one month) started from a world copied at a month start of a today's-rule year.

## Goals

- Morgan rates 24 blind pairs of moments and the bench prints the D-020 verdict: Yes only if the net is picked in at least 16 of 24 **and** no held-out seed is more than 5% worse on food at year end, alive at year end, or days to each metal-chain first (`metal.smelted`, `smithy.built`, `smith.made`).
- A net whose output layer is zero gives exactly today's trace (bit-identical lines and world after 3 days on anvil).
- Every bench result names the Vulcan commit it ran on, and a rerun at that commit gives the same numbers.
- First verdict within 8 sessions (D-019).

## Non-goals

- No change to play in Vulcan: the hook's default is today's rule, and no net ships to Vulcan before a Yes.
- No ledger line in Vulcan yet. The cause line exists in the shadow log; putting it in Vulcan's ledger is part of the in-game switch (Soon, D-019).
- No work-order swap, ambitions, Silvanus, Story Generator or Structured Text (D-019's Soon and Later).
- No training in CI; no browser test for the report page.

## Journeys and checks

### J1 The hook changes nothing in play

- **Given** Vulcan at the hook commit
- **When** anvil runs 3 game days with no hook, and again with a hook that returns `today`
- **Then** both give the same lines and the same `JSON.stringify(world)`. With a hook that adds 1500 to food's line, the person-minutes with `doing === 'eat'` differ. **Check:** Vulcan test `src/engine/people/lines.test.ts` (fails now: no hook exists); Vulcan `npm run check`.

### J2 The bench measures today's rule the same way Vulcan does

- **Given** a clean Vulcan checkout at the commit in `vulcan.pin`
- **When** `npm run bench:vulcan -- --seeds anvil`
- **Then** its row matches Vulcan `npm run balance -- anvil` on alive, hungryDays, tiredDays, coldDays, food and the three metal firsts (at `b08ffba`: 5, 11, 202, 166, 483, 30, 97, 110), and it prints the Vulcan commit and seconds per seed-year. With a dirty Vulcan tree or another commit it refuses and says why. **Check:** `npm run test:vulcan` test `bench-matches-balance` (fails now: no bench).

### J3 Zero net equals today

- **Given** the line net with its output layer set to zero
- **When** anvil runs 3 days with the net as the hook
- **Then** lines and world equal today's rule's. **Check:** `npm run test:vulcan` test `zero-net-is-today`.

### J4 Training improves crisis days without losing output

- **Given** the zero net and the 5 training seeds
- **When** `npm run train:vulcan`
- **Then** it logs the training score at generation 0 (equal to today's on the same windows) and after each generation, and writes `models/vulcan/lines.json` (`phobos-weights` v1). **Check:** the log; `models/vulcan/lines.json` exists and its meta names the Vulcan commit.

### J5 Morgan judges blind pairs

- **Given** the trained net
- **When** `npm run pairs:vulcan` and the report page is published
- **Then** the page shows the numbers-floor table and 24 pairs, each with situation, A and B, and no word saying which is the net; Morgan's picks save to the page. **Check:** unit test `pairs-are-blind` (no pair text contains "net", "today" or "Phobos"); 400 px screenshot.

### J6 The verdict

- **When** `npm run verdict:vulcan -- <picks.json>`
- **Then** it prints picks for the net out of 24, each seed's floor result, and Yes or No by D-020. **Check:** unit test `verdict-rule` on built picks (15 of 24 → No; 16 → Yes; a seed 6% worse → No).

## Decisions

- One shared net moves five lines per person (food, water, rest, recreation, warmth) from traits and state; danger and the rung order are untouched (D-019).
- Verdict: 16 of 24 blind pairs and the 5% floor, both (D-020).
- Hard limit 8 sessions to the first verdict (D-019).
- Proposed in this spec (reconcile items R1 to R8 below; Morgan decides each): zero output layer as the copy; per-line bounds; lines once per game hour; output floor in windows; two shared windows per generation; Vulcan reached by checkout path and pin file; Vulcan-dependent tests local only; cause line in the shadow log only.

## Alternatives rejected

- **Work order within a priority level as the swap:** rejected by Morgan (review Q1): it stays a list, and in the bench all 27 jobs tie at level 3 (`work.json` `"start":3`). Fails the goal "not just next on their list".
- **Two free runs compared moment by moment:** rejected (review finding 3): once one choice differs the runs drift apart by chance. Free runs are used only for the numbers floor.
- **Training on full years:** 50 × 32 × 2 runs at 54.7 s is about 49 h on one CPU (estimate from the measured year). Windows of a month cost about 4.1 h on one CPU, 1.4 h on 3 workers (estimate, measured 4.56 s mean month). Fails when a net's harm shows only after a month; the full-year floor catches that.
- **Copy training on today's lines (as the Lab's S5):** today's lines are constants per person, so a zero output layer is an exact copy with no training and no error. Copy training would fail by being approximate (D-018 showed a copied net can miss an end of its range).
- **Phobos runtime copied into Vulcan now:** rejected in round 1: code in Vulcan before we know it helps.
- **A Vulcan commit as a Phobos npm dev dependency (approved in the final page):** the install fails in cloud sessions: npm gets 403 for Vulcan's own story-generator tarball from codeload.github.com, and attaching that repo was refused here. See R6.
- **One net per person:** rejected (review Q8): 30 times the training (V-027) for differences traits already give.
- **Net run every minute:** 5 people × 1,440 minutes × 336 days is 2.4 M passes a year; inputs change slowly, so once per game hour (40,320 passes a year) loses little. Assumption: no rung needs a line that changes within the hour.

## Risks

- A net that buys fewer crisis days by idling → the window output floor (R4) and the full-year floor.
- Few moments: if lines rarely straddle a need value, there may be under 24 moments → S4 counts moments first; with fewer than 24 it stops and asks Morgan.
- Overfitting 5 training seeds → verdict only on held-out seeds; ES settings picked on training score only (as D-017).
- Vulcan moves on → `vulcan.pin` fixes the commit; a new pin is a commit that says why, and reruns the J2 check.
- Training runtime over 2 h → run in the background with snapshots every 5 generations (D-017 `snapshotEvery`); resume from the last snapshot.
- Session limit → the 8-session limit; at the limit stop and ask.

## Design

**Vulcan hook (Vulcan repo).**
- New `src/engine/people/lines.ts`: `export type LineHook = (ctx: SystemContext, p: EntityRow, need: LineNeed, today: number) => number;` with `LineNeed = 'food' | 'water' | 'rest' | 'recreation' | 'warmth'`, and `lineOf(ctx, p, need, today)` returning `hook ? hook(ctx, p, need, today) : today`.
- `Sim` gains `hooks: { line?: LineHook }` (empty by default) and `SystemContext` gains `hooks` passed from it; `setLineHook(sim, hook | undefined)` exported from `src/engine/index.ts` and `tools/engine-entry.ts`.
- Callers read through `lineOf`: `mind.ts` (food `seek`, keeping the tamer's `flock.tame.back` as today's value; rest `seek`; recreation `seek`), `drink.ts` line 72 (water `seek` when awake; asleep stays `def.low`), `warm.ts` line 66 (`warmLineOf` result). Nothing else changes.
- Purity (V-006): the engine never imports Phobos; the hook is a function the caller passes. Vulcan `npm run codemap` after `index.ts` changes.

**Reaching Vulcan (Phobos).** `VULCAN_DIR` (default `../Project-Vulcan`) and a committed `vulcan.pin` holding the full commit hash. The bench imports `${VULCAN_DIR}/tools/engine.mjs` (Vulcan's Vite runner; works under Node 22.23.5 and 24.19.0, checked), refuses when `git status --porcelain` is non-empty or `HEAD` differs from the pin, and writes the commit into every result. A minimal type for what it uses lives in `src/vulcan/engine.ts` (Phobos `tsc` doesn't read Vulcan). Cloud setup when Vulcan's `npm ci` gets 403: install with story-generator from a local `git archive` of its pinned commit (how this session did it; documented in `docs/vulcan-setup.md`).

**Inputs (26, Q12 int16, D-006),** per person, read once per game hour, each in [0, 1]:
- needs food, water, rest, warmth, recreation: value / 10,000 (5)
- `doing` is `work`, `sleep`, `relax` (3, each 0 or 1)
- hour of day / 24 (1); inside the person's working hours, from `hoursOf` (1)
- season one-hot from `clockAt(tick, calendar).season`, order of `calendar.json` `seasons`: spring, summer, autumn, winter (4)
- food in store per person / 100 and firewood in store per person / 20, each clamped to 1 (2). Assumption: these scales; the builder logs the year's maximum on the 5 training seeds in S2 and the spec's owner fixes them before S3.
- traits: 10 bits in `traits.json` order: hot-tempered, melancholic, restless, greedy, cheerful, steady, sociable, solitary, hardy, devout (10)

S1 also exports `clockAt` and `hoursOf` from `tools/engine-entry.ts` for the bench.

**Net:** dense 26 → 16 tanh → 5 tanh, `phobos-weights` v1 (`src/model/weights.ts`), run with `src/runtime/net.ts` `forward`. Hidden layer from Phobos's seeded RNG, seed 17; output layer weights and biases all 0 (the copy, R1).

**Lines from outputs (R2):** offset = output (−4096 … 4096 in Q12) × 1500 / 4096, integer floor division as `shr`. Then: food and water lines = today + offset, never below `low` (3000); rest and recreation = today + offset; warmth = today + offset, never below today (the net may only make someone act on cold earlier); every line clamped to [0, 10,000]. Cached per person per game hour (R3).

**Training (`scripts/train-vulcan.ts`, `src/vulcan/train.ts`):** for each training seed (ledger, gwerin, harrow, cairn, ashford), one today's-rule year with a `structuredClone` of the world at each of the 12 month starts (checked: a clone at day 28 continues identically for 7 days, also with a fresh sim; clone 7 ms; world 5,734 KB). Each generation draws 2 windows (seed and month, from the ES rng) shared by all 32 members (R5). Score per window, lower is better: crisis days; a member whose window output is under 95% of today's on that window scores as the worst in the generation (R4). Window output: food in store at window end and person-minutes with `doing === 'work'`, each against today's. ES as D-017: 50 generations of 32, sigma 32, alpha 128, centred ranks, `src/train/pool.ts` workers. Snapshot every 5 generations to `models/vulcan/`.

**Shadow log and pairs (`scripts/pairs-vulcan.ts`):** on the 5 held-out seeds (anvil, smoke, tallow, wren, bryn), one shadow year each. A candidate is a person-hour where some need's value lies between today's line and the net's; confirm it by stepping two clones one tick (hook today vs net) and comparing `doing`. Log each moment with person, traits, tick, needs, stores, both `doing`s and the cause line "<doing>: <top 2 inputs by |weight × input| through the net>" labelled as the net's reading (V-036 form, not in Vulcan's ledger). Pick 24 by a seeded sample spread over seeds, seasons and people; A/B order by a seeded coin. The answer key is regenerated from the seed, never shown on the page.

**Numbers floor:** free full years, today vs net, on the 5 held-out seeds (about 9 min, estimate from 54.7 s per year). A metal first that never happens counts as day 337 (worst). Each value per seed may be at most 5% worse (alive: lower is worse; days: higher is worse; food: lower is worse).

**Report page:** an Artifact with `db` and `user`; collection `picks`, one doc per pair id with `A` or `B`. The floor table, then pairs. Built from `planning-interview`'s form template look (`UI_STYLE.md` tokens). Picks exported with `ArtifactData list` to `picks.json` for the verdict script.

## Slices

### S1 Vulcan line hook

- **Morgan tries:** play a new game in Vulcan; nothing has changed.
- **Checks that fail now:** J1.
- **Files:** Vulcan `src/engine/people/lines.ts` and `lines.test.ts`: the hook and J1. `src/engine/sim/world.ts`, `system.ts`: `hooks` on Sim and SystemContext. `mind.ts`, `drink.ts`, `warm.ts`: read through `lineOf`. `src/engine/index.ts`, `tools/engine-entry.ts`: export `setLineHook`. `MODULE.md` and code map. Vulcan PR on its own branch; its CI runs when marked ready (Vulcan AGENTS.md).
- **Waits on:** none.

### S2 Bench runner and today's numbers page

- **Morgan tries:** a page with today's numbers for all 10 seeds and the seconds per seed-year.
- **Checks that fail now:** J2.
- **Files:** Phobos `vulcan.pin`; `src/vulcan/engine.ts` (load, pin check, types); `src/vulcan/measure.ts` (balance measures); `scripts/bench-vulcan.ts`; `package.json` scripts `bench:vulcan`, `test:vulcan` (runs `tests-vulcan/**/*.test.ts`, local only, R7); `tests-vulcan/bench.test.ts`; `docs/vulcan-setup.md`; AGENTS.md local checks line.
- **Waits on:** S1 merged (the pin points at it).

### S3 Line net and training

- **Morgan tries:** a page with the training score per generation and how many shadow moments the net makes on one held-out seed.
- **Checks that fail now:** J3, J4; unit tests `tests/vulcan-lines.test.ts` (inputs encoding, line bounds, hourly cache) in `npm run check`.
- **Files:** `src/vulcan/inputs.ts`, `src/vulcan/lines.ts` (net to lines, hook), `src/vulcan/train.ts`, `scripts/train-vulcan.ts`, `models/vulcan/lines.json`, `tests-vulcan/zero-net.test.ts`, `package.json` `train:vulcan`.
- **Waits on:** S2.

### S4 Pairs, report and verdict

- **Morgan tries:** the report page: rate 24 pairs.
- **Checks that fail now:** J5, J6.
- **Files:** `src/vulcan/shadow.ts`, `src/vulcan/verdict.ts`, `scripts/pairs-vulcan.ts`, `scripts/verdict-vulcan.ts`, `tests/vulcan-verdict.test.ts`, `tests/vulcan-pairs.test.ts`; DECISIONS D-0xx with the verdict.
- **Waits on:** S3.

## Verification

- Every push: Phobos `npm run check` (budget 10 s; Vulcan-free unit tests only).
- Vulcan-dependent: `npm run test:vulcan` before a PR is marked ready, with Vulcan at the pin (local only, like D-013). Vulcan's own `npm run check` for S1.
- End to end: Morgan's picks on the report page and `npm run verdict:vulcan`.

## Reconcile with D-019 and D-020 (Morgan decides each)

- **R1 Copy:** D-019 says "copy today's lines". Spec: a zero output layer is the exact copy, no copy training.
- **R2 Warning lines:** D-019 says "never past a warning line". Rest's line (2500) is already below its warning line (3000), so the spec bounds each line instead: ±1500, food and water never below 3000, warmth only earlier.
- **R3 Hourly:** lines computed once per game hour, not per minute (addition).
- **R4 Window output:** "output no worse" defined for a month window as food in store at window end and work person-minutes, each at least 95% of today's (addition).
- **R5 Windows per generation:** 2 shared windows; estimate 1.4 h on 3 workers (addition).
- **R6 Reaching Vulcan:** D-019 says "pins a Vulcan commit as a dev dependency". Spec: a checkout path plus a committed pin file, because the npm route fails here (403); the pin still names the exact commit.
- **R7 Tests:** Vulcan-dependent tests run locally in `test:vulcan`, not in CI (addition; Phobos CI has no Vulcan).
- **R8 Cause line:** D-019 says "a ledger line only where the net differs". Spec: the line lives in the shadow log; Vulcan's ledger gets it with the in-game switch (Soon).

## Open questions

- Store scales for the two store inputs (S2 logs the maxima).
- Whether 24 moments exist on the held-out seeds (S4 counts first).
