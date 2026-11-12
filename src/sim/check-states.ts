// Check states (spec "Check states"): the Lab-net inputs, taken before the controller acts, at every 15th step
// of the training set at seed 1, under the fixed PI. 5 segments × 3,000 / 15 = 1,000 states. S4 feeds them to nets.
import { makeRng } from "../rng.ts";
import { makePlant, TANK } from "./plant.ts";
import { SEGMENTS, STEPS, fixedPI } from "./fixed-test.ts";
import { makeNetInputs } from "./net-inputs.ts";

export const CHECK_EVERY = 15; // steps, 1.5 s
export const CHECK_SEED = 1;

export function checkStates(): Int16Array[];
export function checkStates(opts: { withPI: true }): { states: Int16Array[]; piI: number[] };
/** withPI also returns the PI's integral part at each state (for tests). */
export function checkStates(opts: { withPI?: boolean } = {}) {
  const states: Int16Array[] = [], piI: number[] = [];
  for (const seg of SEGMENTS.training) {
    const plant = makePlant({ level: seg.start, rng: makeRng(CHECK_SEED) });
    const pi = fixedPI(), inputs = makeNetInputs();
    pi.reset(seg.start, seg.setpoint);
    inputs.reset(seg.start);
    const [d0, d1] = seg.disturb ? seg.disturb.map(s => Math.round(s / TANK.dt)) : [0, 0];
    for (let n = 0; n < STEPS; n++) {
      const measured = plant.measure();
      const x = inputs.next(measured, seg.setpoint);
      if (n % CHECK_EVERY === 0) { states.push(x); piI.push(pi.I); }
      const valve = pi.step(measured, seg.setpoint);
      inputs.after(valve);
      plant.step(valve, n >= d0 && n < d1);
    }
  }
  return opts.withPI ? { states, piI } : states;
}
