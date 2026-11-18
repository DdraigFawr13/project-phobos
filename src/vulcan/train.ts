// Training the line net and R10's table (docs/specs/vulcan-bench.md "Training"; R4, R5, R10). Month windows cloned
// from today's-rule years on the training seeds; each generation draws 2 windows shared by every member; one integer
// score per member (lower is better); ES from src/train/es.ts (`makeGauss`, `perturb`, `update`) with tied ranks.
// Offline code (float Math allowed, AGENTS.md); the lines themselves come from src/vulcan/lines.ts in integers.
import { createHash } from "node:crypto";
import { makeRng, type Rng } from "../rng.ts";
import { makeGauss, perturb, update, flatten, withParams } from "../train/es.ts";
import { randomNet } from "../model/random.ts";
import type { Layer } from "../num/layer.ts";
import type { Engine, LineHook, World } from "./engine.ts";
import { makeHook, netPolicy, tablePolicy, type Cache, type Policy } from "./lines.ts";
import { N_INPUTS } from "./inputs.ts";
import { TABLE_PARAMS } from "./table.ts";

/** Spec "Net": 26 → 16 tanh → 5 tanh, seed 17. */
export const LINE_SHAPE = [
  { in: N_INPUTS, out: 16, act: "tanh" as const },
  { in: 16, out: 5, act: "tanh" as const },
];
/** The line net with its output layer's weights and biases set to 0 (R1): exactly today's lines. */
export function zeroLineNet(): Layer[] {
  const layers = randomNet(LINE_SHAPE, 17);
  const last = layers[layers.length - 1];
  last.w.fill(0);
  last.b.fill(0);
  return layers;
}

export type Kind = "net" | "table";
/** The starting parameters: the zero net's, or 70 zeros for the table. */
export const theta0 = (kind: Kind) => (kind === "net" ? flatten(zeroLineNet()) : new Array(TABLE_PARAMS).fill(0));
export const policyOf = (kind: Kind, theta: number[], base = zeroLineNet()): Policy =>
  kind === "net" ? netPolicy(withParams(base, theta)) : tablePolicy(theta);

/** ES settings (D-017 apart from sigma and alpha, which the S3 sigma check picks; D-023). */
export const VULCAN_ES = {
  generations: 50,
  population: 32,
  gaussSeed: 17,
  windowSeed: 18,
  windowsPerGeneration: 4,
  snapshotEvery: 5,
  windowDays: 28,
} as const;

/** The sigma check's picks per model (D-023); 0 until the check has run. */
export const VULCAN_PICK: Record<Kind, { sigma: number; alpha: number }> = {
  net: { sigma: 1024, alpha: 128 },
  table: { sigma: 64, alpha: 128 },
};

/** What a window run gives: crisis person-hours (D-023), food in store at the end, work person-hours, and a world hash. */
export interface WindowResult {
  crisis: number;
  food: number;
  work: number;
  /** sha256 of JSON.stringify(world) at the window's end (to tell a run that differs from today's at all). */
  hash: string;
}

const CRISIS_NEEDS = new Set(["food", "rest", "warmth"]);
const HOUR = 60;

/** Food kinds (items whose `good` is food) in store (no holder), as balance.mjs counts goods. */
export const foodInStore = (engine: Engine, w: World) => {
  const kinds = new Set(engine.content.items.filter((i) => i.good === "food").map((i) => i.id));
  return w.entities.item.filter((i) => kinds.has(i.kind) && !i.holder).reduce((n, i) => n + i.count, 0);
};

/** Runs `days` game days on `world` (mutated) with an optional hook, reading the world at each hour's end. */
export function runWindow(engine: Engine, world: World, hook: LineHook | undefined, days: number): WindowResult {
  const sim = engine.createSim(engine.content);
  if (hook) engine.setLineHook(sim, hook);
  let crisis = 0;
  let work = 0;
  for (let d = 0; d < days; d++)
    for (let h = 0; h < 24; h++) {
      engine.step(world, sim, HOUR);
      const alive = new Set<number>();
      for (const p of world.entities.person)
        if (p.status === "alive") {
          alive.add(p.id);
          if (p.doing === "work") work += 1;
        }
      for (const n of world.entities.need) if (n.low && CRISIS_NEEDS.has(n.need) && alive.has(n.person)) crisis += 1;
    }
  return {
    crisis,
    food: foodInStore(engine, world),
    work,
    hash: createHash("sha256").update(JSON.stringify(world)).digest("hex"),
  };
}

/** A window run under a policy (null: today's rule, no hook), on a copy of `world`. */
export function runPolicyWindow(engine: Engine, world: World, policy: Policy | null, days: number): WindowResult {
  const w = structuredClone(world);
  const cache: Cache = new Map();
  return runWindow(engine, w, policy ? makeHook(engine, cache, policy) : undefined, days);
}

/** Today's-rule worlds at the given month starts of `seed`'s year: month 0 is the new world (06:00 day 1), month m
 *  the world at tick m × 28 days. Deep copies (cloneRun with an empty cache). */
export function yearClones(engine: Engine, seed: string, months: number[]): World[] {
  const sim = engine.createSim(engine.content);
  const world = engine.createWorld(sim, seed);
  const perMonth = engine.content.calendar.daysPerMonth * engine.TICKS_PER_DAY;
  const out: World[] = [];
  for (const m of [...months].sort((a, b) => a - b)) {
    const at = m === 0 ? world.tick : m * perMonth;
    if (at > world.tick) engine.step(world, sim, at - world.tick);
    out.push(structuredClone(world));
  }
  return out;
}

export interface Score {
  crisis: number;
  /** The lower of food‰ and work‰ against today's over the windows, clamped to [0, 999]. */
  r: number;
  /** crisis × 1000 + (1000 − r). */
  raw: number;
  /** r under 950 (R4: output at least 95% of today's). */
  penalised: boolean;
}

const permille = (net: number, today: number) => (today <= 0 ? 1000 : Math.floor((net * 1000) / today));

/** One member's score on its windows against today's on the same windows. */
export function scoreOf(results: WindowResult[], today: WindowResult[]): Score {
  const sum = (rs: WindowResult[], k: "crisis" | "food" | "work") => rs.reduce((n, x) => n + x[k], 0);
  const crisis = sum(results, "crisis");
  const lower = Math.min(
    permille(sum(results, "food"), sum(today, "food")),
    permille(sum(results, "work"), sum(today, "work")),
  );
  const r = Math.max(0, Math.min(999, lower));
  return { crisis, r, raw: crisis * 1000 + (1000 - r), penalised: r < 950 };
}

/** The generation's scores: a penalised member scores the worst unpenalised score (0 if all are penalised)
 *  + 1000 + (1000 − r), so harmful members still rank among themselves (R4). */
export function generationScores(scores: Score[]): number[] {
  const ok = scores.filter((s) => !s.penalised).map((s) => s.raw);
  const worst = ok.length ? Math.max(...ok) : 0;
  return scores.map((s) => (s.penalised ? worst + 1000 + (1000 - s.r) : s.raw));
}

/** Centred ranks in [−0.5, 0.5], the lowest score +0.5, the highest −0.5; equal scores share their mean rank
 *  (the Lab's `centredRanks` keeps index order on ties, which would favour one side of an antithetic pair). */
export function centredRanksTied(scores: number[]): number[] {
  const n = scores.length;
  const order = [...scores.keys()].sort((a, b) => scores[b] - scores[a]); // worst first
  const r: number[] = new Array(n);
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && scores[order[j + 1]] === scores[order[i]]) j++;
    const mean = (i + j) / 2;
    for (let k = i; k <= j; k++) r[order[k]] = n > 1 ? mean / (n - 1) - 0.5 : 0;
    i = j + 1;
  }
  return r;
}

/** D-023: the windows where today's rule has at least one crisis hour; only these are drawn for training. */
export const eligibleWindows = (today: WindowResult[]) => today.flatMap((t, i) => (t.crisis > 0 ? [i] : []));

/** `count` distinct window indices out of `n` (with repeats only when n < count). */
export function drawWindows(rng: Rng, n: number, count: number = VULCAN_ES.windowsPerGeneration): number[] {
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    if (n - out.length <= 0) {
      out.push(Math.floor(rng.uniform() * n));
      continue;
    }
    let i = Math.floor(rng.uniform() * (n - out.length));
    for (const t of [...out].sort((a, b) => a - b)) if (i >= t) i++;
    out.push(i);
  }
  return out;
}

/** Scores `thetas` on the windows (indices into the run's window list), in order. */
export type EvaluateWindows = (windows: number[], thetas: number[][]) => Promise<WindowResult[][]>;

export interface LogEntry {
  /** Generation g's line: the members of g and the current theta (θ after g − 1 steps) on g's windows. The last
   *  line (g = generations + 1) scores only the final θ, on one more draw. */
  generation: number;
  windows: number[];
  today: number;
  theta: Score;
  mean?: number;
  best?: number;
  /** Share of members whose window worlds differ from today's at all. */
  differ?: number;
  seconds: number;
}
export interface Snapshot {
  kind: Kind;
  sigma: number;
  alpha: number;
  /** Generations done. */
  done: number;
  theta: number[];
  log: LogEntry[];
}

export interface TrainOpts {
  kind: Kind;
  sigma: number;
  alpha: number;
  generations?: number;
  population?: number;
  /** The window indices generations draw from (D-023: those where today's rule has a crisis hour). */
  pool: number[];
  /** Today's result per window index. */
  today: WindowResult[];
  evaluate: EvaluateWindows;
  /** Continue from a snapshot (the draws are replayed, so the run equals an unbroken one). */
  resume?: Snapshot;
  onGeneration?: (e: LogEntry, snap: Snapshot) => void;
}

/** The ES loop (spec "Training"): antithetic pairs, tied centred ranks, `update` with alpha. */
export async function trainVulcan(o: TrainOpts): Promise<Snapshot> {
  const gens = o.generations ?? VULCAN_ES.generations,
    pop = o.population ?? VULCAN_ES.population;
  const gauss = makeGauss(makeRng(VULCAN_ES.gaussSeed)),
    wrng = makeRng(VULCAN_ES.windowSeed);
  let theta = o.resume ? [...o.resume.theta] : theta0(o.kind);
  const log: LogEntry[] = o.resume ? [...o.resume.log] : [];
  const draw = () => {
    const eps: number[][] = [];
    for (let k = 0; k < pop / 2; k++) {
      const e = theta.map(() => gauss());
      eps.push(
        e,
        e.map((x) => -x),
      );
    }
    return { windows: drawWindows(wrng, o.pool.length).map((i) => o.pool[i]), eps };
  };
  const done = o.resume?.done ?? 0;
  for (let g = 1; g <= done; g++) draw(); // replay the draws of the generations already done
  for (let g = done + 1; g <= gens + 1; g++) {
    const t0 = performance.now();
    const { windows, eps } = draw();
    const today = windows.map((w) => o.today[w]);
    const todayScore = scoreOf(today, today).raw;
    if (g > gens) {
      const [res] = await o.evaluate(windows, [theta]);
      const e = { generation: g, windows, today: todayScore, theta: scoreOf(res, today), seconds: secs(t0) };
      log.push(e);
      const snap = { kind: o.kind, sigma: o.sigma, alpha: o.alpha, done: gens, theta, log };
      o.onGeneration?.(e, snap);
      return snap;
    }
    const members = eps.map((e) => perturb(theta, e, o.sigma));
    const res = await o.evaluate(windows, [theta, ...members]);
    const scores = res.slice(1).map((r) => scoreOf(r, today));
    const ranked = generationScores(scores);
    const differ = res.slice(1).filter((r) => r.some((x, i) => x.hash !== today[i].hash)).length / members.length;
    const e: LogEntry = {
      generation: g,
      windows,
      today: todayScore,
      theta: scoreOf(res[0], today),
      mean: ranked.reduce((a, b) => a + b, 0) / ranked.length,
      best: Math.min(...ranked),
      differ,
      seconds: 0,
    };
    theta = update(theta, eps, centredRanksTied(ranked), o.alpha);
    e.seconds = secs(t0);
    log.push(e);
    o.onGeneration?.(e, { kind: o.kind, sigma: o.sigma, alpha: o.alpha, done: g, theta, log });
  }
  throw new Error("unreachable");
}

const secs = (t0: number) => Math.round((performance.now() - t0) / 100) / 10;

/** Chance (spec "Training" (a)): today's rule plus the noise band's day-1 hook on pairs of windows. Each pair is
 *  scored like a generation's 2 windows; the spread is the largest |today's score − nudged score|. */
export function chanceSpread(
  today: WindowResult[][],
  nudged: WindowResult[][][],
): { deltas: number[]; spread: number } {
  const deltas = nudged.flatMap((runs, i) => {
    const t = scoreOf(today[i], today[i]).raw;
    return runs.map((r) => t - scoreOf(r, today[i]).raw);
  });
  return { deltas, spread: Math.max(0, ...deltas.map(Math.abs)) };
}

export interface SettingRun {
  sigma: number;
  alpha: number;
  log: LogEntry[];
}
export interface SettingRow {
  sigma: number;
  alpha: number;
  /** Share of members that differ from today at generation 1. */
  differ: number;
  /** today − best member, per generation (positive: the best member beats today). */
  leads: number[];
  /** Generations whose lead is above the chance spread. */
  beats: number;
  /** today − θ's score on the last line (the final θ, on the same draw for every setting). */
  final: number;
  qualifies: boolean;
}

/** The sigma check's rule (spec "Training"; D-023): a setting qualifies when at least half the members differ from
 *  today at generation 1 and the best member's lead over today is above chance in a majority of its generations.
 *  Pick the smallest qualifying sigma; between its alphas, the larger final lead, then the smaller alpha. */
export function pickSetting(runs: SettingRun[], spread: number): { rows: SettingRow[]; pick: SettingRow | null } {
  const rows = runs.map((s): SettingRow => {
    const gens = s.log.filter((e) => e.best !== undefined);
    const leads = gens.map((e) => e.today - e.best!);
    const beats = leads.filter((l) => l > spread).length;
    const last = s.log[s.log.length - 1];
    const differ = gens[0]?.differ ?? 0;
    return {
      sigma: s.sigma,
      alpha: s.alpha,
      differ,
      leads,
      beats,
      final: last.today - last.theta.raw,
      qualifies: differ >= 0.5 && beats * 2 > gens.length,
    };
  });
  const ok = rows.filter((r) => r.qualifies);
  const minSigma = Math.min(...ok.map((r) => r.sigma));
  const pick = ok.filter((r) => r.sigma === minSigma).sort((a, b) => b.final - a.final || a.alpha - b.alpha)[0] ?? null;
  return { rows, pick };
}
