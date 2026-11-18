// npm run train:vulcan -- [stage] [--model net|table] [--sigma <n> --alpha <n>] [--jobs <n>] [--html <path>]
// (docs/specs/vulcan-bench.md "Training", "Shadow log", S3; D-023). Stages, each writing to models/vulcan/:
//   --chance        today's rule plus the noise band's day-1 hook on 10 windows (chance.json)
//   --sigma-check   sigma 64, 256, 1024 × alpha 128, 512, 5 generations each (sigma-<model>.json); resumes per setting
//   (no stage)      the full run, 50 × 32 antithetic: lines.json (net) or table.json, <model>-log.json; a snapshot
//                   every 5 generations (<model>.snapshot.json, git-ignored), resumed when it matches the settings
//   --shadow        a shadow year on each held-out seed with the trained model: moments (moments-<model>.json)
//   --html <path>   the S3 page from those files (alone, or after a stage)
// Window worlds and today's window results are cached in .cache/vulcan/ (git-ignored) per Vulcan commit.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";
import { serialize, deserialize } from "node:v8";
import { loadVulcan, refusal, vulcanDir, type World } from "../src/vulcan/engine.ts";
import { TRAINING_SEEDS, HELD_OUT_SEEDS } from "../src/vulcan/bench.ts";
import { openPool } from "../src/vulcan/pool.ts";
import {
  VULCAN_ES,
  VULCAN_PICK,
  chanceSpread,
  drawWindows,
  eligibleWindows,
  pickSetting,
  trainVulcan,
  zeroLineNet,
  type Kind,
  type LogEntry,
  type Snapshot,
  type WindowResult,
} from "../src/vulcan/train.ts";
import { withParams } from "../src/train/es.ts";
import { toWeightFile } from "../src/model/weights.ts";
import { toTableFile } from "../src/vulcan/table.ts";
import { makeRng } from "../src/rng.ts";
import { trainPage } from "../src/vulcan/train-page.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = resolve(ROOT, "models/vulcan");
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const html = flag("--html");
const model = (flag("--model") ?? "net") as Kind;
const jobs = Number(flag("--jobs") ?? Math.max(1, availableParallelism() - 1));
const gensArg = flag("--generations");
const sigmaArg = flag("--sigma"),
  alphaArg = flag("--alpha");
const stage = args.includes("--chance")
  ? "chance"
  : args.includes("--sigma-check")
    ? "sigma"
    : args.includes("--shadow")
      ? "shadow"
      : html && args.length === 0
        ? "html"
        : "full";
if (model !== "net" && model !== "table") throw new Error(`--model ${model}: want net or table`);

const log = (s: string) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);
const file = (name: string) => resolve(OUT, name);
const readJson = (name: string) => (existsSync(file(name)) ? JSON.parse(readFileSync(file(name), "utf8")) : null);
const writeJson = (name: string, v: unknown) => {
  mkdirSync(OUT, { recursive: true });
  const tmp = `${file(name)}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(v, null, 1)}\n`);
  renameSync(tmp, file(name));
};

if (stage !== "html") {
  const dir = vulcanDir();
  const why = refusal(dir);
  if (why) {
    process.stderr.write(`train:vulcan refused: ${why}\n`);
    process.exit(1);
  }
  const { commit } = await loadVulcan(dir);
  const workers = await openPool(jobs, dir);
  log(`vulcan ${commit}; ${jobs} workers started in ${workers.startSeconds.toFixed(1)} s`);
  try {
    if (stage === "shadow") {
      const trained = model === "net" ? readJson("lines.json") : readJson("table.json");
      if (!trained) throw new Error(`no trained ${model}; run the full stage first`);
      const theta = model === "net" ? trained.layers.flatMap((l: any) => [...l.w, ...l.b]) : trained.params;
      const t0 = performance.now();
      const res = await workers.shadow([...HELD_OUT_SEEDS], model, theta);
      for (const r of res)
        log(`${r.seed}: ${r.moments.length} moments of ${r.candidates} candidates, ${r.seconds.toFixed(0)} s`);
      writeJson(`moments-${model}.json`, {
        vulcan: commit,
        model,
        seconds: Math.round((performance.now() - t0) / 1000),
        seeds: res,
      });
    } else {
      const { worlds, today } = await windows(workers, commit);
      const pool = eligibleWindows(today);
      log(`${pool.length} of ${today.length} windows have a crisis hour under today's rule (D-023)`);
      if (stage === "chance") {
        const per = VULCAN_ES.windowsPerGeneration;
        const idx = drawWindows(makeRng(20), pool.length, 5 * per).map((i) => pool[i]);
        const pairs = [0, 1, 2, 3, 4].map((k) => idx.slice(k * per, (k + 1) * per));
        const nudged: WindowResult[][][] = [];
        const t0 = performance.now();
        for (const p of pairs) {
          const runs = await workers.nudged(
            p.map((i) => worlds[i]),
            [0, 1, 2],
            VULCAN_ES.windowDays,
          );
          nudged.push(runs);
        }
        const c = chanceSpread(
          pairs.map((p) => p.map((i) => today[i])),
          nudged,
        );
        log(`chance: deltas ${c.deltas.join(" ")}; spread ${c.spread}`);
        writeJson("chance.json", {
          vulcan: commit,
          windows: idx,
          pairs,
          ...c,
          seconds: Math.round((performance.now() - t0) / 1000),
        });
      } else if (stage === "sigma") {
        const out = readJson(`sigma-${model}.json`) ?? { vulcan: commit, model, runs: [] };
        for (const sigma of [64, 256, 1024])
          for (const alpha of [128, 512]) {
            if (out.runs.some((r: any) => r.sigma === sigma && r.alpha === alpha)) continue;
            log(`${model} sigma ${sigma} alpha ${alpha}`);
            const snap = await trainVulcan({
              kind: model,
              sigma,
              alpha,
              generations: 5,
              pool,
              today,
              evaluate: workers.evaluator(model, worlds, VULCAN_ES.windowDays),
              onGeneration: (e) => log(line(e)),
            });
            out.runs.push({ sigma, alpha, log: snap.log });
            writeJson(`sigma-${model}.json`, out);
          }
        const chance = readJson("chance.json");
        if (chance) {
          const { rows, pick } = pickSetting(out.runs, chance.spread);
          for (const r of rows)
            log(
              `sigma ${r.sigma} alpha ${r.alpha}: differ ${r.differ.toFixed(2)}, leads ${r.leads.join(" ")}, beats ${r.beats}, final ${r.final}${r.qualifies ? " ✔" : ""}`,
            );
          log(pick ? `pick: sigma ${pick.sigma} alpha ${pick.alpha}` : "pick: none qualifies (stop and ask)");
          writeJson(`sigma-${model}.json`, { ...out, spread: chance.spread, rows, pick });
        }
      } else {
        const checked = readJson(`sigma-${model}.json`)?.pick;
        const sigma = Number(sigmaArg ?? (VULCAN_PICK[model].sigma || checked?.sigma)),
          alpha = Number(alphaArg ?? (VULCAN_PICK[model].alpha || checked?.alpha));
        const generations = Number(gensArg ?? VULCAN_ES.generations);
        if (!(sigma > 0 && alpha > 0)) throw new Error(`no sigma and alpha for ${model}: run --sigma-check (D-023)`);
        const snapName = `${model}.snapshot.json`;
        const prior: Snapshot | null = readJson(snapName);
        const resume =
          prior && prior.sigma === sigma && prior.alpha === alpha && prior.kind === model ? prior : undefined;
        if (resume) log(`resuming ${model} from generation ${resume.done}`);
        let posts = 0;
        const t0 = performance.now();
        const snap = await trainVulcan({
          kind: model,
          sigma,
          alpha,
          generations,
          pool,
          today,
          resume,
          evaluate: workers.evaluator(model, worlds, VULCAN_ES.windowDays, (s) => (posts += s)),
          onGeneration: (e, s) => {
            log(line(e));
            if (s.done % VULCAN_ES.snapshotEvery === 0) writeJson(snapName, s);
          },
        });
        const meta = { trainer: "es", seed: VULCAN_ES.gaussSeed, vulcan: commit };
        if (model === "net") writeJson("lines.json", toWeightFile(withParams(zeroLineNet(), snap.theta), meta));
        else writeJson("table.json", toTableFile(snap.theta, { ...meta, sigma, alpha }));
        writeJson(`${model}-log.json`, {
          vulcan: commit,
          model,
          sigma,
          alpha,
          generations,
          workers: jobs,
          startSeconds: Math.round(workers.startSeconds * 10) / 10,
          postSeconds: Math.round(posts * 10) / 10,
          seconds: Math.round((performance.now() - t0) / 1000),
          resumedFrom: resume?.done ?? 0,
          log: snap.log,
        });
        log(
          `${model} done: final θ ${snap.log[snap.log.length - 1].theta.raw}, today ${snap.log[snap.log.length - 1].today}`,
        );
      }
    }
  } finally {
    await workers.close();
  }
}

if (html) {
  mkdirSync(dirname(resolve(html)), { recursive: true });
  writeFileSync(
    html,
    trainPage({
      chance: readJson("chance.json"),
      sigma: { net: readJson("sigma-net.json"), table: readJson("sigma-table.json") },
      logs: { net: readJson("net-log.json"), table: readJson("table-log.json") },
      moments: { net: readJson("moments-net.json"), table: readJson("moments-table.json") },
    }),
  );
  log(`wrote ${html}`);
}

function line(e: LogEntry) {
  const t = `θ ${e.theta.raw}${e.theta.penalised ? " (penalised)" : ""}`;
  return e.best === undefined
    ? `final ${t}, today ${e.today}, windows ${e.windows.join(",")}`
    : `gen ${e.generation}: today ${e.today}, ${t}, mean ${e.mean!.toFixed(1)}, best ${e.best}, differ ${e.differ!.toFixed(2)}, windows ${e.windows.join(",")}, ${e.seconds} s`;
}

/** The 60 window worlds (training seeds × month starts 0 to 11) and today's result on each, cached per commit.
 *  Today's results are recomputed when the cached ones predate crisis person-hours (D-023). */
async function windows(w: Awaited<ReturnType<typeof openPool>>, commit: string) {
  const cache = resolve(ROOT, `.cache/vulcan/windows-${commit.slice(0, 12)}-${VULCAN_ES.windowDays}d.bin`);
  let worlds: World[] | null = null;
  if (existsSync(cache)) {
    const v = deserialize(readFileSync(cache)) as { worlds: World[]; today: WindowResult[]; unit?: string };
    log(`window worlds from ${cache}`);
    if (v.unit === "person-hours") return v;
    worlds = v.worlds;
  }
  let t = performance.now();
  if (!worlds) {
    const months = Array.from({ length: 12 }, (_, m) => m);
    worlds = (await w.years([...TRAINING_SEEDS], months)).flat();
    log(`${worlds.length} window worlds in ${((performance.now() - t) / 1000).toFixed(0)} s`);
  }
  t = performance.now();
  const today = await w.today(worlds, VULCAN_ES.windowDays);
  log(`today's ${today.length} windows in ${((performance.now() - t) / 1000).toFixed(0)} s`);
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(cache, serialize({ worlds, today, unit: "person-hours" }));
  return { worlds, today };
}
