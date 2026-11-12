# Phobos first usable version (milestones M1 to M3)

- **Status:** Draft
- **Planned in:** [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), 2026-11-12. **Decisions:** D-002 to D-010.

## Problem

Morgan wants "colonists [that] have goals that they work toward" in Project-Vulcan, and models an agent can build "for any goal" from this repo's instructions (`docs/CONCEPT.md`). Neither exists, and no one knows yet whether small integer nets are worth it. The project is exploratory: "whatever comes of it is fine". Morgan wants to see each step working on a phone, to watch training, and to "see if this would be worth implementing" before trusting the pass mark (D-009 note).

## Goals

- **M1:** Morgan opens Lab on a phone and sees the tank under a fixed-gain PID, live, plus the fixed test's error per level. That shows how large the gap is that a net could close. A throwaway simulation in the planning session (not a test) measured IAE 2.01 m·s for the fixed PI against 1.01 m·s for a PI retuned at 0.25 m. At 1.8 m it was 2.06 against 2.00.
- **M2:** an integer runtime (dense layer, action mask, tanh and exp tables) passes D-007's bounds in CI. Each layer is within 1% of its output range of the float reference, and the integer and float models choose the same action on at least 99% of the fixed test states.
- **M3:** a net trained in Node runs in Lab beside the PID. Lab replays its training, and shows whether it beats the fixed-gain PID on the fixed test (D-009).

## Non-goals

- Live training on the phone, the Structured Text exporter, agent recipes, SwiGLU, KAN, state-space and CfC cells, Vulcan and Silvanus work (D-004 Later list and later phases).
- A Python trainer, unless D-008's switch rule fires.
- Deploying Lab anywhere except as a published Artifact page (D-005).
- Cross-browser bit-identity of the tank plant. The plant runs in floating point (SIM-04); only the net runtime is integer (D-006).

## Journeys and checks

### J1 Watch the tank under the PID (M1)

- **Given** the Lab link on Morgan's phone
- **When** Morgan opens it, drags the setpoint slider and taps Disturbance
- **Then** the level, setpoint and valve curves update live; the level moves toward the new setpoint; the disturbance dips the level, and the PID recovers it. **Check:** `tests/lab-smoke.test.ts` (Playwright on the built page): it moves the slider, waits 10 simulated seconds, and asserts the drawn level has moved toward the setpoint. Plus a screenshot at 400 px width in the PR.

### J2 See the gap per level (M1)

- **Given** Lab is open
- **When** Morgan taps "Run fixed test"
- **Then** a bar per test segment shows the fixed PID's IAE (m·s) beside a PID retuned for that segment's level, with the numbers printed. **Check:** `tests/fixed-test.test.ts` asserts the segment list and that retuned IAE < fixed IAE at 0.25 m; `npm run fixed-test` prints the same table in Node.

### J3 Integer runtime matches float (M2)

- **Given** the committed tables and golden files
- **When** `npm run check` runs
- **Then** every layer is within 1% of its output range of the float reference, the action agreement over the fixed test states is ≥ 99%, and the same seed gives an identical trace. **Check:** `tests/runtime.test.ts`, `tests/tables.test.ts` and `tests/trace.test.ts`, each run in CI.

### J4 Watch a trained net (M3)

- **Given** a weight file committed under `models/lab/`
- **When** Morgan opens Lab and turns on "Net"
- **Then** the net and the PID control two tanks side by side on the same setpoints, and a weights heat map shows the loaded net. **Check:** `tests/lab-smoke.test.ts` adds a case that loads the committed weights and asserts both tanks are drawn; `tests/weights.test.ts` validates the file format.

### J5 Replay training and read the verdict (M3)

- **Given** a training run recorded by `npm run train:lab`
- **When** Morgan opens the Replay tab and drags the snapshot slider
- **Then** the loss curve shows the current point, and the tank plays the fixed test with that snapshot's weights. The verdict line reads "Net beats fixed PID: yes/no (IAE net X, PID Y m·s)". **Check:** `tests/train.test.ts` checks that a short seeded run writes a log with decreasing loss and at least 2 snapshots; the Playwright case drags the slider and asserts the verdict line is present.

## Decisions

- Lab on the phone as a published Artifact page; Node for training and tests (D-005).
- int16 values, sums in JS numbers bounded below 2^53, saturate, power-of-two scales, floor shift, ties to the lowest index, seeded integer RNG, committed tables and golden files (D-006).
- 1% per layer; 99% action agreement (D-007).
- Copy the PID, then evolution strategies; Python only by D-008's rule; training replay in Lab (D-008).
- Tank drains through a fixed opening; the net must beat a fixed-gain PID across the setpoint range (D-009).
- Phobos JSON weights with a format version; MIT licence (D-010).

## Alternatives rejected

- **Live training on the phone in M3**: rejected by Morgan (D-008, final Q2). It would fail when the phone locks and suspends the tab.
- **Pass mark "close to PID"**: replaced by "beats the fixed-gain PID" (D-009). It would fail to say whether the net is worth having.
- **BigInt or int32 sums**: int32 overflows after two int16 × int16 products, and BigInt is slow (D-006, finding 2).
- **Vitest or Jest**: `node --test` runs `.ts` files directly on Node 22.23.4 (type stripping; tried in the planning session), so no test framework dependency is needed. Vitest would be the choice if we needed watch mode or browser-mode tests.
- **A Vite dev server for Lab**: Lab ships as one HTML file, and esbuild 0.28.2 bundles it in one command (tried in the planning session). Vite would be the choice if Lab became a multi-page site.

## Risks

- **The gap is small above 1 m**, so a net may only win at low levels → the fixed test weights all levels equally and the J2 bars show where the gap is; Morgan judges at M1 whether M3 is worth it (D-009).
- **Hand-written backprop for dense + tanh has bugs** → a finite-difference gradient check is a test (D-008's switch rule).
- **Quantisation loses what float training learned** → evolution strategies (S6) score the integer net directly, so the ES stage optimises the net that ships.
- **Playwright in CI costs minutes** → the browser smoke test runs locally and in the PR's screenshot; CI runs only the Node tests (CI-02). Assumption: the Node tests cover the logic the page shows.

## Design

**Repo layout** (all ESM TypeScript, `"type": "module"`, erasable syntax only, imports with `.ts` extensions):

- `src/num/`: fixed-point helpers. `Q = 12` (1.0 = 4096); `sat16(x)` clamps to [-32768, 32767]; `shr(x, n)` = `Math.floor(x / 2**n)` (floor, D-006); `checkBound(fanIn)` throws if `fanIn * 2**30 >= 2**53`.
- `src/num/tables/`: `tanh.json` and `exp.json`, generated by `scripts/gen-tables.ts` and committed. tanh covers [0, 8] in steps of 1/128 (1,025 entries, Q12 out), uses odd symmetry, linear interpolation between entries, and saturates at ±4096 beyond 8. exp covers [-8, 0] in steps of 1/128 (1,025 entries, Q12 out) and is 0 below -8.
- `src/runtime/`: `dense(w, b, x, shift)`, `tanhQ(x)`, `expQ(x)`, `mask(actions, allowed)`, `argmax(v)` (lowest index wins ties). Pure functions on `Int16Array`/`Int32Array`, with no `Math.*` except `floor` in `shr`.
- `src/ref/`: float reference of the same layers, used only in tests and by the trainer.
- `src/sim/`: tank plant and PID, pure, in float (SIM-01, SIM-04). Tank: area 1.0 m², max level 2.0 m, inflow `0.1 m³/s × valve` with valve in [0, 1], outflow `k × sqrt(level)` with k = 0.05 m^2.5/s, dt 0.1 s. PI tuned at 1.0 m by IMC with λ = 10 s: Kp = 1.0 per m, Ti = 40 s, Kd = 0, and conditional-integration anti-windup. Disturbance: k × 1.2 for 60 s. Sensor noise: seeded, ±0.005 m uniform.
- `src/sim/fixed-test.ts`: segments of 300 s each, starting at steady state: 0.5 → 0.25, 0.25 → 1.0, 1.0 → 1.75, 1.75 → 0.5, then a disturbance at 1.0 m. It returns IAE per segment and in total, for any controller `(state) => valve`. The retuned PID per segment uses the same IMC rule at the segment's target level.
- `src/rng.ts`: one seeded integer RNG, xorshift32 on `>>> 0`.
- `src/model/`: weight file type and loader. Format: `{ "format": "phobos-weights", "version": 1, "layers": [{ "kind": "dense", "in": n, "out": m, "shift": s, "w": number[], "b": number[], "act": "tanh" | "none" }], "meta": { ... } }`.
- `src/train/`: copy-PID supervised training in float with hand-written backprop, then quantisation to int16, then evolution strategies on the integer net scored by fixed-test IAE. It writes `models/lab/weights.json`, `models/lab/log.json` (loss per step) and `models/lab/snapshots.json` (≤ 20 weight snapshots).
- `src/lab/`: the page. It renders curves on a canvas and reads one model object (SIM-01); `scripts/build-lab.ts` bundles it with esbuild into `dist/lab.html`, with the weights, log and snapshots inlined.
- **Lab net:** inputs (setpoint, level, error, clamped error integral), all Q12; hidden layer of 16 with tanh; output of 1, mapped from [-1, 1] to valve [0, 1]. That is 4 × 16 + 16 + 16 + 1 = 97 parameters.

**Scripts** (`package.json`): `check` = `tsc -p . && node --test "tests/**/*.test.ts" && node .claude/skills/test-design/scripts/test-traps.mjs && node .claude/master/sync.mjs --check`; `test:browser` = Playwright smoke; `build:lab`; `fixed-test`; `gen-tables`; `train:lab`.

**Pins:** `.nvmrc` 22.23.4, `packageManager` npm@10.9.9 (WEB-01). Dev dependencies: typescript 7.0.2, esbuild 0.28.2, @types/node 22.x (exact version pinned at install). There are no runtime dependencies. Playwright comes from the container (WEB-05).

**Publishing Lab:** the build session publishes `dist/lab.html` with the Artifact tool and records the URL in HANDOFF. Later slices republish to the same URL.

## Slices

### S1 Lab v0: tank and PID live (M1)

- **Morgan tries:** opens the Lab link and drags the setpoint; taps Disturbance.
- **Checks that fail now:** J1; `tests/sim.test.ts` (steady state at 1.0 m gives valve 0.5 ± 0.01); `tests/trace.test.ts` (same seed, same 600 s trace).
- **Files:** `package.json`, `.nvmrc`, `tsconfig.json`, `LICENSE` (MIT), `ATTRIBUTION.md`; `src/sim/*`, `src/rng.ts`, `src/lab/*`, `scripts/build-lab.ts`; `tests/sim.test.ts`, `tests/trace.test.ts`, `tests/lab-smoke.test.ts`; `.github/workflows/ci.yml` (add setup-node with `.nvmrc`, `npm ci`, `npm run check`); `AGENTS.md` local checks with a time budget; `docs/UI_STYLE.md`.
- **Waits on:** a `ui-style` doc and a `ui-mockups` mock-up of the Lab screen, approved by Morgan.

### S2 The gap per level (M1)

- **Morgan tries:** taps "Run fixed test" and reads the bars.
- **Checks that fail now:** J2.
- **Files:** `src/sim/fixed-test.ts`, `scripts/fixed-test.ts`, `src/lab/` (test panel), `tests/fixed-test.test.ts`.
- **Waits on:** S1.

### S3 Numbers and tables (M2)

- **Morgan tries:** opens Lab's "Tables" panel, with tanh and exp drawn from the integer tables over the float curves, and the maximum error printed.
- **Checks that fail now:** `tests/num.test.ts` (sat16, floor shift on negatives, bound check throws at fan-in 2^23); `tests/tables.test.ts` (table error ≤ 1% of output range; the tables in the repo equal a fresh generation).
- **Files:** `src/num/*`, `scripts/gen-tables.ts`, `src/num/tables/*.json`, `src/lab/` (tables panel), `docs/NUMBERS.md` (the number spec, one page).
- **Waits on:** S1.

### S4 Dense, mask and the float reference (M2)

- **Morgan tries:** in Lab, a fixed-seed random net's integer output drawn over its float output while the PID runs the tank, with the agreement % printed.
- **Checks that fail now:** J3 (`tests/runtime.test.ts`: per-layer 1%, ≥ 99% action agreement on 1,000 fixed states from the fixed test, mask zeroes forbidden actions, argmax ties go to the lowest index).
- **Files:** `src/runtime/*`, `src/ref/*`, `src/model/*`, `tests/runtime.test.ts`, `tests/weights.test.ts`, `src/lab/` (integer vs float panel).
- **Waits on:** S3.

### S5 Copy the PID (M3)

- **Morgan tries:** turns on "Net" in Lab; a net that copied the PID runs a second tank beside it, with the heat map.
- **Checks that fail now:** J4; `tests/train.test.ts` gradient check (finite differences, relative error < 1e-4) and copy-PID loss falling over a 200-step seeded run.
- **Files:** `src/train/supervised.ts`, `src/train/quantise.ts`, `scripts/train-lab.ts`, `models/lab/*`, `src/lab/` (net toggle, heat map).
- **Waits on:** S4.

### S6 Evolution strategies and replay (M3)

- **Morgan tries:** opens Replay, drags the snapshot slider, and reads the verdict.
- **Checks that fail now:** J5; ES on the integer net lowers fixed-test IAE over a seeded 20-generation run.
- **Files:** `src/train/es.ts`, `scripts/train-lab.ts`, `models/lab/*`, `src/lab/` (replay tab, verdict).
- **Waits on:** S5. A mock-up of the Replay tab, approved by Morgan.

## Verification

- Every push: `npm run check` (budget to be measured in S1 and written in AGENTS.md, VER-11).
- End to end: `npm run test:browser` locally before each PR with a Lab change, and a 400 px screenshot in the PR. Device check: Morgan opens the Lab link on a phone (VER-07).

## Open questions

- None. The gap above 1 m may be too small to matter; Morgan decides at M1 (D-009).
