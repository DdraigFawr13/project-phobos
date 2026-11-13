// J2 fixed-test checks (docs/specs/first-usable.md "J2", "Fixed test"). Also locks the numbers the Lab teaching text quotes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SEGMENTS, runFixedTest, formatTable, type FixedTestResult } from "../src/sim/fixed-test.ts";
import { EXPLAIN } from "../src/lab/explain.ts";

const noisy = runFixedTest(SEGMENTS.training);
const quiet = runFixedTest(SEGMENTS.training, { noise: false });
const row = (r: FixedTestResult, name: string) => r.rows.find((x) => x.name === name)!;

test("training and held-out sets have the spec's five segments each", () => {
  assert.deepEqual(
    SEGMENTS.training.map((s) => s.name),
    ["0.50→0.25", "0.25→1.00", "1.00→1.75", "1.75→0.50", "dist@1.00"],
  );
  assert.deepEqual(
    SEGMENTS.heldOut.map((s) => s.name),
    ["0.75→0.15", "0.15→1.40", "1.40→1.90", "1.90→0.75", "dist@0.35"],
  );
  assert.deepEqual(
    noisy.rows.map((r) => r.name),
    SEGMENTS.training.map((s) => s.name),
  );
});

test("retuned IAE < 0.8 × fixed IAE on 0.50→0.25", () => {
  const r = row(noisy, "0.50→0.25");
  assert.ok(r.retuned.iae < 0.8 * r.fixed.iae, `retuned ${r.retuned.iae} fixed ${r.fixed.iae}`);
});

test("retuned equals fixed on dist@1.00 (same Ti at 1.0 m)", () => {
  const r = row(noisy, "dist@1.00");
  assert.equal(r.retuned.iae, r.fixed.iae);
  assert.equal(r.retuned.travel, r.fixed.travel);
});

test("IAE is on the true level: noise changes it by under 0.2 m·s per segment", () => {
  for (const name of noisy.rows.map((r) => r.name)) {
    for (const pi of ["fixed", "retuned"] as const) {
      const d = Math.abs(row(noisy, name)[pi].iae - row(quiet, name)[pi].iae);
      assert.ok(d < 0.2, `${name} ${pi}: ${d}`);
    }
  }
});

test("a dist@ segment holds its level and the disturbance lifts IAE above the no-disturbance run", () => {
  const r = row(quiet, "dist@1.00");
  assert.ok(r.fixed.iae > 1, `dist@1.00 quiet IAE ${r.fixed.iae}`);
  // without noise and before the disturbance the tank sits exactly at its setpoint, so all of the IAE comes from 60 s on
  const early = runFixedTest([{ ...SEGMENTS.training[4], disturb: null }], { noise: false });
  assert.equal(early.rows[0].fixed.iae, 0);
});

test("totals are the sums of the segment means; travel is reported and positive", () => {
  for (const pi of ["fixed", "retuned"] as const) {
    const sum = noisy.rows.reduce((a, r) => a + r[pi].iae, 0);
    assert.equal(noisy.total[pi].iae, sum);
    for (const r of noisy.rows) assert.ok(r[pi].travel > 0, `${r.name} travel ${r[pi].travel}`);
  }
});

test("same seeds, same result; other seeds differ", () => {
  assert.deepEqual(runFixedTest(SEGMENTS.training), noisy);
  const other = runFixedTest(SEGMENTS.training, { seeds: [6, 7, 8, 9, 10] });
  assert.notEqual(other.total.fixed.iae, noisy.total.fixed.iae);
});

test("formatTable prints name, fixed IAE and retuned IAE to 2 decimals, one row per segment", () => {
  const lines = formatTable(noisy).trim().split("\n");
  const body = lines.filter((l) => noisy.rows.some((r) => l.startsWith(r.name)));
  assert.equal(body.length, 5);
  for (const [i, r] of noisy.rows.entries()) {
    assert.deepEqual(body[i].trim().split(/\s+/), [r.name, r.fixed.iae.toFixed(2), r.retuned.iae.toFixed(2)]);
  }
});

test("Lab's Fixed test teaching text quotes the numbers this test measures", () => {
  const text = EXPLAIN.fixed.tryit + EXPLAIN.fixed.deep;
  const r = row(noisy, "1.00→1.75");
  assert.ok(text.includes(`${r.retuned.iae.toFixed(2)} against ${r.fixed.iae.toFixed(2)} m·s`), "1.00→1.75 numbers");
  assert.ok(r.retuned.iae > r.fixed.iae, "the text says retuned is worse on 1.00→1.75");
  // "with the noise switched off, each test's travel is under 1.3 instead of about 10"
  assert.ok(text.includes("under 1.3 instead of about 10"));
  for (const x of quiet.rows)
    for (const pi of ["fixed", "retuned"] as const)
      assert.ok(x[pi].travel < 1.3, `${x.name} quiet travel ${x[pi].travel}`);
  for (const x of noisy.rows)
    for (const pi of ["fixed", "retuned"] as const)
      assert.ok(x[pi].travel > 9.5 && x[pi].travel < 11.5, `${x.name} travel ${x[pi].travel}`);
});
