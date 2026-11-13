# Lessons

One line per mistake. Read the entries for an area before working in it. When a mistake repeats, bump its count; at ×2 it also becomes a rule (in DECISIONS, AGENTS.md, or proposed to AI-Master-Instructions). Mark retired entries SUPERSEDED; never delete them.

Format: `- <area> · <mistake> · <root cause> · <rule> · ×<n> (<YYYY-MM-DD>)`

- ci · pushed and marked the PR ready in the same second; the draft push's skipped run cancelled the ready run, so CI never ran the checks and GitHub showed the PR clean · one concurrency group for draft and ready runs · give draft runs their own group, and read the job conclusion (not the PR's merge state) before merging · ×1 (2026-11-12)
- git · cut the S5 branch from a stale local `origin/main` (PR #1 era), so the tree had no code · the container's clone had not fetched since · run `git fetch origin main` before `git checkout -b <branch> origin/main` · ×1 (2026-11-13)
- ui · used `--ink` as "dark" for the heat map's negative squares; in dark theme `--ink` is near-white, so the legend lied · tokens name a role, not a shade · pick a token whose role fits in both themes and read both screenshots before writing colour words · ×1 (2026-11-13)
- train · judged the copied net only open loop (on the PI's own runs) and in control at 0.3 to 1.5 m; it could not hold 0.10 m, and Morgan found it on the phone · copy data had no disturbances, so one input carried no information and the net ignored it; open-loop scores can't see that · test a learned controller in control across its whole range, and give every input variation the others don't explain · ×1 (2026-11-13)
- train · mapped the net's tanh output to the valve as (y + 1) / 2, so a shut valve needed tanh = −1; the trained nets never shut it and lost on low levels (found in S6, fixed by D-018) · an actuator's end sat where the output's slope is zero, so the loss could not pull the net there · map a bounded output so every actuator end is reached inside the activation's range (here ±0.8), and test the trained net at each end · ×1 (2026-11-13)
