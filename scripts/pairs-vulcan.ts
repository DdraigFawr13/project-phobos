// npm run pairs:vulcan -- [--jobs <n>] [--skip-floor] [--html <path>] (docs/specs/vulcan-bench.md J5, S4; D-021 R10).
//   1. Shadow years on the 5 held-out seeds for the net and the table: read from models/vulcan/moments-<kind>.full.json
//      (git-ignored; written by `train:vulcan -- --shadow`) when it names the pinned commit, else rebuilt and written.
//   2. Picks 24 net moments (5, 5, 5, 5, 4) and 12 table moments (3, 3, 2, 2, 2), follows today's rule and the policy
//      6 game hours from each, and writes the blind list models/vulcan/pairs.json (no key; pairs.ts pairKey()).
//   3. The floor: free full years on the held-out seeds, today, net and table, plus today's noise band (each seed 3
//      more times with the day-1 food nudge), written to models/vulcan/floor.json. `--skip-floor` keeps the file.
//   --html <path> writes the report page from those files (given alone, it only writes the page).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";
import { loadVulcan, refusal, vulcanDir } from "../src/vulcan/engine.ts";
import { HELD_OUT_SEEDS, NUDGE, noiseBand, runJobs, type Job } from "../src/vulcan/bench.ts";
import { openPool } from "../src/vulcan/pool.ts";
import { NET_QUOTAS, TABLE_QUOTAS, blindPairs, selectMoments, type FollowItem } from "../src/vulcan/pairs.ts";
import { changeOf, type FloorFile } from "../src/vulcan/floor.ts";
import { floorOf } from "../src/vulcan/measure.ts";
import type { ShadowResult } from "../src/vulcan/shadow.ts";
import type { Kind } from "../src/vulcan/train.ts";
import { reportPage } from "../src/vulcan/report-page.ts";

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
const jobs = Number(flag("--jobs") ?? Math.max(1, availableParallelism() - 1));
const skipFloor = args.includes("--skip-floor");
const onlyHtml = html !== undefined && process.argv.length === 4; // `--html <path>` and nothing else

const log = (s: string) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);
const file = (name: string) => resolve(OUT, name);
const readJson = (name: string) => (existsSync(file(name)) ? JSON.parse(readFileSync(file(name), "utf8")) : null);
const writeJson = (name: string, v: unknown, indent = 1) => {
  mkdirSync(OUT, { recursive: true });
  const tmp = `${file(name)}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(v, null, indent)}\n`);
  renameSync(tmp, file(name));
};

if (!onlyHtml) {
  const dir = vulcanDir();
  const why = refusal(dir);
  if (why) {
    process.stderr.write(`pairs:vulcan refused: ${why}\n`);
    process.exit(1);
  }
  const { commit } = await loadVulcan(dir);
  const t0 = performance.now();
  const thetas: Record<Kind, number[]> = {
    net: readJson("lines.json").layers.flatMap((l: any) => [...l.w, ...l.b]),
    table: readJson("table.json").params,
  };
  const workers = await openPool(jobs, dir);
  log(`vulcan ${commit}; ${jobs} workers started in ${workers.startSeconds.toFixed(1)} s`);
  const shadows = {} as Record<Kind, ShadowResult[]>;
  try {
    for (const kind of ["net", "table"] as Kind[]) {
      const full = readJson(`moments-${kind}.full.json`);
      if (full?.vulcan === commit) {
        shadows[kind] = full.seeds;
        log(`${kind}: shadow years from moments-${kind}.full.json`);
        continue;
      }
      const t = performance.now();
      shadows[kind] = await workers.shadow([...HELD_OUT_SEEDS], kind, thetas[kind]);
      const seconds = Math.round((performance.now() - t) / 1000);
      writeJson(`moments-${kind}.full.json`, { vulcan: commit, model: kind, seconds, seeds: shadows[kind] });
      log(`${kind}: shadow years in ${seconds} s`);
    }
    const order = (r: ShadowResult[]) => HELD_OUT_SEEDS.map((s) => r.find((x) => x.seed === s)!);
    const picked: Record<Kind, ReturnType<typeof selectMoments>> = {
      net: selectMoments(order(shadows.net), NET_QUOTAS),
      table: selectMoments(order(shadows.table), TABLE_QUOTAS),
    };
    for (const k of ["net", "table"] as Kind[])
      log(
        `${k}: ${picked[k].length} moments, per seed ${HELD_OUT_SEEDS.map((s) => picked[k].filter((m) => m.seed === s).length).join(" ")}`,
      );
    const t = performance.now();
    const perSeed = HELD_OUT_SEEDS.map((seed) => {
      const items: (FollowItem & { at: number })[] = [];
      for (const kind of ["net", "table"] as Kind[])
        picked[kind].forEach((m, at) => m.seed === seed && items.push({ kind, moment: m, at }));
      return { seed, items };
    });
    const followed = await workers.follow(
      perSeed.map(({ seed, items }) => ({ seed, items: items.map(({ kind, moment }) => ({ kind, moment })) })),
      thetas,
    );
    const back = { net: [] as any[], table: [] as any[] };
    perSeed.forEach(({ items }, s) =>
      items.forEach((it, j) => (back[it.kind][it.at] = { moment: it.moment, followed: followed[s][j] })),
    );
    const pairs = blindPairs(back.net, back.table);
    writeJson("pairs.json", pairs);
    log(`pairs.json: ${pairs.length} pairs, followed in ${((performance.now() - t) / 1000).toFixed(0)} s`);
  } finally {
    await workers.close();
  }

  if (!skipFloor) {
    const t = performance.now();
    const list: Job[] = [
      ...HELD_OUT_SEEDS.map((seed) => ({ seed })),
      ...HELD_OUT_SEEDS.map((seed) => ({ seed, policy: { kind: "net" as Kind, theta: thetas.net } })),
      ...HELD_OUT_SEEDS.map((seed) => ({ seed, policy: { kind: "table" as Kind, theta: thetas.table } })),
      ...HELD_OUT_SEEDS.flatMap((seed) => Array.from({ length: NUDGE.people }, (_, k) => ({ seed, nudge: k }))),
    ];
    let done = 0;
    const res = await runJobs(dir, list, jobs, (r) =>
      log(
        `floor ${++done}/${list.length}: ${r.seed}${r.nudge !== undefined ? ` nudge ${r.nudge}` : ""} ${r.seconds.toFixed(0)} s`,
      ),
    );
    const n = HELD_OUT_SEEDS.length;
    const today = res.slice(0, n),
      net = res.slice(n, 2 * n),
      table = res.slice(2 * n, 3 * n),
      nudged = res.slice(3 * n);
    const band = noiseBand(today, nudged);
    const floor: FloorFile = {
      vulcan: commit,
      band: band.band,
      worse: band.worse,
      seeds: HELD_OUT_SEEDS.map((seed, i) => ({
        seed,
        today: floorOf(today[i]),
        net: floorOf(net[i]),
        table: floorOf(table[i]),
        noise: band.runs.filter((r) => r.seed === seed).map((r) => r.change),
      })),
      seconds: Math.round((performance.now() - t) / 1000),
    };
    writeJson("floor.json", floor);
    for (const s of floor.seeds)
      log(
        `${s.seed}: net change ${JSON.stringify(changeOf(s.today, s.net))}, table ${JSON.stringify(changeOf(s.today, s.table))}`,
      );
    log(`floor.json in ${floor.seconds} s`);
  }
  log(`pairs:vulcan done in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}

if (html) {
  mkdirSync(dirname(resolve(html)), { recursive: true });
  writeFileSync(
    html,
    reportPage({
      pairs: readJson("pairs.json"),
      floor: readJson("floor.json"),
      logs: { net: readJson("net-log.json"), table: readJson("table-log.json") },
      chance: readJson("chance.json"),
    }),
  );
  log(`wrote ${html}`);
}
