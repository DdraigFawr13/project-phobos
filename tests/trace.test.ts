// S1 same-seed trace (SIM-02). The golden file changes only in a commit that says why.
// Regenerate: UPDATE_GOLDEN=1 node --test tests/trace.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createLive } from "../src/sim/live.ts";
import { steadyValve } from "../src/sim/plant.ts";

const GOLDEN = new URL("./golden/trace-seed1.json", import.meta.url);

/** Spec trace: steady at 1.0 m, setpoint to 1.5 m at 60 s, disturbance 200–260 s, 600 s, fixed PI. */
function trace(seed: number) {
  const live = createLive({ seed, level: 1.0, setpoint: 1.0 });
  const out: { t: number; level: number; valve: number }[] = [];
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  for (let s = 0; s <= 600; s++) {
    if (s % 10 === 0) out.push({ t: s, level: r6(live.state.level), valve: r6(live.state.valve) });
    if (s === 600) break;
    if (s === 60) live.setSetpoint(1.5);
    if (s === 200) live.disturb();
    live.step(1);
  }
  return out;
}

test("seed 1 trace equals the golden file", () => {
  const got = trace(1);
  if (process.env.UPDATE_GOLDEN === "1") writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + "\n");
  const want = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.equal(got.length, 61);
  assert.deepEqual(got, want);
});

test("the trace is repeatable and seed 2 differs", () => {
  assert.deepEqual(trace(1), trace(1));
  assert.notDeepEqual(trace(2), trace(1));
});

test("the trace shows the scenario, checked against the physics, not the golden", () => {
  const tr = trace(1), at = (t: number) => tr.find(p => p.t === t)!;
  assert.deepEqual(at(0), { t: 0, level: 1, valve: 0.5 }); // steady start: valve 0.5·√1.0
  assert.ok(Math.abs(at(190).level - 1.5) < 0.005, `190 s: ${at(190).level}`);
  assert.ok(at(230).level < at(190).level - 0.02, `230 s: ${at(230).level}`);
  assert.ok(at(230).valve > at(190).valve + 0.05, `PI opens the valve against the disturbance: ${at(230).valve}`);
  assert.ok(Math.abs(at(600).level - 1.5) < 0.005, `600 s: ${at(600).level}`);
  assert.ok(Math.abs(at(600).valve - steadyValve(1.5)) < 0.01, `600 s valve ${at(600).valve} vs steady ${steadyValve(1.5)}`);
});
