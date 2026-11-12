// S3 number checks (docs/specs/first-usable.md "S3", "Numbers"; D-006).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sat16, shr, ONE } from "../src/num/fixed.ts";
import { quantise, checkBound } from "../src/num/quantise.ts";
import { tanhQ, expQ } from "../src/num/act.ts";
import type { Layer } from "../src/num/layer.ts";

test("Q12: 1.0 is 4096", () => assert.equal(ONE, 4096));

test("sat16 clamps to [−32768, 32767] and keeps values inside", () => {
  assert.equal(sat16(32767), 32767);
  assert.equal(sat16(32768), 32767);
  assert.equal(sat16(1e12), 32767);
  assert.equal(sat16(-32768), -32768);
  assert.equal(sat16(-32769), -32768);
  assert.equal(sat16(-1e12), -32768);
  assert.equal(sat16(0), 0);
  assert.equal(sat16(-123), -123);
});

test("shr floors: shr(−5, 1) = −3, and stays exact far above 2^31", () => {
  assert.equal(shr(-5, 1), -3);
  assert.equal(shr(5, 1), 2);
  assert.equal(shr(-1, 5), -1);
  assert.equal(shr(31, 5), 0);
  assert.equal(shr(7, 0), 7);
  assert.equal(shr(-(2 ** 40) - 1, 3), -(2 ** 37) - 1);
  assert.equal(shr(2 ** 52 + 2, 1), 2 ** 51 + 1);
});

const layerOf = (w: number[], b: number[], inN: number, out: number) => quantise({ in: inN, out, w, b, act: "none" });

test("quantise picks the largest s in [0, 14] with max|w| × 2^s ≤ 32767", () => {
  assert.equal(layerOf([1.0, -0.25], [0], 2, 1).shift, 14); // 16384 fits, 32768 doesn't
  assert.equal(layerOf([0.5, 0.1], [0], 2, 1).shift, 14); // capped at 14
  assert.equal(layerOf([0, 0], [0], 2, 1).shift, 14); // all-zero weights
  assert.equal(layerOf([-3.0, 1], [0], 2, 1).shift, 13); // 24576 fits, 49152 doesn't
  assert.equal(layerOf([1.9999], [0], 1, 1).shift, 14); // 32766.4 fits
  assert.equal(layerOf([32767 / 16384], [0], 1, 1).shift, 14); // exactly 32767 fits (≤, not <)
  assert.equal(layerOf([2.0], [0], 1, 1).shift, 13); // 32768 doesn't fit at 14
  assert.equal(layerOf([3000], [0], 1, 1).shift, 3);
  assert.equal(layerOf([40000], [0], 1, 1).shift, 0);
});

test("quantise rounds w × 2^s and b × 4096, saturated", () => {
  const l = layerOf([-3.0, 1, 0.00006], [0.5, -9, 0.0001], 1, 3);
  assert.deepEqual([...l.w], [-24576, 8192, 0]); // 0.00006 × 8192 = 0.49 rounds to 0
  assert.deepEqual([...l.b], [2048, -32768, 0]);
  assert.ok(l.w instanceof Int16Array && l.b instanceof Int16Array);
  assert.deepEqual([...layerOf([40000, -40000], [9], 2, 1).w], [32767, -32768]);
  assert.deepEqual([...layerOf([1.0, 0.75], [0], 2, 1).w], [16384, 12288]);
  assert.equal(l.kind, "dense");
  assert.equal(l.act, "none");
});

test("quantise rejects a w or b of the wrong length", () => {
  assert.throws(() => layerOf([1, 2, 3], [0], 2, 1));
  assert.throws(() => layerOf([1, 2], [0, 0], 2, 1));
});

test("checkBound throws when the largest row sum × 32768 reaches the limit", () => {
  // rows [3, −2] and [1, 1]: largest Σ|w| = 5, so the bound is 5 × 32768 = 163840
  const l: Layer = { kind: "dense", in: 2, out: 2, shift: 0, w: Int16Array.from([3, -2, 1, 1]), b: new Int16Array(2), act: "none" };
  assert.doesNotThrow(() => checkBound(l, 163841));
  assert.throws(() => checkBound(l, 163840));
  assert.throws(() => checkBound(l, 100000));
  // the default limit is 2^53: a full-scale 16→1 layer passes
  const big: Layer = { kind: "dense", in: 16, out: 1, shift: 0, w: new Int16Array(16).fill(-32768), b: new Int16Array(1), act: "tanh" };
  assert.doesNotThrow(() => checkBound(big));
});

test("tanhQ and expQ end points", () => {
  assert.equal(tanhQ(-32768), -4096);
  assert.equal(tanhQ(32767), 4096);
  assert.equal(tanhQ(0), 0);
  assert.equal(expQ(0), 4096);
  assert.equal(expQ(100), 4096);
  assert.equal(expQ(32767), 4096);
});

test("tanhQ is odd and expQ falls towards 0", () => {
  for (const x of [1, 31, 32, 33, 4096, 20000]) assert.equal(tanhQ(-x), -tanhQ(x), `x = ${x}`);
  assert.ok(expQ(-32768) >= 0 && expQ(-32768) <= 2);
  assert.ok(expQ(-4096) < expQ(-2048) && expQ(-2048) < expQ(-1));
});
