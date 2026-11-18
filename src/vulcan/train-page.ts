// The S3 page (docs/specs/vulcan-bench.md S3): training score per generation for the line net and R10's table, the
// settings the sigma check picked, and the moment count on each held-out seed with example moments and their cause
// lines. Written by `npm run train:vulcan -- --html <path>` from models/vulcan/*.json. A fragment the Artifact host
// wraps; look from docs/UI_STYLE.md (Control room tokens, Plex faces, one 400 px column), as src/vulcan/page.ts.
import { HELD_OUT_SEEDS } from "./bench.ts";
import type { LogEntry } from "./train.ts";
import type { Moment, ShadowResult } from "./shadow.ts";

/** Spec S4: moments per held-out seed, in HELD_OUT_SEEDS order; a short seed passes the rest of its quota on. */
export const QUOTAS = [5, 5, 5, 5, 4] as const;

type Model = "net" | "table";
interface TrainLog {
  vulcan: string;
  sigma: number;
  alpha: number;
  workers: number;
  seconds: number;
  startSeconds: number;
  postSeconds: number;
  resumedFrom: number;
  log: LogEntry[];
}
interface SigmaFile {
  spread?: number;
  rows?: {
    sigma: number;
    alpha: number;
    differ: number;
    leads: number[];
    beats: number;
    final: number;
    qualifies: boolean;
  }[];
  pick?: { sigma: number; alpha: number } | null;
}
export interface TrainPageData {
  chance: { spread: number; deltas: number[]; pairs: number[][]; seconds: number } | null;
  sigma: Record<Model, SigmaFile | null>;
  logs: Record<Model, TrainLog | null>;
  moments: Record<Model, { seeds: ShadowResult[]; seconds: number } | null>;
}

/** Whether the held-out seeds meet the quotas (24 in all; a short seed passes the rest on to the next). */
export function quotaCheck(counts: number[]): { total: number; ok: boolean; carried: number[] } {
  let owe = 0;
  const carried: number[] = [];
  counts.forEach((n, i) => {
    const want = QUOTAS[i] + owe;
    owe = Math.max(0, want - n);
    carried.push(want);
  });
  const total = counts.reduce((a, b) => a + b, 0);
  return { total, ok: total >= 24 && owe === 0, carried };
}

const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
const hhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
const pct = (v: number) => `${Math.floor(v / 100)}%`;
const NAME: Record<Model, string> = { net: "line net", table: "season-and-trait table" };

const CSS = `
:root{--bg:#dfe2e4;--panel:#eef0f1;--ink:#22292e;--muted:#56616a;--line:#c9ced2;--edge:#b9c0c5;--level:#2b5d8a;--net:#6b4f8a;--alert:#8a4f12;
--sans:"IBM Plex Sans",system-ui,sans-serif;--cond:"IBM Plex Sans Condensed","IBM Plex Sans",sans-serif;--mono:"IBM Plex Mono",monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1b2024;--panel:#242a2f;--ink:#e3e7ea;--muted:#9aa5ad;--line:#343c42;--edge:#3f484f;--level:#7fb0dc;--net:#b39ddb;--alert:#e0a35c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#1b2024;--panel:#242a2f;--ink:#e3e7ea;--muted:#9aa5ad;--line:#343c42;--edge:#3f484f;--level:#7fb0dc;--net:#b39ddb;--alert:#e0a35c;color-scheme:dark}
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
.read.net .val{color:var(--net)}
.chart{background:var(--panel);border:1px solid var(--edge);border-radius:3px;padding:8px}
.chart svg{display:block;width:100%;height:auto}
.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:var(--muted)}
.legend i{display:inline-block;width:16px;height:2px;vertical-align:middle;margin-right:6px}
.scroll{overflow-x:auto;border:1px solid var(--edge);border-radius:3px;background:var(--panel)}
table{border-collapse:collapse;font-size:13px;width:100%}
th{font:600 13px/1.25 var(--sans);color:var(--muted);text-align:right;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:bottom}
td{text-align:right;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
tr:last-child td{border-bottom:0}
th:first-child,td:first-child{text-align:left;position:sticky;left:0;background:var(--panel)}
td.seed{font-family:var(--sans);font-weight:600}
td.seed span{display:block;font-weight:400;color:var(--muted);font-size:13px}
.off{color:var(--alert)}
.moment{background:var(--panel);border:1px solid var(--line);border-radius:3px;padding:12px;display:grid;gap:6px;min-width:0}
.moment .who{font-weight:600}
.moment .cause{font-family:var(--mono);font-size:13px;overflow-wrap:anywhere}
.moment .cause b{font-family:var(--sans);font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-size:13px;margin-right:6px}
.did{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:13px}
.did dt{color:var(--muted)}.did dd{margin:0;font-family:var(--mono)}
.did dd.n{color:var(--net)}
details{border-top:1px solid var(--line);padding-top:4px}
summary{font-weight:600;min-height:44px;display:flex;align-items:center;cursor:pointer}
summary:focus-visible{outline:2px solid var(--level);outline-offset:2px}
details[open]>div{display:grid;gap:8px;padding-bottom:8px}
`;

/** θ's score minus today's on the same windows, per step (step g = θ after g generations). */
const steps = (l: TrainLog) => l.log.map((e) => ({ step: e.generation - 1, d: e.theta.raw - e.today, e }));

function chart(logs: TrainPageData["logs"]): string {
  const series = (["net", "table"] as const).filter((m) => logs[m]).map((m) => ({ m, pts: steps(logs[m]!) }));
  if (!series.length) return `<p class="note off">No training log yet.</p>`;
  const W = 520,
    H = 220,
    L = 52,
    R = 12,
    T = 12,
    B = 30;
  const all = series.flatMap((s) => s.pts.map((p) => p.d));
  let lo = Math.min(0, ...all),
    hi = Math.max(0, ...all);
  if (lo === hi) hi = lo + 1000;
  const span = hi - lo;
  const tick = [500, 1000, 2000, 5000, 10000, 20000, 50000].find((t) => span / t <= 6) ?? 100000;
  lo = Math.floor(lo / tick) * tick;
  hi = Math.ceil(hi / tick) * tick;
  const maxStep = Math.max(...series.flatMap((s) => s.pts.map((p) => p.step)), 1);
  const x = (s: number) => L + (s / maxStep) * (W - L - R);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const grid: string[] = [];
  for (let v = lo; v <= hi; v += tick)
    grid.push(
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="${v === 0 ? 0 : 1}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" fill="var(--muted)" font-size="12" font-family="var(--mono)">${signed(v)}</text>`,
    );
  const xt: string[] = [];
  for (let s = 0; s <= maxStep; s += maxStep > 20 ? 10 : 1)
    xt.push(
      `<text x="${x(s)}" y="${H - 10}" text-anchor="middle" fill="var(--muted)" font-size="12" font-family="var(--mono)">${s}</text>`,
    );
  const colour = { net: "var(--net)", table: "var(--ink)" };
  const lines = series
    .map(({ m, pts }) => {
      const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.step).toFixed(1)},${y(p.d).toFixed(1)}`).join("");
      const dots = pts
        .map(
          (p) =>
            `<circle cx="${x(p.step).toFixed(1)}" cy="${y(p.d).toFixed(1)}" r="6" fill="transparent"><title>${NAME[m]}, after ${p.step} generations: ${p.e.theta.raw} (today ${p.e.today}, ${p.e.theta.crisis} crisis days)</title></circle>`,
        )
        .join("");
      const last = pts[pts.length - 1];
      return `<path d="${d}" fill="none" stroke="${colour[m]}" stroke-width="2" stroke-linejoin="round"${m === "table" ? ' stroke-dasharray="5 3"' : ""}/><circle cx="${x(last.step)}" cy="${y(last.d)}" r="4" fill="${colour[m]}"/>${dots}`;
    })
    .join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Score minus today's score per generation">${grid.join("")}
<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--muted)" stroke-width="1.5"/>
<text x="${W - R}" y="${y(0) - 5}" text-anchor="end" fill="var(--muted)" font-size="12" font-family="var(--sans)">today = 0</text>
${xt.join("")}${lines}</svg>
<div class="legend">${series.map(({ m }) => `<span><i style="background:${colour[m]}"></i>${NAME[m]}</span>`).join("")}<span>across: generations · up: worse than today</span></div></div>`;
}

function sigmaTable(m: Model, s: SigmaFile | null): string {
  if (!s?.rows) return `<p class="note off">The ${NAME[m]}'s sigma check has not run.</p>`;
  return `<div class="scroll"><table><thead><tr><th>${NAME[m]}: noise, step</th><th>differ at gen 1</th><th>lead over today, gens 1–5</th><th>beats chance</th><th>final lead</th></tr></thead><tbody>${s.rows
    .map((r) => {
      const picked = s.pick && s.pick.sigma === r.sigma && s.pick.alpha === r.alpha;
      return `<tr><td class="seed">${r.sigma}, ${r.alpha}${picked ? "<span>picked</span>" : r.qualifies ? "<span>qualifies</span>" : ""}</td><td${r.differ < 0.5 ? ' class="off"' : ""}>${Math.round(r.differ * 100)}%</td><td>${r.leads.map(signed).join(" ")}</td><td>${r.beats} of ${r.leads.length}</td><td>${signed(r.final)}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}

function momentsTable(mo: TrainPageData["moments"]): string {
  const net = mo.net?.seeds;
  if (!net) return `<p class="note off">The shadow years have not run.</p>`;
  const by = (r: ShadowResult[] | undefined, seed: string) => r?.find((x) => x.seed === seed);
  const counts = HELD_OUT_SEEDS.map((s) => by(net, s)?.moments.length ?? 0);
  const q = quotaCheck(counts);
  const tableSeeds = mo.table?.seeds;
  return `<div class="scroll"><table><thead><tr><th>held-out seed</th><th>moments, net</th><th>quota</th><th>person-hours checked</th>${tableSeeds ? "<th>moments, table</th>" : ""}</tr></thead><tbody>${HELD_OUT_SEEDS.map(
    (s, i) => {
      const r = by(net, s);
      return `<tr><td class="seed">${s}</td><td${counts[i] < q.carried[i] ? ' class="off"' : ""}>${counts[i]}</td><td>${q.carried[i]}</td><td>${r?.candidates ?? "–"}</td>${tableSeeds ? `<td>${by(tableSeeds, s)?.moments.length ?? "–"}</td>` : ""}</tr>`;
    },
  ).join(
    "",
  )}<tr><td class="seed">all</td><td${q.ok ? "" : ' class="off"'}>${q.total}</td><td>24</td><td>${net.reduce((a, r) => a + r.candidates, 0)}</td>${tableSeeds ? `<td>${tableSeeds.reduce((a, r) => a + r.moments.length, 0)}</td>` : ""}</tr></tbody></table></div>
<p class="note">${q.ok ? "Enough moments for S4's 24 blind pairs." : `<span class="off">Short of S4's quotas: stop and decide with Morgan.</span>`}</p>`;
}

/** Up to 3 examples: the first moment of the first 3 held-out seeds that have one, each a different person. */
export function examples(seeds: ShadowResult[]): Moment[] {
  const out: Moment[] = [];
  for (const s of HELD_OUT_SEEDS) {
    const r = seeds.find((x) => x.seed === s);
    const m = r?.moments.find((x) => x.clock.hour >= 6 && x.clock.hour < 22) ?? r?.moments[0];
    if (m && out.length < 3) out.push(m);
  }
  return out;
}

const momentCard = (m: Moment) => `<div class="moment">
<div class="who">${esc(m.person.name)} <span class="sub">(${m.traits.map(esc).join(", ") || "no traits"}), ${esc(m.seed)}</span></div>
<div class="sub mono">${esc(m.clock.season)} day ${m.clock.day} ${hhmm(m.clock.hour, m.clock.minute)} · food ${pct(m.needs.food)}, water ${pct(m.needs.water)}, rest ${pct(m.needs.rest)}, warmth ${pct(m.needs.warmth)}, recreation ${pct(m.needs.recreation)} · store food ${m.stores.food}, firewood ${m.stores.firewood} each</div>
<dl class="did"><dt>today's rule</dt><dd>${esc(m.today || "idle")} (${esc(m.line)} line ${m.todayLine})</dd><dt>with the net</dt><dd class="n">${esc(m.policy || "idle")} (${esc(m.line)} line ${m.policyLine})</dd></dl>
<div class="cause"><b>net's reading</b>${esc(m.cause)}</div>
</div>`;

export function trainPage(d: TrainPageData): string {
  const net = d.logs.net,
    table = d.logs.table;
  const last = (l: TrainLog | null) => (l ? l.log[l.log.length - 1] : null);
  const ln = last(net),
    lt = last(table);
  const vulcan = net?.vulcan ?? table?.vulcan ?? "";
  const mins = (l: TrainLog | null) => (l ? `${Math.round(l.seconds / 60)} min` : "–");
  const ex = d.moments.net ? examples(d.moments.net.seeds) : [];
  const counts = d.moments.net
    ? HELD_OUT_SEEDS.map((s) => d.moments.net!.seeds.find((x) => x.seed === s)?.moments.length ?? 0)
    : [];
  return `<title>Vulcan Line Net Training</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans:wght@400;600&display=swap">
<style>${CSS}</style>
<main class="vb">
<h1>Training the line net</h1>
<p class="sub">Vulcan <span class="mono">${esc(vulcan.slice(0, 7))}</span> · Phobos bench S3</p>
<p><strong>What you're seeing.</strong> A small net learned when each colonist should start eating, drinking, sleeping, relaxing or warming up, by moving their personal lines up or down. A plain table that moves lines only by season and trait learned the same way, as a rival. Each was scored on month-long stretches of the 5 training maps: fewer days spent hungry, tired or cold is better, as long as food and work stay at 95% of today's. Then the net watched a year on each of the 5 held-out maps and we counted the moments it would have done something different.</p>
<div class="reads">
<div class="read net"><div class="k">net, final</div><div class="val">${ln ? ln.theta.raw : "–"}</div></div>
<div class="read"><div class="k">table, final</div><div class="val">${lt ? lt.theta.raw : "–"}</div></div>
<div class="read"><div class="k">today, same</div><div class="val">${ln ? ln.today : lt ? lt.today : "–"}</div></div>
</div>
<p class="note">Final score: the trained rule on one more pair of month windows, the same pair for both; today's rule on that pair beside it. Lower is better: 1000 per crisis day, plus up to 1000 when food or work fall behind today.</p>
<h2>Score per generation</h2>
<p class="note">Each generation is scored on a new pair of windows, so the chart shows the score minus today's score on the same pair. Below the line is better than today.</p>
${chart(d.logs)}
<h2>Moments on the held-out maps</h2>
<p class="note">A moment is a minute where the net's lines would have made a colonist do something else than today's rule does. S4 turns ${QUOTAS.join(", ")} of them per map into blind pairs.</p>
${momentsTable(d.moments)}
${ex.length ? `<h2>Three moments</h2><p class="note">The cause line is the net's own reading: the two inputs that move this line most when set to nothing. It is not Vulcan's explanation.</p>${ex.map(momentCard).join("")}` : ""}
<h2>Settings picked</h2>
<p class="note">Before the full run, each rule tried 3 noise sizes and 2 step sizes for 5 generations. Chance alone (one colonist nudged for a day) moved a pair's score by up to <span class="mono">${d.chance ? d.chance.spread : "–"}</span>. The pick is the smallest noise where at least half the tries play out differently from today and the best try beats chance in most generations.</p>
${sigmaTable("net", d.sigma.net)}
${sigmaTable("table", d.sigma.table)}
<details><summary>Every generation</summary><div>${(["net", "table"] as const)
    .filter((m) => d.logs[m])
    .map(
      (m) =>
        `<div class="scroll"><table><thead><tr><th>${NAME[m]}: gen</th><th>windows</th><th>today</th><th>θ</th><th>mean</th><th>best</th><th>differ</th></tr></thead><tbody>${d.logs[
          m
        ]!.log.map(
          (e) =>
            `<tr><td>${e.generation}</td><td>${e.windows.join(", ")}</td><td>${e.today}</td><td${e.theta.penalised ? ' class="off"' : ""}>${e.theta.raw}</td><td>${e.mean === undefined ? "" : e.mean.toFixed(0)}</td><td>${e.best ?? ""}</td><td>${e.differ === undefined ? "" : `${Math.round(e.differ * 100)}%`}</td></tr>`,
        ).join("")}</tbody></table></div>`,
    )
    .join("")}</div></details>
<details><summary>How it works</summary><div>
<p>The net reads 26 numbers per colonist once per game hour: five needs, what they are doing, the hour and whether it is inside work hours, the season, food and firewood in store per person, and ten traits. It has 16 hidden units and 5 outputs, all in integer maths. Each output moves one line by at most 1000 of 10,000 either way (food's line is 5200 today, water 5500, rest 2500, recreation 3500; warmth depends on the person). It started with its last layer at zero, which is exactly today's rule.</p>
<p>Training is an evolution strategy: each generation makes 16 pairs of opposite random changes, runs each on the same 2 month windows (28 game days, cloned from today's years on ledger, gwerin, harrow, cairn and ashford), ranks them and steps toward the better ones. Score = 1000 × crisis days (person-days with food, rest or warmth under its warning line) + (1000 − r), where r is the lower of food in store and hours worked as per mille of today's, at most 999. Under 950 it is penalised past every unharmful try. The table has 70 numbers (a line offset per season and per trait, for each of the 5 lines) and was trained by the same loop.</p>
<p>Runs: net ${net ? `noise ${net.sigma}, step ${net.alpha}, ${net.log.length - 1} generations, ${mins(net)} on ${net.workers} threads` : "not run"}; table ${table ? `noise ${table.sigma}, step ${table.alpha}, ${table.log.length - 1} generations, ${mins(table)} on ${table.workers} threads` : "not run"}. Shadow years: ${d.moments.net ? `${Math.round(d.moments.net.seconds / 60)} min for 5 maps` : "not run"}${counts.length ? ` (${counts.join(", ")} moments)` : ""}.</p>
<p class="words">Words used here: line, the need level under which a colonist acts on it; window, 28 game days from a month start; crisis day, a person-day spent under a warning line; held out, maps kept back to judge the net, never trained on; shadow year, a year under today's rule where the net only watches.</p>
</div></details>
</main>
`;
}
