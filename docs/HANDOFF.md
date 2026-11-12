# Handoff

Updated: 2026-11-12. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

Plan approved 2026-11-12 (D-004 to D-010). Writing the spec for the first usable version (`write-spec`).

## Plan map

Shown at the start of a session and when asking the owner to approve a PR or a merge (WS-08). One line per step, marked done ✔, now ▶ or later ○.

- ✔ Brainstorm: `docs/CONCEPT.md`.
- ✔ Bootstrap AI-Master-Instructions (D-001).
- ✔ Planning interview, approved (D-003 to D-010).
- ▶ Spec for the first usable version, then Morgan's approval.
- ○ M1 Lab v0: tank and fixed-gain PID at several levels.
- ○ M2 Integer runtime: dense, mask, tables, golden tests.
- ○ M3 Trained net in Lab with training replay.
- ○ Vulcan test bench, then Vulcan brain; Later list in D-004.

## Just done

- 2026-11-12 Bootstrap: manifest, sync, starter files, CI with the drift check.

## Next

1. Draft spec `docs/specs/first-usable.md` written; three fresh checks (paraphrase, critic, zero-decisions) running. Next: sort findings (write-spec step 6), reconcile items, then a spec approval page.
   Reconcile items to raise: Lab net design (97 params), ES on the integer net, Playwright local only, dev deps typescript 7.0.2 / esbuild 0.28.2 / @types/node, "beats across the range" = total IAE or every segment.

Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ) (approved 2026-11-12).

## Open questions

- None open from planning.

## Decisions since the last plan update

- 2026-11-12 D-001 harness; D-002 concept; D-003 round 1; D-004 plan approved; D-005 platforms; D-006 number spec; D-007 accuracy; D-008 training; D-009 Lab pass mark; D-010 files and licence.
