# Agent instructions

Project Phobos: a toolkit for small neural controllers on exact integer maths in TypeScript (and exported to PLC Structured Text), first used for proactive colonists in Project-Vulcan. For Morgan, as an exploratory learning project; see `docs/CONCEPT.md`.

Shared rules come from AI-Master-Instructions and load through CLAUDE.md (`.claude/master/RULES.md`). This file holds only what is specific to this project. Keep it under 80 lines.

## Read first

1. `docs/HANDOFF.md`: current state and next step.
2. `docs/DECISIONS.md`: settled rules. Don't reopen them.
3. `docs/LESSONS.md`: entries for the area you are about to work in.
4. `docs/CONCEPT.md`: pitch, kill criteria and the Design brief (Settled / Open for design).
5. `docs/UI_STYLE.md`: before any Lab screen work.

## Local checks (run before pushing)

- Every push: `npm run check` (type check, `node --test` unit and golden tests, test-traps, master drift check). Measured 6.6 s on 2026-11-13 (88 tests, after D-018; `tests/es.test.ts` reruns 5 ES generations on 3 worker threads, about 4 s, and `tests/train.test.ts` retrains the copy phase, about 1 s); budget 10 s.
- Lab changes: `npm run test:browser`, 5.6 to 6.0 s (builds `dist/lab.html`, runs `e2e/lab-smoke.mjs` in the container's Chromium at 400 px, light and dark, Live, Fixed test, Tables, Integer vs float, Net and Replay tabs; screenshots in `test-results/`). Put the 400 px screenshot in the PR.
- Training: `npm run train:lab` rewrites `models/lab/*.json` (copy phase, then ES on worker threads, then the verdict; 41.1 s on 2026-11-13 with 3 workers); commit the files it changes, saying why (SIM-02).

## What CI runs

- **CI** (`ci.yml`): `npm ci` and `npm run check` on non-draft PR updates and `main` pushes. Markdown and `docs/**` changes skip it. Browser tests are local only (D-013).
- No deploys yet.

## Project rules

- Runtime maths is integers only: `+ - * /`, shifts and lookup tables; no float `Math` in the runtime path. One exception: `shr` in `src/num/fixed.ts` uses `Math.floor(x / 2 ** n)`, exact below 2^53 (`docs/NUMBERS.md`). Why: bit-identical results across browsers, Vulcan V-006, Silvanus integer sim (CONCEPT.md).
- Every learned block ships with a plain baseline and a stated test it must beat on a fixed seed list, or it is dropped. Why: kill criteria in CONCEPT.md.
- Integer layers have golden tests against a float reference within a stated error bound.
- Never write code that implements a safety function or drives a live plant; exports target Controls-Simulator's simulator, with output clamps and a classic PID fallback. Why: CONCEPT.md "What it isn't".
- Port only MIT or Apache-2.0 code, with credit in `ATTRIBUTION.md`; GPL (ICSML) and unlicensed (OpenAI RND) code are ideas only (SAFE-05).
- The brief's parameter counts and latency figures are wrong; never use them as targets (CONCEPT.md Open questions).

## Overrides

Master rules this project deliberately changes. Each line names the rule id and the reason; the same entry is in `.ai-master.json` "overrides".

- None.
