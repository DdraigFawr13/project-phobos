// Lab's Replay tank (S6, J5): one snapshot's net plays the five held-out segments in order, each from its steady
// start, on noise seed 101 (the first held-out seed), then starts again. Changing the snapshot restarts at 0 s, so
// two snapshots can be compared from the same state. Pure and separate from the UI (SIM-01).
import { makeRng } from "../rng.ts";
import { makePlant, steadyValve, TANK } from "./plant.ts";
import { SEGMENTS, SEEDS, SEGMENT_S, STEPS } from "./fixed-test.ts";
import { makeNetController } from "./net-controller.ts";
import type { Layer } from "../num/layer.ts";

export const REPLAY_SEED = SEEDS.heldOut[0];
export type ReplaySample = { t: number; level: number; setpoint: number; valve: number; disturbed: boolean };
export type ReplayState = {
  t: number; // s since the replay started, 0 to 1,500
  segment: number; // 0-based held-out segment
  name: string;
  level: number;
  setpoint: number;
  valve: number;
  disturbed: boolean;
  iae: number; // m·s so far in this segment
  history: ReplaySample[]; // this segment, one sample per second
  finished: { name: string; iae: number }[]; // segments completed in this round, in order
};

const STEPS_PER_S = Math.round(1 / TANK.dt);

export function createReplay(layers: Layer[]) {
  const segs = SEGMENTS.heldOut;
  let ctrl = makeNetController(layers),
    plant = makePlant({ level: 0 }),
    n = 0,
    seg = 0;
  const state = {} as ReplayState;
  const begin = (k: number) => {
    seg = k;
    n = 0;
    if (k === 0) state.finished = [];
    const s = segs[k];
    plant = makePlant({ level: s.start, rng: makeRng(REPLAY_SEED) });
    ctrl.reset(s.start, s.setpoint);
    Object.assign(state, {
      segment: k,
      name: s.name,
      level: s.start,
      setpoint: s.setpoint,
      valve: steadyValve(s.start),
      disturbed: false,
      iae: 0,
      history: [],
    });
    state.t = k * SEGMENT_S;
    state.history.push({ t: 0, level: s.start, setpoint: s.setpoint, valve: state.valve, disturbed: false });
  };
  begin(0);
  function tick() {
    const s = segs[seg],
      [d0, d1] = s.disturb ? s.disturb.map((x) => Math.round(x / TANK.dt)) : [0, 0];
    const disturbed = n >= d0 && n < d1;
    state.valve = Math.min(1, Math.max(0, ctrl.step(plant.measure(), s.setpoint)));
    state.level = plant.step(state.valve, disturbed);
    state.disturbed = disturbed;
    state.iae += Math.abs(state.level - s.setpoint) * TANK.dt;
    n++;
    state.t = seg * SEGMENT_S + n * TANK.dt;
    if (n % STEPS_PER_S === 0)
      state.history.push({ t: n * TANK.dt, level: state.level, setpoint: s.setpoint, valve: state.valve, disturbed });
    if (n === STEPS) {
      state.finished.push({ name: s.name, iae: state.iae });
      begin((seg + 1) % segs.length);
    }
  }
  return {
    state,
    step(seconds: number) {
      const k = Math.round(seconds * STEPS_PER_S);
      for (let i = 0; i < k; i++) tick();
    },
    /** Another snapshot's weights; the replay starts again at 0 s. */
    setLayers(next: Layer[]) {
      ctrl = makeNetController(next);
      begin(0);
    },
  };
}
export type Replay = ReturnType<typeof createReplay>;
