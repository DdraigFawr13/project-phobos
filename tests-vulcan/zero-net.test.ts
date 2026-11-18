// J3 (docs/specs/vulcan-bench.md): a net whose output layer is zero gives exactly today's trace, also after a clone
// taken with its line cache. Needs a Vulcan checkout at `vulcan.pin` (docs/vulcan-setup.md). Local only (R7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadVulcan, type Engine, type Line } from "../src/vulcan/engine.ts";
import { start } from "../src/vulcan/measure.ts";
import { cloneRun } from "../src/vulcan/clone.ts";
import { makeHook, netPolicy, type Cache, type Policy } from "../src/vulcan/lines.ts";
import { zeroLineNet } from "../src/vulcan/train.ts";
import { randomNet } from "../src/model/random.ts";
import { LINE_SHAPE } from "../src/vulcan/train.ts";

const vulcan = await loadVulcan();
const engine: Engine = vulcan.engine;

/** Steps `days` days an hour at a time, keeping every ledger line `step` returns. */
function days(policy: Policy | null, n: number) {
  const cache: Cache = new Map();
  const { sim, world } = start(engine, "anvil", policy ? makeHook(engine, cache, policy) : undefined);
  const lines: Line[] = [];
  for (let h = 0; h < n * 24; h++) lines.push(...engine.step(world, sim, 60));
  return { sim, world, cache, lines };
}

test("zero-net-is-today: anvil, 3 days, the zero net's lines and world equal today's rule", () => {
  const today = days(null, 3);
  const zero = days(netPolicy(zeroLineNet()), 3);
  assert.ok(zero.cache.size > 0, "the hook was never called");
  assert.equal(JSON.stringify(zero.lines), JSON.stringify(today.lines));
  assert.ok(JSON.stringify(zero.world) === JSON.stringify(today.world), "world differs from today's");
});

test("clone-continues-with-net: a run cloned at day 1 with its line cache continues as the original", () => {
  // The zero net (equals today) and a random net whose lines differ from today's (so the cache matters).
  const moving = netPolicy(randomNet(LINE_SHAPE, 5));
  for (const [name, policy] of [
    ["zero", netPolicy(zeroLineNet())],
    ["random", moving],
  ] as const) {
    const cache: Cache = new Map();
    const { sim, world } = start(engine, "anvil", makeHook(engine, cache, policy));
    engine.step(world, sim, engine.TICKS_PER_DAY + 37); // mid-hour, so the cache holds this hour's offsets
    const copy = cloneRun({ world, cache });
    const copySim = engine.createSim(engine.content);
    engine.setLineHook(copySim, makeHook(engine, copy.cache, policy));
    // Within the same hour the clone must use the copied offsets, not ones recomputed from minute 37's state.
    const a = engine.step(world, sim, 22);
    const b = engine.step(copy.world, copySim, 22);
    assert.deepEqual(copy.cache, cache, `${name}: cache within the hour`);
    a.push(...engine.step(world, sim, 2 * engine.TICKS_PER_DAY));
    b.push(...engine.step(copy.world, copySim, 2 * engine.TICKS_PER_DAY));
    assert.equal(JSON.stringify(b), JSON.stringify(a), `${name}: lines`);
    assert.ok(JSON.stringify(copy.world) === JSON.stringify(world), `${name}: clone drifted from the original`);
    assert.deepEqual(copy.cache, cache, `${name}: cache`);
  }
  // The random net really moves the lines: its 3 days differ from today's.
  assert.ok(JSON.stringify(days(moving, 3).world) !== JSON.stringify(days(null, 3).world), "random net is today");
});
