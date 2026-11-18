// Measures (docs/specs/vulcan-bench.md "Measures"): one game year on a seed, computed exactly as Vulcan's
// `tools/balance.mjs` computes its 14 table columns and six metal-chain firsts (stepping 60 ticks, reading
// `world.entities` at each hour's end), plus the floor numbers (D-020, R9) and the yearly maximum of food and
// firewood in store per alive person (for `scales.ts`). Reads state only.
import type { Engine, LineHook, World, Sim } from "./engine.ts";

export const YEAR_DAYS = 336;
const HOUR = 60;
/** The day the floor gives a metal-chain first that never happened (D-020: "counts as worst"). */
export const NEVER = YEAR_DAYS + 1;
export const FIRSTS = [
  "tool.worn",
  "mine.shaftPlanned",
  "mine.veinMined",
  "metal.smelted",
  "smithy.built",
  "smith.made",
] as const;
export type First = (typeof FIRSTS)[number];
/** balance.mjs's table columns, in its order. */
export const COLUMNS = [
  "seed",
  "alive",
  "hungryDays",
  "tiredDays",
  "coldDays",
  "crowdedDays",
  "coldNotable",
  "notable",
  "minWarmth",
  "minMood",
  "food",
  "fullDays",
  "houses",
  "days",
] as const;
export type Column = (typeof COLUMNS)[number];

export interface YearResult {
  seed: string;
  row: Record<Column, string | number>;
  /** Day of each first (1-based), 0 when it never happened (as balance.mjs). */
  firsts: Record<First, number>;
  top: string;
  /** Wall-clock seconds for the year (world creation and 336 days of steps). */
  seconds: number;
  /** The year's maximum of goods in store per alive person, at hour ends (integer division). */
  maxPerAlive: { food: number; firewood: number };
}

/** Floor numbers (D-020): food and alive at year end, days to three metal firsts (a first never reached is 337). */
export interface FloorNumbers {
  food: number;
  alive: number;
  "metal.smelted": number;
  "smithy.built": number;
  "smith.made": number;
}
export const FLOOR_KEYS = ["food", "alive", "metal.smelted", "smithy.built", "smith.made"] as const;
/** Whether a bigger value is better for this floor number. */
export const HIGHER_IS_BETTER: Record<keyof FloorNumbers, boolean> = {
  food: true,
  alive: true,
  "metal.smelted": false,
  "smithy.built": false,
  "smith.made": false,
};

export const floorOf = (r: YearResult): FloorNumbers => ({
  food: Number(r.row.food),
  alive: Number(r.row.alive),
  "metal.smelted": r.firsts["metal.smelted"] || NEVER,
  "smithy.built": r.firsts["smithy.built"] || NEVER,
  "smith.made": r.firsts["smith.made"] || NEVER,
});

const foodKinds = (engine: Engine) => new Set(engine.content.items.filter((i) => i.good === "food").map((i) => i.id));

/** Goods of `kinds` in store (no holder), as balance.mjs's `goods`. */
const inStore = (w: World, kinds: Set<string>) =>
  w.entities.item.filter((i) => kinds.has(i.kind) && !i.holder).reduce((n, i) => n + i.count, 0);

/** Creates a seed's world with an optional line hook set before the first step. */
export function start(engine: Engine, seed: string, hook?: LineHook): { sim: Sim; world: World } {
  const sim = engine.createSim(engine.content);
  const world = engine.createWorld(sim, seed);
  if (hook) engine.setLineHook(sim, hook);
  return { sim, world };
}

/** One game year on `seed`, from world creation, as balance.mjs runs it. */
export function measureYear(engine: Engine, seed: string, hook?: LineHook): YearResult {
  const t0 = performance.now();
  const { content, step, growSpot, TICKS_PER_DAY } = engine;
  const { sim, world: w } = start(engine, seed, hook);
  const lowDays: Record<string, Set<string>> = {
    food: new Set(),
    rest: new Set(),
    warmth: new Set(),
    privacy: new Set(),
  };
  let minWarmth = Infinity;
  let minMood = Infinity;
  let fullDays = 0;
  const notable = new Map<string, number>();
  const firsts = Object.fromEntries(FIRSTS.map((f) => [f, 0])) as Record<First, number>;
  const food = foodKinds(engine);
  const firewood = new Set(["firewood"]);
  const maxPerAlive = { food: 0, firewood: 0 };
  for (let day = 0; day < YEAR_DAYS; day += 1) {
    for (let h = 0; h < 24; h += 1) {
      for (const line of step(w, sim, HOUR)) {
        if ((firsts as Record<string, number>)[line.type] === 0) firsts[line.type as First] = day + 1;
        if (!sim.notable(line)) continue;
        const key = line.type === "need.low" ? `need.low ${line.data.need}` : line.type;
        notable.set(key, (notable.get(key) ?? 0) + 1);
      }
      for (const n of w.entities.need) {
        if (n.low && lowDays[n.need]) lowDays[n.need].add(`${n.person}/${day}`);
        if (n.need === "warmth") minWarmth = Math.min(minWarmth, n.value);
      }
      for (const m of w.entities.mood) minMood = Math.min(minMood, m.value);
      const alive = w.entities.person.filter((p) => p.status === "alive").length;
      if (alive > 0) {
        maxPerAlive.food = Math.max(maxPerAlive.food, Math.floor(inStore(w, food) / alive));
        maxPerAlive.firewood = Math.max(maxPerAlive.firewood, Math.floor(inStore(w, firewood) / alive));
      }
    }
    const taken = new Set(w.entities.item.filter((i) => !i.holder).map((i) => `${i.x},${i.y},${i.z}`));
    const empty = w.entities.store.some((s) => !taken.has(`${s.x},${s.y},${s.z}`));
    if (!empty && !growSpot(w, content)) fullDays += 1;
  }
  const total = [...notable.values()].reduce((a, b) => a + b, 0);
  const top = [...notable].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return {
    seed,
    row: {
      seed,
      alive: w.entities.person.filter((p) => p.status === "alive").length,
      hungryDays: lowDays.food.size,
      tiredDays: lowDays.rest.size,
      coldDays: lowDays.warmth.size,
      crowdedDays: lowDays.privacy.size,
      coldNotable: notable.get("need.low warmth") ?? 0,
      notable: total,
      minWarmth,
      minMood,
      food: inStore(w, food),
      fullDays,
      houses: (w.entities.house ?? []).filter((x) => x.state === "built").length,
      days: w.tick / TICKS_PER_DAY,
    },
    firsts,
    top: top.map(([k, v]) => `${k} ${v}`).join(", "),
    seconds: (performance.now() - t0) / 1000,
    maxPerAlive,
  };
}

/** The lines balance.mjs prints for these results: header, one row each, then each seed's metal chain. */
export function formatTable(results: YearResult[]): string {
  const out = [COLUMNS.join(" | ")];
  for (const r of results) out.push(COLUMNS.map((c) => r.row[c]).join(" | "));
  for (const r of results)
    out.push(`${r.seed} metal chain, first day: ${FIRSTS.map((f) => `${f} ${r.firsts[f] || "-"}`).join(", ")}`);
  return `${out.join("\n")}\n`;
}

/** A hook adding `add` to the food line of one person (by id) during the world's first game day only. */
export function foodNudge(engine: Engine, person: number, startTick: number, add = 1000): LineHook {
  const end = startTick + engine.TICKS_PER_DAY;
  return (ctx, p, need, today) => (need === "food" && p.id === person && ctx.world.tick < end ? today + add : today);
}
