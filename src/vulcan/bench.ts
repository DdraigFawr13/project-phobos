// The bench's jobs (docs/specs/vulcan-bench.md S2): today's rule on each seed, and today's noise band on the held-out
// seeds (each 3 more times, with a hook adding 1000 to the food line of the first, second or third person by id during
// game day 1 only). Jobs run here or on worker threads; results come back in the order asked, so the numbers don't
// depend on the worker count (only the seconds do).
import { Worker } from "node:worker_threads";
import type { Engine } from "./engine.ts";
import { makeHook } from "./lines.ts";
import { policyOf, type Kind } from "./train.ts";
import {
  FLOOR_KEYS,
  HIGHER_IS_BETTER,
  floorOf,
  foodNudge,
  measureYear,
  start,
  type FloorNumbers,
  type YearResult,
} from "./measure.ts";

/** D-019, D-020. */
export const TRAINING_SEEDS = ["ledger", "gwerin", "harrow", "cairn", "ashford"] as const;
export const HELD_OUT_SEEDS = ["anvil", "smoke", "tallow", "wren", "bryn"] as const;
/** The noise band's nudge: +1000 on one person's food line for game day 1. */
export const NUDGE = { add: 1000, people: 3 } as const;

/** A seed-year; with `nudge`, the food nudge goes to the person at that index (0-based) in id order; with `policy`,
 *  a free year with that policy's lines (S4's floor). */
export interface Job {
  seed: string;
  nudge?: number;
  policy?: { kind: Kind; theta: number[] };
}
export interface JobResult extends YearResult {
  nudge?: number;
  /** The nudged person's id and name. */
  person?: { id: number; name: string };
}

/** The k-th person by id in a fresh world of `seed`, and the world's first tick. */
export function nthPerson(engine: Engine, seed: string, k: number): { id: number; name: string; startTick: number } {
  const { world } = start(engine, seed);
  const p = [...world.entities.person].sort((a, b) => a.id - b.id)[k];
  return { id: p.id, name: p.name, startTick: world.tick };
}

export function runJob(engine: Engine, job: Job): JobResult {
  if (job.policy)
    return measureYear(engine, job.seed, makeHook(engine, new Map(), policyOf(job.policy.kind, job.policy.theta)));
  if (job.nudge === undefined) return measureYear(engine, job.seed);
  const p = nthPerson(engine, job.seed, job.nudge);
  const r = measureYear(engine, job.seed, foodNudge(engine, p.id, p.startTick, NUDGE.add));
  return { ...r, nudge: job.nudge, person: { id: p.id, name: p.name } };
}

/** Runs jobs on `workers` threads (1: one worker; the main thread stays free), in the order given. */
export async function runJobs(dir: string, jobs: Job[], workers: number, onDone?: (r: JobResult) => void) {
  const n = Math.max(1, Math.min(workers, jobs.length));
  const pool = await Promise.all(
    Array.from(
      { length: n },
      () =>
        new Promise<Worker>((res, rej) => {
          const w = new Worker(new URL("./bench-worker.ts", import.meta.url), { workerData: { dir } });
          w.once("error", rej);
          w.once("message", () => res(w));
        }),
    ),
  );
  const out: JobResult[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    pool.map(async (w) => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await new Promise<JobResult>((res, rej) => {
          w.once("message", res);
          w.once("error", rej);
          w.postMessage(jobs[i]);
        });
        w.removeAllListeners("error");
        onDone?.(out[i]);
      }
    }),
  );
  await Promise.all(pool.map((w) => w.terminate()));
  return out;
}

export interface NoiseRun {
  seed: string;
  person: { id: number; name: string };
  floor: FloorNumbers;
  /** Nudged minus today, per floor number. */
  change: FloorNumbers;
}
export interface NoiseBand {
  runs: NoiseRun[];
  /** Min and max change from today's run, per floor number, over all runs. */
  band: Record<keyof FloorNumbers, { min: number; max: number }>;
  /** The largest change in the worse direction (0 if none was worse): a miss up to this size doesn't count (R9). */
  worse: Record<keyof FloorNumbers, number>;
}

/** Today's noise band from today's runs and the nudged runs of the same seeds. */
export function noiseBand(today: YearResult[], nudged: JobResult[]): NoiseBand {
  const base = new Map(today.map((r) => [r.seed, floorOf(r)]));
  const runs = nudged.map((r) => {
    const floor = floorOf(r);
    const t = base.get(r.seed)!;
    const change = Object.fromEntries(FLOOR_KEYS.map((k) => [k, floor[k] - t[k]])) as unknown as FloorNumbers;
    return { seed: r.seed, person: r.person!, floor, change };
  });
  const band = {} as NoiseBand["band"];
  const worse = {} as NoiseBand["worse"];
  for (const k of FLOOR_KEYS) {
    const c = runs.map((r) => r.change[k]);
    band[k] = { min: Math.min(...c), max: Math.max(...c) };
    worse[k] = HIGHER_IS_BETTER[k] ? Math.max(0, -band[k].min) : Math.max(0, band[k].max);
  }
  return { runs, band, worse };
}

/** `scales.ts` values: the yearly maximum per alive person over the given runs, rounded up to a multiple of 10. */
export function scalesOf(results: YearResult[]): { food: number; firewood: number } {
  const up = (v: number) => Math.ceil(v / 10) * 10;
  return {
    food: up(Math.max(...results.map((r) => r.maxPerAlive.food))),
    firewood: up(Math.max(...results.map((r) => r.maxPerAlive.firewood))),
  };
}
