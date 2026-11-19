// J5 (docs/specs/vulcan-bench.md): the blind pairs. `pairs-are-blind` reads the committed pair file; the selection,
// side draws and the page's pair data are checked on built moments (no Vulcan needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeRng } from "../src/rng.ts";
import { NET_QUOTAS, TABLE_QUOTAS, pairKey, selectMoments, situationOf, type Pair } from "../src/vulcan/pairs.ts";
import type { Moment } from "../src/vulcan/shadow.ts";
import { HELD_OUT_SEEDS } from "../src/vulcan/bench.ts";
import { reportPage } from "../src/vulcan/report-page.ts";

const BANNED = /\b(net|today|phobos|policy|table)\b/i;

test("pairs-are-blind", () => {
  const pairs: Pair[] = JSON.parse(readFileSync(new URL("../models/vulcan/pairs.json", import.meta.url), "utf8"));
  assert.equal(pairs.length, 36);
  assert.equal(new Set(pairs.map((p) => p.id)).size, 36);
  const names = new Set<string>();
  for (const p of pairs) {
    assert.deepEqual(Object.keys(p).sort(), ["a", "b", "id", "situation"], `pair ${p.id} has only id, situation, a, b`);
    assert.ok(p.a.length > 0 && p.b.length > 0);
    names.add(p.situation.slice(0, p.situation.indexOf(" (")));
  }
  // Colonist names are allowed to match (spec J5): strip them, then no word may say which side is which.
  let text = JSON.stringify(pairs);
  for (const n of names) text = text.split(n).join("");
  const hit = BANNED.exec(text);
  assert.equal(hit, null, `pair text says "${hit?.[0]}" near "${hit && text.slice(hit.index - 40, hit.index + 40)}"`);
  // Ids run p01..p36 in page order and carry no group or side.
  assert.deepEqual(
    pairs.map((p) => p.id),
    pairKey().map((k) => k.id),
  );
});

test("the blind check catches a tell", () => {
  assert.ok(BANNED.test("07:00 work (Net)"));
  assert.ok(BANNED.test("today's rule"));
  assert.ok(!BANNED.test("Annette ate; netting"));
});

/** A moment for selection tests: only seed, person id, tick and season matter. */
const m = (seed: string, id: number, tick: number, season: string): Moment =>
  ({ seed, person: { id, name: `P${id}` }, tick, clock: { season, day: 1, hour: 6, minute: 0 } }) as Moment;

test("selection cycles the seasons, prefers a person not yet used, and skips an empty season", () => {
  const anvil = [
    m("anvil", 1, 100, "spring"),
    m("anvil", 1, 50, "spring"), // earliest spring: person 1
    m("anvil", 2, 120, "spring"),
    m("anvil", 1, 9000, "summer"), // person 1 used: summer has only person 1, so take it anyway
    m("anvil", 3, 30000, "winter"),
    m("anvil", 2, 40, "spring"), // a tie on tick goes to the lower id
    m("anvil", 1, 40, "spring"),
  ];
  const got = selectMoments([{ seed: "anvil", moments: anvil }], [5]);
  // spring t40 p1; summer t9000 p1; autumn none (skipped); winter t30000 p3; spring: p2 not yet used → t40 p2;
  // summer: none left; winter: none; spring t50 p1 (all spring people used).
  assert.deepEqual(
    got.map((x) => [x.tick, x.person.id]),
    [
      [40, 1],
      [9000, 1],
      [30000, 3],
      [40, 2],
      [50, 1],
    ],
  );
});

test("a seed short of its quota passes the rest to the next seed", () => {
  const seeds = [
    { seed: "anvil", moments: [m("anvil", 1, 10, "spring"), m("anvil", 2, 20, "summer")] },
    { seed: "smoke", moments: Array.from({ length: 10 }, (_, i) => m("smoke", i + 1, 100 + i, "spring")) },
  ];
  const got = selectMoments(seeds, [5, 2]);
  assert.equal(got.filter((x) => x.seed === "anvil").length, 2);
  assert.equal(got.filter((x) => x.seed === "smoke").length, 5);
  assert.deepEqual(NET_QUOTAS, [5, 5, 5, 5, 4]);
  assert.equal(
    TABLE_QUOTAS.reduce((a, b) => a + b, 0),
    12,
  );
  assert.equal(HELD_OUT_SEEDS.length, NET_QUOTAS.length);
});

test("pair key: 24 net and 12 table pairs, sides from makeRng(19) and makeRng(20), shuffled into p01..p36", () => {
  const key = pairKey();
  assert.equal(key.length, 36);
  assert.deepEqual(
    key.map((k) => k.id),
    Array.from({ length: 36 }, (_, i) => `p${String(i + 1).padStart(2, "0")}`),
  );
  const net = key.filter((k) => k.kind === "net").sort((a, b) => a.index - b.index);
  const table = key.filter((k) => k.kind === "table").sort((a, b) => a.index - b.index);
  assert.equal(net.length, 24);
  assert.equal(table.length, 12);
  const r19 = makeRng(19),
    r20 = makeRng(20);
  assert.deepEqual(
    net.map((k) => k.side),
    net.map(() => (r19.uniform() < 0.5 ? "A" : "B")),
  );
  assert.deepEqual(
    table.map((k) => k.side),
    table.map(() => (r20.uniform() < 0.5 ? "A" : "B")),
  );
  // Shuffled: the net pairs are not simply the first 24.
  assert.notDeepEqual(
    key.slice(0, 24).map((k) => k.kind),
    new Array(24).fill("net"),
  );
  assert.deepEqual(pairKey(), key, "deterministic");
});

test("situation text", () => {
  const s = situationOf({
    seed: "anvil",
    person: { id: 1, name: "Colm" },
    traits: ["cheerful", "hot-tempered"],
    tick: 780,
    clock: { season: "spring", day: 1, hour: 13, minute: 5 },
    needs: { food: 5200, water: 6900, rest: 8899, warmth: 10000, recreation: 4012 },
    stores: { food: 40, firewood: 3 },
  } as Moment);
  assert.equal(
    s,
    "Colm (cheerful, hot-tempered), spring day 1 13:05: food 52%, water 69%, rest 88%, warmth 100%, recreation 40%; store food 40, firewood 3",
  );
});

test("the report page carries pairs.json as is, and the floor and training note only after the pairs", () => {
  const pairs: Pair[] = JSON.parse(readFileSync(new URL("../models/vulcan/pairs.json", import.meta.url), "utf8"));
  const read = (f: string) => JSON.parse(readFileSync(new URL(`../models/vulcan/${f}`, import.meta.url), "utf8"));
  const html = reportPage({
    pairs,
    floor: read("floor.json"),
    logs: { net: read("net-log.json"), table: read("table-log.json") },
    chance: read("chance.json"),
  });
  const data = /<script type="application\/json" id="pairs">([^<]*)<\/script>/.exec(html);
  assert.ok(data);
  assert.deepEqual(JSON.parse(data[1]), pairs);
  const card = html.indexOf('id="card"');
  assert.ok(card > 0);
  assert.ok(html.indexOf("The numbers floor") > card);
  assert.ok(html.indexOf("How the two rules were trained") > card);
  // Nothing before the card names a side's rule beyond the plain instruction.
  assert.equal(/\b(net|table)\b/i.test(html.slice(0, card).replace(/<style>[\s\S]*?<\/style>/, "")), false);
});
