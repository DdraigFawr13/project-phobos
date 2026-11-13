// S5 copy phase (docs/specs/first-usable.md "Trainer", "S5", J4; D-007, D-008). The committed copy-phase files in
// models/lab/ come from `npm run train:lab`; the last test retrains and asserts the same bytes (SIM-02).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COPY, copyData, xavier, lossAndGrad, datasetLoss, trainCopy, copyFiles } from "../src/train/copy.ts";
import { loadWeights } from "../src/model/weights.ts";
import { checkStates } from "../src/sim/check-states.ts";
import { forward } from "../src/runtime/net.ts";
import { forwardRef } from "../src/ref/dense.ts";
import { layerGaps } from "../src/ref/agreement.ts";
import { valveOf, valveOfRef, VALVE_GAIN, LAB_SHAPE } from "../src/model/nets.ts";
import { makeRng } from "../src/rng.ts";
import { createLive } from "../src/sim/live.ts";

const Q = 4096;
const MODELS = new URL("../models/lab/", import.meta.url);
const readModel = (f: string) => readFileSync(new URL(f, MODELS), "utf8");
const committed = loadWeights(JSON.parse(readModel("copy-weights.json"))).layers;
const data = copyData();

test("copy data: 50 fixed-PI runs × 200 states (every 2 s of 400 s) = 10,000, Q12 inputs, clamped PI valve targets", () => {
  assert.equal(COPY.runs * (COPY.runS / COPY.sampleEveryS), 10_000);
  assert.equal(data.x.length, 10_000);
  assert.equal(data.y.length, 10_000);
  for (const [i, x] of data.x.entries()) {
    assert.equal(x.length, 4);
    for (const v of x) assert.ok(Number.isInteger(v * Q) && v * Q >= -32768 && v * Q <= 32767, `state ${i}: ${v}`);
    assert.ok(x[0] >= 0.1 - 1 / Q && x[0] <= 1.9 + 1 / Q, `state ${i}: setpoint ${x[0]}`);
    assert.ok(data.y[i] >= 0 && data.y[i] <= 1, `state ${i}: valve ${data.y[i]}`);
  }
  // shuffled: the first 200 states are not one run's 200 states in time order (one run shares two setpoints)
  assert.ok(new Set(data.x.slice(0, 200).map((x) => x[0])).size > 2);
  // the PI spends time pinned, so the targets reach both ends
  assert.ok(data.y.some((v) => v === 0) && data.y.some((v) => v === 1));
});

test("gradient check: backprop equals central finite differences, relative error < 1e-4 on 20 random parameters", () => {
  const net = xavier(LAB_SHAPE, COPY.initSeed);
  // move off the all-zero biases so every parameter has a gradient
  const r = makeRng(99);
  for (const L of net) for (let o = 0; o < L.b.length; o++) L.b[o] = (r.uniform() * 2 - 1) * 0.3;
  const idx = Array.from({ length: 64 }, (_, k) => k * 37);
  const { grad } = lossAndGrad(net, data, idx);
  const params = net.flatMap((L, k) => [
    ...[...L.w.keys()].map((i) => ({ k, p: "w" as const, i })),
    ...[...L.b.keys()].map((i) => ({ k, p: "b" as const, i })),
  ]);
  assert.equal(params.length, 97);
  const pick = makeRng(5),
    h = 1e-6;
  let worst = 0;
  for (let n = 0; n < 20; n++) {
    const { k, p, i } = params[Math.floor(pick.uniform() * params.length)];
    const arr = net[k][p],
      keep = arr[i];
    arr[i] = keep + h;
    const up = lossAndGrad(net, data, idx).loss;
    arr[i] = keep - h;
    const down = lossAndGrad(net, data, idx).loss;
    arr[i] = keep;
    const num = (up - down) / (2 * h),
      ana = grad[k][p][i];
    const rel = Math.abs(ana - num) / Math.max(Math.abs(ana), Math.abs(num), 1e-12);
    assert.ok(Math.abs(ana) > 1e-8, `layer ${k} ${p}[${i}] has no gradient to check (${ana})`);
    worst = Math.max(worst, rel);
    assert.ok(rel < 1e-4, `layer ${k} ${p}[${i}]: backprop ${ana}, finite difference ${num}, relative error ${rel}`);
  }
  assert.ok(worst < 1e-4);
});

test("the copy-phase loss after 200 seeded steps is below half its first value", () => {
  const { log } = trainCopy({ steps: 200, data });
  assert.equal(log[0].step, 0);
  assert.equal(log.at(-1)!.step, 200);
  assert.ok(log.at(-1)!.loss < log[0].loss / 2, `loss ${log[0].loss} → ${log.at(-1)!.loss}`);
  // and the full-data loss is what the log records
  assert.equal(log[0].loss, datasetLoss(xavier(LAB_SHAPE, COPY.initSeed), data));
});

const { states, piValve } = checkStates({ withPI: true });

test("the copied net (committed copy-weights.json): mean |valve − PI valve| over the 1,000 check states < 0.05", () => {
  assert.equal(piValve.length, 1000);
  let sum = 0;
  for (const [i, s] of states.entries()) sum += Math.abs(valveOf(forward(committed, s).at(-1)![0]) - piValve[i]);
  const mean = sum / states.length;
  assert.ok(mean < 0.05, `mean |valve − PI valve| ${mean}`);
  // a net that ignores its inputs (always half open) fails this bound, so the bound can fail
  const half = piValve.reduce((a, v) => a + Math.abs(0.5 - v), 0) / piValve.length;
  assert.ok(half >= 0.05, `a constant 0.5 valve scores ${half}`);
});

test("D-007 on the trained net: integer valve within 0.01 of its float valve on ≥ 99% of check states; each layer within 1%", () => {
  let within = 0;
  for (const s of states) {
    const vi = valveOf(forward(committed, s).at(-1)![0]);
    const vf = valveOfRef(
      forwardRef(
        committed,
        [...s].map((v) => v / Q),
      ).at(-1)![0],
    );
    if (Math.abs(vi - vf) <= 0.01) within++;
  }
  assert.ok(within >= 990, `${within / 10}% within 0.01`);
  for (const [k, g] of layerGaps(committed, states).entries()) assert.ok(g < 1, `layer ${k + 1} gap ${g}%`);
});

test("log and snapshots: loss every 10 steps from 0 to 2,000; 10 quantised snapshots, every 200 steps, the last = copy-weights", () => {
  const log = JSON.parse(readModel("log.json")),
    snaps = JSON.parse(readModel("snapshots.json"));
  assert.equal(log.version, 1);
  const copyLog = log.entries.filter((e: any) => e.phase === "copy");
  assert.deepEqual(
    copyLog.map((e: any) => e.step),
    Array.from({ length: 201 }, (_, i) => i * 10),
  );
  assert.ok(copyLog.every((e: any) => Number.isFinite(e.loss) && !("iae" in e)));
  assert.equal(snaps.version, 1);
  const copySnaps = snaps.snapshots.filter((s: any) => s.phase === "copy");
  assert.deepEqual(
    copySnaps.map((s: any) => s.step),
    Array.from({ length: 10 }, (_, i) => (i + 1) * 200),
  );
  for (const s of copySnaps)
    assert.doesNotThrow(() => loadWeights({ format: "phobos-weights", version: 1, layers: s.layers, meta: {} }));
  assert.deepEqual(copySnaps.at(-1).layers, JSON.parse(readModel("copy-weights.json")).layers);
  // S6 replaced weights.json with the ES result (tests/es.test.ts); the copy keeps its own file
  assert.notEqual(readModel("weights.json"), readModel("copy-weights.json"));
});

test("train:lab is reproducible: a fresh copy run writes exactly the committed copy-weights.json and copy-phase log and snapshots", () => {
  const files = copyFiles();
  assert.equal(files["copy-weights.json"], readModel("copy-weights.json"));
  assert.deepEqual(
    files.log,
    JSON.parse(readModel("log.json")).entries.filter((e: any) => e.phase === "copy"),
  );
  assert.deepEqual(
    files.snapshots,
    JSON.parse(readModel("snapshots.json")).snapshots.filter((s: any) => s.phase === "copy"),
  );
});

test("J4 in Lab's live sim: the copied net holds its tank at the setpoint, and Net on leaves the PI tank unchanged", () => {
  const a = createLive({ seed: 1, level: 1.0, setpoint: 1.0 }),
    b = createLive({ seed: 1, level: 1.0, setpoint: 1.0 });
  a.step(50);
  b.step(50);
  b.setNet(committed);
  assert.equal(b.state.net!.level, b.state.level);
  for (const sp of [1.0, 1.5, 0.3]) {
    a.setSetpoint(sp);
    b.setSetpoint(sp);
    a.step(300);
    b.step(300);
    assert.ok(Math.abs(b.state.net!.level - sp) < 0.05, `setpoint ${sp}: net tank ${b.state.net!.level}`);
  }
  b.disturb();
  a.disturb();
  b.step(30);
  a.step(30);
  assert.ok(
    b.state.history.at(-1)!.net! < b.state.history.at(-31)!.net! - 0.02,
    "the disturbance hits the net tank too",
  );
  assert.equal(b.state.level, a.state.level); // same PI tank, bit for bit
  b.setNet(null);
  assert.equal(b.state.net, null);
});

test("the copied net in control holds every level from 0.10 to 1.90 m within 0.02 m, after 900 s and still after 1,800 s", () => {
  // Morgan saw the S5 net settle at 0.20 m for a 0.10 m setpoint: it ignored its error-so-far input, so it had no
  // integral action. Open-loop closeness on the PI's own runs could not show that; only the net in control can.
  for (const start of [1.0, null]) {
    for (const sp of [0.1, 0.25, 0.5, 1.0, 1.5, 1.9]) {
      const lv = createLive({ seed: 1, level: start ?? sp, setpoint: start ?? sp });
      lv.setNet(committed);
      lv.setSetpoint(sp);
      for (const t of [900, 1800]) {
        lv.step(900);
        const h = lv.state.net!.level;
        assert.ok(
          Math.abs(h - sp) < 0.02,
          `start ${start ?? sp} m, setpoint ${sp} m: net tank ${h.toFixed(3)} m at ${t} s`,
        );
      }
    }
  }
});

test("valve mapping (D-018): y = 0 is half open, ±0.8 reaches shut and fully open, integer and float maps agree", () => {
  assert.equal(VALVE_GAIN, 1.25);
  assert.equal(valveOf(0), 0.5);
  assert.equal(valveOf(-3277), 0); // −0.8 in Q12 (rounded away from 0), clamped
  assert.equal(valveOf(3277), 1);
  assert.ok(valveOf(-3276) > 0 && valveOf(3276) < 1, "just inside ±0.8 the valve is not yet at its end");
  for (let y = -4096; y <= 4096; y++) assert.equal(valveOf(y), valveOfRef(y / Q), `y ${y}`);
});

test("the copied net reaches both ends of the valve: where the PI's valve is shut or fully open in the copy data, mean gap < 0.03", () => {
  // S6 found the first nets never shut the valve (at least 0.06 open on 0.75→0.15): (y + 1) / 2 needed tanh to reach −1.
  for (const end of [0, 1]) {
    const gaps = data.x.flatMap((x, i) =>
      data.y[i] === end
        ? [
            Math.abs(
              valveOf(
                forward(
                  committed,
                  Int16Array.from(x, (v) => Math.round(v * Q)),
                ).at(-1)![0],
              ) - end,
            ),
          ]
        : [],
    );
    assert.ok(gaps.length >= 50, `${gaps.length} states with the PI's valve at ${end}`);
    const mean = gaps.reduce((a, g) => a + g, 0) / gaps.length;
    assert.ok(mean < 0.03, `PI valve ${end}: the net's mean gap ${mean.toFixed(4)} over ${gaps.length} states`);
  }
});
