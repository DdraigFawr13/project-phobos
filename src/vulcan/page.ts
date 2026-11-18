// The S2 page (docs/specs/vulcan-bench.md S2): today's numbers on all 10 seeds, seconds per seed-year and today's
// noise band, written by `npm run bench:vulcan -- --noise --jobs 3 --html <path>`. A fragment the Artifact host wraps;
// look from docs/UI_STYLE.md (Control room tokens, Plex faces, one 400 px column).
import { COLUMNS, FIRSTS, FLOOR_KEYS, HIGHER_IS_BETTER, NEVER, floorOf, type YearResult } from "./measure.ts";
import { HELD_OUT_SEEDS, NUDGE, TRAINING_SEEDS, type NoiseBand } from "./bench.ts";

export interface BenchData {
  commit: string;
  date: string;
  node: string;
  cpus: number;
  workers: number;
  wall: number;
  perYear: number;
  today: YearResult[];
  band?: NoiseBand;
  scales?: { food: number; firewood: number };
}

const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const LABEL: Record<string, string> = {
  alive: "alive",
  hungryDays: "hungry days",
  tiredDays: "tired days",
  coldDays: "cold days",
  crowdedDays: "crowded days",
  coldNotable: "cold alerts",
  notable: "alerts",
  minWarmth: "lowest warmth",
  minMood: "lowest mood",
  food: "food in store",
  fullDays: "full-store days",
  houses: "houses",
  days: "days",
  "tool.worn": "tool worn",
  "mine.shaftPlanned": "shaft planned",
  "mine.veinMined": "ore mined",
  "metal.smelted": "ingot smelted",
  "smithy.built": "smithy built",
  "smith.made": "tool made",
};
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
const role = (seed: string) =>
  (HELD_OUT_SEEDS as readonly string[]).includes(seed)
    ? "held out"
    : (TRAINING_SEEDS as readonly string[]).includes(seed)
      ? "training"
      : "";
const fmt = (c: string, v: unknown) => (c === "days" ? Number(v).toFixed(2) : v === Infinity ? "–" : esc(v));

const CSS = `
:root{--bg:#dfe2e4;--panel:#eef0f1;--ink:#22292e;--muted:#56616a;--line:#c9ced2;--edge:#b9c0c5;--level:#2b5d8a;--alert:#8a4f12;
--sans:"IBM Plex Sans",system-ui,sans-serif;--cond:"IBM Plex Sans Condensed","IBM Plex Sans",sans-serif;--mono:"IBM Plex Mono",monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1b2024;--panel:#242a2f;--ink:#e3e7ea;--muted:#9aa5ad;--line:#343c42;--edge:#3f484f;--level:#7fb0dc;--alert:#e0a35c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#1b2024;--panel:#242a2f;--ink:#e3e7ea;--muted:#9aa5ad;--line:#343c42;--edge:#3f484f;--level:#7fb0dc;--alert:#e0a35c;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font:400 15px/1.45 var(--sans)}
.vb{max-width:560px;margin:0 auto;padding-block:16px 32px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:12px}
.vb h1{font:600 22px/1.2 var(--cond);margin:0;text-wrap:balance}
.vb h2{font:600 18px/1.25 var(--cond);margin:8px 0 0}
.vb p{margin:0}
.sub,.note,.words{font-size:13px;color:var(--muted)}
.mono,td,.val{font-family:var(--mono);font-weight:500;font-variant-numeric:tabular-nums}
.reads{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.read{background:var(--panel);border:1px solid var(--line);border-radius:3px;padding:8px;min-width:0}
.read .k{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.read .val{font-size:20px;line-height:1.2}
.read .val small{font-size:13px;color:var(--muted)}
.scroll{overflow-x:auto;border:1px solid var(--edge);border-radius:3px;background:var(--panel)}
table{border-collapse:collapse;font-size:13px;width:100%}
th{font:600 13px/1.25 var(--sans);color:var(--muted);text-align:right;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:bottom}
td{text-align:right;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
tr:last-child td{border-bottom:0}
th:first-child,td:first-child{text-align:left;position:sticky;left:0;background:var(--panel)}
td.seed{font-family:var(--sans);font-weight:600}
td.seed span{display:block;font-weight:400;color:var(--muted);font-size:13px}
.off{color:var(--alert)}
details{border-top:1px solid var(--line);padding-top:4px}
summary{font-weight:600;min-height:44px;display:flex;align-items:center;cursor:pointer}
summary:focus-visible{outline:2px solid var(--level);outline-offset:2px}
details[open]>div{display:grid;gap:8px;padding-bottom:8px}
`;

export function benchPage(d: BenchData): string {
  const short = d.commit.slice(0, 7);
  const today = new Map(d.today.map((r) => [r.seed, r]));
  const order = [...HELD_OUT_SEEDS, ...TRAINING_SEEDS].filter((s) => today.has(s));
  for (const r of d.today) if (!order.includes(r.seed as never)) order.push(r.seed as never);
  const rows = order.map((s) => today.get(s)!);
  const cols = COLUMNS.filter((c) => c !== "seed" && c !== "days");
  const seedCell = (s: string) => `<td class="seed">${esc(s)}${role(s) ? `<span>${role(s)}</span>` : ""}</td>`;
  const yearTable = `<div class="scroll"><table><thead><tr><th>seed</th>${cols
    .map((c) => `<th>${LABEL[c]}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr>${seedCell(r.seed)}${cols
          .map((c) => `<td${c === "alive" && Number(r.row.alive) < 5 ? ' class="off"' : ""}>${fmt(c, r.row[c])}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
  const metalTable = `<div class="scroll"><table><thead><tr><th>seed</th>${FIRSTS.map(
    (f) => `<th>${LABEL[f]}</th>`,
  ).join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr>${seedCell(r.seed)}${FIRSTS.map((f) => `<td${r.firsts[f] ? "" : ' class="off"'}>${r.firsts[f] || "never"}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
  const b = d.band;
  const floorLabel = (k: string) => (k === "food" || k === "alive" ? LABEL[k] : `day ${LABEL[k]}`);
  const bandTable = b
    ? `<div class="scroll"><table><thead><tr><th>floor number</th><th>better is</th><th>change, min</th><th>change, max</th><th>worse by up to</th></tr></thead><tbody>${FLOOR_KEYS.map(
        (k) =>
          `<tr><td class="seed">${floorLabel(k)}</td><td>${HIGHER_IS_BETTER[k] ? "higher" : "lower"}</td><td>${signed(b.band[k].min)}</td><td>${signed(b.band[k].max)}</td><td>${b.worse[k]}</td></tr>`,
      ).join("")}</tbody></table></div>`
    : `<p class="note off">Noise band not measured in this run (run with --noise).</p>`;
  const runsTable = b
    ? `<div class="scroll"><table><thead><tr><th>seed, person nudged</th>${FLOOR_KEYS.map(
        (k) => `<th>${floorLabel(k)}</th>`,
      ).join("")}</tr></thead><tbody>${b.runs
        .map(
          (r) =>
            `<tr><td class="seed">${esc(r.seed)}<span>${esc(r.person.name)} (id ${r.person.id})</span></td>${FLOOR_KEYS.map(
              (k) =>
                `<td>${r.floor[k] === NEVER ? "never" : r.floor[k]} <span class="sub">(${signed(r.change[k])})</span></td>`,
            ).join("")}</tr>`,
        )
        .join("")}</tbody></table></div>`
    : "";
  const heldFloors = rows.filter((r) => role(r.seed) === "held out").map((r) => ({ seed: r.seed, f: floorOf(r) }));
  return `<title>Vulcan Bench Baseline</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans:wght@400;600&display=swap">
<style>${CSS}</style>
<main class="vb">
<h1>Vulcan today: one game year on every seed</h1>
<p class="sub">Vulcan <span class="mono">${short}</span> · measured ${esc(d.date)} · Phobos bench S2</p>
<p><strong>What you're seeing.</strong> Each of Vulcan's 10 map seeds ran one game year with today's colonist rules, nothing from Phobos changing them. These are the numbers a trained net will later have to match. The noise band shows how much the same numbers move when one colonist is nudged for a single day, so small differences later can be read as chance.</p>
<div class="reads">
<div class="read"><div class="k">per seed-year</div><div class="val">${d.perYear.toFixed(1)} <small>s</small></div></div>
<div class="read"><div class="k">seeds</div><div class="val">${rows.length}</div></div>
<div class="read"><div class="k">noise runs</div><div class="val">${b ? b.runs.length : 0}</div></div>
</div>
<h2>Year end, each seed</h2>
<p class="note">Days count person-days with the need below its warning line. Five people start; fewer alive is marked.</p>
${yearTable}
<h2>Metal chain, first day</h2>
<p class="note">The game day each step first happened. "never" counts as day ${NEVER} in the floor.</p>
${metalTable}
<h2>Today's noise band</h2>
<p class="note">On each held-out seed, ${NUDGE.people} more years, each adding ${NUDGE.add} (of 10,000) to one person's hunger line for day 1 only. Change is the nudged year minus today's year.</p>
${bandTable}
<p><strong>How it counts.</strong> Later, the net loses on a floor number only when it is more than 5% worse than today <em>and</em> worse by more than the band's "worse by up to". Alive must not drop at all.</p>
${
  b
    ? `<details><summary>The ${b.runs.length} nudged years</summary><div>${runsTable}<p class="note">Today's held-out values: ${heldFloors
        .map((h) => `${esc(h.seed)} food ${h.f.food}, alive ${h.f.alive}`)
        .join("; ")}.</p></div></details>`
    : ""
}
<details><summary>How it works</summary><div>
<p>The bench loads Vulcan's engine from a clean checkout at commit <span class="mono">${esc(d.commit)}</span> (the one in Phobos's <span class="mono">vulcan.pin</span>) and refuses any other. It steps each world 60 ticks (one game hour) at a time for 336 game days and reads the same entity tables as Vulcan's <span class="mono">npm run balance</span>, so every column here equals that tool's on the same seed.</p>
<p>The nudge goes through the line hook Vulcan gained in S1: for the first, second or third colonist by id, the food line (normally 5200) reads 6200 until the first game day ends, so that colonist eats a little earlier once. Vulcan's world is chaotic, so that one change spreads into a different year. The band is the smallest and largest change across all ${b ? b.runs.length : 0} runs, per number.</p>
<p>Timing: ${d.today.length + (b ? b.runs.length : 0)} seed-years in ${d.wall.toFixed(0)} s on ${d.workers} worker thread${d.workers === 1 ? "" : "s"} of ${d.cpus} CPUs, Node ${esc(d.node)}. "Per seed-year" is the mean of the ${d.today.length} today's-rule years, each timed on its own thread.</p>
${
  d.scales
    ? `<p>Store scales for the net's inputs (largest food and firewood in store per alive person in any hour, over the 5 training seeds, rounded up to 10): food <span class="mono">${d.scales.food}</span>, firewood <span class="mono">${d.scales.firewood}</span>.</p>`
    : ""
}
<p class="words">Words used here: seed, a map's starting value; held out, seeds kept back to judge the net, never trained on; line, the need level under which a colonist acts on it; floor, the numbers the net may not make worse (Phobos D-020, R9).</p>
</div></details>
</main>
`;
}
