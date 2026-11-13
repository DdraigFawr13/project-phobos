// Copy phase (docs/specs/first-usable.md "Trainer", D-008): the Lab net learns to give the fixed PI's valve.
// Float and Node only, never the runtime: hand-written backprop for dense + tanh layers, momentum SGD, then
// quantise to the integer net that ships. Same settings give the same files (no timestamps, seeded RNGs).
import { makeRng } from "../rng.ts";
import { makePlant } from "../sim/plant.ts";
import { fixedPI } from "../sim/fixed-test.ts";
import { makeNetInputs } from "../sim/net-inputs.ts";
import { quantise } from "../num/quantise.ts";
import { toWeightFile, type LayerJson } from "../model/weights.ts";
import { LAB_SHAPE } from "../model/nets.ts";
import type { Shape } from "../model/random.ts";
import type { Layer } from "../num/layer.ts";
import { TANK } from "../sim/plant.ts";

/** The spec's copy-phase settings, plus one 60 s disturbance per run (D-016: without it the net ignored its
 *  error-so-far input and could not hold low levels). */
export const COPY = {
  runs: 50, runS: 400, stepAtS: 200, sampleEveryS: 2, // 50 × 200 = 10,000 states
  levelRange: [0.1, 1.9] as const, // m, start level and both setpoints, uniform
  disturbS: 60, // s, outflow × 1.2 once per run, starting at a uniform time in [0, 340] s (D-016)
  dataSeed: 11, noiseSeedBase: 1000, initSeed: 13,
  lr: 0.01, momentum: 0.9, batch: 64, steps: 2000,
  logEvery: 10, snapshotEvery: 200,
} as const;

export type CopyData = { x: number[][]; y: number[] }; // inputs as Q12 / 4096; the fixed PI's clamped valve
/** A float net: every layer is dense + tanh (the Lab shape). w is row-major [out][in], like the integer Layer. */
export type FloatNet = { in: number; out: number; w: Float64Array; b: Float64Array }[];

/** 50 fixed-PI runs of 400 s. Each draws a start level and two setpoints from [0.1, 1.9] m (rng seed 11),
 *  then a disturbance start; the setpoint steps at 200 s; noise seed 1000 + run. The disturbance makes the
 *  error so far differ from its steady value at each level, so the net must learn to use it (D-016). The Lab net inputs are taken before the PI acts, every
 *  2 s, with the integral's hold rule using the PI's valve (as for the check states). Shuffled with a fresh seed 11. */
export function copyData(): CopyData {
  const r = makeRng(COPY.dataSeed), [lo, hi] = COPY.levelRange, draw = () => lo + (hi - lo) * r.uniform();
  const steps = Math.round(COPY.runS / TANK.dt), stepAt = Math.round(COPY.stepAtS / TANK.dt), every = Math.round(COPY.sampleEveryS / TANK.dt);
  const x: number[][] = [], y: number[] = [];
  for (let run = 0; run < COPY.runs; run++) {
    const start = draw(), sp1 = draw(), sp2 = draw();
    const plant = makePlant({ level: start, rng: makeRng(COPY.noiseSeedBase + run) });
    const pi = fixedPI(), inputs = makeNetInputs();
    pi.reset(start, sp1);
    inputs.reset(start);
    const dSteps = Math.round(COPY.disturbS / TANK.dt), d0 = Math.floor(r.uniform() * (steps - dSteps)), d1 = d0 + dSteps;
    for (let n = 0; n < steps; n++) {
      const sp = n < stepAt ? sp1 : sp2, measured = plant.measure();
      const q = inputs.next(measured, sp), valve = pi.step(measured, sp);
      if (n % every === 0) { x.push([...q].map(v => v / 4096)); y.push(valve); }
      inputs.after(valve);
      plant.step(valve, n >= d0 && n < d1);
    }
  }
  const s = makeRng(COPY.dataSeed); // Fisher–Yates
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(s.uniform() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
    [y[i], y[j]] = [y[j], y[i]];
  }
  return { x, y };
}

/** Xavier-uniform weights, limit √(6 / (in + out)), drawn layer by layer in row-major order; biases 0. */
export function xavier(shape: Shape, seed: number): FloatNet {
  const r = makeRng(seed);
  return shape.map(s => {
    const lim = Math.sqrt(6 / (s.in + s.out));
    return { in: s.in, out: s.out, w: Float64Array.from({ length: s.in * s.out }, () => (r.uniform() * 2 - 1) * lim), b: new Float64Array(s.out) };
  });
}

/** Activations of every layer (index 0 is the input). */
function forwardF(net: FloatNet, x: number[]): Float64Array[] {
  const acts = [Float64Array.from(x)];
  for (const L of net) {
    const a = acts.at(-1)!, z = new Float64Array(L.out);
    for (let o = 0; o < L.out; o++) {
      let s = L.b[o];
      for (let i = 0; i < L.in; i++) s += L.w[o * L.in + i] * a[i];
      z[o] = Math.tanh(s);
    }
    acts.push(z);
  }
  return acts;
}

/** The net's valve: (y + 1) / 2 from the tanh output in [−1, 1]. */
export const valveF = (net: FloatNet, x: number[]) => (forwardF(net, x).at(-1)![0] + 1) / 2;

/** Mean squared error between the net's valve and the PI's over the given samples, and its gradient. */
export function lossAndGrad(net: FloatNet, data: CopyData, idx: number[]): { loss: number; grad: FloatNet } {
  const grad: FloatNet = net.map(L => ({ in: L.in, out: L.out, w: new Float64Array(L.w.length), b: new Float64Array(L.out) }));
  let loss = 0;
  const n = idx.length;
  for (const j of idx) {
    const acts = forwardF(net, data.x[j]), y = acts.at(-1)!;
    const err = (y[0] + 1) / 2 - data.y[j];
    loss += err * err;
    // dL/dy = 2·err/n · dv/dy (½); through tanh: × (1 − y²)
    let delta = Float64Array.of((err / n) * (1 - y[0] * y[0]));
    for (let k = net.length - 1; k >= 0; k--) {
      const L = net[k], a = acts[k], g = grad[k];
      const prev = new Float64Array(L.in);
      for (let o = 0; o < L.out; o++) {
        g.b[o] += delta[o];
        for (let i = 0; i < L.in; i++) {
          g.w[o * L.in + i] += delta[o] * a[i];
          prev[i] += L.w[o * L.in + i] * delta[o];
        }
      }
      if (k > 0) for (let i = 0; i < L.in; i++) prev[i] *= 1 - a[i] * a[i]; // a = tanh output of layer k − 1
      delta = prev;
    }
  }
  return { loss: loss / n, grad };
}

/** Full-data MSE. Same sums in the same order as forwardF, without allocating per sample (it runs 201 times). */
export function datasetLoss(net: FloatNet, data: CopyData): number {
  const bufs = [new Float64Array(net[0].in), ...net.map(L => new Float64Array(L.out))];
  let s = 0;
  for (let j = 0; j < data.x.length; j++) {
    const x = data.x[j];
    for (let i = 0; i < x.length; i++) bufs[0][i] = x[i];
    for (let k = 0; k < net.length; k++) {
      const L = net[k], a = bufs[k], z = bufs[k + 1];
      for (let o = 0; o < L.out; o++) {
        let t = L.b[o];
        for (let i = 0; i < L.in; i++) t += L.w[o * L.in + i] * a[i];
        z[o] = Math.tanh(t);
      }
    }
    const e = (bufs[net.length][0] + 1) / 2 - data.y[j];
    s += e * e;
  }
  return s / data.x.length;
}

export const quantiseNet = (net: FloatNet): Layer[] =>
  net.map(L => quantise({ in: L.in, out: L.out, w: [...L.w], b: [...L.b], act: "tanh" }));

export type CopyLog = { step: number; loss: number }[];
export type Snapshot = { step: number; layers: Layer[] };

/** Momentum SGD (v = 0.9·v + g; θ −= 0.01·v), batch 64 taken in order from the shuffled data, wrapping round.
 *  Logs the full-data loss at step 0 and every 10 steps; a quantised snapshot every 200 steps. */
export function trainCopy(opts: { steps?: number; data?: CopyData } = {}): { net: FloatNet; log: CopyLog; snapshots: Snapshot[] } {
  const data = opts.data ?? copyData(), steps = opts.steps ?? COPY.steps, N = data.x.length;
  const net = xavier(LAB_SHAPE, COPY.initSeed);
  const vel = net.map(L => ({ w: new Float64Array(L.w.length), b: new Float64Array(L.out) }));
  const log: CopyLog = [{ step: 0, loss: datasetLoss(net, data) }], snapshots: Snapshot[] = [];
  for (let step = 1; step <= steps; step++) {
    const idx = Array.from({ length: COPY.batch }, (_, k) => ((step - 1) * COPY.batch + k) % N);
    const { grad } = lossAndGrad(net, data, idx);
    net.forEach((L, k) => {
      for (const p of ["w", "b"] as const) {
        const th = L[p], v = vel[k][p], g = grad[k][p];
        for (let i = 0; i < th.length; i++) { v[i] = COPY.momentum * v[i] + g[i]; th[i] -= COPY.lr * v[i]; }
      }
    });
    if (step % COPY.logEvery === 0) log.push({ step, loss: datasetLoss(net, data) });
    if (step % COPY.snapshotEvery === 0) snapshots.push({ step, layers: quantiseNet(net) });
  }
  return { net, log, snapshots };
}

// File text: two-space JSON with number arrays kept on one line, so diffs stay readable.
export const fmt = (v: unknown) => JSON.stringify(v, null, 2).replace(/\[\s+(-?[\d.e+-]+(?:,\s+-?[\d.e+-]+)*)\s+\]/g, (_, xs: string) => `[${xs.split(/,\s+/).join(", ")}]`) + "\n";
export const layersJson = (layers: Layer[]): LayerJson[] => toWeightFile(layers, { trainer: "copy", seed: COPY.initSeed }).layers;

/** The copy phase's share of models/lab/: copy-weights.json as text, and its log entries and snapshots for
 *  log.json and snapshots.json (lab-files.ts adds the ES phase). Losses are kept to 6 significant digits. */
export function copyFiles() {
  const { log, snapshots } = trainCopy();
  const layers = snapshots.at(-1)!.layers;
  return {
    layers,
    "copy-weights.json": fmt(toWeightFile(layers, { trainer: "copy", seed: COPY.initSeed })),
    log: log.map(e => ({ phase: "copy" as const, step: e.step, loss: Number(e.loss.toPrecision(6)) })),
    snapshots: snapshots.map(s => ({ phase: "copy" as const, step: s.step, layers: layersJson(s.layers) })),
  };
}
