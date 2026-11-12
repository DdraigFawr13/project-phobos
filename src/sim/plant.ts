// Tank plant (spec "Plant", SIM-01, SIM-04): pure, floating point, explicit Euler. Units: m, m², m³/s, s.
import type { Rng } from "../rng.ts";

export const TANK = {
  area: 1.0, // m²
  maxLevel: 2.0, // m
  inflowMax: 0.1, // m³/s at valve 1
  k: 0.05, // m^2.5/s, outflow = k·√level
  dt: 0.1, // s
  disturbFactor: 1.2, // outflow coefficient while disturbed
  noise: 0.005, // ± m on the measured level
} as const;

/** Valve that holds level h steady: inflow = outflow, so 0.1·v = k·√h. */
export const steadyValve = (h: number) => (TANK.k * Math.sqrt(Math.max(h, 0))) / TANK.inflowMax;

export type Plant = {
  readonly level: number;
  /** Advance dt with the valve clamped to [0, 1]; returns the true level. */
  step(valve: number, disturbed: boolean): number;
  /** The level the controller sees: true level plus one uniform draw of noise (none without an rng). */
  measure(): number;
};

export function makePlant(opts: { level: number; rng?: Rng }): Plant {
  let h = opts.level;
  const rng = opts.rng;
  return {
    get level() { return h; },
    step(valve, disturbed) {
      const v = Math.min(1, Math.max(0, valve));
      const k = disturbed ? TANK.k * TANK.disturbFactor : TANK.k;
      const dh = ((TANK.inflowMax * v - k * Math.sqrt(Math.max(h, 0))) / TANK.area) * TANK.dt;
      h = Math.min(TANK.maxLevel, Math.max(0, h + dh));
      return h;
    },
    measure() {
      return rng ? h + (rng.uniform() * 2 * TANK.noise - TANK.noise) : h;
    },
  };
}
