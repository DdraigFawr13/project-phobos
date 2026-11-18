// Lines from a policy (docs/specs/vulcan-bench.md "Inputs", "Lines from outputs"; R2, R3): a Vulcan line hook that
// gives each person today's line plus an offset, worked out once per game hour at the person's first lookup in it
// and cached outside the world (the cache is cloned with it, src/vulcan/clone.ts). A policy is the line net or R10's
// table. Imports only types from Vulcan: the engine functions it reads come in as `env`, so tests can fake them.
import type { Content, Engine, LineHook, LineNeed, PersonRow, World } from "./engine.ts";
import { forward } from "../runtime/net.ts";
import type { Layer } from "../num/layer.ts";
import { STORE_SCALES } from "./scales.ts";
import { tableOffsets } from "./table.ts";
import { LINE_NEEDS, NEED_INPUTS, encode, lineFrom, offsetOf, type LineNeedName, type PersonState } from "./inputs.ts";

/** Five line offsets (LINE_NEEDS order), each within ±1000, from the 26 Q12 inputs. */
export type Policy = (x: Int16Array) => number[];

export const netPolicy =
  (layers: Layer[]): Policy =>
  (x) => {
    const outs = forward(layers, x);
    return Array.from(outs[outs.length - 1], offsetOf);
  };
export const tablePolicy =
  (params: ArrayLike<number>): Policy =>
  (x) =>
    tableOffsets(params, x);
/** Today's rule as a policy: every offset 0. */
export const zeroPolicy: Policy = () => [0, 0, 0, 0, 0];

export interface Entry {
  /** floor(tick / 60) at the lookup that filled `offsets`. */
  hourIndex: number;
  offsets: number[];
  /** The warmth offset frozen when the person started warming; used while `doing === 'warm'`. */
  warmOffset: number;
  /** `doing` at the person's last lookup. */
  lastDoing: string;
  /** Today's line at the last lookup of each need (LINE_NEEDS order; 0 until looked up). */
  todays: number[];
  inputs: Int16Array;
  state: PersonState;
}
/** Keyed by person id. */
export type Cache = Map<number, Entry>;

/** The engine parts the hook reads. */
export type LineEnv = Pick<Engine, "clockAt" | "hoursOf"> & { content: Content };

const HOUR = 60;
export const hourIndexOf = (tick: number) => (tick - (tick % HOUR)) / HOUR;

const foodKindsOf = (content: Content) => new Set(content.items.filter((i) => i.good === "food").map((i) => i.id));

/** A person's state for the inputs, read from the world as `balance.mjs` reads it. */
export function stateOf(env: LineEnv, world: World, p: PersonRow, foodKinds = foodKindsOf(env.content)): PersonState {
  const needs = { food: 0, water: 0, rest: 0, warmth: 0, recreation: 0 };
  for (const n of world.entities.need)
    if (n.person === p.id && (NEED_INPUTS as readonly string[]).includes(n.need))
      needs[n.need as keyof typeof needs] = n.value;
  const clock = env.clockAt(world.tick, env.content.calendar);
  const hours = env.hoursOf(world, env.content, p.id);
  let food = 0,
    firewood = 0;
  for (const i of world.entities.item) {
    if (i.holder) continue;
    if (foodKinds.has(i.kind)) food += i.count;
    else if (i.kind === "firewood") firewood += i.count;
  }
  const alive = world.entities.person.filter((q) => q.status === "alive").length;
  const per = (v: number) => (alive > 0 ? (v - (v % alive)) / alive : 0);
  return {
    needs,
    doing: p.doing,
    hour: clock.hour,
    inWork: clock.hour >= hours.workFrom && clock.hour < hours.workTo,
    season: clock.season,
    foodPerAlive: per(food),
    firewoodPerAlive: per(firewood),
    traits: world.entities.trait.filter((t) => t.person === p.id).map((t) => t.trait),
  };
}

export const needIndex = (need: LineNeed) => LINE_NEEDS.indexOf(need as LineNeedName);

/** The cache entry for `p` at this lookup: recomputed at the person's first lookup in a new game hour, then the
 *  warm freeze (spec "Lines from outputs") and `lastDoing` updated. */
export function lookup(
  env: LineEnv,
  cache: Cache,
  policy: Policy,
  world: World,
  p: PersonRow,
  foodKinds?: Set<string>,
) {
  const hi = hourIndexOf(world.tick);
  let e = cache.get(p.id);
  if (!e || e.hourIndex !== hi) {
    const state = stateOf(env, world, p, foodKinds);
    const inputs = encode(state, STORE_SCALES);
    e = {
      hourIndex: hi,
      offsets: policy(inputs),
      warmOffset: e?.warmOffset ?? 0,
      lastDoing: e?.lastDoing ?? "",
      todays: e?.todays ?? [0, 0, 0, 0, 0],
      inputs,
      state,
    };
    cache.set(p.id, e);
  }
  if (p.doing === "warm" && e.lastDoing !== "warm") e.warmOffset = e.offsets[4];
  e.lastDoing = p.doing;
  return e;
}

/** The offset that applies to `need` for this entry and `doing`. */
export const offsetFor = (e: Entry, need: LineNeed, doing: string) =>
  need === "warmth" && doing === "warm" ? e.warmOffset : e.offsets[needIndex(need)];

/** A line hook from a policy. `record`: fill the cache exactly as the policy's hook would, but return today's line
 *  (shadow mode, spec "Shadow log"). */
export function makeHook(env: LineEnv, cache: Cache, policy: Policy, opts: { record?: boolean } = {}): LineHook {
  const foodKinds = foodKindsOf(env.content);
  return (ctx, p, need, today) => {
    const e = lookup(env, cache, policy, ctx.world, p, foodKinds);
    e.todays[needIndex(need)] = today;
    return opts.record ? today : lineFrom(today, offsetFor(e, need, p.doing));
  };
}
