// The line net's 26 inputs and its line offsets (docs/specs/vulcan-bench.md "Inputs", "Lines from outputs"; R2).
// Plain numbers in, Q12 out: imports nothing from Vulcan, so its tests run in `npm run check`. Integer maths only
// (`shr` is the runtime's floor divide by a power of two, src/num/fixed.ts).
import { ONE, shr } from "../num/fixed.ts";

/** Vulcan `traits.json` order. */
export const TRAITS = [
  "hot-tempered",
  "melancholic",
  "restless",
  "greedy",
  "cheerful",
  "steady",
  "sociable",
  "solitary",
  "hardy",
  "devout",
] as const;
/** Vulcan `calendar.json` `seasons` order; `clockAt(...).season` is the index. */
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
/** The net's outputs, in order. */
export const LINE_NEEDS = ["food", "water", "rest", "recreation", "warmth"] as const;
export type LineNeedName = (typeof LINE_NEEDS)[number];
/** The need inputs, in input order (spec "Inputs": food, water, rest, warmth, recreation). */
export const NEED_INPUTS = ["food", "water", "rest", "warmth", "recreation"] as const;
export const DOINGS = ["work", "sleep", "relax"] as const;

/** Needs run 0 to 10,000 (Vulcan `life.json` `scale`); a line moves at most this far either way (R2). */
export const NEED_SCALE = 10_000;
export const MAX_OFFSET = 1000;

/** Everything the inputs are made from, in real units, at a person's first lookup in a game hour. */
export interface PersonState {
  needs: Record<(typeof NEED_INPUTS)[number], number>;
  doing: string;
  /** Hour of day, 0 to 23. */
  hour: number;
  /** The hour lies inside the person's work hours (`hoursOf` `workFrom` ≤ hour < `workTo`). */
  inWork: boolean;
  /** Index into SEASONS. */
  season: number;
  /** Goods in store (no holder) per alive person, integer division. */
  foodPerAlive: number;
  firewoodPerAlive: number;
  traits: string[];
}

export const INPUT_NAMES: readonly string[] = [
  ...NEED_INPUTS,
  ...DOINGS.map((d) => `doing ${d}`),
  "hour",
  "work hours",
  ...SEASONS,
  "food in store",
  "firewood in store",
  ...TRAITS,
];
export const N_INPUTS = 26;

/** floor(value × 4096 / scale) by integer division, clamped to [0, 4096]. */
export function q12(value: number, scale: number): number {
  if (value <= 0) return 0;
  const n = value * ONE;
  const q = (n - (n % scale)) / scale;
  return q > ONE ? ONE : q;
}

const flag = (on: boolean) => (on ? ONE : 0);

/** The 26 Q12 inputs in spec order. `scales` are the store scales (src/vulcan/scales.ts). */
export function encode(s: PersonState, scales: { food: number; firewood: number }): Int16Array {
  const x = new Int16Array(N_INPUTS);
  let k = 0;
  for (const n of NEED_INPUTS) x[k++] = q12(s.needs[n], NEED_SCALE);
  for (const d of DOINGS) x[k++] = flag(s.doing === d);
  x[k++] = q12(s.hour, 24);
  x[k++] = flag(s.inWork);
  for (let i = 0; i < SEASONS.length; i++) x[k++] = flag(s.season === i);
  x[k++] = q12(s.foodPerAlive, scales.food);
  x[k++] = q12(s.firewoodPerAlive, scales.firewood);
  for (const t of TRAITS) x[k++] = flag(s.traits.includes(t));
  return x;
}

/** A net output (Q12, tanh so in [−4096, 4096]) as a line offset: shr(output × 1000, 12), floor (−1 stays −1). */
export const offsetOf = (output: number): number => shr(output * MAX_OFFSET, 12);

/** today + offset, clamped to [0, 10,000]. */
export const lineFrom = (today: number, offset: number): number => {
  const v = today + offset;
  return v < 0 ? 0 : v > NEED_SCALE ? NEED_SCALE : v;
};
