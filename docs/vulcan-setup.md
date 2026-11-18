# Vulcan setup for the bench

The Vulcan bench (`docs/specs/vulcan-bench.md`, R6) reads a Vulcan checkout at `VULCAN_DIR` (default `../Project-Vulcan`, beside this repo). The checkout must be clean and at the commit in `vulcan.pin`, or `npm run bench:vulcan` and `npm run test:vulcan` refuse with the reason. A new pin is a commit saying why, and reruns `npm run test:vulcan` (J2).

## Checkout

```sh
git clone https://github.com/DdraigFawr13/Project-Vulcan ../Project-Vulcan   # public; anonymous read works
git -C ../Project-Vulcan checkout "$(cat vulcan.pin)"
```

Where Vulcan's own `npm ci` works, run it in the checkout and stop here.

## Cloud sessions: `npm ci` 403s on story-generator

In this project's cloud containers, `codeload.github.com` returns 403, so Vulcan's `npm ci` fails on its story-generator dependency (a codeload tarball URL in Vulcan's `package.json`). The workaround installs everything through a scratch copy and leaves Vulcan's tracked files untouched (`git status` stays clean; `node_modules` is git-ignored there). Done 2026-11-18 at pin `ee016ed3db2dab5f87a4cedcdc825cc8e0d409df`: install 11.4 s.

1. Read the story-generator commit from Vulcan's lockfile (`package-lock.json`, `packages[""].dependencies["story-generator"]`, the hash at the end of the URL). At this pin: `6430856302a3b70c4f45da424251b323b08e6615`.
2. Clone story-generator read-only and export that commit to a folder:
   ```sh
   git clone https://github.com/DdraigFawr13/Story-Generator ../story-generator-src
   mkdir ../sg-6430856
   git -C ../story-generator-src archive 6430856302a3b70c4f45da424251b323b08e6615 | tar -x -C ../sg-6430856
   ```
3. In a scratch folder outside both repos, copy Vulcan's `package.json` and `package-lock.json`; in both, point `story-generator` at `file:<absolute path to ../sg-6430856>`, and delete the lockfile's `node_modules/story-generator` entries.
4. Install there with Vulcan's Node and npm (Vulcan pins Node 24.19.0, npm 11.9.0):
   ```sh
   npm exec --yes --package=node@24.19.0 --package=npm@11.9.0 -- npm install --install-links --ignore-scripts
   ```
   `--install-links` copies the folder in as a package (not a symlink), so its own dependencies install too; `--ignore-scripts` runs no install scripts.
5. Copy the scratch `node_modules` into the Vulcan checkout (`cp -a <scratch>/node_modules ../Project-Vulcan/`), then check `git -C ../Project-Vulcan status --porcelain` prints nothing.

## Node versions

Measured 2026-11-18 at the pin:

- Vulcan `npm run balance -- anvil` under Node 24.19.0 (`npm exec --yes --package=node@24.19.0 -- node tools/balance.mjs anvil`): 42.3 s, alive 5, hungryDays 11, tiredDays 202, coldDays 166, food 483, metal.smelted 30, smithy.built 97, smith.made 110 (unchanged from `b08ffba`).
- Phobos `npm run bench:vulcan` and `npm run test:vulcan` run on Phobos's Node 22.23.4; Vulcan's `tools/engine.mjs` (Vite's module runner) loads there in about 2.5 s, and the anvil numbers equal the Node 24 run.
