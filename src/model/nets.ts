// The S4 nets (spec "Test net", "Lab net inputs"). Test net: 4→16 tanh, 16→5 none, action 4 masked, seed 7.
// Lab-shaped net: 4→16 tanh, 16→1 tanh (97 parameters), seed 8. Valve = (y + 4096) / 8192, clamped to [0, 1].
import { randomNet, type Shape } from "./random.ts";

export const TEST_SHAPE: Shape = [{ in: 4, out: 16, act: "tanh" }, { in: 16, out: 5, act: "none" }];
export const LAB_SHAPE: Shape = [{ in: 4, out: 16, act: "tanh" }, { in: 16, out: 1, act: "tanh" }];
export const TEST_SEED = 7, LAB_SEED = 8;
export const TEST_NET_ALLOWED = [true, true, true, true, false];

export const testNet = () => randomNet(TEST_SHAPE, TEST_SEED);
export const labShapedNet = () => randomNet(LAB_SHAPE, LAB_SEED);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** The Lab net's Q12 output y in [−4096, 4096] to a valve opening. Outside the runtime: the plant is float. */
export const valveOf = (y: number) => clamp01((y + 4096) / 8192);
/** The float model's output in [−1, 1] to a valve opening. */
export const valveOfRef = (y: number) => clamp01((y + 1) / 2);
