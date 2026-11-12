// Lab net inputs (spec "Lab net inputs"), all Q12 int16 (1.0 = 4096): setpoint m, measured level m, error m,
// and the error integral ∫e dt / 32 clamped to ±7.99. The integral is kept in float here, outside the integer
// runtime, and rounded to Q12 each step (spec "Rounding": Math.round, then saturate).
import { TANK } from "./plant.ts";

export const Q = 4096;
export const INTEGRAL_DIV = 32;
export const INTEGRAL_MAX = 7.99; // after the divide
const PIN_LOW = 0.001, PIN_HIGH = 0.999; // valve at or past these counts as pinned: the integral is held

const q12 = (x: number) => Math.min(32767, Math.max(-32768, Math.round(x * Q)));

/** next() builds the inputs before the controller acts; after(valve) then applies that step's error to the
 *  integral unless the valve was pinned, so the next step's inputs see it ("held while the previous valve is pinned"). */
export function makeNetInputs() {
  let integral = 0; // m·s, ∫e dt
  let e = 0;
  return {
    /** At a segment start: preload to the fixed PI's steady value, 20·√h0 (I = 0.5·√h0 = ∫e / 40). */
    reset(level: number) { integral = 20 * Math.sqrt(Math.max(level, 0)); e = 0; },
    next(measured: number, setpoint: number): Int16Array {
      e = setpoint - measured;
      const integ = Math.min(INTEGRAL_MAX, Math.max(-INTEGRAL_MAX, integral / INTEGRAL_DIV));
      return Int16Array.of(q12(setpoint), q12(measured), q12(e), q12(integ));
    },
    after(valve: number) {
      if (valve > PIN_LOW && valve < PIN_HIGH) {
        integral = Math.min(INTEGRAL_MAX * INTEGRAL_DIV, Math.max(-INTEGRAL_MAX * INTEGRAL_DIV, integral + e * TANK.dt));
      }
    },
  };
}
export type NetInputs = ReturnType<typeof makeNetInputs>;
