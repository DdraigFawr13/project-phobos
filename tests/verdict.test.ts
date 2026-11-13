// S6 verdict (docs/specs/first-usable.md J5, "Verdict"; D-011). Recomputes the held-out numbers from the committed
// weights and checks they equal models/lab/verdict.json (a regression lock), and that yes/no follows D-011.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verdictOf, judge, scoreNet, type Verdict } from "../src/sim/verdict.ts";
import { loadWeights } from "../src/model/weights.ts";
import { SEGMENTS, SEEDS, runFixedTest } from "../src/sim/fixed-test.ts";
import { makeNetController } from "../src/sim/net-controller.ts";
import { runSegment } from "../src/sim/fixed-test.ts";
import { createReplay } from "../src/sim/replay.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../models/lab/${f}`, import.meta.url), "utf8"));
const final = loadWeights(read("weights.json")).layers;
const committed: Verdict = read("verdict.json");
const fresh = verdictOf(final);

test("verdict.json equals the held-out results recomputed from weights.json", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(fresh)), committed);
  assert.equal(committed.version, 1);
  assert.deepEqual(committed.seeds, [...SEEDS.heldOut]);
  assert.deepEqual(committed.rows.map(r => r.name), SEGMENTS.heldOut.map(s => s.name));
});

test("the PI columns are the fixed test's held-out numbers, and the net column is the net run on the same seeds", () => {
  const pi = runFixedTest(SEGMENTS.heldOut, { seeds: SEEDS.heldOut });
  for (const [i, r] of fresh.rows.entries()) {
    assert.deepEqual(r.fixed, pi.rows[i].fixed);
    assert.deepEqual(r.retuned, pi.rows[i].retuned);
  }
  const seg = SEGMENTS.heldOut[2], one = SEEDS.heldOut.map(s => runSegment(seg, makeNetController(final), s));
  assert.ok(Math.abs(fresh.rows[2].net.iae - one.reduce((a, x) => a + x.iae, 0) / 5) < 1e-9);
  assert.deepEqual(scoreNet(final, SEGMENTS.heldOut, SEEDS.heldOut).total, fresh.total.net);
});

test("yes/no follows D-011 from the numbers: lower total IAE, no segment > 5% worse, travel ≤ 2× the fixed PI's", () => {
  const { rows, total, checks } = committed;
  assert.equal(checks.lowerTotal, total.net.iae < total.fixed.iae);
  assert.equal(checks.noSegmentOver5, rows.every(r => r.net.iae <= 1.05 * r.fixed.iae));
  assert.equal(checks.travelWithin2x, total.net.travel <= 2 * total.fixed.travel);
  assert.equal(committed.worthIt, checks.lowerTotal && checks.noSegmentOver5 && checks.travelWithin2x);
});

test("judge: each clause alone can turn the answer to no", () => {
  const row = (n: number, f: number, nt = 10, ft = 10) => ({ name: "x", net: { iae: n, travel: nt }, fixed: { iae: f, travel: ft }, retuned: { iae: f, travel: ft } });
  assert.equal(judge([row(9, 10), row(9, 10)]).worthIt, true);
  assert.equal(judge([row(11, 10), row(9.5, 10)]).checks.lowerTotal, false);
  const worse = judge([row(5, 10), row(10.6, 10)]); // total lower, one segment 6% worse
  assert.deepEqual([worse.checks.lowerTotal, worse.checks.noSegmentOver5, worse.worthIt], [true, false, false]);
  const twitchy = judge([row(9, 10, 21), row(9, 10, 20)]); // travel 41 against 2 × 20
  assert.deepEqual([twitchy.checks.travelWithin2x, twitchy.worthIt], [false, false]);
  assert.equal(judge([row(9, 10, 20), row(9, 10, 20)]).checks.travelWithin2x, true); // exactly 2× passes
});

test("Lab's Replay tank plays each held-out segment exactly as the verdict runs it on seed 101, then restarts", () => {
  const rp = createReplay(final);
  for (const [k, seg] of SEGMENTS.heldOut.entries()) {
    assert.equal(rp.state.name, seg.name);
    rp.step(299.9);
    assert.equal(rp.state.history.length, 300); // 0 to 299 s
    rp.step(0.1);
    if (k < 4) assert.equal(rp.state.finished[k].iae, runSegment(seg, makeNetController(final), 101).iae, seg.name);
  }
  assert.deepEqual([rp.state.segment, rp.state.t, rp.state.finished], [0, 0, []]); // round again
  rp.step(10);
  const v = rp.state.valve;
  rp.setLayers(loadWeights(read("copy-weights.json")).layers);
  assert.deepEqual([rp.state.t, rp.state.segment], [0, 0]);
  rp.step(10);
  assert.notEqual(rp.state.valve, v, "another snapshot drives the valve differently from the same start");
});
