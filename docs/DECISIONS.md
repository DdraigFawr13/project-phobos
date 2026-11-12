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
