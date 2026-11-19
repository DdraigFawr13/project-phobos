// The numbers floor (docs/specs/vulcan-bench.md "Pairs, floor and report"; D-020, D-021 R9, D-022): free full years
// on the 5 held-out seeds, today's rule against the net and against R10's table, beside today's noise band. A floor
// number misses when it is worse than today's by the spec's integer 5% rule **and** by more than the band's largest
// worse-side change; alive misses at any drop. Pure: the years come from scripts/pairs-vulcan.ts.
import { FLOOR_KEYS, HIGHER_IS_BETTER, type FloorNumbers } from "./measure.ts";
import type { NoiseBand } from "./bench.ts";

export type FloorKey = (typeof FLOOR_KEYS)[number];
export type Misses = Record<FloorKey, boolean>;

export interface FloorSeed {
  seed: string;
  today: FloorNumbers;
  net: FloorNumbers;
  table: FloorNumbers;
  /** This seed's own noise runs (day-1 food nudges), as changes from today's year. */
  noise: FloorNumbers[];
}
export interface FloorFile {
  vulcan: string;
  /** Today's noise band, pooled over the held-out seeds (D-022). */
  band: NoiseBand["band"];
  /** The band's largest worse-side change per number; alive is ignored (any drop misses). */
  worse: NoiseBand["worse"];
  seeds: FloorSeed[];
  seconds?: number;
}

/** Which floor numbers of `other` miss against `today` (D-022's reading of R9). */
export function floorMisses(today: FloorNumbers, other: FloorNumbers, worse: Record<FloorKey, number>): Misses {
  const out = {} as Misses;
  for (const k of FLOOR_KEYS) {
    const t = today[k],
      o = other[k];
    if (k === "alive") out[k] = o < t;
    else if (HIGHER_IS_BETTER[k]) out[k] = o * 100 < t * 95 && t - o > worse[k];
    else out[k] = o * 100 > t * 105 && o - t > worse[k];
  }
  return out;
}

export const missList = (m: Misses) => FLOOR_KEYS.filter((k) => m[k]);

/** Other minus today, per floor number. */
export const changeOf = (today: FloorNumbers, other: FloorNumbers) =>
  Object.fromEntries(FLOOR_KEYS.map((k) => [k, other[k] - today[k]])) as unknown as FloorNumbers;
