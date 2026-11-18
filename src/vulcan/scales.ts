// Store scales for the line net's inputs (docs/specs/vulcan-bench.md "Measures", "Inputs"): the yearly maximum of food
// and of firewood in store (items with no holder) per alive person (integer division), at hour ends, over the 5
// training seeds under today's rule, rounded up to a multiple of 10. Written by S2 from
// `npm run bench:vulcan -- --noise --jobs 3` at Vulcan ee016ed3db2dab5f87a4cedcdc825cc8e0d409df, 2026-11-18. Changes
// only with a new `vulcan.pin`, in a commit saying why.
export const STORE_SCALES = { food: 1120, firewood: 10 } as const;
