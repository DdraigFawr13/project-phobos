// Blind pairs (docs/specs/vulcan-bench.md J5, "Pairs, floor and report"; D-020, D-021 R10). From each policy's shadow
// years on the held-out seeds, pick moments (net 5, 5, 5, 5, 4; table 3, 3, 2, 2, 2), branch today's rule and the
// policy from the same world at each moment, and follow both for 6 game hours. A seeded draw per pair sets which side
// is the policy (makeRng(19) for the net's pairs, makeRng(20) for the table's), and makeRng(21) shuffles all 36 into
// one list, p01 to p36. The pair file holds no key: `pairKey()` rebuilds it from the same draws (verdict.ts).
// Offline code; imports only types from Vulcan.
import type { Engine, Line, Sim, World } from "./engine.ts";
import { cloneRun, type Run } from "./clone.ts";
import { makeHook, type Cache, type Policy } from "./lines.ts";
import { SEASONS } from "./inputs.ts";
import type { Moment } from "./shadow.ts";
import type { Kind } from "./train.ts";
import { makeRng } from "../rng.ts";

/** Moments per held-out seed, in HELD_OUT_SEEDS order (anvil, smoke, tallow, wren, bryn). */
export const NET_QUOTAS = [5, 5, 5, 5, 4] as const;
/** R10's 12 table pairs; the first two seeds take the odd ones (a default, PR S4). */
export const TABLE_QUOTAS = [3, 3, 2, 2, 2] as const;
export const SIDE_SEEDS: Record<Kind, number> = { net: 19, table: 20 };
export const SHUFFLE_SEED = 21;
export const FOLLOW_HOURS = 6;

export interface Pair {
  id: string;
  situation: string;
  a: string[];
  b: string[];
}
export interface KeyEntry {
  id: string;
  kind: Kind;
  /** The pair's place in its own kind's selection order. */
  index: number;
  /** The side the policy is on. */
  side: "A" | "B";
}

const byTick = (a: Moment, b: Moment) => a.tick - b.tick || a.person.id - b.person.id;

/** The spec's selection, per seed in order: cycle the seasons spring to winter; each time take the earliest unused
 *  moment of a person not yet used in that seed, else the earliest unused moment; a season with none is skipped.
 *  A seed short of its quota passes the rest to the next seed. */
export function selectMoments(seeds: { seed: string; moments: Moment[] }[], quotas: readonly number[]): Moment[] {
  const out: Moment[] = [];
  let carry = 0;
  seeds.forEach((s, i) => {
    const want = (quotas[i] ?? 0) + carry;
    const left = [...s.moments].sort(byTick);
    const used = new Set<number>();
    let got = 0;
    for (let season = 0; got < want && left.length > 0; season = (season + 1) % SEASONS.length) {
      const here = left.filter((m) => m.clock.season === SEASONS[season]);
      if (here.length === 0) continue;
      const pick = here.find((m) => !used.has(m.person.id)) ?? here[0];
      left.splice(left.indexOf(pick), 1);
      used.add(pick.person.id);
      out.push(pick);
      got++;
    }
    carry = want - got;
  });
  return out;
}

/** The key: which page id is which kind's pair, and the policy's side. Depends only on the pair counts. */
export function pairKey(nNet = 24, nTable = 12): KeyEntry[] {
  const sides = (kind: Kind, n: number) => {
    const r = makeRng(SIDE_SEEDS[kind]);
    return Array.from({ length: n }, (_, index) => ({
      kind,
      index,
      side: (r.uniform() < 0.5 ? "A" : "B") as "A" | "B",
    }));
  };
  const all = [...sides("net", nNet), ...sides("table", nTable)];
  const r = makeRng(SHUFFLE_SEED);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(r.uniform() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.map((e, i) => ({ id: `p${String(i + 1).padStart(2, "0")}`, ...e }));
}

const pct = (v: number) => `${Math.floor(v / 100)}%`;
const hhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/** "<name> (<traits>), <season> day <d> hh:mm: food <%>, …; store food <n>, firewood <n>" (spec). */
export function situationOf(m: Moment): string {
  const n = m.needs;
  return (
    `${m.person.name} (${m.traits.length ? m.traits.join(", ") : "no traits"}), ${m.clock.season} day ${m.clock.day} ` +
    `${hhmm(m.clock.hour, m.clock.minute)}: food ${pct(n.food)}, water ${pct(n.water)}, rest ${pct(n.rest)}, ` +
    `warmth ${pct(n.warmth)}, recreation ${pct(n.recreation)}; store food ${m.stores.food}, firewood ${m.stores.firewood}`
  );
}

/** What one side did: the moment's minute, then each clock hour, each followed by its ledger lines. */
export interface Followed {
  today: string[];
  policy: string[];
}
export interface FollowItem {
  kind: Kind;
  moment: Pick<Moment, "tick" | "person" | "today" | "policy">;
}

/** A ledger line's text from Vulcan's event templates (`content.events`, held by the sim as `templates`): each
 *  `{key}` slot filled from the line's data, `{actorN}`/`{subjectN}` with names (as Vulcan's log renders it). */
export function lineText(sim: Sim, line: Line, nameOf: (id: number) => string): string {
  const t = (sim.templates as Map<string, string> | undefined)?.get(line.type);
  if (t === undefined) return line.type;
  return t.replace(/\{(\w+)\}/g, (slot, key: string) => {
    const role = /^(actor|subject)(\d+)$/.exec(key);
    if (role) {
      const id = ((role[1] === "actor" ? line.actors : line.subjects) as number[] | undefined)?.[Number(role[2])];
      return id === undefined ? slot : nameOf(id);
    }
    const v = line.data?.[key];
    return v === undefined ? slot : String(v);
  });
}

/** Whether a ledger line names the person: as an actor or subject, or in its data's `person`. */
export const namesPerson = (line: Line, id: number) =>
  (line.actors as number[] | undefined)?.includes(id) ||
  (line.subjects as number[] | undefined)?.includes(id) ||
  line.data?.person === id;

const doingOf = (w: World, id: number) => {
  const p = w.entities.person.find((q) => q.id === id);
  return !p ? "gone" : p.status !== "alive" ? p.status : p.doing || "idle";
};

const HOUR = 60;

/** Steps a branch on from its moment and writes what the person does (spec: at each clock hour after the moment,
 *  "hh:00 <doing>", then the text of any ledger line naming them). The first entry is the moment's own minute. */
function trace(engine: Engine, sim: Sim, w: World, id: number, hours: number): string[] {
  const names = new Map(w.entities.person.map((p) => [p.id, p.name]));
  const nameOf = (i: number) => names.get(i) ?? `#${i}`;
  const out: string[] = [];
  const add = (lines: Line[]) => {
    const seen = new Set<string>();
    for (const l of lines) {
      if (!namesPerson(l, id)) continue;
      const t = lineText(sim, l, nameOf);
      if (!seen.has(t)) out.push(`· ${t}`);
      seen.add(t);
    }
  };
  const t0 = w.tick;
  const lines = engine.step(w, sim, 1);
  const c = engine.clockAt(t0, engine.content.calendar);
  out.push(`${hhmm(c.hour, c.minute)} ${doingOf(w, id)}`);
  add(lines);
  // Lines up to a clock hour are listed under the entry before it, so none come after the last hour's entry.
  for (let h = 0; h < hours; h++) {
    if (h > 0 || w.tick % HOUR !== 0) add(engine.step(w, sim, HOUR - (w.tick % HOUR)));
    const k = engine.clockAt(w.tick, engine.content.calendar);
    out.push(`${hhmm(k.hour, 0)} ${doingOf(w, id)}`);
  }
  return out;
}

/** One today's-rule year on `seed` with a record-only hook per policy (each fills its own line cache exactly as
 *  that policy's shadow year did), branching at each item's tick: today's rule and the policy each step on from a
 *  clone of the world and that policy's cache. Checks each branch's first minute against the moment's `doing`s. */
export function followSeed(
  engine: Engine,
  seed: string,
  policies: Record<Kind, Policy>,
  items: FollowItem[],
  hours = FOLLOW_HOURS,
): Followed[] {
  const sim = engine.createSim(engine.content);
  const world = engine.createWorld(sim, seed);
  const caches: Record<Kind, Cache> = { net: new Map(), table: new Map() };
  const rec = {
    net: makeHook(engine, caches.net, policies.net, { record: true }),
    table: makeHook(engine, caches.table, policies.table, { record: true }),
  };
  engine.setLineHook(sim, (ctx, p, need, today) => {
    rec.net(ctx, p, need, today);
    rec.table(ctx, p, need, today);
    return today;
  });
  const order = items.map((_, i) => i).sort((i, j) => items[i].moment.tick - items[j].moment.tick);
  const out: Followed[] = new Array(items.length);
  for (const i of order) {
    const { kind, moment } = items[i];
    if (moment.tick < world.tick) throw new Error(`${seed}: moments out of order at tick ${moment.tick}`);
    if (moment.tick > world.tick) engine.step(world, sim, moment.tick - world.tick);
    const branch = (live: boolean) => {
      const copy: Run<Cache> = cloneRun({ world, cache: caches[kind] });
      const s = engine.createSim(engine.content);
      engine.setLineHook(s, makeHook(engine, copy.cache, policies[kind], { record: !live }));
      return trace(engine, s, copy.world, moment.person.id, hours);
    };
    const today = branch(false),
      policy = branch(true);
    const first = (t: string[]) => t[0].slice(6);
    const want = (d: string) => d || "idle";
    if (first(today) !== want(moment.today) || first(policy) !== want(moment.policy))
      throw new Error(
        `${seed} tick ${moment.tick} person ${moment.person.id}: replay gave ${first(today)}/${first(policy)}, ` +
          `the shadow year ${want(moment.today)}/${want(moment.policy)}`,
      );
    out[i] = { today, policy };
  }
  return out;
}

/** The page's pair list from both kinds' selections and follows, in pairKey order, with no key. */
export function blindPairs(
  net: { moment: Moment; followed: Followed }[],
  table: { moment: Moment; followed: Followed }[],
): Pair[] {
  return pairKey(net.length, table.length).map((k) => {
    const { moment, followed } = (k.kind === "net" ? net : table)[k.index];
    const [a, b] = k.side === "A" ? [followed.policy, followed.today] : [followed.today, followed.policy];
    return { id: k.id, situation: situationOf(moment), a, b };
  });
}
