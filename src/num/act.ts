// tanh and exp in Q12 from the committed tables (spec "Tables"). Integer-only: shifts, masks and one shr.
import { TANH, EXP } from "./tables.gen.ts";
import { shr } from "./fixed.ts";

// Entry i covers input i × 32 (i / 128 in real units); the 5 low bits interpolate between entries.
function lookup(t: Int16Array, a: number): number {
  const i = a >> 5,
    f = a & 31;
  return t[i] + shr((t[i + 1] - t[i]) * f, 5);
}

/** tanh in Q12: input clamped to [−32767, 32767], result in [−4096, 4096]. Odd by construction. */
export function tanhQ(x: number): number {
  const c = x < -32767 ? -32767 : x > 32767 ? 32767 : x;
  return c < 0 ? -lookup(TANH, -c) : lookup(TANH, c);
}

/** exp in Q12: input clamped to [−32767, 0], so a positive input gives 4096. */
export function expQ(x: number): number {
  const c = x < -32767 ? -32767 : x > 0 ? 0 : x;
  return lookup(EXP, -c);
}
