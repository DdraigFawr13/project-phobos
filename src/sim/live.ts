// Lab's live simulation: one tank under the fixed PI and, while Net is on, a second tank under a net (S5).
// Lab and tests/trace.test.ts both drive this, so the golden trace locks exactly what Lab runs (SIM-01, SIM-02).
import { makeRng } from "../rng.ts";
import { makePlant, steadyValve, TANK } from "./plant.ts";
import { makePI, FIXED_PI } from "./pi.ts";
import { makeNetController } from "./net-controller.ts";
import type { Layer } from "../num/layer.ts";

export const HISTORY_S = 600; // s of history kept for the chart
export const DISTURB_S = 60; // s a disturbance lasts
export const NET_SEED = 2; // the net tank's own sensor noise (spec "Lab")
export const SETPOINT = { min: 0.1, max: 1.9, step: 0.05 } as const; // m, the slider

export type Sample = { t: number; level: number; setpoint: number; valve: number; disturbed: boolean; net: number | null /* net tank level, m */ };
export type NetTank = { level: number; measured: number; valve: number; inputs: Int16Array | null };
export type LiveState = {
  t: number; // s
  level: number; // m, true level
  measured: number; // m, what the PI saw last step
  setpoint: number; // m
  valve: number; // 0 shut to 1 open
  pTerm: number; // Kp·error, last step (for the teaching layer)
  iTerm: number; // the PI's integral part, last step
  disturbedUntil: number; // s, for display; the step count below decides
  net: NetTank | null; // the net tank while Net is on
  history: Sample[]; // one sample per second, oldest first, at most HISTORY_S + 1
};

const STEPS_PER_S = Math.round(1 / TANK.dt);

export function createLive(opts: { seed?: number; level?: number; setpoint?: number } = {}) {
  const level0 = opts.level ?? 1.0;
  const plant = makePlant({ level: level0, rng: makeRng(opts.seed ?? 1) });
  const pi = makePI(FIXED_PI.Kp, FIXED_PI.Ti);
  pi.reset(level0, opts.setpoint ?? level0);
  let n = 0; // steps taken; t = n·dt avoids summing dt
  let disturbEndStep = 0; // disturbed while n < disturbEndStep: exactly DISTURB_S of steps per tap
  const state: LiveState = {
    t: 0, level: level0, measured: level0, setpoint: opts.setpoint ?? level0, valve: steadyValve(level0),
    pTerm: 0, iTerm: steadyValve(level0),
    disturbedUntil: 0, net: null, history: [],
  };
  const record = () => {
    state.history.push({ t: state.t, level: state.level, setpoint: state.setpoint, valve: state.valve, disturbed: n < disturbEndStep, net: state.net?.level ?? null });
    if (state.history.length > HISTORY_S + 1) state.history.shift();
  };
  record();
  let net: { plant: ReturnType<typeof makePlant>; ctrl: ReturnType<typeof makeNetController> } | null = null;

  function tick() {
    const disturbed = n < disturbEndStep;
    state.measured = plant.measure();
    const iBefore = pi.I;
    state.valve = pi.step(state.measured, state.setpoint);
    state.pTerm = pi.Kp * (state.setpoint - state.measured);
    state.iTerm = iBefore; // the I that went into this step's valve: valve = clamp(pTerm + iTerm)
    state.level = plant.step(state.valve, disturbed);
    if (net && state.net) {
      const m = net.plant.measure();
      state.net.measured = m;
      state.net.valve = net.ctrl.step(m, state.setpoint);
      state.net.inputs = net.ctrl.last;
      state.net.level = net.plant.step(state.net.valve, disturbed); // disturb() hits both tanks
    }
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
    disturb() { disturbEndStep = n + DISTURB_S * STEPS_PER_S; state.disturbedUntil = disturbEndStep * TANK.dt; },
    disturbed: () => n < disturbEndStep,
    /** Net on: a second tank, reset to steady state at the PI tank's true level, with its own noise (seed 2).
     *  null turns it off. */
    setNet(layers: Layer[] | null) {
      if (!layers) { net = null; state.net = null; return; }
      const h = state.level;
      net = { plant: makePlant({ level: h, rng: makeRng(NET_SEED) }), ctrl: makeNetController(layers) };
      net.ctrl.reset(h, state.setpoint);
      state.net = { level: h, measured: h, valve: steadyValve(h), inputs: null };
    },
  };
}
export type Live = ReturnType<typeof createLive>;
