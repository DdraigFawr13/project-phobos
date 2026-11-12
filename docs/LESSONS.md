# Lessons

One line per mistake. Read the entries for an area before working in it. When a mistake repeats, bump its count; at ×2 it also becomes a rule (in DECISIONS, AGENTS.md, or proposed to AI-Master-Instructions). Mark retired entries SUPERSEDED; never delete them.

Format: `- <area> · <mistake> · <root cause> · <rule> · ×<n> (<YYYY-MM-DD>)`

- ci · pushed and marked the PR ready in the same second; the draft push's skipped run cancelled the ready run, so CI never ran the checks and GitHub showed the PR clean · one concurrency group for draft and ready runs · give draft runs their own group, and read the job conclusion (not the PR's merge state) before merging · ×1 (2026-11-12)
