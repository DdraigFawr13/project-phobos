// Float reference (spec "Terms": "Float reference"), for tests, Lab's Integer vs float tab and the trainer only;
// never the runtime. The same layers in float with dequantised weights w / 2^shift and b / 4096, no saturation.
// exp uses exp(min(x, 0)), the function the exp table covers (its input is clamped to ≤ 0, spec "Tables").
import type { Layer } from "../num/layer.ts";

export function denseRef(layer: Layer, x: number[]): number[] {
  const { in: n, out, w, b, shift, act } = layer,
    scale = 2 ** shift;
  const y: number[] = [];
  for (let o = 0; o < out; o++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += (w[o * n + i] / scale) * x[i];
    const v = s + b[o] / 4096;
    y.push(act === "tanh" ? Math.tanh(v) : act === "exp" ? Math.exp(Math.min(v, 0)) : v);
  }
  return y;
}

export function forwardRef(layers: Layer[], x: number[]): number[][] {
  const outs: number[][] = [];
  for (const L of layers) {
    x = denseRef(L, x);
    outs.push(x);
  }
  return outs;
}

/** Forbidden actions become −Infinity. */
export const maskRef = (scores: number[], allowed: boolean[]) => scores.map((s, i) => (allowed[i] ? s : -Infinity));

/** Lowest index on ties; −1 if every action is forbidden. */
export function argmaxRef(v: number[]): number {
  let best = -1;
  for (let i = 0; i < v.length; i++) if (v[i] !== -Infinity && (best < 0 || v[i] > v[best])) best = i;
  return best;
}
