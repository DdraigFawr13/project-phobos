// PI controller (spec "PI", "Terms"): u = Kp·e + I, valve = u clamped to [0, 1].
// I integrates only while 0 ≤ u ≤ 1 (conditional integration, anti-windup).
import { TANK, steadyValve } from "./plant.ts";

export type Controller = { reset(level: number, setpoint: number): void; step(measured: number, setpoint: number): number };

/** IMC tuning, λ = 10 s: Kp = A / (0.1·λ) = 1.0 at every level, Ti = 2·A·√h / k = 40·√h s. */
export const imcTi = (h: number) => (2 * TANK.area * Math.sqrt(h)) / TANK.k;
/** The fixed PI, tuned once at 1.0 m. */
export const FIXED_PI = { Kp: 1.0, Ti: imcTi(1.0) } as const;

export type PI = Controller & { readonly Kp: number; readonly Ti: number; /** the integral part, after the last step */ readonly I: number };

export function makePI(Kp: number, Ti: number): PI {
  let I = 0;
  return {
    Kp, Ti,
    get I() { return I; },
    reset(level) { I = steadyValve(level); },
    step(measured, setpoint) {
      const e = setpoint - measured;
      const u = Kp * e + I;
      if (u >= 0 && u <= 1) I += (Kp / Ti) * e * TANK.dt;
      return Math.min(1, Math.max(0, u));
    },
  };
}
