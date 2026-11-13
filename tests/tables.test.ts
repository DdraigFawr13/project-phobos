// S3 table checks (docs/specs/first-usable.md "S3", "Tables"; J3). Every int16 input against the float function,
// and the committed tables against a fresh generation. Also locks the numbers the Tables tab teaching text quotes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TANH, EXP } from "../src/num/tables.gen.ts";
import { tanhQ, expQ } from "../src/num/act.ts";
import { tanhEntries, expEntries } from "../src/num/gen.ts";
import { tableErrors } from "../src/num/table-errors.ts";
import { EXPLAIN } from "../src/lab/explain.ts";

test("each table has 1,025 entries; tanh starts at 0, exp at 4096", () => {
  assert.equal(TANH.length, 1025);
  assert.equal(EXP.length, 1025);
  assert.ok(TANH instanceof Int16Array && EXP instanceof Int16Array);
  assert.equal(TANH[0], 0);
  assert.equal(EXP[0], 4096);
  assert.equal(TANH[1024], 4096);
  assert.equal(EXP[1024], 1); // round(4096 × e^−8) = round(1.37)
});

test("a fresh generation matches the committed tables within 1 LSB", () => {
  const t = tanhEntries(),
    e = expEntries();
  for (let i = 0; i <= 1024; i++) {
    assert.ok(Math.abs(t[i] - TANH[i]) <= 1, `tanh entry ${i}: fresh ${t[i]}, committed ${TANH[i]}`);
    assert.ok(Math.abs(e[i] - EXP[i]) <= 1, `exp entry ${i}: fresh ${e[i]}, committed ${EXP[i]}`);
  }
});

test("tanhQ is within 2 LSB of round(4096 × tanh(x / 4096)) at every int16 input", () => {
  let worst = 0;
  for (let x = -32768; x <= 32767; x++) {
    const d = Math.abs(tanhQ(x) - Math.round(4096 * Math.tanh(x / 4096)));
    if (d > worst) worst = d;
    if (d > 2) assert.fail(`tanhQ(${x}) = ${tanhQ(x)}, reference ${Math.round(4096 * Math.tanh(x / 4096))}`);
  }
  assert.equal(tableErrors().tanh.lsb, worst);
});

// exp's input is clamped to [−32767, 0], so for x > 0 the reference is exp(0) = 1 (spec "Tables").
test("expQ is within 2 LSB of round(4096 × exp(min(x, 0) / 4096)) at every int16 input", () => {
  let worst = 0;
  for (let x = -32768; x <= 32767; x++) {
    const ref = Math.round(4096 * Math.exp(Math.min(x, 0) / 4096));
    const d = Math.abs(expQ(x) - ref);
    if (d > worst) worst = d;
    if (d > 2) assert.fail(`expQ(${x}) = ${expQ(x)}, reference ${ref}`);
  }
  assert.equal(tableErrors().exp.lsb, worst);
});

test("Tables teaching text quotes the measured largest gaps", () => {
  const { tanh, exp } = tableErrors();
  const text = EXPLAIN.tables.deep + EXPLAIN.tables.tryit;
  assert.ok(text.includes(`within ${tanh.lsb} LSB for tanh and ${exp.lsb} for exp`), "deep text names the LSB gaps");
  assert.ok(
    text.includes(`${tanh.pct.toFixed(3)}% for tanh and ${exp.pct.toFixed(3)}% for exp`),
    "deep text names the % gaps",
  );
});
