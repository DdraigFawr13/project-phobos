// Float weights to an int16 layer, and the per-layer sum bound (spec "Numbers", D-006). Runs outside the runtime:
// it uses Math.round, as the spec's rounding rule says.
import { sat16, ONE } from "./fixed.ts";
import type { Act, Layer } from "./layer.ts";

export type FloatLayer = { in: number; out: number; w: number[]; b: number[]; act: Act };

/** s = the largest integer in [0, 14] with max|w| × 2^s ≤ 32767; w = round(w × 2^s), b = round(b × 4096), saturated. */
export function quantise(f: FloatLayer): Layer {
  if (f.w.length !== f.in * f.out) throw new Error(`quantise: w has ${f.w.length} values, want ${f.in * f.out}`);
  if (f.b.length !== f.out) throw new Error(`quantise: b has ${f.b.length} values, want ${f.out}`);
  let max = 0;
  for (const v of f.w) if (Math.abs(v) > max) max = Math.abs(v);
  let s = 14;
  while (s > 0 && max * 2 ** s > 32767) s--;
  return {
    kind: "dense", in: f.in, out: f.out, shift: s, act: f.act,
    w: Int16Array.from(f.w, v => sat16(Math.round(v * 2 ** s))),
    b: Int16Array.from(f.b, v => sat16(Math.round(v * ONE))),
  };
}

/** Throws if the largest row sum Σ_j |w_ij| × 32768 (the worst |Σ w·x| for int16 x) is ≥ limit. */
export function checkBound(layer: Layer, limit = 2 ** 53): void {
  let worst = 0;
  for (let o = 0; o < layer.out; o++) {
    let row = 0;
    for (let i = 0; i < layer.in; i++) row += Math.abs(layer.w[o * layer.in + i]);
    if (row > worst) worst = row;
  }
  if (worst * 32768 >= limit) throw new Error(`checkBound: sum bound ${worst * 32768} ≥ limit ${limit}`);
}
