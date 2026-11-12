// Integer vs float on the check states (spec "Terms", J3, D-007), for Lab's Integer vs float tab; the tests
// recompute the same numbers independently. Float, not runtime code.
import { dense } from "../runtime/dense.ts";
import { forward } from "../runtime/net.ts";
import { mask, argmax } from "../runtime/select.ts";
import { denseRef, forwardRef, maskRef, argmaxRef } from "./dense.ts";
import { testNet, labShapedNet, TEST_NET_ALLOWED, valveOf, valveOfRef } from "../model/nets.ts";
import type { Layer } from "../num/layer.ts";

const Q = 4096;

/** Largest |integer − float| per layer as a % of the layer's output range. Each layer gets the integer
 *  previous-layer output (dequantised) in both versions. Range: tanh 2, exp 1, none: max(1, float max − min). */
export function layerGaps(net: Layer[], states: Int16Array[]): number[] {
  const worst = net.map(() => 0), lo = net.map(() => Infinity), hi = net.map(() => -Infinity);
  for (const s of states) {
    let x = s;
    net.forEach((L, k) => {
      const yi = dense(L, x), yf = denseRef(L, [...x].map(v => v / Q));
      yf.forEach((f, o) => {
        worst[k] = Math.max(worst[k], Math.abs(yi[o] / Q - f));
        lo[k] = Math.min(lo[k], f); hi[k] = Math.max(hi[k], f);
      });
      x = yi;
    });
  }
  return net.map((L, k) => {
    const range = L.act === "tanh" ? 2 : L.act === "exp" ? 1 : Math.max(1, hi[k] - lo[k]);
    return (100 * worst[k]) / range;
  });
}

/** % of [integer, float] pairs within tol of each other (D-007: valve within 0.01). */
export const withinPct = (series: [number, number][], tol = 0.01) =>
  (100 * series.filter(([a, b]) => Math.abs(a - b) <= tol).length) / series.length;

export type Comparison = {
  states: number;
  testNet: { layerGaps: number[]; samePct: number; distinct: number; counts: number[] };
  labNet: { layerGaps: number[]; withinPct: number; maxGap: number; series: [number, number][] };
};

export function compareNets(states: Int16Array[]): Comparison {
  const tn = testNet(), ln = labShapedNet();
  let same = 0, maxGap = 0;
  const counts = [0, 0, 0, 0, 0];
  const series: [number, number][] = [];
  for (const s of states) {
    const f = [...s].map(v => v / Q);
    const ai = argmax(mask(forward(tn, s).at(-1)!, TEST_NET_ALLOWED));
    const af = argmaxRef(maskRef(forwardRef(tn, f).at(-1)!, TEST_NET_ALLOWED));
    if (ai === af) same++;
    if (ai >= 0) counts[ai]++;
    const vi = valveOf(forward(ln, s).at(-1)![0]), vf = valveOfRef(forwardRef(ln, f).at(-1)![0]);
    maxGap = Math.max(maxGap, Math.abs(vi - vf));
    series.push([vi, vf]);
  }
  const n = states.length;
  return {
    states: n,
    testNet: { layerGaps: layerGaps(tn, states), samePct: (100 * same) / n, distinct: counts.filter(c => c > 0).length, counts },
    labNet: { layerGaps: layerGaps(ln, states), withinPct: withinPct(series), maxGap, series },
  };
}
