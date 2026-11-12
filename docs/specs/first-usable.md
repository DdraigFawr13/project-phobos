# Phobos first usable version (milestones M1 to M3)

- **Status:** Draft
- **Planned in:** planning pages [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), 2026-11-12. **Decisions:** D-002 to D-010. "Finding n" and answer ids (P1, N1, Q2, ...) refer to the review 1 and final pages; DECISIONS quotes what they settled.

This is a new repo: there is no code yet, only docs, the synced `.claude/` harness and a CI drift check (`AGENTS.md`).

## Problem

Morgan wants "colonists [that] have goals that they work toward" in Project-Vulcan, and models an agent can build "for any goal" from this repo's instructions (`docs/CONCEPT.md`). Neither exists, and no one knows yet whether small integer nets are worth it. The project is exploratory: "whatever comes of it is fine". Morgan wants to see each step working on a phone, to watch training, and to "see if this would be worth implementing" before trusting the pass mark (D-009).

## Terms

- **PI:** the tank's classic controller, a PID with no derivative term (Kd = 0). "Fixed PI" is tuned once at 1.0 m; "retuned PI" is tuned for each test segment's target level.
- **IMC tuning, λ = 10 s:** for this tank, Kp = A / (0.1 × λ) = 1.0 at every level, and Ti = 2·A·√h / k = 40·√h s. So retuning changes only Ti (the integral time).
- **IAE:** integral of |true level − setpoint| over time, in m·s. It is always computed on the true level, never the noisy measurement.
- **Output range:** for a tanh layer, [−1, 1]. For a layer with no activation, max − min of the float reference's output over the 1,000 check states.

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
- **Then** the level, setpoint and valve curves update live; the level moves toward the new setpoint; the disturbance dips the level, and the PI recovers it. **Check:** `e2e/lab-smoke.mjs` (Playwright on `dist/lab.html`). It sets the slider to 1.5 m, calls `window.__lab.step(100)` (100 simulated seconds), and asserts `window.__lab.state().level` has risen from 1.0 m by more than 0.2 m. It also saves a 400 px screenshot for the PR.

### J2 See the gap per level (M1)

- **Given** Lab is open
- **When** Morgan taps "Run fixed test"
- **Then** a pair of bars per segment shows the fixed and the retuned PI's IAE (m·s), with the numbers printed. **Check:** `tests/fixed-test.test.ts` asserts the 5 segment names, and that retuned IAE < fixed IAE on the segment targeting 0.25 m. `npm run fixed-test` prints the same table in Node.

### J3 Integer runtime matches float (M2)

- **Given** the committed tables and golden files
- **When** `npm run check` runs
- **Then** every layer is within 1% of its output range, the Lab-net and test-net agreement bounds in Goals M2 hold, and the seed-1 trace equals the golden file. **Check:** `tests/runtime.test.ts`, `tests/tables.test.ts` and `tests/trace.test.ts`, run in CI.

### J4 Watch a trained net (M3)

- **Given** `models/lab/weights.json` committed
- **When** Morgan opens Lab and turns on "Net"
- **Then** the net and the PI control two tanks side by side on the same setpoint, and a weights heat map shows the loaded net. **Check:** `e2e/lab-smoke.mjs` adds a case: with Net on, `window.__lab.state().net` is not null and both levels are numbers. `tests/weights.test.ts` validates the committed file.

### J5 Replay training and read the verdict (M3)

- **Given** a training run recorded by `npm run train:lab`
- **When** Morgan opens the Replay tab and drags the snapshot slider
- **Then** the curve marks the current point (loss in the copy phase, IAE in the ES phase), and the tank plays the held-out test with that snapshot's weights. The verdict panel shows, per held-out segment and in total, IAE for the net, the fixed PI and the retuned PI, and a line "Net beats fixed PI: yes/no". **Check:** `tests/verdict.test.ts` computes the verdict from the committed weights on the held-out test and asserts it equals `models/lab/verdict.json`. `e2e/lab-smoke.mjs` drags the slider and asserts the verdict text equals that file.

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

- **The gap may be small**: the planning sim showed about 2× at 0.25 m and about 3% at 1.8 m. Retuning changes only Ti, so a net that learns gain scheduling closes the gap without "learning anything new". → J2 shows the gap per segment at M1, the verdict also shows the retuned PI, and Morgan judges at M1 whether M3 is worth it (D-009).
- **Hand-written backprop for dense + tanh has bugs** → a finite-difference gradient check is a test (D-008's switch rule).
- **Quantisation loses what float training learned** → ES scores the integer net directly, so it optimises the net that ships.
- **`Math.tanh` and `Math.exp` differ across Node versions** → table regeneration is compared within 1 LSB, not for equality, and Node is pinned (WEB-01).

## Design

**Repo layout:** all ESM TypeScript, `"type": "module"`, erasable syntax only, imports with `.ts` extensions. `tsconfig.json`: `target es2022`, `module nodenext`, `strict`, `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `lib ["es2022","dom"]`, `types ["node"]`, include `src scripts tests`. This config was tried in the planning session with TypeScript 7.0.2.

**Numbers** (`src/num/`, written up in `docs/NUMBERS.md`):

- Values are Q12 int16: 1.0 = 4096, range [−8, 8).
- `sat16(x)` clamps to [−32768, 32767].
- `shr(x, n)` = `Math.floor(x / 2 ** n)`. It is exact for integers below 2^53, since a power-of-two divide is exact in doubles. AGENTS.md's integer rule gains this one exception.
- **Layer:** `y = sat16(shr(Σ w·x, s) + b)`, then the activation. A weight's real value is w / 2^s. The bias is int16 Q12 at output scale. `w` is row-major, `[out][in]`, flattened.
- **Quantise** (`src/num/quantise.ts`): s = the largest integer in [0, 14] with max|w_real| × 2^s ≤ 32767; w = round(w_real × 2^s); b = round(b_real × 4096). Both are saturated.
- `checkBound(layer)` throws if the largest row sum, max over outputs i of Σ_j |w_ij|, times 32768 is ≥ 2^53. It uses the actual weights, not the fan-in.
- **Tables** (`scripts/gen-tables.ts` writes `src/num/tables.gen.ts`, committed):
  - tanh: inputs |x| in [0, 8], 1/128 per entry (32 LSB), 1,025 entries, Q12 out. Odd symmetry. The input is clamped to [−32767, 32767] before the lookup, so the last index read is 1024. Linear interpolation between entries.
  - exp: inputs [−8, 0], same step and size. Clamped below at −32767; 0 for inputs under −8.

**Runtime** (`src/runtime/`): `dense(layer, x)`, `tanhQ(x)`, `expQ(x)`, `mask(scores, allowed)` (forbidden → −32768), `argmax(v)` (the lowest index wins ties). These are pure functions on `Int16Array`/`Int32Array`, with no `Math.*` except `floor` in `shr`. `src/ref/` holds the float versions, used by tests and the trainer only.

**Plant** (`src/sim/`, pure, float, SIM-01 and SIM-04):

- Area 1.0 m², level clamped to [0, 2.0] m.
- Inflow 0.1 m³/s × valve, with valve clamped to [0, 1]. Outflow k × √max(level, 0), with k = 0.05 m^2.5/s.
- Explicit Euler with dt 0.1 s.
- Disturbance: k × 1.2.
- Sensor noise: uniform ±0.005 m, from `rng`. It is added only to the measured level that the controller sees.

**PI:** `u = Kp·e + I`. When u is inside [0, 1], `I += (Kp / Ti)·e·dt`; when it saturates, I is held (conditional integration). At a segment start, I = the steady-state valve.

**RNG** (`src/rng.ts`): xorshift32 on `>>> 0`. A seed of 0 is replaced by 1. `uniform()` = r / 2^32. The default seed is 1.

**Controller interface:** `type Controller = { reset(level: number, setpoint: number): void; step(measured: number, setpoint: number): number }`. Each controller carries its own state.

**Fixed test** (`src/sim/fixed-test.ts`): five 300 s segments. Each resets the plant and controller to steady state at its start level.

- Training set: `0.50→0.25`, `0.25→1.00`, `1.00→1.75`, `1.75→0.50`, and `dist@1.00` (setpoint held at 1.0 m, disturbance from 60 s to 120 s). Noise seeds 1 to 5.
- Held-out set: `0.75→0.35`, `0.35→1.40`, `1.40→1.90`, `1.90→0.75`, `dist@0.35`. Noise seeds 101 to 105.
- Each segment runs every seed; IAE is the mean over seeds, per segment and in total.
- The retuned PI uses Ti = 40·√target. For a `dist@` segment, the target is its level.
- `npm run fixed-test` prints one row per segment: `name  fixedIAE  retunedIAE` in m·s, to 2 decimals.

**Check states:** the measured inputs at every 15th step of the training set at seed 1. That gives 5 × 3,000 / 15 = 1,000 states.

**Lab net inputs**, all Q12:

1. Setpoint, in m.
2. Measured level, in m.
3. Error, in m.
4. Error integral ∫e dt / 32, clamped to ±7.99. It is held while the valve saturates. Steady values are about 10 to 26 m·s, so after /32 they are under 1.

The net is dense 4→16 with tanh, then dense 16→1 with tanh. The valve is (y + 4096) / 8192, clamped to [0, 1]. That makes 97 parameters.

**Test net** (S4 only): dense 4→16 tanh, then 16→5 with no activation, then mask (action 4 forbidden), then argmax. Its weights are uniform in ±0.5 from rng seed 7, quantised as above.

**Weight file** (`src/model/`): `{ "format": "phobos-weights", "version": 1, "layers": [{ "kind": "dense", "in", "out", "shift", "w", "b", "act": "tanh" | "none" }], "meta": { "created", "trainer", "seed" } }`. Loading a file with another `format` or `version` throws.

**Trainer** (`src/train/`, float and Node only):

- **Copy phase:** states come from PI runs at setpoints drawn uniformly from [0.1, 1.9] m, seed 11, 20,000 states. Loss is the MSE between the net valve and the PI valve. Training is SGD with momentum 0.9, learning rate 0.01, batch 64, 2,000 steps, with Xavier-uniform initialisation (seed 13). After the phase, the weights are quantised.
- **ES phase:** runs on the integer net. 50 generations, population 32 with antithetic pairs, σ = 64 LSB, Gaussian noise by Box-Muller from rng seed 17. The update is the rank-weighted mean, with step 0.5. Fitness is −(training-set IAE).
- **Logs:**
  - `models/lab/log.json`: `{ version: 1, entries: [{ phase: "copy" | "es", step, loss?, iae? }] }`.
  - `models/lab/snapshots.json`: 10 copy-phase snapshots (quantised) and 10 ES snapshots, each `{ phase, step, layers }`.
  - `models/lab/verdict.json`: the held-out results.
- **Verdict rule:** "Net beats fixed PI" = net total IAE < fixed total IAE on the held-out set, and no held-out segment worse than fixed by more than 5%. This is open question 1.

**Lab** (`src/lab/`):

- Canvas curves read one model object, `{ t, level, setpoint, valve, history }`. `history` is a ring buffer of the last 600 s (SIM-01).
- The sim runs at 10× real time.
- Slider: 0.1 to 1.9 m, step 0.05.
- Tests reach the page through `window.__lab = { state(), step(seconds), setSetpoint(m) }`.
- `scripts/build-lab.ts` bundles the page with esbuild into `dist/lab.html`. It inlines `models/lab/*.json` when they exist and hides the panels that need them when they don't.

**Scripts** (each added in the slice that creates its file): `check` = `tsc -p . && node --test "tests/**/*.test.ts" && node .claude/skills/test-design/scripts/test-traps.mjs && node .claude/master/sync.mjs --check`; `build:lab`; `test:browser` = `npm run build:lab && node e2e/lab-smoke.mjs` (container Playwright, WEB-05); `fixed-test`; `gen-tables`; `train:lab`.

**Pins:** `.nvmrc` 22.23.4, `packageManager` npm@10.9.9 (WEB-01). Dev dependencies, pinned exactly: typescript 7.0.2, esbuild 0.28.2, @types/node at the newest 22.x on install. No runtime dependencies.

**Publishing Lab:** the build session publishes `dist/lab.html` with the Artifact tool and records the URL in HANDOFF. Later slices republish to the same URL.

## Slices

### S1 Lab v0: tank and PI live (M1)

- **Morgan tries:** opens the Lab link and drags the setpoint; taps Disturbance.
- **Checks that fail now:** J1; `tests/sim.test.ts` (steady state at 1.0 m holds level within ±0.01 m over 300 s with valve 0.5 ± 0.01); `tests/trace.test.ts` (the seed-1, 600 s trace, sampled every 10 s, equals `tests/golden/trace-seed1.json`; the golden file changes only in a commit that says why, SIM-02).
- **Files:**
  - `package.json` (`check`, `build:lab`, `test:browser`)
  - `.nvmrc`, `tsconfig.json`, `LICENSE` (MIT), `ATTRIBUTION.md`
  - `src/sim/plant.ts`, `src/sim/pi.ts`, `src/rng.ts`, `src/lab/*`, `scripts/build-lab.ts`
  - `tests/sim.test.ts`, `tests/trace.test.ts`, `tests/golden/trace-seed1.json`, `e2e/lab-smoke.mjs`
  - `.github/workflows/ci.yml` (setup-node with `.nvmrc`, `npm ci`, `npm run check`)
  - `AGENTS.md` (local checks with a measured time budget; the `shr` exception)
- **Waits on:** `docs/UI_STYLE.md` (the `ui-style` skill) and a `ui-mockups` mock-up of the Lab screen approved by Morgan. Both are done in the build session before code.

### S2 The gap per level (M1)

- **Morgan tries:** taps "Run fixed test" and reads the bars.
- **Checks that fail now:** J2.
- **Files:** `src/sim/fixed-test.ts`, `scripts/fixed-test.ts`, `package.json` (`fixed-test`), `src/lab/` (test panel), `tests/fixed-test.test.ts`.
- **Waits on:** S1.

### S3 Numbers and tables (M2)

- **Morgan tries:** opens Lab's "Tables" panel: tanh and exp from the integer tables drawn over the float curves, with the maximum error printed in Q12 LSB and as a % of the output range.
- **Checks that fail now:** `tests/num.test.ts` covers:
  - `sat16`;
  - `shr(−5, 1) = −3`;
  - quantise picks s as specified;
  - `checkBound` throws on a layer whose bound reaches 2^53;
  - lookups at −32768 and 32767 return finite values.

  `tests/tables.test.ts` checks that table error is ≤ 1% of output range at every Q12 input, and that a fresh generation matches the committed table within 1 LSB.
- **Files:** `src/num/*`, `scripts/gen-tables.ts`, `src/num/tables.gen.ts`, `package.json` (`gen-tables`), `src/lab/` (tables panel), `docs/NUMBERS.md`, `tests/num.test.ts`, `tests/tables.test.ts`.
- **Waits on:** S1.

### S4 Dense, mask and the float reference (M2)

- **Morgan tries:** in Lab, a fixed-seed Lab-shaped net's integer valve drawn over its float valve while the PI runs the tank, with the agreement % printed.
- **Checks that fail now:** J3 (`tests/runtime.test.ts`). It covers per-layer 1%, using the same integer inputs for both the integer layer and its float reference; the Lab-shape valve within 0.01 on ≥ 99% of the check states; test-net argmax agreement ≥ 99%; mask; and ties.
- **Files:** `src/runtime/*`, `src/ref/*`, `src/model/*`, `src/lab/` (integer vs float panel), `tests/runtime.test.ts`.
- **Waits on:** S2 (check states) and S3.

### S5 Copy the PI (M3)

- **Morgan tries:** turns on "Net" in Lab. A net that copied the PI runs a second tank beside it, with the heat map.
- **Checks that fail now:**
  - J4.
  - `tests/train.test.ts`: the gradient check (finite differences, relative error < 1e-4 on 20 random parameters).
  - The copy-phase loss after 200 seeded steps is below half its first value.
  - `tests/weights.test.ts`: the committed file loads, and a wrong version throws.
- **Files:** `src/train/copy.ts`, `scripts/train-lab.ts`, `package.json` (`train:lab`), `models/lab/weights.json`, `models/lab/log.json`, `models/lab/snapshots.json` (copy phase), `src/lab/` (net toggle, heat map), `tests/train.test.ts`, `tests/weights.test.ts`.
- **Waits on:** S4.

### S6 Evolution strategies, replay and verdict (M3)

- **Morgan tries:** opens Replay, drags the snapshot slider, and reads the verdict.
- **Checks that fail now:**
  - J5.
  - `tests/es.test.ts`: on a seeded 5-generation run, the mean-update net's training IAE after the run is lower than before it. It must not fall back to keeping the best candidate.
- **Files:** `src/train/es.ts`, `src/sim/verdict.ts`, `scripts/train-lab.ts`, `models/lab/*` (adds ES snapshots and `verdict.json`), `src/lab/` (Replay tab, verdict panel), `tests/es.test.ts`, `tests/verdict.test.ts`.
- **Waits on:** S5, and a mock-up of the Replay tab approved by Morgan.

## Verification

- Every push: `npm run check` (S1 measures it and writes the budget in AGENTS.md, VER-11).
- Lab changes: `npm run test:browser` locally, with the 400 px screenshot in the PR.
- Device check: Morgan opens the Lab link on a phone. It counts only with Morgan's word (VER-07).

## Open questions

1. Verdict rule: lower total held-out IAE, plus no segment worse by more than 5% (proposed). Or must the net be better on every segment?
2. Not for this spec: `docs/CONCEPT.md` "Open for design" and its hard limits are superseded by D-003 to D-010. CONCEPT stays as the brainstorm snapshot.
