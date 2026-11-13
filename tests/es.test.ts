// S6 evolution strategies (docs/specs/first-usable.md "Trainer" ES phase, S6; D-008, D-017). The committed
// models/lab/ files come from `npm run train:lab`; a 5-generation run here must reproduce its first ES snapshot.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ES, makeGauss, centredRanks, perturb, update, esGeneration, trainEs, flatten, withParams } from "../src/train/es.ts";
import { makePool } from "../src/train/pool.ts";
import { trainingIae } from "../src/sim/verdict.ts";
import { loadWeights, toWeightFile } from "../src/model/weights.ts";
import { checkStates } from "../src/sim/check-states.ts";
import { forward } from "../src/runtime/net.ts";
import { forwardRef } from "../src/ref/dense.ts";
import { layerGaps } from "../src/ref/agreement.ts";
import { valveOf, valveOfRef } from "../src/model/nets.ts";
import { makeRng } from "../src/rng.ts";
import { createLive } from "../src/sim/live.ts";

const MODELS = new URL("../models/lab/", import.meta.url);
const readModel = (f: string) => JSON.parse(readFileSync(new URL(f, MODELS), "utf8"));
const copyNet = loadWeights(readModel("copy-weights.json")).layers;
const final = loadWeights(readModel("weights.json")).layers;

test("ES settings are D-017's: noise 32 LSB, step 128, 50 generations of 32 (16 antithetic pairs), seed 17", () => {
  assert.deepEqual({ ...ES }, { sigma: 32, alpha: 128, generations: 50, population: 32, seed: 17, snapshotEvery: 5 });
});

test("Box-Muller draws from seed 17 are standard normal: mean near 0, variance near 1, pairs from one draw", () => {
  const g = makeGauss(makeRng(17));
  const xs = Array.from({ length: 20_000 }, g);
  const mean = xs.reduce((a, x) => a + x, 0) / xs.length, v = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length;
  assert.ok(Math.abs(mean) < 0.03, `mean ${mean}`);
  assert.ok(Math.abs(v - 1) < 0.03, `variance ${v}`);
  assert.deepEqual(Array.from({ length: 6 }, makeGauss(makeRng(17))), xs.slice(0, 6)); // seeded
});

test("centred ranks: the best (lowest IAE) gets +0.5, the worst −0.5, evenly spaced", () => {
  assert.deepEqual(centredRanks([3, 1, 2, 5, 4]), [0, 0.5, 0.25, -0.5, -0.25]);
});

test("one generation on a 4-parameter quadratic: the update equals θ += round(128 × Σ r_k ε_k / 32) exactly", async () => {
  const target = [1000, -2000, 300, 0], cost = (t: number[]) => t.reduce((a, v, i) => a + (v - target[i]) ** 2, 0);
  const theta = [0, 0, 0, 0];
  const { theta: next, eps, iae } = await esGeneration(theta, makeGauss(makeRng(17)), async ms => ms.map(cost));
  // the formula, written out again here
  assert.equal(eps.length, 32);
  for (let k = 0; k < 32; k += 2) assert.deepEqual(eps[k + 1], eps[k].map(e => -e)); // antithetic pairs
  const members = eps.map(e => perturb(theta, e, 32));
  assert.deepEqual(members[0], theta.map((t, i) => t + Math.round(32 * eps[0][i])));
  assert.deepEqual(iae, members.map(cost));
  const order = [...iae.keys()].sort((a, b) => iae[b] - iae[a]); // worst first
  const r: number[] = []; order.forEach((k, n) => { r[k] = n / 31 - 0.5; });
  const want = theta.map((t, i) => t + Math.round((128 * r.reduce((a, rk, k) => a + rk * eps[k][i], 0)) / 32));
  assert.deepEqual(next, want);
  assert.deepEqual(update(theta, eps, r, 128), want);
  // keeping the best candidate instead would fail
  const best = members[iae.indexOf(Math.min(...iae))];
  assert.notDeepEqual(next, best);
  assert.ok(cost(next) < cost(theta), "the step moves toward the target");
});

test("perturb and update saturate to int16", () => {
  assert.deepEqual(perturb([32760, -32760], [1, -1], 32), [32767, -32768]);
  assert.deepEqual(update([32767], [[1], [-1]], [0.5, -0.5], 128), [32767]);
});

test("flatten and withParams round-trip the Lab net's 97 numbers, keeping shifts", () => {
  const t = flatten(copyNet);
  assert.equal(t.length, 97);
  assert.deepEqual(withParams(copyNet, t), copyNet);
});

const pool = makePool(copyNet, 3);
after(() => pool.close());

test("a seeded 5-generation Lab run lowers training IAE by ≥ 1% and reproduces the committed ES log and snapshot", async () => {
  const run = await trainEs(copyNet, pool.evaluate, { generations: 5 });
  const iae0 = run.log[0].iae, iae5 = run.log.at(-1)!.iae;
  assert.equal(iae0, trainingIae(copyNet));
  assert.ok(iae5 < 0.99 * iae0, `training IAE ${iae0} → ${iae5}`);
  const log = readModel("log.json").entries.filter((e: any) => e.phase === "es");
  assert.deepEqual(run.log.map(e => ({ phase: "es", ...e })), log.slice(0, 6));
  const snap = readModel("snapshots.json").snapshots.find((s: any) => s.phase === "es" && s.step === 5);
  assert.deepEqual(run.snapshots.map(s => s.step), [5]);
  assert.deepEqual(run.example, readModel("log.json").esExample); // Lab's worked example is generation 1 as run
  assert.deepEqual(toWeightFile(run.snapshots[0].layers, { trainer: "es", seed: 17 }).layers, snap.layers);
});

test("committed ES log and snapshots: IAE every generation 0 to 50, 10 snapshots every 5, the last = weights.json", () => {
  const log = readModel("log.json").entries.filter((e: any) => e.phase === "es");
  assert.deepEqual(log.map((e: any) => e.step), Array.from({ length: 51 }, (_, i) => i));
  assert.ok(log.every((e: any) => Number.isFinite(e.iae) && !("loss" in e)));
  assert.ok(log.at(-1).iae < log[0].iae, "50 generations lower training IAE");
  assert.equal(log.at(-1).iae, trainingIae(final));
  const snaps = readModel("snapshots.json").snapshots.filter((s: any) => s.phase === "es");
  assert.deepEqual(snaps.map((s: any) => s.step), Array.from({ length: 10 }, (_, i) => (i + 1) * 5));
  assert.deepEqual(snaps.at(-1).layers, readModel("weights.json").layers);
  assert.deepEqual(readModel("weights.json").meta, { trainer: "es", seed: 17 });
  // shifts stay as quantisation set them
  assert.deepEqual(final.map(l => l.shift), copyNet.map(l => l.shift));
});

const { states } = checkStates({ withPI: true });

test("D-007 on the final weights.json: integer valve within 0.01 of float on ≥ 99% of check states; each layer within 1%", () => {
  let within = 0;
  for (const s of states) {
    const vi = valveOf(forward(final, s).at(-1)![0]);
    const vf = valveOfRef(forwardRef(final, [...s].map(v => v / 4096)).at(-1)![0]);
    if (Math.abs(vi - vf) <= 0.01) within++;
  }
  assert.ok(within >= 990, `${within / 10}% within 0.01`);
  for (const [k, g] of layerGaps(final, states).entries()) assert.ok(g < 1, `layer ${k + 1} gap ${g}%`);
});

test("the ES net in control holds every level from 0.10 to 1.90 m within 0.02 m, after 900 s and still after 1,800 s", () => {
  // LESSONS `train`: held-out scores alone can't show a net that fails to hold part of its range.
  for (const start of [1.0, null]) {
    for (const sp of [0.1, 0.25, 0.5, 1.0, 1.5, 1.9]) {
      const lv = createLive({ seed: 1, level: start ?? sp, setpoint: start ?? sp });
      lv.setNet(final);
      lv.setSetpoint(sp);
      for (const t of [900, 1800]) {
        lv.step(900);
        const h = lv.state.net!.level;
        assert.ok(Math.abs(h - sp) < 0.02, `start ${start ?? sp} m, setpoint ${sp} m: net tank ${h.toFixed(3)} m at ${t} s`);
      }
    }
  }
});
