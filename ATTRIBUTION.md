# Attribution

Code and assets this project uses or ports, with their licences (SAFE-05, AGENTS.md "Project rules"). Port only MIT or Apache-2.0 code; GPL and unlicensed code are ideas only.

## Ported code

- None yet. The plant, PI, RNG and Lab are written for this project from `docs/specs/first-usable.md`.
- `src/vulcan/pairs.ts` `lineText` fills Vulcan's ledger templates (Vulcan `src/content/data/events.json`, read at run time from Morgan's own Vulcan checkout, not stored here) the way Vulcan's `src/engine/log/render.ts` does: `{key}` from the line's data, `{actorN}`/`{subjectN}` as names. Written for this project from that format; no Vulcan code is copied.

## Assets loaded at run time

- IBM Plex Sans, IBM Plex Sans Condensed and IBM Plex Mono (Lab's faces, `docs/UI_STYLE.md`): SIL Open Font License 1.1, by IBM. Loaded from Google Fonts by `dist/lab.html`; not stored in the repo.

## Tools (dev dependencies, not shipped)

- TypeScript 7.0.2 (Apache-2.0), esbuild 0.28.2 (MIT), @types/node 22.20.5 (MIT), Prettier 3.9.10 (MIT). D-012.
