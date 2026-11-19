// Worker threads for the Vulcan bench's training and shadow runs (docs/specs/vulcan-bench.md "Training"). Each worker
// loads Vulcan once through src/vulcan/engine.ts; the main thread posts the generation's window worlds once per worker
// (structured clone), then members one at a time to whichever worker is free. Results come back in the order asked,
// so the files don't depend on the number of workers. Separate from src/train/pool.ts, which imports Lab code.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import type { World } from "./engine.ts";
import type { EvaluateWindows, Kind, WindowResult } from "./train.ts";
import type { ShadowResult } from "./shadow.ts";

type Msg =
  | { type: "year"; seed: string; months: number[] }
  | { type: "worlds"; worlds: World[] }
  | { type: "eval"; kind: Kind | "today"; theta: number[] | null; days: number; worlds?: World[] }
  | { type: "nudge"; k: number; days: number }
  | { type: "shadow"; seed: string; kind: Kind; theta: number[] };

export interface VulcanPool {
  size: number;
  /** Start-up seconds (every worker loading Vulcan). */
  startSeconds: number;
  years(seeds: string[], months: number[]): Promise<World[][]>;
  /** An evaluator over `worlds` (the run's window list): posts each generation's worlds, then the thetas. */
  evaluator(kind: Kind, worlds: World[], days: number, onPost?: (seconds: number) => void): EvaluateWindows;
  /** Today's rule on each of `worlds`. */
  today(worlds: World[], days: number): Promise<WindowResult[]>;
  /** The noise band's day-1 hook on `worlds`: for each k, +1000 on the food line of the k-th alive person by id. */
  nudged(worlds: World[], ks: number[], days: number): Promise<WindowResult[][]>;
  shadow(seeds: string[], kind: Kind, theta: number[]): Promise<ShadowResult[]>;
  close(): Promise<void>;
}

export async function openPool(n: number, dir: string): Promise<VulcanPool> {
  const t0 = performance.now();
  const workers = await Promise.all(
    Array.from(
      { length: n },
      () =>
        new Promise<Worker>((res, rej) => {
          const w = new Worker(new URL(import.meta.url), { workerData: { dir } });
          w.once("error", rej);
          w.once("message", () => {
            w.off("error", rej);
            res(w);
          });
        }),
    ),
  );
  const startSeconds = (performance.now() - t0) / 1000;
  const ask = <T>(w: Worker, m: Msg) =>
    new Promise<T>((res, rej) => {
      const fail = (e: Error) => {
        w.off("message", ok);
        rej(e);
      };
      const ok = (v: T) => {
        w.off("error", fail);
        res(v);
      };
      w.once("message", ok);
      w.once("error", fail);
      w.postMessage(m);
    });
  /** Runs jobs on free workers, `before(w)` once per worker first; results in job order. */
  async function run<T>(jobs: Msg[], before?: Msg): Promise<T[]> {
    const out: T[] = new Array(jobs.length);
    let next = 0;
    await Promise.all(
      workers.map(async (w) => {
        if (next >= jobs.length) return;
        if (before) await ask(w, before);
        while (next < jobs.length) {
          const i = next++;
          out[i] = await ask<T>(w, jobs[i]);
        }
      }),
    );
    return out;
  }
  return {
    size: n,
    startSeconds,
    years: (seeds, months) => run<World[]>(seeds.map((seed) => ({ type: "year", seed, months }))),
    evaluator: (kind, worlds, days, onPost) => async (windows, thetas) => {
      const t = performance.now();
      const before: Msg = { type: "worlds", worlds: windows.map((i) => worlds[i]) };
      onPost?.((performance.now() - t) / 1000);
      return run<WindowResult[]>(
        thetas.map((theta) => ({ type: "eval", kind, theta, days })),
        before,
      );
    },
    async today(worlds, days) {
      const parts = await run<WindowResult[]>(
        worlds.map((w): Msg => ({ type: "eval", kind: "today", theta: null, days, worlds: [w] })),
        undefined,
      );
      return parts.flat();
    },
    async nudged(worlds, ks, days) {
      return run<WindowResult[]>(
        ks.map((k) => ({ type: "nudge", k, days })),
        { type: "worlds", worlds },
      );
    },
    shadow: (seeds, kind, theta) => run<ShadowResult>(seeds.map((seed) => ({ type: "shadow", seed, kind, theta }))),
    async close() {
      await Promise.all(workers.map((w) => w.terminate()));
    },
  };
}

if (!isMainThread) {
  const { loadVulcan } = await import("./engine.ts");
  const { runPolicyWindow, runWindow, yearClones, policyOf, zeroLineNet } = await import("./train.ts");
  const { shadowYear } = await import("./shadow.ts");
  const { foodNudge } = await import("./measure.ts");
  const { engine } = await loadVulcan(workerData.dir);
  const base = zeroLineNet();
  let worlds: World[] = [];
  parentPort!.on("message", (m: Msg) => {
    if (m.type === "year") return parentPort!.postMessage(yearClones(engine, m.seed, m.months));
    if (m.type === "worlds") {
      worlds = m.worlds;
      return parentPort!.postMessage("ok");
    }
    if (m.type === "eval") {
      const ws = m.worlds ?? worlds;
      const policy = m.kind === "today" ? null : policyOf(m.kind, m.theta!, base);
      return parentPort!.postMessage(ws.map((w) => runPolicyWindow(engine, w, policy, m.days)));
    }
    if (m.type === "nudge")
      return parentPort!.postMessage(
        worlds.map((w0) => {
          const w = structuredClone(w0);
          const alive = w.entities.person.filter((p) => p.status === "alive").sort((a, b) => a.id - b.id);
          const p = alive[m.k % alive.length];
          return runWindow(engine, w, foodNudge(engine, p.id, w.tick), m.days);
        }),
      );
    if (m.type === "shadow")
      return parentPort!.postMessage(shadowYear(engine, m.seed, policyOf(m.kind, m.theta, base)));
  });
  parentPort!.postMessage("ready");
}
