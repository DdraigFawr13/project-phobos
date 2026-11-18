// Line net inputs, bounds, warm freeze and cache (docs/specs/vulcan-bench.md "Inputs", "Lines from outputs", S3),
// plus the training score and tied ranks (spec "Training") and R10's table. Vulcan-free: the hook runs on a fake
// world and fake engine functions, so these run in `npm run check`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { INPUT_NAMES, N_INPUTS, encode, lineFrom, offsetOf, q12, type PersonState } from "../src/vulcan/inputs.ts";
import { TABLE_PARAMS, tableOffsets } from "../src/vulcan/table.ts";
import { makeHook, netPolicy, type Cache, type LineEnv, type Policy } from "../src/vulcan/lines.ts";
import {
  centredRanksTied,
  drawWindows,
  eligibleWindows,
  generationScores,
  pickSetting,
  scoreOf,
  zeroLineNet,
  type WindowResult,
} from "../src/vulcan/train.ts";
import { makeRng } from "../src/rng.ts";
import type { World, PersonRow, Content } from "../src/vulcan/engine.ts";

const state = (over: Partial<PersonState> = {}): PersonState => ({
  needs: { food: 5000, water: 10_000, rest: 0, warmth: 2441, recreation: 12_000 },
  doing: "sleep",
  hour: 13,
  inWork: true,
  season: 2,
  foodPerAlive: 560,
  firewoodPerAlive: 3,
  traits: ["greedy", "devout", "unknown"],
  ...over,
});

test("inputs: 26 in spec order, Q12 by integer division, clamped to [0, 4096]", () => {
  assert.equal(INPUT_NAMES.length, N_INPUTS);
  assert.equal(q12(5000, 10_000), 2048);
  assert.equal(q12(2441, 10_000), 999); // 2441 × 4096 / 10000 = 999.83, floored
  assert.equal(q12(12_000, 10_000), 4096);
  assert.equal(q12(-5, 10_000), 0);
  assert.equal(q12(3, 10), 1228); // 1228.8 floored
  const x = encode(state(), { food: 1120, firewood: 10 });
  assert.deepEqual(
    [...x],
    [
      2048,
      4096,
      0,
      999,
      4096, // needs: food, water, rest, warmth, recreation
      0,
      4096,
      0, // doing work, sleep, relax
      2218,
      4096, // hour 13 (13 × 4096 / 24 = 2218.67), in work hours
      0,
      0,
      4096,
      0, // autumn
      2048,
      1228, // stores 560 of 1120, 3 of 10
      0,
      0,
      0,
      4096,
      0,
      0,
      0,
      0,
      0,
      4096, // greedy, devout; unknown traits ignored
    ],
  );
});

test("bounds: offset = shr(output × 1000, 12), within ±1000, floor so −1 stays −1; lines clamp to [0, 10000]", () => {
  assert.equal(offsetOf(4096), 1000);
  assert.equal(offsetOf(-4096), -1000);
  assert.equal(offsetOf(0), 0);
  assert.equal(offsetOf(-1), -1);
  assert.equal(offsetOf(1), 0);
  assert.equal(offsetOf(2048), 500);
  assert.equal(lineFrom(5200, -1000), 4200);
  assert.equal(lineFrom(300, -1000), 0);
  assert.equal(lineFrom(9500, 1000), 10_000);
  // The table: season offset + trait offsets, clamped to ±1000; reads only season and traits.
  const p = new Array(TABLE_PARAMS).fill(0);
  p[2 * 5 + 0] = 300; // autumn, food
  p[(4 + 3) * 5 + 0] = 900; // greedy, food
  p[(4 + 9) * 5 + 2] = -40; // devout, rest
  p[(4 + 0) * 5 + 1] = 777; // hot-tempered (not this person), water
  const x = encode(state(), { food: 1120, firewood: 10 });
  assert.deepEqual(tableOffsets(p, x), [1000, 0, -40, 0, 0]);
  assert.equal(TABLE_PARAMS, 70);
});

// A fake world: person 1 and 2, needs, a food item in store, traits; the engine functions the hook reads.
function fake() {
  const content = {
    items: [{ id: "bread", good: "food" }, { id: "firewood" }],
    life: { scale: 10_000, needs: [] },
    calendar: { daysPerMonth: 28, monthsPerYear: 12, seasons: ["spring", "summer", "autumn", "winter"] },
  } as unknown as Content;
  const env: LineEnv = {
    content,
    clockAt: (tick) => ({
      year: 1,
      month: 0,
      day: 1,
      hour: Math.floor((tick % 1440) / 60),
      minute: tick % 60,
      season: 1,
    }),
    hoursOf: () => ({ workFrom: 8, workTo: 17, sleepFrom: 22 }),
  };
  const person = (id: number): PersonRow => ({ id, name: `p${id}`, status: "alive", doing: "" });
  const world = {
    tick: 9 * 60,
    entities: {
      person: [person(1), person(2)],
      need: [
        { id: 10, person: 1, need: "food", value: 5000, low: 0 },
        { id: 11, person: 1, need: "warmth", value: 2000, low: 1 },
        { id: 12, person: 2, need: "food", value: 9000, low: 0 },
      ],
      item: [
        { id: 20, kind: "bread", count: 40, holder: 0, x: 0, y: 0, z: 0 },
        { id: 21, kind: "bread", count: 99, holder: 1, x: 0, y: 0, z: 0 },
        { id: 22, kind: "firewood", count: 5, holder: 0, x: 0, y: 0, z: 0 },
      ],
      trait: [{ id: 30, person: 1, trait: "hardy" }],
      mood: [],
      store: [],
    },
  } as unknown as World;
  return { env, world, p1: world.entities.person[0], p2: world.entities.person[1] };
}

/** A policy whose offsets follow the food need input, so a changed state shows as a changed offset. */
const follows: Policy = (x) => [x[0] >> 4, -(x[0] >> 5), 7, -7, x[0] >> 3];

test("cache key: one entry per person id, recomputed at the first lookup in a new game hour only", () => {
  const { env, world, p1, p2 } = fake();
  const cache: Cache = new Map();
  const hook = makeHook(env, cache, follows);
  const ctx = { world, content: env.content };
  const first = hook(ctx, p1, "food", 5200);
  assert.equal(first, 5200 + (q12(5000, 10_000) >> 4));
  assert.deepEqual([...cache.keys()], [1]);
  const e = cache.get(1)!;
  assert.equal(e.hourIndex, 9);
  assert.equal(e.state.foodPerAlive, 20); // 40 in store (the held 99 don't count) / 2 alive
  assert.equal(e.state.firewoodPerAlive, 2);
  assert.deepEqual(e.state.traits, ["hardy"]);
  assert.equal(e.state.inWork, true);
  // Same hour, the need changed: the hour's offsets stay.
  world.entities.need[0].value = 1000;
  world.tick += 59;
  assert.equal(hook(ctx, p1, "food", 5200), first);
  // Another person gets its own entry; recreation reads its own offset.
  assert.equal(hook(ctx, p2, "recreation", 3500), 3493);
  assert.deepEqual([...cache.keys()], [1, 2]);
  // A new hour recomputes from the new state.
  world.tick += 1;
  assert.equal(hook(ctx, p1, "food", 5200), 5200 + (q12(1000, 10_000) >> 4));
  assert.equal(cache.get(1)!.hourIndex, 10);
  // Record mode fills the cache the same way but returns today's line.
  const rec: Cache = new Map();
  assert.equal(makeHook(env, rec, follows, { record: true })(ctx, p1, "food", 5200), 5200);
  assert.deepEqual(rec.get(1)!.offsets, cache.get(1)!.offsets);
  assert.equal(rec.get(1)!.todays[0], 5200);
});

test("warm freeze: warmth's offset is fixed when warming starts and held while doing is warm", () => {
  const { env, world, p1 } = fake();
  const cache: Cache = new Map();
  const hook = makeHook(env, cache, follows);
  const ctx = { world, content: env.content };
  const off = (v: number) => q12(v, 10_000) >> 3;
  assert.equal(hook(ctx, p1, "warmth", 3000), 3000 + off(5000)); // not warming yet: the hour's offset
  p1.doing = "warm"; // warming() sets doing after its lookup; the next lookup (same hour) freezes the offset
  assert.equal(hook(ctx, p1, "warmth", 3000), 3000 + off(5000));
  world.entities.need[0].value = 0;
  world.tick += 60; // a new hour: the hour's warmth offset is now off(0) = 0
  assert.equal(hook(ctx, p1, "warmth", 3000), 3000 + off(5000), "frozen while warming, across the hour");
  assert.equal(cache.get(1)!.offsets[4], off(0));
  assert.equal(hook(ctx, p1, "food", 5200), 5200 + (q12(0, 10_000) >> 4), "other lines use the hour's offsets");
  p1.doing = "";
  assert.equal(hook(ctx, p1, "warmth", 3000), 3000, "doing anything else: the hour's offset again");
  p1.doing = "warm";
  assert.equal(hook(ctx, p1, "warmth", 3000), 3000, "warming again freezes the current hour's offset");
});

test("the zero net gives offset 0 on any input", () => {
  const zero = netPolicy(zeroLineNet());
  const x = encode(state(), { food: 1120, firewood: 10 });
  assert.deepEqual(zero(x), [0, 0, 0, 0, 0]);
  assert.deepEqual(zero(new Int16Array(N_INPUTS).fill(4096)), [0, 0, 0, 0, 0]);
});

const wr = (crisis: number, food: number, work: number): WindowResult => ({ crisis, food, work, hash: "" });

test("score: crisis × 1000 + (1000 − r); r the lower of food‰ and work‰ against today's, clamped to [0, 999]", () => {
  const today = [wr(3, 1000, 400), wr(2, 500, 200)];
  assert.deepEqual(scoreOf(today, today), { crisis: 5, r: 999, raw: 5001, penalised: false });
  const s = scoreOf([wr(1, 1000, 400), wr(1, 400, 200)], today); // food 1400/1500 = 933‰
  assert.deepEqual(s, { crisis: 2, r: 933, raw: 2067, penalised: true });
  assert.equal(scoreOf([wr(0, 0, 0)], [wr(0, 0, 0)]).r, 999); // nothing to lose: no penalty
  assert.equal(scoreOf([wr(0, 2000, 900)], [wr(4, 1000, 400)]).raw, 1);
  // A penalised member: the worst unpenalised score + 1000 + (1000 − r); all penalised: from 0.
  const ok = scoreOf([wr(4, 1000, 400)], [wr(4, 1000, 400)]);
  const bad = scoreOf([wr(0, 900, 400)], [wr(4, 1000, 400)]);
  assert.deepEqual(generationScores([ok, bad]), [4001, 4001 + 1000 + 100]);
  assert.deepEqual(generationScores([bad]), [1100]);
});

test("centredRanksTied: lowest score +0.5, highest −0.5, equal scores share their mean rank", () => {
  assert.deepEqual(centredRanksTied([10, 30, 20]), [0.5, -0.5, 0]);
  assert.deepEqual(centredRanksTied([5, 5, 9, 1]), [0, 0, -0.5, 0.5]);
  assert.deepEqual(centredRanksTied([7, 7]), [0, 0]); // an antithetic pair that ties: no step
  const r = centredRanksTied([3, 1, 3, 3, 2]);
  assert.equal(
    r.reduce((a, b) => a + b, 0),
    0,
  );
});

test("drawWindows: distinct windows, fixed by the seed", () => {
  const a = drawWindows(makeRng(18), 60);
  assert.equal(a.length, 4); // D-023: 4 windows per generation
  assert.equal(new Set(a).size, 4);
  assert.deepEqual(drawWindows(makeRng(18), 60), a);
  const ten = drawWindows(makeRng(20), 60, 10);
  assert.equal(new Set(ten).size, 10);
  assert.ok(ten.every((i) => i >= 0 && i < 60));
  assert.equal(new Set(drawWindows(makeRng(3), 3, 3)).size, 3);
});

test("pickSetting: the smallest sigma where half the members differ and the best beats chance in most generations", () => {
  const gen = (today: number, best: number, differ: number) => ({
    generation: 1,
    windows: [0, 1],
    today,
    theta: { crisis: 0, r: 999, raw: today, penalised: false },
    best,
    mean: best,
    differ,
    seconds: 0,
  });
  const run = (sigma: number, alpha: number, leads: number[], differ: number, final: number) => ({
    sigma,
    alpha,
    log: [
      ...leads.map((l) => gen(5000, 5000 - l, differ)),
      {
        generation: 6,
        windows: [2, 3],
        today: 4000,
        theta: { crisis: 0, r: 999, raw: 4000 - final, penalised: false },
        seconds: 0,
      },
    ],
  });
  const runs = [
    run(64, 128, [3000, 3000, 3000, 3000, 3000], 0.3, 0), // too few differ
    run(256, 128, [2000, 0, 2000, 0, 2000], 0.6, 100), // beats chance 3 of 5
    run(256, 512, [2000, 2000, 2000, 2000, 2000], 0.9, 500), // also qualifies, better final lead
    run(1024, 128, [9000, 9000, 9000, 9000, 9000], 1, 9000),
  ];
  const { rows, pick } = pickSetting(runs, 1500);
  assert.deepEqual(
    rows.map((r) => r.qualifies),
    [false, true, true, true],
  );
  assert.deepEqual([pick!.sigma, pick!.alpha], [256, 512]);
  assert.equal(pickSetting(runs, 10_000).pick, null);
});

test("quotaCheck: 5, 5, 5, 5, 4 and 24 in all; a short seed passes the rest of its quota on", async () => {
  const { quotaCheck } = await import("../src/vulcan/train-page.ts");
  assert.equal(quotaCheck([5, 5, 5, 5, 4]).ok, true);
  assert.equal(quotaCheck([9, 9, 9, 9, 9]).ok, true);
  assert.deepEqual(quotaCheck([3, 7, 5, 5, 4]), { total: 24, ok: true, carried: [5, 7, 5, 5, 4] });
  assert.equal(quotaCheck([3, 6, 5, 5, 5]).ok, true); // anvil's 2 short pass on until bryn's spare covers them
  assert.equal(quotaCheck([40, 0, 0, 0, 0]).ok, false);
  assert.equal(quotaCheck([5, 5, 5, 5, 3]).ok, false);
});

test("eligibleWindows: only windows where today's rule has a crisis hour (D-023)", () => {
  assert.deepEqual(eligibleWindows([wr(0, 9, 9), wr(3, 9, 9), wr(0, 0, 0), wr(1, 0, 0)]), [1, 3]);
});
