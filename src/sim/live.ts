// Lab's live simulation: one tank under the fixed PI. Lab and tests/trace.test.ts both drive this,
// so the golden trace locks exactly what Lab runs (SIM-01, SIM-02).
import { makeRng } from "../rng.ts";
import { makePlant, steadyValve, TANK } from "./plant.ts";
import { makePI, FIXED_PI } from "./pi.ts";

export const HISTORY_S = 600; // s of history kept for the chart
export const DISTURB_S = 60; // s a disturbance lasts
export const SETPOINT = { min: 0.1, max: 1.9, step: 0.05 } as const; // m, the slider

export type Sample = { t: number; level: number; setpoint: number; valve: number; disturbed: boolean };
export type LiveState = {
  t: number; // s
  level: number; // m, true level
  measured: number; // m, what the PI saw last step
  setpoint: number; // m
  valve: number; // 0 shut to 1 open
  pTerm: number; // Kp·error, last step (for the teaching layer)
  iTerm: number; // the PI's integral part, last step
  disturbedUntil: number; // s; disturbed while t < disturbedUntil
  net: null; // M3
  history: Sample[]; // one sample per second, oldest first, at most HISTORY_S + 1
};

const STEPS_PER_S = Math.round(1 / TANK.dt);

export function createLive(opts: { seed?: number; level?: number; setpoint?: number } = {}) {
  const level0 = opts.level ?? 1.0;
  const plant = makePlant({ level: level0, rng: makeRng(opts.seed ?? 1) });
  const pi = makePI(FIXED_PI.Kp, FIXED_PI.Ti);
  pi.reset(level0, opts.setpoint ?? level0);
  let n = 0; // steps taken; t = n·dt avoids summing dt
  const state: LiveState = {
    t: 0, level: level0, measured: level0, setpoint: opts.setpoint ?? level0, valve: steadyValve(level0),
    pTerm: 0, iTerm: steadyValve(level0),
    disturbedUntil: 0, net: null, history: [],
  };
  const record = () => {
    state.history.push({ t: state.t, level: state.level, setpoint: state.setpoint, valve: state.valve, disturbed: state.t < state.disturbedUntil });
    if (state.history.length > HISTORY_S + 1) state.history.shift();
  };
  record();

  function tick() {
    const disturbed = state.t < state.disturbedUntil;
    state.measured = plant.measure();
    const iBefore = pi.I;
    state.valve = pi.step(state.measured, state.setpoint);
    state.pTerm = pi.Kp * (state.setpoint - state.measured);
    state.iTerm = iBefore; // the I that went into this step's valve: valve = clamp(pTerm + iTerm)
    state.level = plant.step(state.valve, disturbed);
    n++;
    state.t = n * TANK.dt;
    if (n % STEPS_PER_S === 0) record();
  }

  return {
    state,
    /** Advance by whole steps covering `seconds` (rounded to the nearest 0.1 s). */
    step(seconds: number) {
      const steps = Math.round(seconds * STEPS_PER_S);
      for (let i = 0; i < steps; i++) tick();
    },
    setSetpoint(m: number) {
      const s = Math.round(Math.min(SETPOINT.max, Math.max(SETPOINT.min, m)) / SETPOINT.step) * SETPOINT.step;
      state.setpoint = Math.round(s * 100) / 100;
    },
    /** Outflow × 1.2 for the next 60 s; tapping again restarts the 60 s. */
    disturb() { state.disturbedUntil = state.t + DISTURB_S; },
    disturbed: () => state.t < state.disturbedUntil,
  };
}
export type Live = ReturnType<typeof createLive>;
