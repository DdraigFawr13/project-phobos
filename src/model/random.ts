// Fixed-seed random nets (spec "Test net"): each weight and bias is (uniform() × 2 − 1) × 0.5, drawn layer by
// layer, w in row-major order then b, then quantised. Used for S4's checks; trained nets replace them in M3.
import { makeRng } from "../rng.ts";
import { quantise } from "../num/quantise.ts";
import type { Act, Layer } from "../num/layer.ts";

export type Shape = { in: number; out: number; act: Act }[];

export function randomNet(shape: Shape, seed: number): Layer[] {
  const rng = makeRng(seed),
    draw = () => (rng.uniform() * 2 - 1) * 0.5;
  return shape.map((s) => {
    const w = Array.from({ length: s.in * s.out }, draw),
      b = Array.from({ length: s.out }, draw);
    return quantise({ ...s, w, b });
  });
}
