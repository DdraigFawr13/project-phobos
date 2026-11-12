# Project Phobos

- **Date:** 2026-11-12. **Pages:** [open questions](https://claude.ai/artifact/CWe59DHA7ZPbUkVJmKw1jB), [concepts](https://claude.ai/artifact/JNtooM3ZuWKXaAZYCiD35F), [starting kit (research)](https://claude.ai/artifact/EVuiy8JUePatybTyAfjDN5), [round 1](https://claude.ai/artifact/La7nUtxy3EUYVnYozX9go5). **Agent cost:** $1.01 measured (critique $0.25, two research agents $0.36 and $0.40).
- **Source:** Morgan's "Project Vulcan: Dual-System Proactive Hybrid Neural Engine" brief v2.0 (uploaded 2026-11-11, not in this repo).

## Pitch

A toolkit for small neural controllers that run on exact integer maths inside TypeScript apps and on PLCs. Its first job is colonists in Project Vulcan who pursue their own goals instead of only reacting. Its second job is letting an AI agent build a new controller for any goal from this repo's instructions.

## Who it's for

- Morgan, as an exploratory and learning project: "whatever comes of it is fine" (round 1).
- Players of Project-Vulcan (browser, Phaser 4, engine in a Web Worker), then Silvanus (phone PWA).
- Controls-Simulator and Morgan's PID work: models exported to Structured Text and tested in the simulator.
- AI agents in any of Morgan's repos, told "your goal is X, create the model using the instructions in this repo" (open questions).

## Core loop or idea

1. **Core runtime (C):** TypeScript integer runtime with the brief's blocks (dense, KAN, state-space cell, CfC, SwiGLU, action mask); exp and tanh as tables; golden tests against a float reference.
2. **Lab v0 (E), early:** one browser page, a tank-level plant, a small net learning to hold level, with live curves Morgan can watch on a phone.
3. **Trainer:** TypeScript or Python, decided in design.
4. **Vulcan brain (A):** the brief's slow planner and fast per-tick net, tested against a plain baseline on fixed seeds.
5. **Exporters and agent recipes (B):** Structured Text for Controls-Simulator; instructions so an agent can build a new model from a goal.

## What it isn't

- Not code that implements safety functions or runs a live plant on its own. It produces tested code for Controls-Simulator's simulator; putting a model on real equipment is Morgan's engineering call, with output clamped and a classic PID as fallback.
- Not a float or GPU runtime inside the apps. Vulcan bans transcendental `Math` in its engine (V-006) and Silvanus's sim is integers only (`docs/CHARTER.md:114`).
- Not a copy of GPL or unlicensed code: ICSML (GPL-3.0) and OpenAI RND (no licence) are ideas only.

## Concepts dropped

- **A Mind, B Kit, C Fixed, E Lab:** merged into the chosen concept, as its layers in build order (round 1 finding 1, agreed).
- **D Hybrid** (readable planner and utility AI, learning only where it wins): parked by Morgan. Its utility scorer comes back as the plain baseline every learned block must beat (round 1 finding 4, agreed).

## Kill criteria

Morgan treats this as exploratory, so these signal a change of course, not a stop:
- The integer runtime can't match the float reference within a stated error bound on every layer: stop adding blocks until it does.
- After the Vulcan brain is trained, it doesn't beat the plain baseline on the proactive test below over a fixed seed list: drop the extra blocks and keep the baseline.
- A Lab or recipe step runs past one milestone without something Morgan can see working: cut it back to the smallest visible version.

## Open questions

- Hard limits (time per week, money for cloud training, platforms): asked three times, still blank. Default until answered: free CPU training only.
- "Proactive", agreed in round 1: a colonist starts goal work while its needs are met, and that work closes an ambition gap faster than Vulcan's current priority-list mind on the same seeds. Morgan: "colonists have goals that they work toward."
- The brief's own figures are wrong and are not targets: its code counts 4,922 System 1 and 1,371 world-model parameters (brief: ~1,580 and ~480); latency figures are unmeasured; the four ambitions have three name sets; its Mamba step ignores `dt`.
- Brainstorm trial:
  - 2026-11-12: 5 concepts made; dropped with reasons: yes; kill criteria: yes; rounds: 1; measured agent cost $1.01 (plus research Morgan asked for, included); measures 2 and 3 pending design.

## Design brief

For `planning-interview` to start from.

**Settled (don't reopen):**
- The combined concept and its build order: core runtime, Lab v0, trainer, Vulcan brain, exporters and agent recipes.
- Runtime is TypeScript on exact integer maths (`+ - * /` on integers, tables for transcendental functions), bit-identical across browsers.
- Every learned block must beat a plain baseline on a stated test, or it is dropped.
- Resources: the starting-kit page. Port from MIT and Apache-2.0 references with credit; GPL and unlicensed code are ideas only.
- Vulcan targets about 30 colonists (V-027), not 250.

**Open for design:**
- Trainer language: all TypeScript (one language, slower) or Python (PyTorch, faster) with export.
- Number format: int8 or int16 weights, scale and shift per layer, table sizes and the error bound each must meet.
- Weight file format (Phobos JSON proposed; safetensors optional).
- Lab v0's plant, screens and how Morgan opens it on a phone.
- How Vulcan consumes Phobos (npm package, git dependency like `story-generator`, or vendored files) and how a choice becomes a readable cause line for the inspector (V-036).
- Per-NPC weights for online learning, or shared weights plus per-NPC state.
- How Structured Text export is tested (Controls-Simulator's simulator, CODESYS).
- Hard limits, still unanswered.
