// Everything `npm run train:lab` writes to models/lab/ (docs/specs/first-usable.md "Trainer", "Logs"): the copy
// phase, then the ES phase from the copied net, then the held-out verdict of the final weights. Same settings
// give the same bytes (seeded, no timestamps), whatever the number of workers.
import { copyFiles, fmt, layersJson } from "./copy.ts";
import { trainEs, ES } from "./es.ts";
import { makePool } from "./pool.ts";
import { verdictOf } from "../sim/verdict.ts";
import { toWeightFile } from "../model/weights.ts";

export type LabFileName = "copy-weights.json" | "weights.json" | "log.json" | "snapshots.json" | "verdict.json";

export async function labFiles(opts: { workers?: number; onGeneration?: (g: number, iae: number) => void } = {}): Promise<Record<LabFileName, string>> {
  const copy = copyFiles();
  const pool = makePool(copy.layers, opts.workers);
  try {
    const es = await trainEs(copy.layers, pool.evaluate, { onGeneration: opts.onGeneration });
    return {
      "copy-weights.json": copy["copy-weights.json"],
      "weights.json": fmt(toWeightFile(es.layers, { trainer: "es", seed: ES.seed })),
      "log.json": fmt({ version: 1, entries: [...copy.log, ...es.log.map(e => ({ phase: "es", ...e }))], esExample: es.example }),
      "snapshots.json": fmt({ version: 1, snapshots: [...copy.snapshots, ...es.snapshots.map(s => ({ phase: "es", step: s.step, layers: layersJson(s.layers) }))] }),
      "verdict.json": fmt(verdictOf(es.layers)),
    };
  } finally {
    await pool.close();
  }
}
