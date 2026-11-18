// Cloning a run (docs/specs/vulcan-bench.md "Cloning"): a world and the bench's line cache, copied together with
// `structuredClone` so a clone continues exactly as the original (measured 2026-11-18 at Vulcan b08ffba). S2 adds it
// with an empty cache; S3's line net fills the cache. The cache lives outside Vulcan's world (spec Non-goals).
import type { World } from "./engine.ts";

export interface Run<C = Map<number, unknown>> {
  world: World;
  cache: C;
}

/** A deep copy of the world and its line cache. */
export const cloneRun = <C>(run: Run<C>): Run<C> => structuredClone(run);
