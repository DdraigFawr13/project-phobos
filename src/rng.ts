// Seeded RNG (spec "RNG", D-006): xorshift32 on unsigned 32-bit ints. Seed 0 becomes 1; the default seed is 1.
export type Rng = { next(): number; uniform(): number };

export function makeRng(seed = 1): Rng {
  let x = seed >>> 0 || 1;
  const next = () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
  return { next, uniform: () => next() / 2 ** 32 };
}
