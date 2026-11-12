# Phobos first usable version (milestones M1 to M3)

- **Status:** Draft
- **Planned in:** planning pages [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), 2026-11-12. **Decisions:** D-002 to D-010. "Finding n" and answer ids (P1, N1, Q2, ...) refer to the review 1 and final pages; DECISIONS quotes what they settled.

This is a new repo: there is no code yet, only docs, the synced `.claude/` harness and a CI drift check (`AGENTS.md`).

## Problem

Morgan wants "colonists [that] have goals that they work toward" in Project-Vulcan, and models an agent can build "for any goal" from this repo's instructions (`docs/CONCEPT.md`). Neither exists, and no one knows yet whether small integer nets are worth it. The project is exploratory: "whatever comes of it is fine". Morgan wants to see each step working on a phone, to watch training, and to "see if this would be worth implementing" before trusting the pass mark (D-009).

## Terms

- **PI:** the tank's classic controller, a PID with no derivative term (Kd = 0). DECISIONS says "PID" for the same controller. Error e = setpoint − measured level. "Fixed PI" is tuned once at 1.0 m; "retuned PI" is tuned for each test segment's target level.
- **IMC tuning, λ = 10 s:** for this tank, Kp = A / (0.1 × λ) = 1.0 at every level, and Ti = 2·A·√h / k = 40·√h s. So retuning changes only Ti (the integral time).
- **IAE:** integral of |true level − setpoint| over time, in m·s. It is always computed on the true level, never the noisy measurement.
- **Output range:** for a tanh layer, [−1, 1] (8,192 LSB). For exp, [0, 1] (4,096 LSB). A layer's 1% is measured with the integer previous-layer output (dequantised) as its input in both versions. For a layer with no activation, the output range is the larger of 1.0 and max − min of the float reference's output over the 1,000 check states.
- **Float reference:** the same layers in float, using the dequantised weights (w / 2^s, b / 4096). It is fed the same integer inputs / 4096.
- **Rounding:** float to integer always uses `Math.round` and then saturates. This happens only outside the runtime: quantising, Q12 inputs and table generation.

## Goals

- **M1:** Morgan opens Lab on a phone and sees the tank under the fixed PI, live, plus the fixed test's IAE per segment for the fixed and the retuned PI. That shows how large the gap is. A throwaway simulation in the planning session (not part of the repo) measured, on a 0.2 → 0.3 m step, IAE 2.01 m·s for the fixed PI against 1.01 m·s for one retuned at 0.25 m. On 1.7 → 1.9 m it was 2.06 against 2.00. S2's test replaces these numbers.
- **M2:** an integer runtime (dense layer, action mask, argmax, tanh and exp tables) passes D-007's bounds in CI. Each layer is within 1% of its output range of the float reference. The Lab net's valve is within 0.01 of the float model's on at least 99% of the check states. A 5-action test net picks the same masked action as its float model on at least 99% of the check states.
- **M3:** a net trained in Node runs in Lab beside the PI. Lab replays its training, and shows on held-out seeds and setpoints whether it beats the fixed PI (D-009).

## Non-goals

- Live training on the phone, the Structured Text exporter, agent recipes, SwiGLU, KAN, state-space and CfC cells, Vulcan and Silvanus work (D-004 Later list and later phases).
- A Python trainer, unless D-008's switch rule fires.
- Deploying Lab anywhere except as a published Artifact page (D-005).
- Cross-browser bit-identity of the tank plant. The plant and the trainer run in floating point (SIM-04); only the net runtime is integer (D-006).
- Playwright in CI (CI-02). Browser checks run locally, with a screenshot in the PR.

## Journeys and checks

### J1 Watch the tank under the PI (M1)

- **Given** the Lab link on Morgan's phone
- **When** Morgan opens it, drags the setpoint slider and taps Disturbance
- **Then** the level, setpoint and valve curves update live; the level moves toward the new setpoint; the disturbance dips the level, and the PI recovers it. **Check:** `e2e/lab-smoke.mjs` (Playwright on `dist/lab.html`). It calls `pause()`, sets the setpoint to 1.5 m, calls `step(300)`, and asserts the level is within 0.05 m of 1.5 m. An open valve would reach 2.0 m and fail. It then calls `disturb()` and `step(30)` and asserts the level dropped by more than 0.02 m; after `step(300)` it asserts the level is back within 0.05 m. It also saves a 400 px screenshot for the PR.

### J2 See the gap per level (M1)

- **Given** Lab is open
- **When** Morgan taps "Run fixed test"
- **Then** a pair of bars per segment shows the fixed and the retuned PI's IAE (m·s), with the numbers printed. **Check:** `tests/fixed-test.test.ts` asserts the 5 segment names; that retuned IAE < 0.8 × fixed IAE on `0.50→0.25`; that retuned equals fixed on `dist@1.00` (same Ti there); and that IAE with noise differs from IAE with noise off by under 0.2 m·s per segment. IAE on the noisy level would add about 0.75 m·s. `npm run fixed-test` prints the same table in Node.

### J3 Integer runtime matches float (M2)

- **Given** the committed tables and golden files
- **When** `npm run check` runs
- **Then** every layer is within 1% of its output range, the tables are within 2 LSB of the float functions, the Lab-net and test-net agreement bounds in Goals M2 hold, and the test net's outputs on the check states equal `tests/golden/runtime-testnet.json`. **Check:** `tests/runtime.test.ts` and `tests/tables.test.ts`, run in CI.

### J4 Watch a trained net (M3)

- **Given** `models/lab/weights.json` committed
- **When** Morgan opens Lab and turns on "Net"
- **Then** the net and the PI control two tanks side by side on the same setpoint, and a weights heat map shows the loaded net. **Check:** `e2e/lab-smoke.mjs` adds a case: after `pause()` and `setNet(true)`, with setpoint 1.0 m, after `step(300)` the net tank's level is within 0.05 m of 1.0. `tests/weights.test.ts` loads the committed file. `tests/train.test.ts` asserts that `copy-weights.json`'s mean |valve − PI valve| over the check states is below 0.05. `tests/build-lab.test.ts` builds Lab with and without `models/lab/` and asserts the Net panel marker `data-panel="net"` is present only with it.

### J5 Replay training and read the verdict (M3)

- **Given** a training run recorded by `npm run train:lab`
- **When** Morgan opens the Replay tab and drags the snapshot slider
- **Then** the curve marks the current point (loss in the copy phase, IAE in the ES phase), and the tank plays the held-out test with that snapshot's weights. The verdict panel always shows the final weights' verdict: per held-out segment and in total, IAE and valve travel for the net, the fixed PI and the retuned PI, and the yes/no line. **Check:** `tests/verdict.test.ts` recomputes the held-out numbers from the committed weights, asserts they equal `models/lab/verdict.json` (a regression lock), and asserts the yes/no follows the rule from those numbers. `e2e/lab-smoke.mjs` calls `setSnapshot(0)` then the last index, and asserts that `state().snapshot` follows, that `state().net.valve` after `step(10)` from the same state differs between the two, and that the verdict text stays the same.

## Decisions

- Lab on the phone as a published Artifact page; Node for training and tests (D-005).
- int16 values, sums in JS numbers bounded below 2^53, saturate, power-of-two scales, floor shift, ties to the lowest index, seeded integer RNG, committed tables and golden files (D-006).
- 1% per layer; 99% agreement (D-007).
- Copy the PI, then evolution strategies; Python only by D-008's rule; training replay in Lab (D-008).
- Tank drains through a fixed opening; the net must beat the fixed PI across the setpoint range (D-009).
- Phobos JSON weights with a format version; MIT licence (D-010).

## Alternatives rejected

- **Live training on the phone in M3**: rejected by Morgan (D-008, final Q2). It would fail when the phone locks and suspends the tab.
- **Pass mark "close to PID"**: replaced by "beats the fixed PI" (D-009). It would fail to say whether the net is worth having.
- **BigInt or int32 sums**: int32 overflows after two int16 × int16 products, and BigInt is slow (D-006).
- **Verdict on the training test**: ES optimises the training segments and seeds, so a verdict there would reward overfitting. The verdict uses held-out seeds and setpoints.
- **Vitest or Jest**: `node --test` runs `.ts` files directly on Node 22.23.4 (type stripping; tried in the planning session), so no test framework dependency is needed. Vitest would be the choice if we needed watch mode or browser-mode tests.
- **A Vite dev server for Lab**: Lab ships as one HTML file, and esbuild 0.28.2 bundles it in one command (tried in the planning session). Vite would be the choice if Lab became a multi-page site.
- **Tables as JSON files**: importing JSON under Node type stripping needs import attributes, and esbuild needs a loader. Generated `.ts` files with `Int16Array` literals need neither.

## Risks

- **The gap may be small**: the planning simulation showed about 2× at 0.25 m and about 3% at 1.8 m. Retuning changes only Ti, so a net that learns gain scheduling closes the gap without "learning anything new". → J2 shows the gap per segment at M1, the verdict also shows the retuned PI, and Morgan judges at M1 whether M3 is worth it (D-009).
- **Hand-written backprop for dense + tanh has bugs** → a finite-difference gradient check is a test (D-008's switch rule).
- **Quantisation loses what float training learned** → ES scores the integer net directly, so it optimises the net that ships.
- **`Math.tanh` and `Math.exp` differ across Node versions** → table regeneration is compared within 1 LSB, not for equality, and Node is pinned (WEB-01).

## Design

**Repo layout:** all ESM TypeScript, `"type": "module"`, erasable syntax only, imports with `.ts` extensions. `tsconfig.json`: `target es2022`, `module nodenext`, `strict`, `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `lib ["es2022","dom"]`, `types ["node"]`, include `src scripts tests`. This config was tried in the planning session with TypeScript 7.0.2.

**Numbers** (`src/num/`, written up in `docs/NUMBERS.md`):

- Values are Q12 int16: 1.0 = 4096, range [−8, 8).
- `sat16(x)` clamps to [−32768, 32767].
- `shr(x, n)` = `Math.floor(x / 2 ** n)`. It is exact for integers below 2^53, since a power-of-two divide is exact in doubles. AGENTS.md's integer rule gains this one exception.
- **Layer:** `y = sat16(shr(Σ w·x, s) + b)`, then the layer's `act`, which `dense` applies. A weight's real value is w / 2^s. The bias is int16 Q12 at output scale. `w` is row-major, `[out][in]`, flattened.
- **Quantise** (`src/num/quantise.ts`): s = the largest integer in [0, 14] with max|w_real| × 2^s ≤ 32767; w = round(w_real × 2^s); b = round(b_real × 4096). Both are saturated.
- `checkBound(layer, limit = 2 ** 53)` throws if the largest row sum, max over outputs i of Σ_j |w_ij|, times 32768 is ≥ `limit`. It uses the actual weights. The test passes a small `limit`. At full scale a 4→16 layer reaches about 4.3 × 10^9 and a 16→1 layer about 1.7 × 10^10, both far below 2^53 but above 2^31. `docs/NUMBERS.md` records that a 32-bit PLC exporter will need smaller weights or wider sums (Later).
- **Tables** (`scripts/gen-tables.ts` writes `src/num/tables.gen.ts`, committed):
  - tanh: entry i = round(4096 × tanh(i / 128)) for i in 0 to 1024, Q12 out. The input is clamped to [−32767, 32767]. For a = |x|, the index is i = a >> 5 and the fraction is f = a & 31. The result is t[i] + shr((t[i+1] − t[i]) × f, 5), negated for x < 0, so the last index read is 1024.
  - exp: entry i = round(4096 × exp(−i / 128)). The input is clamped to [−32767, 0], so a positive input gives 4096. Same lookup on a = −x.
  - `tanhQ`, `expQ` and the `Layer` type live in `src/num/`.

**Runtime** (`src/runtime/`): `dense(layer, x)`; `mask(scores, allowed: boolean[])` clamps allowed scores to ≥ −32767 and sets forbidden ones to −32768; `argmax(v)` (the lowest index wins ties, and it returns −1 if every action is forbidden). These are pure functions on `Int16Array`/`Int32Array`, with no `Math.*` except `floor` in `shr`. `src/ref/` holds the float versions, used by tests and the trainer only.

**Plant** (`src/sim/`, pure, float, SIM-01 and SIM-04):

- Area 1.0 m², level clamped to [0, 2.0] m.
- Inflow 0.1 m³/s × valve, with valve clamped to [0, 1]. Outflow k × √max(level, 0), with k = 0.05 m^2.5/s.
- Explicit Euler with dt 0.1 s.
- Disturbance: k × 1.2.
- Sensor noise: uniform ±0.005 m, from `rng`. It is added only to the measured level that the controller sees.

**PI** (`pi(Kp, Ti)`): `u = Kp·e + I`; the valve is u clamped to [0, 1]. When 0 ≤ u ≤ 1, `I += (Kp / Ti)·e·dt`; otherwise I is held (conditional integration). At a segment start, I = the steady-state valve, 0.5·√h0.

**RNG** (`src/rng.ts`): xorshift32 on `>>> 0`. A seed of 0 is replaced by 1. `uniform()` = r / 2^32. The default seed is 1. **Plant interface:** `plant.step(valve, disturbed: boolean)` advances dt and returns the true level; `plant.measure()` then draws exactly one uniform and returns true level + (uniform × 0.01 − 0.005).

**Controller interface:** `type Controller = { reset(level: number, setpoint: number): void; step(measured: number, setpoint: number): number }`. Each controller carries its own state.

**Fixed test** (`src/sim/fixed-test.ts`): five 300 s segments. Each resets the plant and controller to steady state at its start level, and the setpoint steps at t = 0. IAE adds |true level − setpoint| × dt after each step. Fixed and retuned controllers see the same noise sequence. Lab's "Run fixed test" shows the training set; the held-out set appears in the verdict panel (S6).

- Training set: `0.50→0.25`, `0.25→1.00`, `1.00→1.75`, `1.75→0.50`, and `dist@1.00` (setpoint held at 1.0 m, disturbance from 60 s to 120 s). Noise seeds 1 to 5.
- Held-out set: `0.75→0.15`, `0.15→1.40`, `1.40→1.90`, `1.90→0.75`, `dist@0.35`. Noise seeds 101 to 105.
- Each segment runs every seed. A segment's IAE is the mean over seeds; the total is the sum over segments.
- Valve travel = Σ |change in clamped valve| per segment, as a mean over seeds like IAE, reported beside it.
- The retuned PI uses Ti = 40·√target. For a `dist@` segment, the target is its level.
- `npm run fixed-test` prints one row per segment: `name  fixedIAE  retunedIAE` in m·s, to 2 decimals.

**Check states** (`src/sim/check-states.ts`, S2): the Lab-net inputs (built by `src/sim/net-inputs.ts`, S2), taken before the controller acts, at every 15th step of the training set at seed 1, under the fixed PI. While the PI drives, the integral is tracked with the hold rule using the PI's valve. That gives 5 × 3,000 / 15 = 1,000 states.

**Lab net inputs**, all Q12:

1. Setpoint, in m.
2. Measured level, in m.
3. Error, in m.
4. Error integral ∫e dt / 32, clamped to ±7.99. It is kept in float by `src/sim/net-inputs.ts`, outside the integer runtime, and converted to Q12 with `Math.round` each step. It is held while the previous valve is ≤ 0.001 or ≥ 0.999. At reset it is preloaded to 20·√h0, the fixed PI's steady value. Steady values are about 6 to 28 m·s, so after /32 they are under 1.

The net is dense 4→16 with tanh, then dense 16→1 with tanh. The valve is (y + 4096) / 8192, clamped to [0, 1]. That makes 97 parameters.

**Test net** (S4 only): dense 4→16 tanh, then 16→5 with no activation, then mask (action 4 forbidden), then argmax. Weights and biases are (uniform() × 2 − 1) × 0.5 from rng seed 7, drawn layer by layer, w in row-major order then b, and quantised as above. The Lab-shaped net in S4 uses the same rule with seed 8. Both are fed the check states.

**Weight file** (`src/model/`): `{ "format": "phobos-weights", "version": 1, "layers": [{ "kind": "dense", "in", "out", "shift", "w", "b", "act": "tanh" | "exp" | "none" }], "meta": { "trainer", "seed" } }`. There is no timestamp, so training output is reproducible. The loader throws on another `format` or `version`, on `w.length ≠ in × out`, on `b.length ≠ out`, on a value outside int16, on shift outside [0, 14], and when `checkBound` fails.

**Trainer** (`src/train/`, float and Node only):

- **Copy phase:**
  - Data: 50 fixed-PI runs of 400 s. Each run uses a start level and two setpoints drawn uniformly from [0.1, 1.9] m (rng seed 11), with the setpoint stepping at 200 s, and noise seed 1000 + run. States are sampled every 2 s, giving 10,000 states, shuffled with seed 11.
  - Loss is the MSE between the net valve and the fixed PI's valve.
  - Training: momentum SGD (v = 0.9·v + g; θ −= 0.01·v), batch 64, 2,000 steps. Weights are Xavier-uniform (seed 13), biases 0. A snapshot is saved every 200 steps and the loss logged every 10 steps. Then quantise and write `models/lab/copy-weights.json`. S5 also copies it to `weights.json`; S6 replaces `weights.json` with the ES result.
- **ES phase:**
  - Runs on the integer net, with shifts fixed from quantisation. Weights and biases are all perturbed, by ε ~ N(0, 1) from Box-Muller (rng seed 17), as round(64 × ε) LSB, saturated.
  - 50 generations, population 32 (16 antithetic pairs).
  - Fitness is −(training-set total IAE).
  - Update: θ += round(512 × Σ_k r_k ε_k / 32) LSB, saturated. r_k is the centred rank of member k, in [−0.5, 0.5]. The step size is not measured; S6 measures it.
  - IAE is logged every generation, with a snapshot every 5 generations.
- These settings are first guesses (not measured). The S5 and S6 re-checks may change them before building, and DECISIONS records any change.
- **Logs:**
  - `models/lab/log.json`: `{ version: 1, entries: [{ phase: "copy" | "es", step, loss?, iae? }] }`.
  - `models/lab/snapshots.json`: 10 copy-phase snapshots (quantised) and 10 ES snapshots, each `{ phase, step, layers }`.
  - `models/lab/verdict.json`: the held-out results.
- **Verdict** (`models/lab/verdict.json`, computed from the final weights, not the snapshot on screen): per held-out segment and in total, IAE and valve travel for the net, the fixed PI and the retuned PI. The yes/no rule is open question 1.

**Lab** (`src/lab/`):

- Canvas curves read one model object, `{ t, level, setpoint, valve, net: { level, valve } | null, history }`. `history` is a ring buffer of the last 600 s (SIM-01).
- The sim runs at 10× real time (checked by eye; untested).
- Slider: 0.1 to 1.9 m, step 0.05. Disturbance: a button that applies k × 1.2 for 60 simulated seconds.
- The Net tank uses the same setpoint and its own noise stream, seed 2. `disturb()` hits both tanks. Turning Net on resets the net tank to steady state at the main tank's level.
- Tests reach the page through `window.__lab = { pause(), state(), step(seconds), setSetpoint(m), disturb(), setNet(on), setSnapshot(i) }`. `pause()` stops the live loop so `step` is the only clock. `state()` also returns `snapshot` (the shown snapshot's step) and, while Net is on, `net.valve`.
- `scripts/build-lab.ts` bundles the page with esbuild into `dist/lab.html`. It inlines `models/lab/*.json` when they exist and hides the panels that need them when they don't.

**Scripts** (each added in the slice that creates its file): `check` = `tsc -p . && node --test "tests/**/*.test.ts" && node .claude/skills/test-design/scripts/test-traps.mjs && node .claude/master/sync.mjs --check`; `build:lab`; `test:browser` = `npm run build:lab && node e2e/lab-smoke.mjs` (container Playwright, WEB-05); `fixed-test`; `gen-tables`; `train:lab`.

**Pins:** `.nvmrc` 22.23.4, `packageManager` npm@10.9.9 (WEB-01). Dev dependencies, pinned exactly: typescript 7.0.2, esbuild 0.28.2, @types/node at the newest 22.x on install. No runtime dependencies. Playwright is the container's copy, loaded with `createRequire` (WEB-05), and is not a dependency.

**Publishing Lab:** the build session publishes `dist/lab.html` with the Artifact tool and records the URL in HANDOFF. Later slices republish to the same URL.

## Slices

### S1 Lab v0: tank and PI live (M1)

- **Morgan tries:** opens the Lab link and drags the setpoint; taps Disturbance.
- **Checks that fail now:**
  - J1.
  - `tests/sim.test.ts`: from steady state at 0.9 m with setpoint 1.0 m, the fixed PI brings the level within 0.01 m of 1.0 m by 300 s, with valve 0.5 ± 0.01. With the valve held at 1, the level reaches 2.0 m.
  - `tests/trace.test.ts`: seed 1, start steady at 1.0 m, setpoint to 1.5 m at 60 s, disturbance 200–260 s, 600 s, fixed PI. `{ t, level, valve }` every 10 s, rounded to 6 decimals, must equal `tests/golden/trace-seed1.json`. A second run with seed 2 must differ. The golden file changes only in a commit that says why (SIM-02).
- **Files:**
  - `package.json` (`check`, `build:lab`, `test:browser`), `package-lock.json`
  - `.nvmrc`, `tsconfig.json`, `LICENSE` (MIT), `ATTRIBUTION.md`
  - `src/sim/plant.ts`, `src/sim/pi.ts`, `src/rng.ts`, `src/lab/*`, `scripts/build-lab.ts`
  - `tests/sim.test.ts`, `tests/trace.test.ts`, `tests/golden/trace-seed1.json`, `e2e/lab-smoke.mjs`
  - `.github/workflows/ci.yml` (setup-node with `.nvmrc`, `npm ci`, `npm run check`)
  - `AGENTS.md` (local checks with a measured time budget)
- **Waits on:** `docs/UI_STYLE.md` (the `ui-style` skill) and one `ui-mockups` mock-up of the whole Lab layout, approved by Morgan: Live, Fixed test, Tables, Integer vs float, Net and Replay. Both are done in the build session before code, so later slices fill in panels already approved.

### S2 The gap per level (M1)

- **Morgan tries:** taps "Run fixed test" and reads the bars.
- **Checks that fail now:** J2.
- **Files:** `src/sim/fixed-test.ts`, `src/sim/net-inputs.ts`, `src/sim/check-states.ts`, `tests/check-states.test.ts` (1,000 states, 4 inputs each, the integral preload at a segment start), `scripts/fixed-test.ts`, `package.json` (`fixed-test`), `src/lab/` (test panel), `tests/fixed-test.test.ts`.
- **Waits on:** S1.

### S3 Numbers and tables (M2)

- **Morgan tries:** opens Lab's "Tables" panel: tanh and exp from the integer tables drawn over the float curves, with the maximum error printed in Q12 LSB and as a % of the output range.
- **Checks that fail now:** `tests/num.test.ts` covers:
  - `sat16`;
  - `shr(−5, 1) = −3`;
  - quantise picks s as specified;
  - `checkBound` throws when the bound reaches a small `limit`;
  - tanhQ(−32768) = −tanhQ(32767) = −4096, tanhQ(0) = 0, expQ(0) = 4096, expQ(100) = 4096.

  `tests/tables.test.ts` checks that tanhQ and expQ are within 2 LSB of round(4096 × f(x / 4096)) at every int16 input, and that a fresh generation matches the committed table within 1 LSB. An off-by-one index fails, because adjacent entries differ by up to 32 LSB.
- **Files:** `src/num/*` (fixed point, quantise, tables, `tanhQ`, `expQ`, `Layer`), `scripts/gen-tables.ts`, `src/num/tables.gen.ts`, `package.json` (`gen-tables`), `src/lab/` (tables panel), `docs/NUMBERS.md`, `tests/num.test.ts`, `tests/tables.test.ts`, `AGENTS.md` (the `shr` exception to the integer rule).
- **Waits on:** S1.

### S4 Dense, mask and the float reference (M2)

- **Morgan tries:** in Lab, a fixed-seed Lab-shaped net's integer valve drawn over its float valve while the PI runs the tank, with the agreement % printed.
- **Checks that fail now:** J3 (`tests/runtime.test.ts`). It covers per-layer 1%; the Lab-shape valve within 0.01 on ≥ 99% of the check states; test-net argmax agreement ≥ 99%, with at least 2 distinct actions chosen over the check states (if the random net misses this, the builder reports the measured value to Morgan rather than changing the bound); mask (a forbidden action is never chosen, even when allowed scores saturate at −32768); ties; all-forbidden → −1; and the golden outputs.
- **Files:** `src/runtime/*`, `src/ref/*`, `src/model/*`, `src/sim/net-controller.ts` (a `Controller` that runs a weight file on `net-inputs`), `src/lab/` (integer vs float panel), `tests/runtime.test.ts`, `tests/golden/runtime-testnet.json`.
- **Waits on:** S2 (check states) and S3.

### S5 Copy the PI (M3)

- **Morgan tries:** turns on "Net" in Lab. A net that copied the PI runs a second tank beside it, with the heat map.
- **Checks that fail now:**
  - J4.
  - `tests/train.test.ts`: the gradient check (finite differences, relative error < 1e-4 on 20 random parameters).
  - The copy-phase loss after 200 seeded steps is below half its first value.
  - The copied net's mean |valve − PI valve| over the check states is below 0.05.
  - D-007 on the trained net: `copy-weights.json`'s integer valve is within 0.01 of its float valve on ≥ 99% of the check states.
  - `tests/weights.test.ts`: the committed file loads; a wrong version, a wrong `w` length, an out-of-range value and a bad shift each throw.
- **Files:** `src/train/copy.ts`, `scripts/train-lab.ts`, `package.json` (`train:lab`), `models/lab/copy-weights.json`, `models/lab/weights.json`, `tests/build-lab.test.ts`, `models/lab/log.json`, `models/lab/snapshots.json` (copy phase), `src/lab/` (net toggle, heat map), `tests/train.test.ts`, `tests/weights.test.ts`.
- **Waits on:** S4.

### S6 Evolution strategies, replay and verdict (M3)

- **Morgan tries:** opens Replay, drags the snapshot slider, and reads the verdict.
- **Checks that fail now:**
  - J5.
  - `tests/es.test.ts`: on a 4-parameter quadratic fitness, one generation's update equals the formula in Design exactly. Keeping the best candidate would fail this. On a seeded 5-generation Lab run, training IAE falls by at least 1%. The final `weights.json` meets D-007 like S5's file.
- **Files:** `src/train/es.ts`, `src/sim/verdict.ts`, `scripts/train-lab.ts`, `models/lab/*` (adds ES snapshots and `verdict.json`), `src/lab/` (Replay tab, verdict panel), `tests/es.test.ts`, `tests/verdict.test.ts`.
- **Waits on:** S5.

## Verification

- Every push: `npm run check` (S1 measures it and writes the budget in AGENTS.md, VER-11).
- Lab changes: `npm run test:browser` locally, with the 400 px screenshot in the PR.
- Device check: Morgan opens the Lab link on a phone. It counts only with Morgan's word (VER-07).
- Not covered by CI: browser checks (J1, J4, J5 run locally only), the 10× live speed, and D-008's 10-minute training limit. S5 and S6 report the measured training time.

## Open questions

1. Verdict rule (for Morgan, before S6). Gain scheduling (Ti = 40·√h) is a one-line fix, so beating only the fixed PI may not show that the net learned anything. Options:
   - (a) Beats the fixed PI: lower total held-out IAE, no segment more than 5% worse, valve travel at most 2× the fixed PI's.
   - (b) As (a), plus within 10% of the retuned PI's total IAE.
   - (c) Beats the retuned PI. This would tighten D-009.
2. Not for this spec: `docs/CONCEPT.md` "Open for design" and its hard limits are superseded by D-003 to D-010. CONCEPT stays as the brainstorm snapshot.
