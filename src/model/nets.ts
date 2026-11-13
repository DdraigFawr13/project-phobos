// The S4 nets (spec "Test net", "Lab net inputs"). Test net: 4→16 tanh, 16→5 none, action 4 masked, seed 7.
// Lab-shaped net: 4→16 tanh, 16→1 tanh (97 parameters), seed 8. Valve = (5y + 16384) / 32768, that is (1.25·y + 1) / 2, clamped to [0, 1] (D-018).
import { randomNet, type Shape } from "./random.ts";

export const TEST_SHAPE: Shape = [
  { in: 4, out: 16, act: "tanh" },
  { in: 16, out: 5, act: "none" },
];
export const LAB_SHAPE: Shape = [
  { in: 4, out: 16, act: "tanh" },
  { in: 16, out: 1, act: "tanh" },
];
export const TEST_SEED = 7,
  LAB_SEED = 8;
export const TEST_NET_ALLOWED = [true, true, true, true, false];

export const testNet = () => randomNet(TEST_SHAPE, TEST_SEED);
export const labShapedNet = () => randomNet(LAB_SHAPE, LAB_SEED);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** D-018: the output's ±0.8 already spans shut to fully open, so the net can reach either end without tanh
 *  saturating (with (y + 1) / 2, shut needed y = −1 exactly, and the S6 nets never shut the valve). */
export const VALVE_GAIN = 1.25;
/** The Lab net's Q12 output y in [−4096, 4096] to a valve opening: (1.25·y/4096 + 1) / 2 = (5y + 16384) / 32768,
 *  clamped. Outside the runtime: the plant is float. */
export const valveOf = (y: number) => clamp01((5 * y + 16384) / 32768);
/** The float model's output in [−1, 1] to a valve opening: the same map. */
export const valveOfRef = (y: number) => clamp01((VALVE_GAIN * y + 1) / 2);
