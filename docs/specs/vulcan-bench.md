# Vulcan bench: a net that moves each colonist's needs-ladder lines

- **Status:** Draft
- **Planned in:** [round 1](https://claude.ai/artifact/33G7tNCHcqECgiVCBYNsPz), [review](https://claude.ai/artifact/GUsAa8KHHKnxJFgd7BA73x), [final](https://claude.ai/artifact/NXn8YwE3MfCwxHPPjPvcJt), 2026-11-18. **Decisions:** D-019, D-020; D-006 (numbers), D-011 (5% rule), D-013 (local-only browser tests), D-017 (ES settings). Vulcan ids (V-xxx) are in Vulcan's `docs/DECISIONS.md`.

Facts below were measured on 2026-11-18 against Vulcan `b08ffba` (Vulcan `main`) under Node 22.23.5 and 24.19.0, unless marked.

## Problem

Morgan wants Vulcan colonists with "more organic responses and proactive behavior that doesn't just happen because it's next on their list … realistic behavior and not just running around meeting quotas. I want to see where the two models diverge and I will say which is most realistic" (round 1). Today a colonist's minute (`src/engine/people/mind.ts` `think`) is a fixed ladder: danger, feast, food, drink, watch, warmth, sleep, work, leisure. Each rung fires when a need falls under one line that is the same for everyone (`life.json` `seek`), except warmth, which two traits and memories move (`warmLineOf`; V-109 "traits move a person's line"). Vulcan has no ambitions yet (V-146), so Phobos's proactive test can't run; this bench tests the ladder's lines.

## Terms

- **Line:** the need value under which a rung fires. Needs run 0 to 10,000 (`life.json` `scale`). Today: food `seek` 5200, water `seek` 5500, rest `seek` 2500, recreation `seek` 3500; warmth fires under `warmLineOf` (3000, hardy 2400, plus memory points). Warning line (`low`): 3000 for every need.
- **Today's rule:** Vulcan with no hook, or with a hook that returns today's line.
- **Lines (in a check):** the ledger lines `step()` returns, as `tools/balance.mjs` reads them.
- **Ledger and cause line:** Vulcan's event log; a cause line is the "why" a player reads (V-036).
- **Shadow mode:** a run under today's rule where the net's lines are also computed and logged but not used.
- **Moment:** a person-minute in shadow mode where stepping one tick with the net's lines gives a different `doing` from today's rule.
- **Crisis days:** person-days with the need's `low` flag set at any hour, summed over food, rest and warmth (as `balance.mjs` `lowDays`).
- **Window:** 28 game days started from a world cloned at a month start (an hour boundary) of a today's-rule year.
- **Seeds:** Vulcan's `MAP_SEEDS` (`src/engine/map/seeds.ts`), 10. Training: ledger, gwerin, harrow, cairn, ashford. Held out: anvil, smoke, tallow, wren, bryn (D-019, D-020).

## Goals

- Morgan rates 24 blind pairs and `verdict:vulcan` prints D-020's verdict: Yes only if the net is picked in at least 16 of 24 **and** the numbers floor holds on every held-out seed.
- A net whose output layer is zero gives exactly today's trace: the same lines and the same `JSON.stringify(world)` after 3 days on anvil.
- Every bench result names the Vulcan commit it ran on; a rerun at that commit gives the same numbers.
- First verdict within 8 sessions (D-019).

## Non-goals

- No change to play in Vulcan: the hook's default is today's rule; no net ships to Vulcan before a Yes.
- No cause line in Vulcan's ledger, and no change to the warmth explanation in `src/worker/law.ts:109`; both come with the in-game switch (Soon, D-019).
- No work-order swap, ambitions, Silvanus, Story Generator or Structured Text.
- No training in CI; no browser test for the pages.

## Journeys and checks

### J1 The hook changes nothing in play

- **Given** Vulcan at the hook commit
- **When** anvil runs 3 game days with no hook, and again with a hook that returns `today`
- **Then** both give the same lines and world. A hook adding 1500 to food's line changes the person-minutes with `doing === 'eat'`. No file under `src/engine` reads `.seek` from `life.needs` or calls `warmLineOf`, except `people/lines.ts` and `needs/` (where `warmLineOf` lives). **Check:** Vulcan `src/engine/people/lines.test.ts` (3 tests; fail now: no hook); Vulcan `npm run check`.

### J2 The bench measures today's rule as Vulcan does

- **Given** a clean Vulcan checkout at the commit in `vulcan.pin`
- **When** `npm run bench:vulcan -- anvil`
- **Then** it prints `balance.mjs`'s table columns for anvil, then `vulcan <commit>` and `seconds per seed-year <n>`. Alive, hungryDays, tiredDays, coldDays, food and the three metal firsts equal Vulcan `npm run balance -- anvil` (at `b08ffba`: 5, 11, 202, 166, 483, 30, 97, 110; S1 must not change them). With a dirty Vulcan tree or another commit it prints why and exits 1. **Check:** `npm run test:vulcan`: `bench-matches-balance`, `bench-refuses-dirty-or-unpinned` (fail now: no bench).

### J3 Zero net equals today, also after a clone

- **When** anvil runs 3 days with the zero net as the hook; and a world cloned at day 1 with its line cache runs 2 more days beside the original
- **Then** lines and world equal today's rule's; the clone equals the continuous run. **Check:** `test:vulcan`: `zero-net-is-today`, `clone-continues-with-net`.

### J4 Training runs and starts from today

- **When** `npm run train:vulcan`
- **Then** generation 0's score equals today's on the same windows; it logs the score after each generation and writes `models/vulcan/lines.json` (`phobos-weights` v1, meta with the Vulcan commit). **Check:** `test:vulcan` `train-gen0-is-today` (1 generation of 2 members on 2-day windows); `tests/weights.test.ts` meta round trip.

### J5 Morgan judges blind pairs

- **When** `npm run pairs:vulcan` and the report page is published
- **Then** the page shows the floor table, today's noise band and 24 pairs; each pair shows the situation and, for A and B, what the person does over the next 6 game hours; no pair text or page data says which side is the net. Picks save to the page. **Check:** `tests/vulcan-pairs.test.ts` `pairs-are-blind` (pair file has no key field and no "net", "today" or "Phobos" outside colonist names); 400 px screenshot.

### J6 The verdict

- **When** `npm run verdict:vulcan -- picks.json`
- **Then** it prints the net's picks out of 24, each seed's floor result and Yes or No by D-020. **Check:** `tests/vulcan-verdict.test.ts` (15 of 24 → No; 16 → Yes; a seed 6% worse on food → No; a first that never happens counts as day 337).

## Decisions

- One shared net moves five lines per person from traits and state; danger and the rung order are untouched (D-019).
- Verdict: 16 of 24 blind pairs and the 5% floor, both (D-020).
- Hard limit 8 sessions to the first verdict (D-019).
- Proposed here for Morgan: R1 to R10 below.

## Alternatives rejected

- **Work order within a priority level:** rejected by Morgan (review Q1): stays a list; in the bench all 27 jobs tie at level 3 (`work.json` `"start":3`).
- **Two free runs compared moment by moment:** they drift apart by chance (review finding 3). Free runs only for the floor.
- **Training on full years:** 50 generations × 32 members × 2 seed-years × 54.7 s is about 49 h on one CPU (estimate from the measured year). Month windows: about 4.1 h on one CPU, 1.4 h on 3 workers (estimate, measured mean month 4.56 s). Fails when harm shows only after a month; the full-year floor catches that.
- **Copy training (as the Lab's S5):** today's lines are constants per person, so a zero output layer is an exact copy; copy training would only approximate it (D-018).
- **Phobos runtime copied into Vulcan now:** rejected in round 1.
- **Vulcan as a Phobos npm dev dependency (final page):** the install 403s here on Vulcan's own story-generator tarball, and attaching that repo was refused. See R6.
- **One net per person:** 30 times the training (V-027) (review Q8).
- **Net every minute:** 2.4 M passes a year against 40,320 hourly; inputs change slowly (assumption: no rung needs a line that changes within the hour).

## Risks

- A net that buys fewer crisis days by idling → the window output floor (R4) and the full-year floor.
- Chance alone fails the floor (one free run per seed, chaotic sim) → S2 measures today's noise band (R9 asks how to use it).
- "Act earlier everywhere" passes the score but reads as unrealistic → Morgan's pairs decide; R10 offers a hand-written rule to compare.
- Under 24 moments on held-out seeds → S3 counts them; under 24, stop and ask Morgan.
- Overfitting 5 training seeds → verdict on held-out seeds only; settings picked on training score only (as D-017).
- Vulcan moves on → `vulcan.pin`; a new pin is a commit saying why, and reruns J2.
- Training over 2 h → background run, snapshot every 5 generations (D-017 `snapshotEvery`), resume from it.

## Design

**Vulcan hook (S1).**
- `src/engine/people/lines.ts`: `type LineNeed = 'food' | 'water' | 'rest' | 'recreation' | 'warmth'`; `type LineHook = (ctx: SystemContext, p: EntityRow, need: LineNeed, today: number) => number`; `todayLine(ctx, p, need)` is the need's `life.json` `seek`, or `warmLineOf(world, content, p.id)` for warmth; `lineOf(ctx, p, need)` returns `ctx.hooks.line ? ctx.hooks.line(ctx, p, need, todayLine(ctx, p, need)) : todayLine(ctx, p, need)`.
- `Sim` gains `hooks: { line?: LineHook }`, created as `{}` in `createSim` (`src/engine/sim/world.ts`); `contextFor` (`src/engine/sim/system.ts:43`) passes `hooks` into `SystemContext`. `setLineHook(sim, hook | undefined)` sets it, per sim, at any time (takes effect next lookup). Exported from `src/engine/index.ts`; `tools/engine-entry.ts` also exports `setLineHook`, `clockAt` and `hoursOf`.
- Every engine reader calls `lineOf`: `mind.ts:154` (food; a tamer keeps `flock.tame.back`, not hooked), `mind.ts:178` (rest), `mind.ts:196` (recreation), `drink.ts:72` (water when awake; asleep keeps `def.low`, not hooked), `warm.ts:66` (warmth), `feed.ts:21` (food of the person fed, read with that person's row), `dusk.ts:27` and `jobs.ts:252` (recreation), `flee.ts:223` (rest). `src/worker/law.ts:109` stays as is (UI, non-goal).
- Purity (V-006): the engine never imports Phobos. Vulcan `npm run codemap` after `index.ts` changes. The Vulcan PR is merged only after Morgan approves it.

**Reaching Vulcan (S2).** `VULCAN_DIR` (default `../Project-Vulcan`) and a committed `vulcan.pin` with S1's merge commit (full hash). `src/vulcan/engine.ts` imports `${VULCAN_DIR}/tools/engine.mjs`, refuses (exit 1, reason printed) when `git status --porcelain` is non-empty or `HEAD` differs from the pin, and returns the commit for every result. It declares a minimal type for what the bench uses; state is read from `world.entities` as `balance.mjs` does (persons, need rows, items, trait rows `{ person, trait }`). Phobos `tsconfig.json` `include` adds `tests-vulcan`. `docs/vulcan-setup.md` records the cloud install: when Vulcan's `npm ci` 403s, install with story-generator from a local `git archive` of its pinned commit (how this session did it).

**Measures (S2, `src/vulcan/measure.ts`).** The same as `balance.mjs`: alive, low days per need, food in store (items with `good: 'food'`, not held), houses, the six metal firsts. The bench table prints `-` for a first that never happened; the floor counts it as day 337. S2 also logs the yearly maximum of food and firewood in store per alive person on the 5 training seeds, and runs today's **noise band**: each held-out seed again with a hook that adds 1 to one person's food line for the first hour only, reporting each floor number's change.

**Inputs (26, S3, `src/vulcan/inputs.ts`),** per person, taken at the first lookup in each game hour (`hourIndex = floor(tick / 60)`), each as Q12: `floor(value × 4096 / scale)` with integer division, clamped to [0, 4096]:
- needs food, water, rest, warmth, recreation (scale 10,000) (5)
- `doing` is `work`, `sleep`, `relax` (3, 0 or 4096)
- hour of day (scale 24) (1); hour inside `hoursOf(world, content, p.id)` `workFrom` to `workTo` (1, 0 or 4096)
- season one-hot from `clockAt(tick, calendar).season`, order of `calendar.json` `seasons`: spring, summer, autumn, winter (4)
- food and firewood (item kind `firewood`) in store per alive person, scales fixed from S2's logged maxima (2)
- traits: 10 bits in `traits.json` order: hot-tempered, melancholic, restless, greedy, cheerful, steady, sociable, solitary, hardy, devout (10)

**Net (S3).** `randomNet([{ in: 26, out: 16, act: 'tanh' }, { in: 16, out: 5, act: 'tanh' }], 17)` (`src/model/random.ts`), then output layer weights and biases set to 0 (R1); `forward` (`src/runtime/net.ts`). Output order: food, water, rest, recreation, warmth. `Meta` in `src/model/weights.ts` gains optional `vulcan: string` (the commit).

**Lines from outputs (R2, `src/vulcan/lines.ts`).** offset = `shr(output × 1500, 12)` (floor, so −1 stays −1). Each line = today + offset, then: never more than 500 under today, never more than 1500 over; food and water never under `low` (3000); every line in [0, 10,000]. The cache holds the five offsets per `(person, hourIndex)`; while a person's `doing` is `warm`, the warmth offset stays at the value it had when warming began (no flapping between `warm.ts:66` and `:68`). The bench clones the cache with the world.

**Training (S3, `src/vulcan/train.ts`, `scripts/train-vulcan.ts`).** Per training seed, one today's-rule year, keeping the world and cache at each month start. Each generation, a separate rng (`makeRng(18)`) draws 2 windows (seed, month) shared by all 32 members; the main thread sends those 2 worlds to the workers (`src/train/pool.ts` gains a window job; about 11 MB per generation, estimate). Score per member = crisis days summed over both windows; ties broken by higher window output. Window output = food in store at window end and person-minutes with `doing === 'work'`; a member under 95% of today's on either, in either window, scores the generation's worst finite score + 1 (R4). ES as D-017 (50 × 32, sigma 32, alpha 128, centred ranks); before the full run, S3 checks sigma 16/32/64 × alpha 64/128 for 5 generations on training score only and records the pick in DECISIONS (as D-017). Snapshots every 5 generations in `models/vulcan/`.

**Shadow log (S3, `src/vulcan/shadow.ts`).** On a held-out seed, one shadow year. A candidate is a person-hour where some need's value lies between today's line and the net's; confirm by stepping two clones one tick (hook today vs net) and comparing `doing`. Each moment logs person, traits, tick, needs, stores, both `doing`s and the cause line: the 2 inputs that most change the moved line when each is set to 0 and the net rerun (integers), written "<doing>: <input> <value>, <input> <value>" and marked as the net's reading. S3 reports the moment count per seed.

**Pairs, floor and report (S4).** `scripts/pairs-vulcan.ts`: shadow years on all 5 held-out seeds; 24 moments picked round-robin over seeds, then seasons, then people, by `makeRng(19)`; for each, both clones step on 6 game hours and the pair records what the person did each hour (their `doing` and any ledger lines naming them). A/B order by the same rng. `models/vulcan/pairs.json` holds pairs without the key; the key is regenerated from the seed by `verdict:vulcan`. Floor: free full years, today vs net, on the 5 held-out seeds (about 9 min, estimate). Report page: an Artifact with `db` and `user`, collection `picks`, one doc per pair id with `A` or `B`, look from `docs/UI_STYLE.md`; picks exported with an `ArtifactData` list to `picks.json`.

## Slices

### S1 Vulcan line hook

- **Morgan tries:** play a new game in Vulcan; nothing has changed. Approve the Vulcan PR.
- **Checks that fail now:** J1.
- **Files (Vulcan):** `src/engine/people/lines.ts`, `lines.test.ts`; `src/engine/sim/world.ts`, `system.ts`; the nine readers listed in Design; `src/engine/index.ts`, `tools/engine-entry.ts`; `src/engine/people/MODULE.md`; code map.
- **Waits on:** none.

### S2 Bench runner and today's numbers page

- **Morgan tries:** a page with today's numbers on all 10 seeds, seconds per seed-year and today's noise band.
- **Checks that fail now:** J2.
- **Files (Phobos):** `vulcan.pin`; `src/vulcan/engine.ts`, `measure.ts`; `scripts/bench-vulcan.ts` (`--html <path>` writes the page); `package.json` `bench:vulcan`, `test:vulcan` (`node --test "tests-vulcan/**/*.test.ts"`, local only, R7); `tests-vulcan/bench.test.ts`; `tsconfig.json`; `docs/vulcan-setup.md`; `AGENTS.md` local checks; DECISIONS: R-items Morgan approved.
- **Waits on:** S1 merged.

### S3 Line net, training and moment count

- **Morgan tries:** a page with the training score per generation and the moment count on each held-out seed.
- **Checks that fail now:** J3, J4; `tests/vulcan-lines.test.ts` (input encoding, bounds, warm freeze, cache key) in `npm run check`.
- **Files:** `src/vulcan/inputs.ts`, `lines.ts`, `train.ts`, `shadow.ts`; `src/train/pool.ts`; `src/model/weights.ts`; `scripts/train-vulcan.ts`; `models/vulcan/lines.json`; `tests-vulcan/zero-net.test.ts`, `train.test.ts`; `tests/vulcan-lines.test.ts`; `package.json` `train:vulcan`; DECISIONS: ES pick.
- **Waits on:** S2.

### S4 Pairs, report and verdict

- **Morgan tries:** the report page: rate 24 pairs.
- **Checks that fail now:** J5, J6.
- **Files:** `src/vulcan/pairs.ts`, `verdict.ts`; `scripts/pairs-vulcan.ts`, `verdict-vulcan.ts`; `models/vulcan/pairs.json`; `tests/vulcan-pairs.test.ts`, `tests/vulcan-verdict.test.ts`; `package.json` `pairs:vulcan`, `verdict:vulcan`; DECISIONS: the verdict as the next free D number.
- **Waits on:** S3.

## Verification

- Every push: Phobos `npm run check` (budget 10 s; Vulcan-free unit tests only). S1: Vulcan `npm run check`.
- Vulcan-dependent: `npm run test:vulcan` before a PR is marked ready, Vulcan at the pin (local only, like D-013).
- End to end: Morgan's picks and `npm run verdict:vulcan`.

## Reconcile with D-019 and D-020 (Morgan decides each)

- **R1 Copy:** "copy today's lines" becomes a zero output layer: exact, no copy training.
- **R2 Warning lines:** "never past a warning line" can't hold for rest (line 2500, already under its warning line 3000). Instead: each line at most 500 under today and 1500 over; food and water never under 3000.
- **R3 Hourly:** lines once per game hour, cached and cloned with the world.
- **R4 Window output:** "output no worse" in a window = food in store at its end and work person-minutes, each at least 95% of today's.
- **R5 Windows:** 2 shared windows per generation; about 1.4 h on 3 workers (estimate).
- **R6 Reaching Vulcan:** a checkout path plus a committed pin file instead of a dev dependency (the npm route 403s here); the pin still names the commit.
- **R7 Tests:** Vulcan-dependent tests local only (`test:vulcan`); Phobos CI has no Vulcan.
- **R8 Cause line:** in the shadow log only; Vulcan's ledger gets it with the in-game switch.
- **R9 Floor and chance (critic, high):** one free run per seed is noisy; losing one of 5 people is a 20% drop. Proposal: alive must be no lower than today's; the other numbers keep the 5% rule, but a miss inside today's noise band (S2) doesn't count as a miss. This changes D-020.
- **R10 A hand-written rival (critic, high):** add a plain rule, for example "lines 500 higher in autumn and winter, hardy people's warmth line 500 lower", scored and shown the same way, so the pairs show whether the net beats a simple idea and not only today's rule. Costs about one session. Phobos AGENTS.md asks for "a plain baseline"; today's rule is that baseline (CONCEPT.md "Proactive"), so this is optional.

## Open questions

- Whether 24 moments exist on the held-out seeds (S3 counts).
