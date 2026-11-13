// S5 copy phase (docs/specs/first-usable.md "Trainer", "S5", J4; D-007, D-008). The committed files in
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
import { valveOf, valveOfRef, LAB_SHAPE } from "../src/model/nets.ts";
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
  assert.ok(new Set(data.x.slice(0, 200).map(x => x[0])).size > 2);
  // the PI spends time pinned, so the targets reach both ends
  assert.ok(data.y.some(v => v === 0) && data.y.some(v => v === 1));
});

test("gradient check: backprop equals central finite differences, relative error < 1e-4 on 20 random parameters", () => {
  const net = xavier(LAB_SHAPE, COPY.initSeed);
  // move off the all-zero biases so every parameter has a gradient
  const r = makeRng(99);
  for (const L of net) for (let o = 0; o < L.b.length; o++) L.b[o] = (r.uniform() * 2 - 1) * 0.3;
  const idx = Array.from({ length: 64 }, (_, k) => k * 37);
  const { grad } = lossAndGrad(net, data, idx);
  const params = net.flatMap((L, k) => [...[...L.w.keys()].map(i => ({ k, p: "w" as const, i })), ...[...L.b.keys()].map(i => ({ k, p: "b" as const, i }))]);
  assert.equal(params.length, 97);
  const pick = makeRng(5), h = 1e-6;
  let worst = 0;
  for (let n = 0; n < 20; n++) {
    const { k, p, i } = params[Math.floor(pick.uniform() * params.length)];
    const arr = net[k][p], keep = arr[i];
    arr[i] = keep + h; const up = lossAndGrad(net, data, idx).loss;
    arr[i] = keep - h; const down = lossAndGrad(net, data, idx).loss;
    arr[i] = keep;
    const num = (up - down) / (2 * h), ana = grad[k][p][i];
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
    const vf = valveOfRef(forwardRef(committed, [...s].map(v => v / Q)).at(-1)![0]);
    if (Math.abs(vi - vf) <= 0.01) within++;
  }
  assert.ok(within >= 990, `${within / 10}% within 0.01`);
  for (const [k, g] of layerGaps(committed, states).entries()) assert.ok(g < 1, `layer ${k + 1} gap ${g}%`);
});

test("log and snapshots: loss every 10 steps from 0 to 2,000; 10 quantised snapshots, every 200 steps, the last = copy-weights", () => {
  const log = JSON.parse(readModel("log.json")), snaps = JSON.parse(readModel("snapshots.json"));
  assert.equal(log.version, 1);
  const copyLog = log.entries.filter((e: any) => e.phase === "copy");
  assert.deepEqual(copyLog.map((e: any) => e.step), Array.from({ length: 201 }, (_, i) => i * 10));
  assert.ok(copyLog.every((e: any) => Number.isFinite(e.loss) && !("iae" in e)));
  assert.equal(snaps.version, 1);
  const copySnaps = snaps.snapshots.filter((s: any) => s.phase === "copy");
  assert.deepEqual(copySnaps.map((s: any) => s.step), Array.from({ length: 10 }, (_, i) => (i + 1) * 200));
  for (const s of copySnaps) assert.doesNotThrow(() => loadWeights({ format: "phobos-weights", version: 1, layers: s.layers, meta: {} }));
  assert.deepEqual(copySnaps.at(-1).layers, JSON.parse(readModel("copy-weights.json")).layers);
  // S5 copies copy-weights.json to weights.json; S6 replaces it with the ES result
  assert.equal(readModel("weights.json"), readModel("copy-weights.json"));
});

test("train:lab is reproducible: a fresh copy run writes exactly the committed files", () => {
  const files = copyFiles();
  for (const name of ["copy-weights.json", "weights.json", "log.json", "snapshots.json"] as const) {
    assert.equal(files[name], readModel(name), name);
  }
});

test("J4 in Lab's live sim: the copied net holds its tank at the setpoint, and Net on leaves the PI tank unchanged", () => {
  const a = createLive({ seed: 1, level: 1.0, setpoint: 1.0 }), b = createLive({ seed: 1, level: 1.0, setpoint: 1.0 });
  a.step(50); b.step(50);
  b.setNet(committed);
  assert.equal(b.state.net!.level, b.state.level);
  for (const sp of [1.0, 1.5, 0.3]) {
    a.setSetpoint(sp); b.setSetpoint(sp);
    a.step(300); b.step(300);
    assert.ok(Math.abs(b.state.net!.level - sp) < 0.05, `setpoint ${sp}: net tank ${b.state.net!.level}`);
  }
  b.disturb(); a.disturb(); b.step(30); a.step(30);
  assert.ok(b.state.history.at(-1)!.net! < b.state.history.at(-31)!.net! - 0.02, "the disturbance hits the net tank too");
  assert.equal(b.state.level, a.state.level); // same PI tank, bit for bit
  b.setNet(null);
  assert.equal(b.state.net, null);
});
