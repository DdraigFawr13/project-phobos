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
