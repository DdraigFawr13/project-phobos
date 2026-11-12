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
  // and pinned shut: error −1 m gives u < 0, valve 0, I held
  for (let i = 0; i < 1000; i++) assert.equal(pi.step(2.0, 1.0), 0);
  assert.equal(pi.step(1.0, 1.0), 0.5);
});

test("plant clamps the valve to [0, 1] and the level at 0 m", () => {
  const a = makePlant({ level: 1.0 }), b = makePlant({ level: 1.0 });
  for (let n = 0; n < 50; n++) assert.equal(a.step(5, false), b.step(1, false));
  const c = makePlant({ level: 0.01 }), d = makePlant({ level: 0.01 });
  for (let n = 0; n < 50; n++) assert.equal(c.step(-3, false), d.step(0, false));
  const e = makePlant({ level: 0.001 });
  for (let n = 0; n < 2000; n++) e.step(0, true);
  assert.equal(e.level, 0);
});

test("a disturbance lasts exactly 60 s of steps whenever it is tapped", async () => {
  const { createLive } = await import("../src/sim/live.ts");
  for (const at of [0, 0.1, 0.3, 7.7, 123.4]) {
    const live = createLive({ seed: 1 });
    live.step(at);
    live.disturb();
    let steps = 0;
    while (live.disturbed()) { live.step(0.1); steps++; }
    assert.equal(steps, 600, `tapped at ${at} s`);
  }
});

test("rng: xorshift32 known value (13, 17, 5 shifts): seed 1 gives 270369 first", () => {
  // Hand-derived: x = 1; x ^= x << 13 → 8193; x ^= x >>> 17 → 8193; x ^= x << 5 → 8193 ^ 262176 = 270369.
  assert.equal(makeRng(1).next(), 270369);
  assert.equal(makeRng(1).uniform(), 270369 / 2 ** 32);
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
