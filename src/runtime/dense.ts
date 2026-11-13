// Dense layer in the integer runtime (spec "Runtime", "Numbers"; D-006): y = act(sat16(shr(Σ w·x, shift) + b)).
// Sums are plain JS numbers, bounded below 2^53 by checkBound at load time. No Math.* here.
import { sat16, shr } from "../num/fixed.ts";
import { tanhQ, expQ } from "../num/act.ts";
import type { Layer } from "../num/layer.ts";

export function dense(layer: Layer, x: Int16Array): Int16Array {
  const { in: n, out, w, b, shift, act } = layer;
  const y = new Int16Array(out);
  for (let o = 0; o < out; o++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += w[o * n + i] * x[i];
    const v = sat16(shr(s, shift) + b[o]);
    y[o] = act === "tanh" ? tanhQ(v) : act === "exp" ? expQ(v) : v;
  }
  return y;
}
