// S2 check states and Lab net inputs (docs/specs/first-usable.md "Check states", "Lab net inputs").
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStates, CHECK_EVERY } from "../src/sim/check-states.ts";
import { makeNetInputs, INTEGRAL_DIV } from "../src/sim/net-inputs.ts";
import { SEGMENTS, STEPS } from "../src/sim/fixed-test.ts";

const Q = 4096;
const states = checkStates();
const perSeg = STEPS / CHECK_EVERY;

test("1,000 check states of 4 int16 inputs each", () => {
  assert.equal(states.length, 1000);
  for (const s of states) {
    assert.ok(s instanceof Int16Array && s.length === 4);
  }
});

test("each segment's first state is the steady start: integral preloaded to 20·√h0, error = setpoint − level", () => {
  for (const [i, seg] of SEGMENTS.training.entries()) {
    const [sp, m, e, integ] = states[i * perSeg];
    assert.equal(sp, Math.round(seg.setpoint * Q), seg.name);
    assert.ok(Math.abs(m - seg.start * Q) <= Math.ceil(0.005 * Q), `${seg.name} measured ${m}`);
    assert.equal(integ, Math.round((20 * Math.sqrt(seg.start)) / INTEGRAL_DIV * Q), seg.name);
    assert.ok(Math.abs(e - (sp - m)) <= 1, `${seg.name} error ${e}`);
  }
});

test("every state: error = setpoint − measured within rounding; integral within ±7.99", () => {
  for (const [sp, m, e, integ] of states) {
    assert.ok(Math.abs(e - (sp - m)) <= 1);
    assert.ok(Math.abs(integ) <= Math.round(7.99 * Q));
  }
});

test("the integral input tracks the fixed PI's integral (I = ∫e / 40) across the check run", () => {
  // The PI holds I when u leaves [0, 1]; the input holds when the clamped valve is ≤ 0.001 or ≥ 0.999.
  // Away from those edges the two agree to Q12 rounding (32 / 4096 / 40 = 0.0002). Measured 2026-11-12: four
  // segments within 0.0001; on 1.00→1.75 the valve leaves full-open through the 0.999 band, the PI integrates
  // about 2 steps the input holds, and a 0.00258 offset stays for the rest of the segment.
  const { piI } = checkStates({ withPI: true });
  for (const [i, s] of states.entries()) {
    const fromInput = (s[3] / Q) * INTEGRAL_DIV / 40;
    const seg = SEGMENTS.training[Math.floor(i / perSeg)].name;
    const limit = seg === "1.00→1.75" ? 0.003 : 0.0002;
    assert.ok(Math.abs(fromInput - piI[i]) < limit, `state ${i} (${seg}): input ${fromInput} PI ${piI[i]}`);
  }
});

test("net inputs hold the integral while the previous valve is pinned and saturate to int16", () => {
  const n = makeNetInputs();
  n.reset(1.0);
  const a = n.next(0.5, 1.0); // error 0.5 m
  n.after(1.0); // pinned open: hold
  const b = n.next(0.5, 1.0);
  assert.equal(b[3], a[3]);
  n.after(0.0005); // pinned shut: hold
  assert.equal(n.next(0.5, 1.0)[3], a[3]);
  n.after(0.6); // free: integral grows by e·dt = 0.05 m·s
  const c = n.next(0.5, 1.0);
  assert.equal(c[3], Math.round(((20 + 0.05) / INTEGRAL_DIV) * Q));
  // a huge error drives the integral to the ±7.99 clamp
  for (let i = 0; i < 100000; i++) { n.next(-1.9, 2.0); n.after(0.5); }
  assert.equal(n.next(0, 0)[3], Math.round(7.99 * Q));
});
