// Shadow log (docs/specs/vulcan-bench.md "Shadow log"; R8): one year under today's rule on a held-out seed with a
// record-only hook that fills the line cache exactly as the policy's hook would. A candidate is a person-hour where,
// at the hour's start, some need's value lies between today's line and the policy's; it is confirmed minute by minute
// (clone, step one tick with the policy and with today's rule, compare `doing`). The first differing minute is the
// moment. Each moment carries a cause line: the inputs (up to 2) whose setting to 0 moves the moved line most, as the
// policy's own reading. Offline code.
import type { Engine } from "./engine.ts";
import { cloneRun, type Run } from "./clone.ts";
import { makeHook, stateOf, type Cache, type Policy } from "./lines.ts";
import { INPUT_NAMES, LINE_NEEDS, NEED_INPUTS, TRAITS, encode, lineFrom, type PersonState } from "./inputs.ts";
import { STORE_SCALES } from "./scales.ts";
import { YEAR_DAYS } from "./measure.ts";

export interface Moment {
  seed: string;
  person: { id: number; name: string };
  traits: string[];
  tick: number;
  clock: { season: string; day: number; hour: number; minute: number };
  /** Needs (0 to 10,000) and stores per alive person at the moment, before the minute is stepped. */
  needs: PersonState["needs"];
  stores: { food: number; firewood: number };
  today: string;
  policy: string;
  /** The line whose straddle made the candidate. */
  line: (typeof LINE_NEEDS)[number];
  todayLine: number;
  policyLine: number;
  /** "<doing>: <input> <value>, …", the policy's reading of why (not Vulcan's). */
  cause: string;
}
export interface ShadowResult {
  seed: string;
  candidates: number;
  moments: Moment[];
  seconds: number;
  /** All moments found; set when `moments` holds only a sample of them (sampleMoments). */
  count?: number;
}

/** The moment count of a seed's shadow year, whether `moments` is the full list or a sample. */
export const momentCount = (r: ShadowResult) => r.count ?? r.moments.length;

/** Keeps `n` moments evenly spaced through the year (the first, then every count/n-th), with the full count. */
export function sampleMoments(r: ShadowResult, n: number): ShadowResult {
  const all = r.moments,
    k = Math.min(n, all.length);
  const moments = Array.from({ length: k }, (_, i) => all[Math.floor((i * all.length) / k)]);
  return { ...r, moments, count: momentCount(r) };
}

const HOUR = 60;

/** Real units for an input's value (spec: needs in %, hour as hh:00, stores as counts, flags as yes/no). */
function valueText(i: number, s: PersonState, x: Int16Array): string {
  const name = INPUT_NAMES[i];
  if (i < NEED_INPUTS.length) return `${Math.floor(s.needs[NEED_INPUTS[i]] / 100)}%`;
  if (name === "hour") return `${String(s.hour).padStart(2, "0")}:00`;
  if (name === "food in store") return `${s.foodPerAlive}`;
  if (name === "firewood in store") return `${s.firewoodPerAlive}`;
  return x[i] ? "yes" : "no";
}

/** The inputs (up to 2) whose setting to Q12 0 changes output `k` most; ties to the lower input index. */
export function causeOf(policy: Policy, x: Int16Array, k: number): number[] {
  const base = policy(x)[k];
  const d = INPUT_NAMES.map((_, i) => {
    if (x[i] === 0) return { i, d: 0 };
    const y = Int16Array.from(x);
    y[i] = 0;
    return { i, d: Math.abs(policy(y)[k] - base) };
  });
  return d
    .filter((v) => v.d > 0)
    .sort((a, b) => b.d - a.d || a.i - b.i)
    .slice(0, 2)
    .map((v) => v.i);
}

export const causeText = (doing: string, idx: number[], s: PersonState, x: Int16Array) =>
  `${doing || "idle"}: ${idx.length ? idx.map((i) => `${INPUT_NAMES[i]} ${valueText(i, s, x)}`).join(", ") : "no input moves it"}`;

/** Today's line per LINE_NEEDS index for a person at an hour's start: `seek`, or warmth as last looked up (0: not
 *  yet looked up, so no warmth candidate). */
function todayLines(engine: Engine, cache: Cache, id: number): number[] {
  const seek = (n: string) => engine.content.life.needs.find((d) => d.id === n)?.seek ?? 0;
  const warm = cache.get(id)?.todays[4] ?? 0;
  return LINE_NEEDS.map((n) => (n === "warmth" ? warm : seek(n)));
}

/** A shadow year (or `days` days) on `seed`. */
export function shadowYear(engine: Engine, seed: string, policy: Policy, days = YEAR_DAYS): ShadowResult {
  const t0 = performance.now();
  const sim = engine.createSim(engine.content);
  const run: Run<Cache> = { world: engine.createWorld(sim, seed), cache: new Map() };
  engine.setLineHook(sim, makeHook(engine, run.cache, policy, { record: true }));
  const moments: Moment[] = [];
  let candidates = 0;
  const w = () => run.world;
  for (let h = 0; h < days * 24; h++) {
    const pending = new Map<number, number>(); // person → moved line
    for (const p of [...w().entities.person].filter((q) => q.status === "alive").sort((a, b) => a.id - b.id)) {
      const s = stateOf(engine, w(), p);
      const off = policy(encode(s, STORE_SCALES));
      const today = todayLines(engine, run.cache, p.id);
      for (let k = 0; k < LINE_NEEDS.length; k++) {
        if (today[k] === 0 && LINE_NEEDS[k] === "warmth") continue;
        const net = lineFrom(today[k], off[k]);
        const v = s.needs[LINE_NEEDS[k]];
        if (net !== today[k] && v >= Math.min(net, today[k]) && v < Math.max(net, today[k])) {
          pending.set(p.id, k);
          break;
        }
      }
    }
    candidates += pending.size;
    let m = 0;
    for (; m < HOUR && pending.size > 0; m++) {
      const before = new Map(
        [...pending.keys()].map((id) => {
          const p = w().entities.person.find((q) => q.id === id)!;
          return [id, { state: stateOf(engine, w(), p), doing: p.doing }];
        }),
      );
      const copy = cloneRun(run);
      const netSim = engine.createSim(engine.content);
      engine.setLineHook(netSim, makeHook(engine, copy.cache, policy));
      engine.step(copy.world, netSim, 1);
      engine.step(w(), sim, 1);
      for (const [id, k] of [...pending]) {
        const pt = w().entities.person.find((q) => q.id === id)!;
        const pn = copy.world.entities.person.find((q) => q.id === id)!;
        if (pt.status !== "alive") {
          pending.delete(id);
          continue;
        }
        if (pt.doing === pn.doing) continue;
        pending.delete(id);
        const e = copy.cache.get(id)!;
        const b = before.get(id)!.state;
        const clock = engine.clockAt(w().tick - 1, engine.content.calendar);
        const tl = e.todays[k] || todayLines(engine, run.cache, id)[k];
        moments.push({
          seed,
          person: { id, name: pt.name },
          traits: b.traits.filter((t) => (TRAITS as readonly string[]).includes(t)),
          tick: w().tick - 1,
          clock: {
            season: engine.content.calendar.seasons[clock.season],
            day: clock.month * engine.content.calendar.daysPerMonth + clock.day,
            hour: clock.hour,
            minute: clock.minute,
          },
          needs: b.needs,
          stores: { food: b.foodPerAlive, firewood: b.firewoodPerAlive },
          today: pt.doing,
          policy: pn.doing,
          line: LINE_NEEDS[k],
          todayLine: tl,
          policyLine: lineFrom(tl, e.offsets[k]),
          cause: causeText(pn.doing, causeOf(policy, e.inputs, k), e.state, e.inputs),
        });
      }
    }
    if (m < HOUR) engine.step(w(), sim, HOUR - m);
  }
  return { seed, candidates, moments, seconds: (performance.now() - t0) / 1000 };
}
