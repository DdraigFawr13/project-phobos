// npm run bench:vulcan -- [seed ...] [--noise] [--jobs <n>] [--html <path>] (docs/specs/vulcan-bench.md J2, S2).
// Today's rule for a game year on each seed (default: all 10 of Vulcan's MAP_SEEDS), printed as Vulcan's
// `npm run balance` prints it, then the Vulcan commit and the seconds per seed-year. `--noise` adds today's noise
// band on the held-out seeds (15 more years) and, when all 5 training seeds ran, the store scales for `scales.ts`.
// `--json` writes the raw results; `--html` writes the "today's numbers" page. Refuses (exit 1, reason on stderr) a Vulcan checkout that is dirty or
// not at `vulcan.pin`. About 45 s per seed-year on one thread (measured 2026-11-18).
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { availableParallelism } from "node:os";
import { loadVulcan, refusal, vulcanDir, readPin } from "../src/vulcan/engine.ts";
import { formatTable } from "../src/vulcan/measure.ts";
import {
  HELD_OUT_SEEDS,
  NUDGE,
  TRAINING_SEEDS,
  noiseBand,
  runJob,
  runJobs,
  scalesOf,
  type Job,
  type JobResult,
} from "../src/vulcan/bench.ts";
import { benchPage, type BenchData } from "../src/vulcan/page.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const html = flag("--html");
const json = flag("--json");
const jobsArg = flag("--jobs");
const noise = args.includes("--noise");
const seedsArg = args.filter((a) => !a.startsWith("--"));

const dir = vulcanDir();
const why = refusal(dir);
if (why) {
  process.stderr.write(`bench:vulcan refused: ${why}\n`);
  process.exit(1);
}
const vulcan = await loadVulcan(dir);
const seeds = seedsArg.length ? seedsArg : [...vulcan.engine.MAP_SEEDS];
for (const s of seeds)
  if (!vulcan.engine.MAP_SEEDS.includes(s)) {
    process.stderr.write(`bench:vulcan: unknown seed ${s} (MAP_SEEDS: ${vulcan.engine.MAP_SEEDS.join(", ")})\n`);
    process.exit(1);
  }
const noiseSeeds = noise ? HELD_OUT_SEEDS.filter((s) => seeds.includes(s)) : [];
const jobs: Job[] = [
  ...seeds.map((seed) => ({ seed })),
  ...noiseSeeds.flatMap((seed) => Array.from({ length: NUDGE.people }, (_, nudge) => ({ seed, nudge }))),
];
const workers = jobsArg ? Number(jobsArg) : 1;
if (!Number.isInteger(workers) || workers < 1 || workers > availableParallelism()) {
  process.stderr.write(`bench:vulcan: --jobs must be 1 to ${availableParallelism()}\n`);
  process.exit(1);
}

const t0 = performance.now();
const log = (r: JobResult) =>
  process.stderr.write(
    `  ${r.seed}${r.person ? ` nudge ${r.person.name}` : ""}: ${r.seconds.toFixed(1)} s, alive ${r.row.alive}, food ${r.row.food}\n`,
  );
const results =
  workers === 1
    ? jobs.map((j) => {
        const r = runJob(vulcan.engine, j);
        if (jobs.length > 1) log(r);
        return r;
      })
    : await runJobs(dir, jobs, workers, log);
const wall = (performance.now() - t0) / 1000;

const today = results.slice(0, seeds.length);
const nudged = results.slice(seeds.length);
const perYear = today.reduce((n, r) => n + r.seconds, 0) / today.length;
process.stdout.write(formatTable(today));
process.stdout.write(`vulcan ${vulcan.commit}\n`);
process.stdout.write(`seconds per seed-year ${perYear.toFixed(1)}\n`);

const band = nudged.length ? noiseBand(today, nudged) : undefined;
if (band) {
  process.stdout.write(`noise band (${band.runs.length} runs: change from today, min to max):\n`);
  for (const [k, b] of Object.entries(band.band))
    process.stdout.write(`  ${k} ${b.min} to ${b.max}, worse by up to ${band.worse[k as keyof typeof band.worse]}\n`);
}
const trainingRan = TRAINING_SEEDS.every((s) => seeds.includes(s));
const scales = trainingRan
  ? scalesOf(today.filter((r) => (TRAINING_SEEDS as readonly string[]).includes(r.seed)))
  : undefined;
if (scales)
  process.stdout.write(`scales (training seeds, per alive person) food ${scales.food} firewood ${scales.firewood}\n`);
process.stderr.write(`${results.length} seed-years in ${wall.toFixed(1)} s on ${workers} thread(s)\n`);

const data: BenchData = {
  commit: readPin(),
  date: new Date().toISOString().slice(0, 10),
  node: process.version,
  cpus: availableParallelism(),
  workers,
  wall,
  perYear,
  today,
  band,
  scales,
};
for (const [path, text] of [
  [json, `${JSON.stringify(data)}\n`],
  [html, html ? benchPage(data) : ""],
] as const)
  if (path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    process.stderr.write(`wrote ${path}\n`);
  }
