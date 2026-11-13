// S4 J3: the integer runtime against the float reference (docs/specs/first-usable.md "S4", "Runtime",
// "Test net", "Terms"; D-006, D-007). The golden file changes only in a commit that says why.
// Regenerate: UPDATE_GOLDEN=1 node --test tests/runtime.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dense } from "../src/runtime/dense.ts";
import { mask, argmax } from "../src/runtime/select.ts";
import { forward } from "../src/runtime/net.ts";
import { denseRef, forwardRef, argmaxRef, maskRef } from "../src/ref/dense.ts";
import { compareNets, withinPct } from "../src/ref/agreement.ts";
import { randomNet } from "../src/model/random.ts";
import { testNet, labShapedNet, TEST_NET_ALLOWED, valveOf, valveOfRef } from "../src/model/nets.ts";
import { makeNetController } from "../src/sim/net-controller.ts";
import { makeNetInputs } from "../src/sim/net-inputs.ts";
import { checkStates } from "../src/sim/check-states.ts";
import { quantise } from "../src/num/quantise.ts";
import { makeRng } from "../src/rng.ts";
import { tanhQ } from "../src/num/act.ts";
import type { Layer } from "../src/num/layer.ts";

const Q = 4096;
const states = checkStates();
const GOLDEN = new URL("./golden/runtime-testnet.json", import.meta.url);

const layer = (
  w: number[],
  b: number[],
  inN: number,
  out: number,
  shift: number,
  act: Layer["act"] = "none",
): Layer => ({ kind: "dense", in: inN, out, shift, w: Int16Array.from(w), b: Int16Array.from(b), act });

test("dense: y = sat16(shr(Σ w·x, shift) + b), row-major w, by hand", () => {
  // w real = [[1.0, −0.5], [0.25, 0.75]] at shift 14; x = [1.0, 0.5]; b = [0.125, −1.0]
  const L = layer([16384, -8192, 4096, 12288], [512, -4096], 2, 2, 14);
  const y = dense(L, Int16Array.of(4096, 2048));
  // row 0: 16384·4096 − 8192·2048 = 50331648 → >>14 = 3072, + 512 = 3584 (0.875)
  // row 1: 4096·4096 + 12288·2048 = 41943040 → >>14 = 2560, − 4096 = −1536 (−0.375)
  assert.deepEqual([...y], [3584, -1536]);
});

test("dense floors negative sums and saturates, never wraps", () => {
  // Σ = −3 at shift 1: floor(−1.5) = −2 (a truncating divide would give −1)
  assert.deepEqual([...dense(layer([-3], [0], 1, 1, 1), Int16Array.of(1))], [-2]);
  // 32767 · 32767 · 2 at shift 0 is far above int16: saturates both ways
  const big = layer([32767, 32767, -32768, -32768], [0, 0], 2, 2, 0);
  assert.deepEqual([...dense(big, Int16Array.of(32767, 32767))], [32767, -32768]);
  // the bias is added after the shift and the sum is saturated after it
  assert.deepEqual([...dense(layer([0], [32767], 1, 1, 0), Int16Array.of(5))], [32767]);
});

test("dense applies the layer's activation to the saturated sum", () => {
  const L = layer([16384, -8192, 4096, 12288], [512, -4096], 2, 2, 14, "tanh");
  assert.deepEqual([...dense(L, Int16Array.of(4096, 2048))], [tanhQ(3584), tanhQ(-1536)]);
});

test("mask: forbidden → −32768, allowed clamped to ≥ −32767", () => {
  const m = mask(Int16Array.of(-32768, 5, -32768, 100), [true, true, true, false]);
  assert.deepEqual([...m], [-32767, 5, -32767, -32768]);
});

test("argmax: lowest index wins ties; a forbidden action is never chosen, even when every allowed score saturates", () => {
  assert.equal(argmax(Int16Array.of(3, 7, 7, 1)), 1);
  assert.equal(argmax(Int16Array.of(-5, -5)), 0);
  // all allowed scores saturated low: the allowed one still beats the forbidden one at index 0
  const m = mask(Int16Array.of(-32768, -32768, -32768), [false, true, true]);
  assert.equal(argmax(m), 1);
  // a forbidden action with a huge score loses to any allowed one
  assert.equal(argmax(mask(Int16Array.of(32767, -32768), [false, true])), 1);
});

test("argmax: every action forbidden → −1", () => {
  assert.equal(argmax(mask(Int16Array.of(1, 2, 3), [false, false, false])), -1);
  assert.equal(argmaxRef(maskRef([1, 2, 3], [false, false, false])), -1);
});

test("the runtime uses no Math.* (shr's floor lives in src/num/fixed.ts)", () => {
  const dir = new URL("../src/runtime/", import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), "utf8").replace(/\/\/.*$/gm, "");
    assert.ok(!/\bMath\./.test(src), `${f} uses Math.*`);
  }
});

test("float reference: dequantised weights w / 2^shift and b / 4096, by hand", () => {
  const L = layer([16384, -8192, 4096, 12288], [512, -4096], 2, 2, 14);
  assert.deepEqual(denseRef(L, [1, 0.5]), [0.875, -0.375]);
  const T = { ...L, act: "tanh" as const };
  assert.deepEqual(denseRef(T, [1, 0.5]), [Math.tanh(0.875), Math.tanh(-0.375)]);
});

test("random nets: drawn layer by layer, w row-major then b, (uniform × 2 − 1) × 0.5, then quantised", () => {
  const rng = makeRng(7),
    draw = () => (rng.uniform() * 2 - 1) * 0.5;
  const w1 = Array.from({ length: 64 }, draw),
    b1 = Array.from({ length: 16 }, draw);
  const w2 = Array.from({ length: 80 }, draw),
    b2 = Array.from({ length: 5 }, draw);
  const want = [
    quantise({ in: 4, out: 16, w: w1, b: b1, act: "tanh" }),
    quantise({ in: 16, out: 5, w: w2, b: b2, act: "none" }),
  ];
  assert.deepEqual(testNet(), want);
  assert.deepEqual(
    randomNet(
      [
        { in: 4, out: 16, act: "tanh" },
        { in: 16, out: 5, act: "none" },
      ],
      7,
    ),
    want,
  );
  const lab = labShapedNet();
  assert.deepEqual(
    lab.map((l) => [l.in, l.out, l.act]),
    [
      [4, 16, "tanh"],
      [16, 1, "tanh"],
    ],
  );
  assert.equal(
    lab.reduce((n, l) => n + l.w.length + l.b.length, 0),
    97,
  );
  assert.notDeepEqual(lab[0].w, testNet()[0].w); // seed 8, not 7
});

// Per-layer gap (spec "Terms"): each layer is fed the integer previous-layer output, dequantised, in both versions.
function layerGaps(net: Layer[]) {
  const ranges: number[] = [],
    worst: number[] = net.map(() => 0);
  const floatOut: number[][][] = net.map(() => []);
  const intOut: number[][][] = net.map(() => []);
  for (const s of states) {
    let x = s;
    net.forEach((L, k) => {
      const yi = dense(L, x),
        yf = denseRef(
          L,
          [...x].map((v) => v / Q),
        );
      intOut[k].push([...yi].map((v) => v / Q));
      floatOut[k].push(yf);
      x = yi;
    });
  }
  net.forEach((L, k) => {
    let range: number;
    if (L.act === "tanh") range = 2;
    else if (L.act === "exp") range = 1;
    else {
      const all = floatOut[k].flat();
      range = Math.max(1, Math.max(...all) - Math.min(...all));
    }
    ranges.push(range);
    intOut[k].forEach((row, n) =>
      row.forEach((v, o) => {
        worst[k] = Math.max(worst[k], Math.abs(v - floatOut[k][n][o]));
      }),
    );
  });
  return net.map((_, k) => (100 * worst[k]) / ranges[k]);
}

test("D-007: every layer of both nets is within 1% of its output range on the 1,000 check states", () => {
  for (const [name, net] of [
    ["test net", testNet()],
    ["Lab-shaped net", labShapedNet()],
  ] as const) {
    const gaps = layerGaps(net);
    assert.equal(gaps.length, 2);
    gaps.forEach((g, k) => assert.ok(g < 1, `${name} layer ${k + 1}: ${g.toFixed(4)}%`));
  }
});

test("D-007: the Lab-shaped net's valve is within 0.01 of the float model's on ≥ 99% of the check states", () => {
  const net = labShapedNet();
  let ok = 0;
  for (const s of states) {
    const vi = valveOf(forward(net, s).at(-1)![0]);
    const vf = valveOfRef(
      forwardRef(
        net,
        [...s].map((v) => v / Q),
      ).at(-1)![0],
    );
    if (Math.abs(vi - vf) <= 0.01) ok++;
  }
  assert.ok(ok / states.length >= 0.99, `${ok} of ${states.length}`);
});

test("D-007: the test net picks the same masked action as its float model on ≥ 99%, choosing ≥ 2 distinct actions", () => {
  const net = testNet();
  let same = 0;
  const chosen = new Set<number>();
  for (const s of states) {
    const ai = argmax(mask(forward(net, s).at(-1)!, TEST_NET_ALLOWED));
    const af = argmaxRef(
      maskRef(
        forwardRef(
          net,
          [...s].map((v) => v / Q),
        ).at(-1)!,
        TEST_NET_ALLOWED,
      ),
    );
    assert.notEqual(ai, 4, "action 4 is forbidden");
    if (ai === af) same++;
    chosen.add(ai);
  }
  assert.ok(same / states.length >= 0.99, `${same} of ${states.length}`);
  assert.ok(chosen.size >= 2, `distinct actions: ${[...chosen].join(", ")}`);
});

test("compareNets (shown on Lab's Integer vs float tab) equals this file's own computation", () => {
  const c = compareNets(states);
  assert.deepEqual(c.testNet.layerGaps, layerGaps(testNet()));
  assert.deepEqual(c.labNet.layerGaps, layerGaps(labShapedNet()));
  assert.equal(c.states, 1000);
  assert.equal(c.labNet.series.length, 1000);
  const [vi, vf] = c.labNet.series[123];
  assert.equal(vi, valveOf(forward(labShapedNet(), states[123]).at(-1)![0]));
  assert.equal(
    vf,
    valveOfRef(
      forwardRef(
        labShapedNet(),
        [...states[123]].map((v) => v / Q),
      ).at(-1)![0],
    ),
  );
  const within = c.labNet.series.filter(([a, b]) => Math.abs(a - b) <= 0.01).length;
  assert.equal(c.labNet.withinPct, (100 * within) / 1000);
  assert.ok(c.testNet.samePct >= 99 && c.testNet.distinct >= 2);
  assert.equal(c.labNet.maxGap, Math.max(...c.labNet.series.map(([a, b]) => Math.abs(a - b))));
});

test("withinPct counts pairs within 0.01, inclusive (real states all pass, so this uses built pairs)", () => {
  assert.equal(
    withinPct([
      [0.5, 0.5],
      [0.5, 0.509],
      [0.5, 0.5101],
      [0.2, 0.1],
    ]),
    50,
  );
  assert.equal(withinPct([[0, 0.5]], 0.5), 100); // exactly at the limit counts (dyadic, so no rounding)
});

function goldenRows() {
  const net = testNet();
  return states.map((s) => {
    const y = forward(net, s).at(-1)!;
    return [...y, argmax(mask(y, TEST_NET_ALLOWED))];
  });
}

test("the test net's outputs and chosen action on the check states equal the golden file", () => {
  const rows = goldenRows();
  if (process.env.UPDATE_GOLDEN === "1") {
    writeFileSync(
      GOLDEN,
      `{"net":"test net, seed 7, 4→16 tanh, 16→5 none, action 4 masked","row":"5 outputs (Q12), then the chosen action","rows":[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]}\n`,
    );
  }
  const want = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.equal(want.rows.length, 1000);
  assert.deepEqual(rows, want.rows);
});

test("net controller: runs a net on the Lab net inputs, valve = (y + 4096) / 8192 clamped, integral held when pinned", () => {
  const net = labShapedNet();
  const ctrl = makeNetController(net),
    inputs = makeNetInputs();
  ctrl.reset(1.0, 1.2);
  inputs.reset(1.0);
  for (const m of [1.0, 1.01, 0.98, 1.05, 1.1]) {
    const want = valveOf(forward(net, inputs.next(m, 1.2)).at(-1)![0]);
    const got = ctrl.step(m, 1.2);
    assert.equal(got, want);
    inputs.after(want);
  }
  assert.equal(valveOf(4096), 1);
  assert.equal(valveOf(-4096), 0);
  assert.equal(valveOf(0), 0.5);
  assert.equal(valveOf(32767), 1); // clamped
  assert.equal(valveOfRef(-3), 0);
});
