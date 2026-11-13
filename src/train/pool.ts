// Scores ES members on worker threads (Node only). Each worker gets the net's layers once (ES keeps their shapes
// and shifts), then lists of parameter vectors, and returns each one's training IAE (verdict.ts trainingIae).
// Results come back in the order sent, so a run gives the same files however many workers there are.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { withParams, type Evaluate } from "./es.ts";
import { trainingIae } from "../sim/verdict.ts";
import type { Layer } from "../num/layer.ts";

export function makePool(
  layers: Layer[],
  n = Math.max(1, availableParallelism() - 1),
): { evaluate: Evaluate; close(): Promise<void> } {
  const workers = Array.from({ length: n }, () => new Worker(new URL(import.meta.url), { workerData: { layers } }));
  const ask = (w: Worker, thetas: number[][]) =>
    new Promise<number[]>((res, rej) => {
      const fail = (e: Error) => {
        w.off("message", ok);
        rej(e);
      };
      const ok = (v: number[]) => {
        w.off("error", fail);
        res(v);
      };
      w.once("message", ok);
      w.once("error", fail);
      w.postMessage(thetas);
    });
  return {
    async evaluate(members) {
      const parts: number[][][] = workers.map(() => []);
      members.forEach((m, i) => parts[i % n].push(m));
      const out = await Promise.all(parts.map((p, i) => (p.length ? ask(workers[i], p) : Promise.resolve([]))));
      return members.map((_, i) => out[i % n][Math.floor(i / n)]);
    },
    async close() {
      await Promise.all(workers.map((w) => w.terminate()));
    },
  };
}

/** The same scores on this thread (for small runs and as the pool's reference). */
export const evaluateHere =
  (layers: Layer[]): Evaluate =>
  async (members) =>
    members.map((t) => trainingIae(withParams(layers, t)));

if (!isMainThread) {
  const layers: Layer[] = workerData.layers;
  parentPort!.on("message", (thetas: number[][]) =>
    parentPort!.postMessage(thetas.map((t) => trainingIae(withParams(layers, t)))),
  );
}
