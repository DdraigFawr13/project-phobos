// The S4 report page (docs/specs/vulcan-bench.md J5, "Pairs, floor and report"; D-020, D-021 R9 and R10, D-022):
// 36 blind pairs, one per card, then the numbers floor beside today's noise band, then a short note on training.
// Picks save to the page's database (`db`, collection `picks`, one doc per pair id, `v` = "A" or "B"); only the
// owner writes. The pairs come only from models/vulcan/pairs.json, which holds no key, and the floor and the note sit
// after the pairs so they can't steer a pick. A fragment the Artifact host wraps; look from docs/UI_STYLE.md.
import { FLOOR_KEYS, NEVER } from "./measure.ts";
import { changeOf, floorMisses, missList, type FloorFile, type FloorKey } from "./floor.ts";
import type { Pair } from "./pairs.ts";
import { PASS_PICKS } from "./verdict.ts";

export interface ReportData {
  pairs: Pair[];
  floor: FloorFile | null;
  logs: { net: any; table: any };
  chance: { spread: number } | null;
}

const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
const LABEL: Record<FloorKey, string> = {
  food: "food at year end",
  alive: "alive at year end",
  "metal.smelted": "first ingot, day",
  "smithy.built": "smithy built, day",
  "smith.made": "first tool, day",
};
const day = (v: number) => (v >= NEVER ? "never" : String(v));
const val = (k: FloorKey, v: number) => (k === "food" || k === "alive" ? String(v) : day(v));
const range = (min: number, max: number) => (min === max ? signed(min) : `${signed(min)} to ${signed(max)}`);

/** The JSON the page script reads its pairs from: pairs.json as is (tests/vulcan-pairs.test.ts). */
export const pairsJson = (pairs: Pair[]) => JSON.stringify(pairs).replace(/</g, "\\u003c");

const CSS = `
:root{--bg:#dfe2e4;--panel:#eef0f1;--ink:#22292e;--muted:#56616a;--line:#c9ced2;--edge:#b9c0c5;--control:#8e989f;--level:#2b5d8a;--alert:#8a4f12;
--sans:"IBM Plex Sans",system-ui,sans-serif;--cond:"IBM Plex Sans Condensed","IBM Plex Sans",sans-serif;--mono:"IBM Plex Mono",monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1b2024;--panel:#242a2f;--ink:#e3e7ea;--muted:#9aa5ad;--line:#343c42;--edge:#3f484f;--control:#6c7780;--level:#7fb0dc;--alert:#e0a35c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#1b2024;--panel:#242a2f;--ink:#e3e7ea;--muted:#9aa5ad;--line:#343c42;--edge:#3f484f;--control:#6c7780;--level:#7fb0dc;--alert:#e0a35c;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font:400 15px/1.45 var(--sans)}
.vb{max-width:560px;margin:0 auto;padding-block:16px 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:12px}
.vb h1{font:600 22px/1.2 var(--cond);margin:0;text-wrap:balance}
.vb h2{font:600 18px/1.25 var(--cond);margin:12px 0 0;text-wrap:balance}
.vb p{margin:0}
.sub,.note{font-size:13px;color:var(--muted)}
.mono,td{font-family:var(--mono);font-weight:500;font-variant-numeric:tabular-nums}
.bar{display:flex;align-items:center;gap:8px;justify-content:space-between}
.count{font:500 15px/1.2 var(--mono);font-variant-numeric:tabular-nums}
.count b{font-weight:500;font-size:20px}
.card{background:var(--panel);border:1px solid var(--edge);border-radius:3px;padding:12px;display:grid;gap:12px;min-width:0}
.k{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.sit{font-size:15px}
.sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.side{border-top:1px solid var(--line);padding-top:6px;min-width:0}
.side ol{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px}
.side li{overflow-wrap:anywhere}
.side .t{font:500 13px/1.3 var(--mono);font-variant-numeric:tabular-nums;color:var(--muted);margin-right:4px}
.side .led{font-size:13px;color:var(--muted);padding-left:8px;border-left:2px solid var(--line)}
.picks{display:grid;grid-template-columns:1fr 1fr;gap:8px}
button{font:600 15px/1.2 var(--sans);color:var(--ink);background:var(--panel);border:1px solid var(--control);border-radius:3px;min-height:44px;padding:8px 12px;cursor:pointer}
button.big{min-height:56px;font-size:18px}
button[aria-pressed="true"]{background:var(--ink);color:var(--panel);border-color:var(--ink)}
button:disabled{opacity:.5;cursor:default}
button:focus-visible,summary:focus-visible{outline:2px solid var(--level);outline-offset:2px}
.nav{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.status{font-size:13px;color:var(--muted);min-height:19px}
.status.off{color:var(--alert)}
.scroll{overflow-x:auto;border:1px solid var(--edge);border-radius:3px;background:var(--panel)}
table{border-collapse:collapse;font-size:13px;width:100%}
caption{font:600 15px/1.3 var(--sans);text-align:left;padding:8px 8px 4px}
caption span{font-weight:400;color:var(--muted);font-size:13px;display:block}
th{font:600 13px/1.25 var(--sans);color:var(--muted);text-align:right;padding:6px 4px;border-bottom:1px solid var(--line);vertical-align:bottom}
td{text-align:right;padding:6px 4px;border-bottom:1px solid var(--line);white-space:nowrap}
tr:last-child td{border-bottom:0}
th:first-child,td:first-child{text-align:left;font-family:var(--sans);font-weight:400;white-space:normal;padding-left:8px}
th:last-child,td:last-child{padding-right:8px}
.miss{color:var(--alert)}
details{border-top:1px solid var(--line);padding-top:4px}
summary{font-weight:600;min-height:44px;display:flex;align-items:center;cursor:pointer}
details p+p{margin-top:8px}
`;

function floorSection(f: FloorFile): string {
  const seedTable = (s: FloorFile["seeds"][number]) => {
    const net = changeOf(s.today, s.net),
      table = changeOf(s.today, s.table);
    const mNet = floorMisses(s.today, s.net, f.worse),
      mTable = floorMisses(s.today, s.table, f.worse);
    const own = (k: FloorKey) =>
      s.noise.length ? range(Math.min(...s.noise.map((n) => n[k])), Math.max(...s.noise.map((n) => n[k]))) : "–";
    const cell = (v: number, miss: boolean) => `<td${miss ? ' class="miss"' : ""}>${signed(v)}${miss ? " ✗" : ""}</td>`;
    const res = (m: Record<FloorKey, boolean>) => {
      const l = missList(m);
      return l.length ? `misses ${l.map((k) => LABEL[k]).join(", ")}` : "holds";
    };
    return `<div class="scroll"><table>
<caption>${esc(s.seed)}<span>Net ${res(mNet)}; table ${res(mTable)}.</span></caption>
<thead><tr><th>number</th><th>today's rule</th><th>net change</th><th>table change</th><th>noise on ${esc(s.seed)}</th></tr></thead>
<tbody>${FLOOR_KEYS.map(
      (k) =>
        `<tr><td>${LABEL[k]}</td><td>${val(k, s.today[k])}</td>${cell(net[k], mNet[k])}${cell(table[k], mTable[k])}<td>${own(k)}</td></tr>`,
    ).join("")}</tbody></table></div>`;
  };
  const holds = (kind: "net" | "table") =>
    f.seeds.every((s) => missList(floorMisses(s.today, s[kind], f.worse)).length === 0);
  return `<h2>The numbers floor</h2>
<p>Each held-out seed played one full game year three ways: today's rule, the net's lines and the table's lines. Each change is the other rule minus today's. Noise is how far today's own numbers moved when one colonist was nudged to eat earlier on day 1 only: on this seed (3 runs) and over all 5 seeds (15 runs, the first table). ✗ marks a miss.</p>
<p><b>Net:</b> floor ${holds("net") ? "holds on every seed" : "misses on at least one seed"}. <b>Table:</b> ${holds("table") ? "holds on every seed" : "misses on at least one seed"}.</p>
<div class="scroll"><table>
<caption>Today's noise, all 5 seeds<span>Smallest and largest change over 15 nudged runs; a miss must be worse than the worst of these.</span></caption>
<thead><tr><th>number</th><th>smallest</th><th>largest</th><th>ignored up to</th></tr></thead>
<tbody>${FLOOR_KEYS.map(
    (k) =>
      `<tr><td>${LABEL[k]}</td><td>${signed(f.band[k].min)}</td><td>${signed(f.band[k].max)}</td><td>${k === "alive" ? "any drop misses" : k === "food" ? signed(-f.worse[k]) : signed(f.worse[k])}</td></tr>`,
  ).join("")}</tbody></table></div>
${f.seeds.map(seedTable).join("\n")}
<p class="note">A miss: alive drops by any amount; any other number is more than 5% worse than today's and worse by more than the largest worse change noise made over all 5 seeds (food ${f.worse.food}, first ingot ${f.worse["metal.smelted"]} days, smithy ${f.worse["smithy.built"]} days, first tool ${f.worse["smith.made"]} days). A first that never happens counts as day ${NEVER}. Vulcan ${esc(f.vulcan.slice(0, 7))}.</p>`;
}

function trainingNote(d: ReportData): string {
  const last = (l: any) => l?.log?.[l.log.length - 1];
  const net = last(d.logs.net),
    table = last(d.logs.table);
  if (!net || !table) return "";
  return `<h2>How the two rules were trained</h2>
<p>Both were tuned on the five training seeds, never these five, to cut crisis hours: hours a colonist spends hungry, tired or cold. On the last training draw, today's rule scored ${today(net)}, the net ${raw(net)} and the table ${raw(table)} (lower is better; chance alone moved the score by up to ${d.chance?.spread ?? "–"}). So the net did not beat today's rule in training, and the table did.</p>`;
}
const raw = (e: any) => e.theta.raw;
const today = (e: any) => e.today;

export function reportPage(d: ReportData): string {
  const n = d.pairs.length;
  return `<title>Vulcan blind pairs</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans:wght@400;600&display=swap">
<style>${CSS}</style>
<main class="vb">
<h1>Which colonist acts more like a person?</h1>
<p>Each card is one moment from a Vulcan year: a colonist, their needs and the stores. Below it, A and B show what they do over the next 6 game hours under two rules. One is today's rule; which side is which was drawn at random for each card. Pick the side that reads more like a real person.</p>
<div class="bar"><span class="count" id="count"><b>0</b> of ${n} rated</span><span class="sub" id="who"></span></div>
<section class="card" id="card" aria-live="polite">
<div class="bar"><span class="k" id="pos">Pair 1 of ${n}</span><span class="sub mono" id="pid"></span></div>
<p class="sit" id="sit"></p>
<div class="sides"><div class="side"><span class="k">A</span><ol id="a"></ol></div><div class="side"><span class="k">B</span><ol id="b"></ol></div></div>
<div class="picks"><button class="big" id="pickA" aria-pressed="false">A</button><button class="big" id="pickB" aria-pressed="false">B</button></div>
<p class="status" id="status">Loading saved picks…</p>
<div class="nav"><button id="prev">Back</button><button id="next">Next</button><button id="todo">Next unrated</button></div>
</section>
<p class="sub">Try this: read the hours side by side before you pick. Your pick saves at once; you can come back and change it.</p>
${d.floor ? floorSection(d.floor) : "<p>No floor yet (npm run pairs:vulcan).</p>"}
${trainingNote(d)}
<details><summary>How it works</summary>
<p>The net and the table each move five lines per colonist (eat, drink, rest, have fun, warm up) by up to 1000 of 10,000. In a shadow year under today's rule, a moment is a minute where the moved lines would make the colonist do something else. 24 cards are net moments (5, 5, 5, 5 and 4 from anvil, smoke, tallow, wren and bryn) and 12 are table moments; all 36 are shuffled together.</p>
<p>The verdict judges only the net: Yes needs the net picked in at least ${PASS_PICKS} of its 24 cards and the floor holding on every seed (D-020). A coin-flipper reaches ${PASS_PICKS} of 24 about 7.6% of the time. The table's score out of 12 and its floor are shown beside it: if the table does as well, the net isn't needed.</p>
<p class="note">Words used here: line, the need level under which a colonist acts; shadow year, a year under today's rule where the other rule's lines are worked out but not used; floor, the numbers the net must not make worse.</p>
</details>
</main>
<script type="application/json" id="pairs">${pairsJson(d.pairs)}</script>
<script>
(() => {
  const PAIRS = JSON.parse(document.getElementById("pairs").textContent);
  const $ = (id) => document.getElementById(id);
  const picks = new Map();
  let i = 0, db = null, canWrite = true, loaded = false;
  try { const s = Number(localStorage.getItem("vb-pair")); if (s >= 0 && s < PAIRS.length) i = s; } catch {}
  const li = (t) => {
    const el = document.createElement("li");
    if (t.startsWith("· ")) { el.className = "led"; el.textContent = t.slice(2); return el; }
    const sp = t.indexOf(" ");
    const tm = document.createElement("span"); tm.className = "t"; tm.textContent = t.slice(0, sp);
    el.append(tm, document.createTextNode(t.slice(sp + 1)));
    return el;
  };
  const status = (t, off) => { const s = $("status"); s.textContent = t; s.classList.toggle("off", !!off); };
  function render() {
    const p = PAIRS[i];
    $("pos").textContent = "Pair " + (i + 1) + " of " + PAIRS.length;
    $("pid").textContent = p.id;
    $("sit").textContent = p.situation;
    $("a").replaceChildren(...p.a.map(li));
    $("b").replaceChildren(...p.b.map(li));
    const v = picks.get(p.id);
    $("pickA").setAttribute("aria-pressed", String(v === "A"));
    $("pickB").setAttribute("aria-pressed", String(v === "B"));
    const ok = db && canWrite && loaded;
    $("pickA").disabled = $("pickB").disabled = !ok;
    $("prev").disabled = i === 0;
    $("next").disabled = i === PAIRS.length - 1;
    $("count").firstElementChild.textContent = PAIRS.filter((q) => picks.has(q.id)).length;
    $("todo").disabled = PAIRS.every((q) => picks.has(q.id));
    if (loaded && db && canWrite) status(v ? "Saved: " + v + "." : "Not rated yet.");
    try { localStorage.setItem("vb-pair", String(i)); } catch {}
  }
  const go = (j) => { i = Math.max(0, Math.min(PAIRS.length - 1, j)); render(); };
  $("prev").onclick = () => go(i - 1);
  $("next").onclick = () => go(i + 1);
  $("todo").onclick = () => {
    for (let k = 1; k <= PAIRS.length; k++) { const j = (i + k) % PAIRS.length; if (!picks.has(PAIRS[j].id)) return go(j); }
  };
  async function pick(v) {
    const p = PAIRS[i];
    if (!db || !canWrite) return;
    $("pickA").disabled = $("pickB").disabled = true;
    status("Saving…");
    try {
      await db.collection("picks").doc(p.id).set({ v });
      picks.set(p.id, v);
      render();
      status("Saved: " + v + ".");
    } catch (e) {
      status("Not saved (" + (e && e.code ? e.code : "error") + "). Try again; if it keeps failing, reload the page.", true);
      render();
    }
  }
  $("pickA").onclick = () => pick("A");
  $("pickB").onclick = () => pick("B");
  render();
  (async () => {
    const timer = setTimeout(() => { if (!loaded) status("Saved picks haven't loaded after 10 s. Reload the page to try again.", true); }, 10000);
    db = await window.claude?.use?.("db") ?? null;
    if (!db) { clearTimeout(timer); status("Picks can't be saved here. Open the page on claude.ai, signed in, to rate.", true); return; }
    const user = await window.claude.use("user");
    if (user && !user.isOwner()) { canWrite = false; $("who").textContent = "Viewing only: the owner's picks count."; }
    db.collection("picks").onSnapshot((snap) => {
      clearTimeout(timer);
      picks.clear();
      for (const d of snap.docs) { const v = d.data()?.v; if (v === "A" || v === "B") picks.set(d.id, v); }
      loaded = true;
      render();
      if (!canWrite) status("Viewing only.");
    }, (e) => { clearTimeout(timer); status("Saved picks didn't load (" + (e && e.code ? e.code : "error") + "). Reload the page to try again.", true); });
  })();
})();
</script>
`;
}
