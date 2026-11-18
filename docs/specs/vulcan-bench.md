# Vulcan bench: a net that moves each colonist's needs-ladder lines

- **Status:** Approved 2026-11-18 ([approval page](https://claude.ai/artifact/RdcHFgUYYEeYiudpe247nY); R1 to R10 approved as written, D-021)
- **Planned in:** [round 1](https://claude.ai/artifact/33G7tNCHcqECgiVCBYNsPz), [review](https://claude.ai/artifact/GUsAa8KHHKnxJFgd7BA73x), [final](https://claude.ai/artifact/NXn8YwE3MfCwxHPPjPvcJt), 2026-11-18. **Decisions:** D-019, D-020, D-021; D-006 (numbers), D-011 (5% rule), D-013 (local-only browser tests), D-017 (ES settings). Vulcan ids (V-xxx) are in Vulcan's `docs/DECISIONS.md`.

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
- **Crisis days:** person-days of alive people with the need's `low` flag set at any hour, summed over food, rest and warmth (as `balance.mjs` `lowDays`, which counts only rows that exist, so the dead drop out).
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
- The line cache lives outside Vulcan's world, which is fine for the bench; the in-game switch must keep it in the world so saves replay (GAME-01).
- No work-order swap, ambitions, Silvanus, Story Generator or Structured Text.
- No training in CI; no browser test for the pages.

## Journeys and checks

### J1 The hook changes nothing in play

- **Given** Vulcan at the hook commit
- **When** anvil runs 3 game days with no hook, and again with a hook that returns `today`
- **Then** both give the same lines and world. A hook adding 1500 to food's line gives a different count of person-minutes with `doing === 'eat'` (stepping one tick at a time). No file under `src/engine` reads `.seek` from `life.needs` or calls `warmLineOf`, except `people/lines.ts` and `needs/` (where `warmLineOf` lives). **Check:** Vulcan `src/engine/people/lines.test.ts`: `today-hook-is-no-hook`, `food-hook-changes-eating`, `lines-only-reader` (scans non-test `.ts` files under `src/engine`, skipping comments, for `.seek` and for calls `warmLineOf(`; allowed: `people/lines.ts`, `needs/`, and import or export lines); fail now: no hook. Vulcan `npm run check`.

### J2 The bench measures today's rule as Vulcan does

- **Given** a clean Vulcan checkout at the commit in `vulcan.pin`
- **When** `npm run bench:vulcan -- anvil`
- **Then** it prints `balance.mjs`'s 14 table columns and its metal-chain line for anvil, then `vulcan <full hash>` and `seconds per seed-year <n>`. Alive, hungryDays, tiredDays, coldDays, food, `metal.smelted`, `smithy.built` and `smith.made` equal Vulcan `npm run balance -- anvil` (at `b08ffba`: 5, 11, 202, 166, 483, 30, 97, 110; S1 must not change them; the test compares with these constants, re-measured once at the pin). With a dirty Vulcan tree or another commit it prints why and exits 1. **Check:** `npm run test:vulcan`: `bench-matches-balance`; `bench-refuses-dirty-or-unpinned` (with `VULCAN_DIR` at a `git clone --shared` copy in a temp folder, checked out one commit back, then with an extra file); fail now: no bench.

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
- R1 to R10 below, approved (D-021).

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
- Every engine reader calls `lineOf`: `mind.ts:154` (food; a tamer keeps `flock.tame.back`, not hooked), `mind.ts:178` (rest), `mind.ts:196` (recreation), `drink.ts:72` (water when awake; asleep keeps `def.low`, not hooked), `warm.ts:66` (warmth), `feed.ts:21` (food of the person fed, read with that person's row), `dusk.ts:27` and `jobs.ts:252` (recreation), `flee.ts:223` (rest). `feed.ts` `hungry(ctx, person)` looks up the person's row (`entityOf`) and keeps today's fallback when the need row is missing; `flee.ts` `restSeek(ctx)` becomes `restSeek(ctx, p)` and its callers (`flee.ts:255`, `:266`) pass the person. Readers of a `low` (warning) line, such as `tend.ts:49`, `needs.ts:164` and `eat.ts:32`, stay as they are: warning lines don't move. Tests that build a `SystemContext` by hand add `hooks: {}`. `src/worker/law.ts:109` stays as is (UI, non-goal).
- Purity (V-006): the engine never imports Phobos. Vulcan `npm run codemap` after `index.ts` changes. The Vulcan PR is merged only after Morgan approves it.

**Reaching Vulcan (S2).** `VULCAN_DIR` (default `../Project-Vulcan`) and a committed `vulcan.pin` with S1's merge commit (full hash). `src/vulcan/engine.ts` imports `${VULCAN_DIR}/tools/engine.mjs`, refuses (exit 1, reason printed) when `git status --porcelain` is non-empty or `HEAD` differs from the pin, and returns the commit for every result. It declares a minimal type for what the bench uses; state is read from `world.entities` as `balance.mjs` does (persons, need rows, items, trait rows `{ person, trait }`). Phobos `tsconfig.json` `include` adds `tests-vulcan`. `docs/vulcan-setup.md` records the cloud install when Vulcan's `npm ci` 403s: clone story-generator read-only, fetch Vulcan's pinned commit (`package-lock.json` `node_modules/story-generator` `resolved`), `git archive` it to a folder; in a scratch copy of Vulcan's `package.json` and lockfile, point `story-generator` at `file:<folder>` and drop its lock entry; `npm install --install-links --ignore-scripts`; copy `node_modules` into Vulcan (git-ignored). Vulcan's tracked files are untouched.

**Measures (S2, `src/vulcan/measure.ts`).** All 14 `balance.mjs` columns and the six metal firsts, computed the same way (stepping 60 ticks, reading `world.entities` at each hour's end). The table prints `-` for a first that never happened; the floor counts it as day 337. S2 writes the yearly maximum of food and firewood (item kind `firewood`) in store per alive person over the 5 training seeds into `src/vulcan/scales.ts` (committed constants, rounded up to a multiple of 10). "In store" is as `balance.mjs` counts goods: items with no holder; per alive person by integer division. **Noise band:** each held-out seed 3 more times, each with a hook adding 1000 to the food line of the first, second or third person (by id) during game day 1 only (the test asserts the world differs from today's at day 2; if not, S2 widens to days 1 to 3 and says so); the band per floor number is the min and max change from today's run (15 runs, about 14 min, estimate). **Cloning:** `src/vulcan/clone.ts` `cloneRun({ world, cache })` = `structuredClone` of both (S2 adds it with an empty cache; S3 fills the cache).

**Inputs (26, S3, `src/vulcan/inputs.ts`),** per person, taken at the first lookup for that person in each game hour (`hourIndex = floor(tick / 60)`; the lookup may come from another person's `think`, as in `feed.ts`, which is fine: it is deterministic). `inputs.ts` takes plain numbers and imports nothing from Vulcan, so its tests run in `npm run check`; `lines.ts` reads the world (with `clockAt`, `hoursOf`) and passes them in. Each input is Q12: `floor(value × 4096 / scale)` with integer division, clamped to [0, 4096]:
- needs food, water, rest, warmth, recreation (scale 10,000) (5)
- `doing` is `work`, `sleep`, `relax` (3, 0 or 4096)
- hour of day (scale 24) (1); hour inside `hoursOf(world, content, p.id)` `workFrom` to `workTo` (1, 0 or 4096)
- season one-hot from `clockAt(tick, calendar).season`, order of `calendar.json` `seasons`: spring, summer, autumn, winter (4)
- food and firewood in store per alive person, scales from `src/vulcan/scales.ts` (S2) (2)
- traits: 10 bits in `traits.json` order: hot-tempered, melancholic, restless, greedy, cheerful, steady, sociable, solitary, hardy, devout (10)

**Net (S3).** `randomNet([{ in: 26, out: 16, act: 'tanh' }, { in: 16, out: 5, act: 'tanh' }], 17)` (`src/model/random.ts`), then output layer weights and biases set to 0 (R1); `forward` (`src/runtime/net.ts`). Output order: food, water, rest, recreation, warmth. `Meta` in `src/model/weights.ts` gains optional `vulcan: string` (the commit).

**Lines from outputs (R2, `src/vulcan/lines.ts`).** Each line = today + offset, with offset = `shr(output × 1000, 12)` (floor, so −1 stays −1), so within ±1000 either way (symmetric, so a pair's earlier side isn't always the net's), then clamped to [0, 10,000]. Food and water can't reach their warning line 3000 (5200 − 1000, 5500 − 1000). The cache is a `Map` keyed `person`, holding `{ hourIndex, offsets[5], warmOffset }`; a lookup in a new hour recomputes `offsets`. The cache also keeps `lastDoing` per person, updated at each lookup; `warmOffset` is the warmth offset at the first lookup where `doing === 'warm'` and `lastDoing` wasn't (`warming()` sets `doing` after the `warm.ts:66` lookup), and is used while `doing === 'warm'`; once `doing` is anything else the hour's offset applies again (no flapping between `warm.ts:66` and `:68`). `cloneRun` copies the cache with the world.

**Training (S3, `src/vulcan/train.ts`, `scripts/train-vulcan.ts`).** At start, per training seed, one today's-rule year (about 4.6 min for 5 seeds, estimate), keeping `cloneRun` copies at each month start in the main thread (60 worlds, about 340 MB, estimate) and today's window results. `train.ts` runs its own loop from `makeGauss`, `perturb` and `update` (`src/train/es.ts`), not `esGeneration`, which ranks inside (`es.ts:88`) and can't take tied ranks; windows change each generation. Each generation, `makeRng(18)` draws 2 windows (seed, month) shared by all 32 members; the main thread posts those 2 worlds (structured clone) with each member's parameters to the workers; each worker loads Vulcan once through `src/vulcan/engine.ts` (`src/train/pool.ts` gains a `window` job: `{ worlds, theta } → { crisis, food, work }` per window). Crisis days count alive people only. Work = person-hours with `doing === 'work'` at hour ends. Score (lower is better, one integer per member): `crisis × 1000 + (1000 − r)`, where `r` is the lower of food‰ and work‰ against today's over both windows, clamped to [0, 999]. A member with `r` under 950 (95%) scores the generation's worst unpenalised score (0 if all are penalised) + 1000 + (1000 − r), so harmful members still rank among themselves (R4). Equal scores share their mean rank (`centredRanksTied` in `src/vulcan/train.ts`; the Lab's `centredRanks` keeps index order on ties, `es.ts:47`, which would bias antithetic pairs, and stays unchanged for the Lab). Workers: a separate `src/vulcan/pool.ts` (the Lab's `pool.ts` imports Lab code), each worker loading Vulcan once through `src/vulcan/engine.ts`; S3 measures worker start-up and the per-generation post time and logs them. **Before the full run, S3 measures two things on training score only:** (a) the score spread of today's rule plus the noise band's day-1 hook on 10 windows (chance); (b) at generation 1, the share of members whose windows differ from today's at all. With D-017's sigma 32, a weight moves about 32 / 2^14 ≈ 0.002 (`quantise.ts` shift 14) and a line about 10 to 50 points (critic estimate), so most members may replay today exactly. The sigma check therefore covers 64, 256 and 1024 with alpha 128 and 512, for 5 generations each, and picks the smallest sigma where at least half the members differ and the best member beats (a)'s spread. If no setting does, or 2 windows per generation are inside (a)'s spread, S3 stops and asks Morgan (more windows cost time: 4 windows ≈ 2.8 h on 3 workers, estimate). ES otherwise as D-017 (50 × 32, antithetic). The log line per generation gives the mean member score and the current theta's score on that generation's windows. The settings picked go into DECISIONS (as D-017). Snapshots every 5 generations in `models/vulcan/`.

**Shadow log (S3, `src/vulcan/shadow.ts`).** On a held-out seed, one shadow year, with a record-only hook: it fills the cache exactly as the net hook does (same hour-start rules) but returns today's line; minute clones copy that cache. A candidate is a person-hour where, at the hour's start, some need's value lies between today's line and the net's. Confirm it minute by minute through that hour: clone, step one tick with hook today and with the net, compare `doing`; the first differing minute is the moment (none: not a moment). Each moment logs person, traits, tick, needs, stores, both `doing`s and the cause line: the inputs (up to 2) whose setting to Q12 0 changes the moved line most (the moved line: the one whose straddle made the candidate, lowest output index if several), net rerun in integers, ties to the lower input index, written "<doing>: <input name> <value in real units: needs in %, hour as hh:00, stores as counts, traits and flags as yes/no>, …" and marked as the net's reading. `scripts/train-vulcan.ts --html <path>` writes the S3 page: score per generation and moment count per held-out seed.

**Pairs, floor and report (S4).** `scripts/pairs-vulcan.ts`: shadow years on all 5 held-out seeds. Pick 24 moments: 5, 5, 5, 5, 4 from anvil, smoke, tallow, wren, bryn; within a seed, cycle the seasons spring to winter, each time taking the earliest unused moment of a person not yet used in that seed, else the earliest unused moment; a season with none is skipped. Then one `makeRng(19)` draw per pair, in pair order, sets A/B. For each, both clones step on 6 game hours and the pair records, at each clock hour after the moment, "hh:00 <doing>", followed by the text of any ledger line whose data names the person's id. `situation` is "<name> (<traits>), <season> day <d> hh:mm: food <%>, water <%>, rest <%>, warmth <%>, recreation <%>; store food <n>, firewood <n>". Ties for "earliest" go to the lower person id; the season cycle continues after a skip; a seed short of its quota passes the rest to the next seed in order. The draw puts the net on side A when it is under 0.5. `models/vulcan/pairs.json`: `{ id, situation, a: string[], b: string[] }[]`, no key; `verdict:vulcan` rebuilds the key by rerunning the same selection and draws. Floor (`src/vulcan/floor.ts`): free full years, today vs net, on the 5 held-out seeds (about 9 min, estimate), written to `models/vulcan/floor.json`. Floor numbers: food at year end and alive (lower is worse), days to `metal.smelted`, `smithy.built`, `smith.made` (higher is worse); a number misses when it is more than 5% worse, in integers: food and alive miss when `net × 100 < today × 95`; days miss when `net × 100 > today × 105`, with R9's changes if approved. Report page: an Artifact with `db` and `user`, collection `picks`, one doc per pair id with `v` `A` or `B`, look from `docs/UI_STYLE.md`; `picks.json` is the `ArtifactData` list output saved as is, read as `id → data.v`. `pairs-are-blind` matches whole words, case-insensitive.

## Slices

### S1 Vulcan line hook

- **Morgan tries:** play a new game in Vulcan; nothing has changed. Approve the Vulcan PR.
- **Checks that fail now:** J1.
- **Files (Vulcan):** `src/engine/people/lines.ts`, `lines.test.ts`; `src/engine/sim/world.ts`, `system.ts`; the nine readers listed in Design; `src/engine/index.ts`, `tools/engine-entry.ts`; `src/engine/people/MODULE.md`; code map.
- **Waits on:** none.

### S2 Bench runner and today's numbers page

- **Morgan tries:** a page with today's numbers on all 10 seeds, seconds per seed-year and today's noise band.
- **Checks that fail now:** J2.
- **Files (Phobos):** `vulcan.pin`; `src/vulcan/engine.ts` (types for everything S1 exports: `createSim`, `createWorld`, `step`, `content`, `TICKS_PER_DAY`, `MAP_SEEDS`, `setLineHook`, `clockAt`, `hoursOf`, `growSpot`, and `sim.notable`), `measure.ts`, `clone.ts`, `scales.ts`; `scripts/bench-vulcan.ts` (`--html <path>` writes the page); `package.json` `bench:vulcan`, `test:vulcan` (`node --test "tests-vulcan/**/*.test.ts"`, local only, R7); `tests-vulcan/bench.test.ts`; `tsconfig.json`; `docs/vulcan-setup.md`; `AGENTS.md` local checks; DECISIONS: R-items Morgan approved.
- **Waits on:** S1 merged.

### S3 Line net, training and moment count

- **Morgan tries:** a page with the training score per generation and the moment count on each held-out seed.
- **Checks that fail now:** J3, J4; `tests/vulcan-lines.test.ts` (input encoding, bounds, warm freeze, cache key) in `npm run check`.
- **Files:** `src/vulcan/inputs.ts`, `lines.ts`, `train.ts`, `shadow.ts`, `pool.ts`; `src/model/weights.ts`; `scripts/train-vulcan.ts`; `models/vulcan/lines.json`; `tests-vulcan/zero-net.test.ts`, `train.test.ts`; `tests/vulcan-lines.test.ts`; `tests/weights.test.ts` (asserts the `vulcan` meta field); `package.json` `train:vulcan`; `AGENTS.md` local checks; DECISIONS: ES pick.
- **Waits on:** S2.

### S4 Pairs, report and verdict

- **Morgan tries:** the report page: rate 24 pairs.
- **Checks that fail now:** J5, J6.
- **Files:** `src/vulcan/pairs.ts`, `floor.ts`, `verdict.ts`; `models/vulcan/floor.json`; `AGENTS.md` local checks; `scripts/pairs-vulcan.ts`, `verdict-vulcan.ts`; `models/vulcan/pairs.json`; `tests/vulcan-pairs.test.ts`, `tests/vulcan-verdict.test.ts`; `package.json` `pairs:vulcan`, `verdict:vulcan`; DECISIONS: the verdict as the next free D number.
- **Waits on:** S3.

## Verification

- Every push: Phobos `npm run check` (budget 10 s; Vulcan-free unit tests only). S1: Vulcan `npm run check`.
- Vulcan-dependent: `npm run test:vulcan` before a PR is marked ready, Vulcan at the pin (local only, like D-013).
- End to end: Morgan's picks and `npm run verdict:vulcan`.

## Reconcile with D-019 and D-020 (all approved 2026-11-18, D-021)

- **R1 Copy:** "copy today's lines" becomes a zero output layer: exact, no copy training.
- **R2 Warning lines:** "never past a warning line" can't hold for rest (line 2500, already under its warning line 3000). Instead: each line moves at most 1000 either way (symmetric, so the blind pairs have no tell); food and water then stay above 3000.
- **R3 Hourly:** lines once per game hour, cached and cloned with the world.
- **R4 Window output:** "output no worse" in a window = food in store at its end and work person-hours, each at least 95% of today's.
- **R5 Windows:** 2 shared windows per generation; about 1.4 h on 3 workers (estimate).
- **R6 Reaching Vulcan:** a checkout path plus a committed pin file instead of a dev dependency (the npm route 403s here); the pin still names the commit. J2, S2 and `vulcan.pin` assume R6; if Morgan keeps the dev dependency, S2 changes to it and first needs codeload.github.com to serve story-generator to this session.
- **R7 Tests:** Vulcan-dependent tests local only (`test:vulcan`); Phobos CI has no Vulcan.
- **R8 Cause line:** in the shadow log only; Vulcan's ledger gets it with the in-game switch.
- **R9 Floor and chance (critic, high):** one free run per seed is noisy; losing one of 5 people is a 20% drop. Proposal: alive must be no lower than today's; the other numbers keep the 5% rule, but a miss inside today's noise band (S2) doesn't count as a miss. This changes D-020.
- **R10 A hand-written rival (both critic passes, high; recommended):** a table of line offsets by season (4) and trait (10) for the five lines, 70 numbers, searched by the same ES on the same windows and score. It enters the blind pairs as a third side: pairs are net against today (24) and, separately, table against today (12, about 10 more minutes for Morgan, estimate). If the table does as well as the net, the net is not needed (Phobos AGENTS.md: "Every learned block ships with a plain baseline"). Costs about one session inside the 8. Without it, "act earlier everywhere" could pass and say nothing about the net. If approved: S3 adds `src/vulcan/table.ts` (a line's offset = season offset + the sum of the person's trait offsets, clamped to ±1000; 70 integer parameters in season-then-trait, line order, searched by the same ES loop and score), and S4 adds 12 table-against-today pairs, so J5 shows 36 pairs and J6 still judges the net on its 24.

## Open questions

- Whether each held-out seed has enough moments for its quota (S3 counts).
