// S1 plant and PI checks (docs/specs/first-usable.md, S1 "Checks that fail now").
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../src/rng.ts";
import { makePlant, TANK, steadyValve } from "../src/sim/plant.ts";
import { makePI, FIXED_PI } from "../src/sim/pi.ts";

const STEPS_PER_S = Math.round(1 / TANK.dt);

test("fixed PI brings 0.9 m to within 0.01 m of 1.0 m by 300 s, valve 0.5 ± 0.01", () => {
  const plant = makePlant({ level: 0.9, rng: makeRng(1) });
  const pi = makePI(FIXED_PI.Kp, FIXED_PI.Ti);
  pi.reset(0.9, 1.0);
  let valve = steadyValve(0.9);
  for (let n = 0; n < 300 * STEPS_PER_S; n++) {
    valve = pi.step(plant.measure(), 1.0);
    plant.step(valve, false);
  }
  assert.ok(Math.abs(plant.level - 1.0) <= 0.01, `level ${plant.level}`);
  assert.ok(Math.abs(valve - 0.5) <= 0.01, `valve ${valve}`);
});

test("valve held at 1 fills the tank to its 2.0 m top", () => {
  const plant = makePlant({ level: 1.0, rng: makeRng(1) });
  for (let n = 0; n < 2000 * STEPS_PER_S; n++) plant.step(1, false);
  assert.equal(plant.level, TANK.maxLevel);
});

test("steady valve holds the level without a controller", () => {
  for (const h of [0.25, 1.0, 1.75]) {
    const plant = makePlant({ level: h });
    for (let n = 0; n < 100 * STEPS_PER_S; n++) plant.step(steadyValve(h), false);
    assert.ok(Math.abs(plant.level - h) < 1e-9, `${h}: ${plant.level}`);
  }
});

test("disturbance drains faster: the level falls under the steady valve", () => {
  const plant = makePlant({ level: 1.0 });
  for (let n = 0; n < 10 * STEPS_PER_S; n++) plant.step(steadyValve(1.0), true);
  assert.ok(plant.level < 0.95, `level ${plant.level}`);
});

test("measure() adds at most ±0.005 m of noise and draws exactly one uniform", () => {
  const a = makeRng(5), b = makeRng(5);
  const plant = makePlant({ level: 1.0, rng: a });
  for (let i = 0; i < 1000; i++) {
    const m = plant.measure();
    const u = b.uniform();
    assert.equal(m, 1.0 + (u * 0.01 - 0.005));
    assert.ok(Math.abs(m - 1.0) <= 0.005);
  }
});

test("PI holds its integral while the valve is pinned (conditional integration)", () => {
  const pi = makePI(1, 40);
  pi.reset(1.0, 1.0);
  for (let i = 0; i < 1000; i++) assert.equal(pi.step(0.0, 1.0), 1); // error 1 m: u > 1, valve pinned at 1
  // I stayed at its preload (0.5), so with zero error the valve is 0.5 again at once
  assert.equal(pi.step(1.0, 1.0), 0.5);
});

test("rng: seed 0 behaves as seed 1; same seed, same sequence; uniform in [0, 1)", () => {
  const z = makeRng(0), o = makeRng(1), o2 = makeRng(1), d = makeRng(2);
  let differs = false;
  for (let i = 0; i < 1000; i++) {
    const x = o.uniform();
    assert.equal(z.uniform(), x);
    assert.equal(o2.uniform(), x);
    if (d.uniform() !== x) differs = true;
    assert.ok(x >= 0 && x < 1);
  }
  assert.ok(differs);
});

test("live state: valve = clamp(P + I) every step", async () => {
  const { createLive } = await import("../src/sim/live.ts");
  const live = createLive({ seed: 3, level: 0.5, setpoint: 1.2 });
  for (let i = 0; i < 3000; i++) {
    live.step(0.1);
    const { pTerm, iTerm, valve } = live.state;
    assert.equal(valve, Math.min(1, Math.max(0, pTerm + iTerm)));
  }
});
