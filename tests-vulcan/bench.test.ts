// J2 (docs/specs/vulcan-bench.md): the bench measures today's rule as Vulcan's `npm run balance` does, and refuses a
// Vulcan checkout that is dirty or not at `vulcan.pin`. Needs a Vulcan checkout (VULCAN_DIR, default
// ../Project-Vulcan; docs/vulcan-setup.md). Local only: `npm run test:vulcan` (R7). About 65 s, most of it one
// anvil seed-year.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadVulcan } from "../src/vulcan/engine.ts";
import { foodNudge, start } from "../src/vulcan/measure.ts";
import { HELD_OUT_SEEDS, NUDGE, nthPerson } from "../src/vulcan/bench.ts";
import { cloneRun } from "../src/vulcan/clone.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const bench = join(root, "scripts/bench-vulcan.ts");
const pin = readFileSync(join(root, "vulcan.pin"), "utf8").trim();
const vulcanDir = process.env.VULCAN_DIR ?? join(root, "../Project-Vulcan");

// Vulcan `npm run balance -- anvil` at the pin (Node 24.19.0, measured 2026-11-18; equal to b08ffba's).
const ANVIL = { alive: 5, hungryDays: 11, tiredDays: 202, coldDays: 166, food: 483 };
const ANVIL_FIRSTS = { "metal.smelted": 30, "smithy.built": 97, "smith.made": 110 };
const COLUMNS =
  "seed | alive | hungryDays | tiredDays | coldDays | crowdedDays | coldNotable | notable | minWarmth | minMood | food | fullDays | houses | days";

const run = (args: string[], dir: string) =>
  spawnSync(process.execPath, [bench, ...args], { env: { ...process.env, VULCAN_DIR: dir }, encoding: "utf8" });
const git = (dir: string, ...args: string[]) => {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};

test(
  "bench-matches-balance: anvil's table row and metal firsts equal Vulcan balance at the pin",
  { timeout: 300_000 },
  () => {
    const r = run(["anvil"], vulcanDir);
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split("\n");
    assert.equal(lines[0], COLUMNS);
    const row = lines.find((l) => l.startsWith("anvil | "));
    assert.ok(row, r.stdout);
    const cells = Object.fromEntries(COLUMNS.split(" | ").map((c, i) => [c, row.split(" | ")[i]]));
    assert.equal(Object.keys(cells).length, 14);
    for (const [k, v] of Object.entries(ANVIL)) assert.equal(Number(cells[k]), v, k);
    assert.equal(cells.days, "336.25");
    const metal = lines.find((l) => l.startsWith("anvil metal chain, first day: "));
    assert.ok(metal, r.stdout);
    for (const [k, v] of Object.entries(ANVIL_FIRSTS))
      assert.match(metal, new RegExp(`${k.replace(".", "\\.")} ${v}(,|$)`), k);
    assert.ok(lines.includes(`vulcan ${pin}`), r.stdout);
    assert.match(r.stdout, /^seconds per seed-year \d+(\.\d)?$/m);
  },
);

test("bench-refuses-dirty-or-unpinned: a clone one commit back, then the pin with an extra file, exit 1 with why", () => {
  const tmp = mkdtempSync(join(tmpdir(), "phobos-vulcan-"));
  try {
    const dir = join(tmp, "vulcan");
    spawnSync("git", ["clone", "--quiet", "--shared", "--no-checkout", vulcanDir, dir], { encoding: "utf8" });
    git(dir, "checkout", "--quiet", `${pin}~1`);
    const back = git(dir, "rev-parse", "HEAD");
    const unpinned = run(["anvil"], dir);
    assert.equal(unpinned.status, 1);
    assert.match(unpinned.stderr, new RegExp(`at ${back}, not the pinned ${pin}`));
    assert.equal(unpinned.stdout, "");

    git(dir, "checkout", "--quiet", pin);
    writeFileSync(join(dir, "extra.txt"), "not Vulcan's\n");
    const dirty = run(["anvil"], dir);
    assert.equal(dirty.status, 1);
    assert.match(dirty.stderr, /has uncommitted changes: \?\? extra\.txt/);
    assert.equal(dirty.stdout, "");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("noise-nudge-changes-world: each day-1 food nudge on a held-out seed gives a different world at day 2", async () => {
  const { engine } = await loadVulcan(vulcanDir);
  const twoDays = (seed: string, k?: number) => {
    const hook =
      k === undefined
        ? undefined
        : (() => {
            const p = nthPerson(engine, seed, k);
            return foodNudge(engine, p.id, p.startTick, NUDGE.add);
          })();
    const { sim, world } = start(engine, seed, hook);
    engine.step(world, sim, 2 * engine.TICKS_PER_DAY);
    return createHash("sha256").update(JSON.stringify(world)).digest("hex");
  };
  for (const seed of HELD_OUT_SEEDS) {
    const today = twoDays(seed);
    assert.equal(twoDays(seed), today, `${seed}: today's rule repeats`);
    for (let k = 0; k < NUDGE.people; k += 1) assert.notEqual(twoDays(seed, k), today, `${seed} person ${k}`);
  }
});

test("clone-run-continues: a run cloned at day 1 continues as the original to day 2 (empty line cache)", async () => {
  const { engine } = await loadVulcan(vulcanDir);
  const { sim, world } = start(engine, "anvil");
  engine.step(world, sim, engine.TICKS_PER_DAY);
  const copy = cloneRun({ world, cache: new Map() });
  assert.notEqual(copy.world, world);
  engine.step(world, sim, engine.TICKS_PER_DAY);
  engine.step(copy.world, sim, engine.TICKS_PER_DAY);
  assert.ok(JSON.stringify(copy.world) === JSON.stringify(world), "clone drifted from the original");
});
