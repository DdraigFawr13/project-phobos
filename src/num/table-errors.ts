// Table error measurement, in float, for the tests and Lab's Tables tab. Not runtime code.
import { tanhQ, expQ } from "./act.ts";

export type TableError = { lsb: number; at: number; pct: number };

/** Largest |table − round(4096 × f(x / 4096))| over every int16 input, and as a % of the output range
 * (8,192 LSB for tanh, 4,096 for exp). exp's reference uses min(x, 0), as its input is clamped to ≤ 0. */
export function tableErrors(): { tanh: TableError; exp: TableError } {
  const worst = (q: (x: number) => number, ref: (x: number) => number, range: number): TableError => {
    let lsb = 0,
      at = 0;
    for (let x = -32768; x <= 32767; x++) {
      const d = Math.abs(q(x) - Math.round(4096 * ref(x / 4096)));
      if (d > lsb) {
        lsb = d;
        at = x;
      }
    }
    return { lsb, at, pct: (100 * lsb) / range };
  };
  return {
    tanh: worst(tanhQ, Math.tanh, 8192),
    exp: worst(expQ, (x) => Math.exp(Math.min(x, 0)), 4096),
  };
}
