// J4 (docs/specs/vulcan-bench.md): training starts from today. One generation of 2 members on 2-day windows, scored
// on worker threads: generation 0's score (the zero net, θ before any step) equals today's on the same windows, and
// so do its window results. Needs a Vulcan checkout at `vulcan.pin`. Local only (R7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { vulcanDir } from "../src/vulcan/engine.ts";
import { openPool } from "../src/vulcan/pool.ts";
import { scoreOf, trainVulcan, type WindowResult } from "../src/vulcan/train.ts";

test("train-gen0-is-today: 1 generation of 2 members on 2-day windows; generation 0 scores as today", async () => {
  const pool = await openPool(2, vulcanDir());
  try {
    const worlds = (await pool.years(["ledger"], [0, 1])).flat();
    assert.equal(worlds.length, 2);
    const today = await pool.today(worlds, 2);
    for (const kind of ["net", "table"] as const) {
      const evaluate = pool.evaluator(kind, worlds, 2);
      let gen0: WindowResult[] = [];
      const snap = await trainVulcan({
        kind,
        sigma: 1024,
        alpha: 512,
        generations: 1,
        population: 2,
        pool: [0, 1],
        today,
        evaluate: async (windows, thetas) => {
          const r = await evaluate(windows, thetas);
          if (!gen0.length) gen0 = r[0];
          return r;
        },
      });
      assert.equal(snap.log.length, 2, kind); // generation 1, then the final θ
      const [g1] = snap.log;
      assert.deepEqual(
        gen0,
        g1.windows.map((w) => today[w]),
        `${kind}: θ0's window results are today's`,
      );
      assert.equal(g1.theta.raw, g1.today, `${kind}: generation 0 scores as today`);
      assert.deepEqual(scoreOf(gen0, gen0).raw, g1.today, kind);
      assert.ok(g1.mean !== undefined && Number.isFinite(g1.mean), kind);
    }
  } finally {
    await pool.close();
  }
});
