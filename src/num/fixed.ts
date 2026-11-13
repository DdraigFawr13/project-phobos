// Q12 fixed point (docs/NUMBERS.md, D-006). Integer-only runtime maths: shr's Math.floor is the one exception
// to AGENTS.md's integer rule, because a power-of-two divide is exact in doubles below 2^53.

/** 1.0 in Q12. Values are int16: range [−8, 8). */
export const ONE = 4096;
export const INT16_MIN = -32768;
export const INT16_MAX = 32767;

/** Clamp to int16. Saturate, never wrap. */
export function sat16(x: number): number {
  return x > INT16_MAX ? INT16_MAX : x < INT16_MIN ? INT16_MIN : x;
}

/** 2^n for n in [0, 52], worked out once: `2 ** n` on every call made shr the runtime's slowest line (S6). */
const POW2 = Array.from({ length: 53 }, (_, n) => 2 ** n);

/** Arithmetic shift right that floors, exact for integers below 2^53 (JS `>>` would wrap above 2^31). */
export function shr(x: number, n: number): number {
  return Math.floor(x / POW2[n]);
}
