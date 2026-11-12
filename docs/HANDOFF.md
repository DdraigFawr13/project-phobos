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

1. Morgan answers the [spec approval page](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR) (collection `spec1`: `verdict`, `deps`, `adds`, `approval`) and says "spec done".
2. On approval: spec Status Approved, DECISIONS for the verdict rule, dev dependencies and spec additions, then mark PR #1 ready and merge (GIT-08). Build S1 in a new session (write-spec step 8): `ui-style` doc and a whole-Lab mock-up first.

Spec checks run: paraphrase, critic, zero-decisions; critic and zero-decisions re-run; final zero-decisions. All findings fixed or put to Morgan.

Pages: [round 1](https://claude.ai/artifact/Cf3i4h6nnKDjhqrQQkbusS), [review 1](https://claude.ai/artifact/SXWLYu44MHB6seWk7yWTjH), [final](https://claude.ai/artifact/EPc7sMpHjHwUNHP96HVwvJ), [spec approval](https://claude.ai/artifact/MHEfcPTujwT9AaCHoHZdLR).

## Open questions

- None open from planning.

## Decisions since the last plan update

- 2026-11-12 D-001 harness; D-002 concept; D-003 round 1; D-004 plan approved; D-005 platforms; D-006 number spec; D-007 accuracy; D-008 training; D-009 Lab pass mark; D-010 files and licence.
