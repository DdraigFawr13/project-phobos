// Lab: the Live tab (S1, the tank under the fixed PI), the Fixed test tab (S2), the Tables tab (S3) and the
// Integer vs float tab (S4), and the Net (S5) and Replay (S6) tabs when the build inlined models/lab/. Each view reads one model
// (live.state, fixedTest, the committed tables, the integer-vs-float comparison, the inlined weights) and nothing
// else (SIM-01).
import { createLive, SETPOINT, HISTORY_S, type Sample } from "../sim/live.ts";
import { SEGMENTS, fixedTestRuns, type FixedTestResult, type Progress } from "../sim/fixed-test.ts";
import { EXPLAIN, explainHtml } from "./explain.ts";
import { TANH, EXP } from "../num/tables.gen.ts";
import { tanhQ, expQ } from "../num/act.ts";
import { tableErrors, type TableError } from "../num/table-errors.ts";
import { checkStates } from "../sim/check-states.ts";
import { compareNets, type Comparison } from "../ref/agreement.ts";
import { forward } from "../runtime/net.ts";
import { forwardRef } from "../ref/dense.ts";
import { labShapedNet, valveOf, valveOfRef } from "../model/nets.ts";
import { netPanel, type LabModels } from "./net-panel.ts";
import { replayPanel, type ReplayModels } from "./replay-panel.ts";

/** models/lab/*.json, inlined by scripts/build-lab.ts; null when the build had no models/lab/. */
declare const __LAB_MODELS__: (LabModels & ReplayModels) | null;

const SPEED = 10; // simulated seconds per real second (spec "Lab")
const MAX_SIM_S_PER_FRAME = 30; // cap catch-up after the tab was hidden

const live = createLive({ seed: 1, level: 1.0, setpoint: 1.0 });
let paused = false;
let lastDisturbEnd: number | null = null;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const tok = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// The Net tab exists only when models/lab/ was inlined; esbuild drops netPanel when __LAB_MODELS__ is null.
const NET = __LAB_MODELS__ ? netPanel(__LAB_MODELS__, { live, $, tok }) : null;
const TABS: (readonly [string, string])[] = [
  ["live", "Live"],
  ["fixed", "Fixed test"],
  ["tables", "Tables"],
  ["ivf", "Integer vs float"],
];
const REPLAY = __LAB_MODELS__ ? replayPanel(__LAB_MODELS__, { $, tok }) : null;
if (NET) TABS.push(NET.tab);
if (REPLAY) TABS.push(REPLAY.tab);
type Tab = string;

// The Fixed test model: idle, running (with progress) or done. The live tank keeps running meanwhile.
type FixedTest = { phase: "idle" } | { phase: "running"; at: Progress } | { phase: "done"; result: FixedTestResult };
let fixedTest: FixedTest = { phase: "idle" };
const RUN_BUDGET_MS = 12; // runs per frame stop after this, so the page keeps drawing on a slow phone

function mount() {
  const ex = explainHtml(EXPLAIN.live),
    fx = explainHtml(EXPLAIN.fixed),
    tx = explainHtml(EXPLAIN.tables),
    ix = explainHtml(EXPLAIN.ivf);
  $("#app").innerHTML = `
    <div class="lhead"><h1>Phobos Lab</h1><span class="chip" id="chip"></span></div>
    <div class="tabs" role="tablist" aria-label="Lab tabs">${TABS.map(
      ([id, name], i) =>
        `<button class="tab" type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${name}</button>`,
    ).join("")}</div>
    <section class="panel" id="panel-live" data-panel="live" role="tabpanel" aria-labelledby="tab-live">
      ${ex.what}
      <div class="reads">
        <div class="rd lvl"><small>Level</small><b id="r-level"></b></div>
        <div class="rd"><small>Setpoint</small><b id="r-sp"></b></div>
        <div class="rd"><small>Valve 0–1</small><b id="r-valve"></b></div>
      </div>
      <canvas id="chart" role="img" aria-label="Water level, setpoint and valve opening over the last 600 seconds"></canvas>
      <div class="key"><span><i class="k-level"></i>water level, m</span><span><i class="k-sp"></i>setpoint (dashed)</span><span><i class="k-valve"></i>valve opening, 0 shut to 1 open, drawn double (0.5 sits on the 1.0 line)</span><span><i class="k-dist"></i>disturbance</span></div>
      <div class="ctl"><label for="sp">Setpoint <span id="sp-val"></span></label>
        <input id="sp" type="range" min="${SETPOINT.min}" max="${SETPOINT.max}" step="${SETPOINT.step}" value="${live.state.setpoint}"></div>
      <div class="row"><button class="btn" id="dist" type="button" aria-pressed="false">Disturbance</button></div>
      <p class="status" id="status" aria-live="polite"></p>
      ${ex.after}
    </section>
    <section class="panel" id="panel-fixed" data-panel="fixed" role="tabpanel" aria-labelledby="tab-fixed" hidden>
      ${fx.what}
      <div class="row"><button class="btn" id="ft-run" type="button">Run fixed test</button><span class="note">5 tests, each 300 s, 5 runs each</span></div>
      <div id="ft-out"></div>
      <p class="status" id="ft-status" aria-live="polite"></p>
      ${fx.after}
    </section>
    <section class="panel" id="panel-tables" data-panel="tables" role="tabpanel" aria-labelledby="tab-tables" hidden>
      ${tx.what}
      <canvas id="tchart" role="img" aria-label="tanh and exp from the integer tables drawn over the exact curves, inputs −8 to 8"></canvas>
      <div class="key"><span><i class="k-sp"></i>read from the table</span><span><i class="k-valve"></i>exact curve (dashed)</span><span>input −8 to +8 across, answer −1 to 1 up</span></div>
      <p class="note">Five of the 1,025 saved points. Each number is the curve's height × 4,096, so 4096 means 1.0.</p>
      <table id="t-entries"><tr><th>Input</th><th class="num">tanh(input)</th><th class="num">exp(−input)</th></tr>${ENTRY_ROWS.map(
        (i) =>
          `<tr data-i="${i}"><td class="mono">${i / 128}</td><td class="num">${TANH[i]}</td><td class="num">${EXP[i]}</td></tr>`,
      ).join("")}</table>
      <table id="t-gaps"><tr><th>Worst miss, all 65,536 inputs</th><th class="num">Steps off</th><th class="num">% of height</th><th></th></tr>
        <tr data-f="tanh"><td>tanh table</td><td class="num"></td><td class="num"></td><td></td></tr>
        <tr data-f="exp"><td>exp table</td><td class="num"></td><td class="num"></td><td></td></tr></table>
      <p class="status" id="t-status">A step is 1/4,096, the smallest change these whole numbers can make. A table passes if it never misses the exact curve by more than ${GAP_LIMIT} steps.</p>
      ${tx.after}
    </section>
    <section class="panel" id="panel-ivf" data-panel="ivf" role="tabpanel" aria-labelledby="tab-ivf" hidden>
      ${ix.what}
      <table id="ivf-checks"><tr><th>Check, 1,000 situations</th><th class="num">Result</th><th class="num">Limit</th><th></th></tr>${IVF_ROWS.map(
        (r) =>
          `<tr data-c="${r.id}"><td>${r.label}</td><td class="num"></td><td class="num">${r.limit}</td><td></td></tr>`,
      ).join("")}</table>
      <canvas id="ivfchart" role="img" aria-label="Lab-shaped net valve over the 1,000 situations, whole numbers drawn over decimal maths"></canvas>
      <div class="key"><span><i class="k-sp"></i>valve, whole numbers</span><span><i class="k-valve"></i>valve, decimal maths (dashed)</span><span>1,000 situations across, valve opening up</span></div>
      <p class="status" id="ivf-status"></p>
      ${ix.after}
    </section>${NET ? NET.html : ""}${REPLAY ? REPLAY.html : ""}`;
  const tabs = [...document.querySelectorAll<HTMLButtonElement>(".tab")];
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => showTab(TABS[i][0]));
    b.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus();
      showTab(TABS[tabs.indexOf(next)][0]);
    });
  });
  $("#ft-run").addEventListener("click", startFixedTest);
  const sp = $<HTMLInputElement>("#sp");
  sp.addEventListener("input", () => {
    live.setSetpoint(+sp.value);
    render();
  });
  $("#dist").addEventListener("click", () => {
    live.disturb();
    render();
  });
  NET?.mount(render);
  REPLAY?.mount(render);
}

function showTab(id: Tab) {
  for (const [t] of TABS) {
    const on = t === id,
      b = $(`#tab-${t}`);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
    $(`#panel-${t}`).hidden = !on;
  }
  if (id === "tables") renderTables();
  if (id === "ivf") renderIvf();
  if (id === "net") NET?.fillSummary();
  if (id === "replay") REPLAY?.opened();
  render();
}

// The Tables model: the committed tables, plus their largest gaps measured once when the tab first opens.
const ENTRY_ROWS = [0, 128, 256, 512, 1024];
const GAP_LIMIT = 2; // LSB, spec S3
let gaps: { tanh: TableError; exp: TableError } | null = null;

function renderTables() {
  gaps ??= tableErrors();
  for (const f of ["tanh", "exp"] as const) {
    const g = gaps[f],
      td = document.querySelectorAll(`#t-gaps [data-f="${f}"] td`);
    td[1].textContent = String(g.lsb);
    td[2].textContent = `${g.pct.toFixed(3)}%`;
    td[3].textContent = g.lsb <= GAP_LIMIT ? "pass" : "fail";
    td[3].className = g.lsb <= GAP_LIMIT ? "pass" : "fail";
  }
  const c = $<HTMLCanvasElement>("#tchart"),
    dpr = window.devicePixelRatio || 1,
    W = c.clientWidth,
    H = c.clientHeight;
  if (!W || !H) return;
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = c.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = tok("--panel");
  g.fillRect(0, 0, W, H);
  const mid = H / 2,
    X = (x: number) => 8 + ((W - 16) * (x + 8)) / 16,
    Y = (y: number) => mid - (mid - 14) * y;
  g.strokeStyle = tok("--line");
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(8, mid);
  g.lineTo(W - 8, mid);
  g.moveTo(X(0), 8);
  g.lineTo(X(0), H - 8);
  g.stroke();
  const q = (x: number) => Math.max(-32768, Math.min(32767, Math.round(x * 4096)));
  const curve = (f: (x: number) => number, col: string, w: number, dash: number[] = []) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.setLineDash(dash);
    g.beginPath();
    for (let k = 0; k <= 320; k++) {
      const x = -8 + k * 0.05,
        y = f(x);
      k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y));
    }
    g.stroke();
    g.setLineDash([]);
  };
  curve((x) => tanhQ(q(x)) / 4096, tok("--ink"), 3);
  curve(Math.tanh, tok("--valve"), 1.25, [4, 3]);
  curve((x) => expQ(q(x)) / 4096, tok("--ink"), 3);
  curve((x) => Math.exp(Math.min(0, x)), tok("--valve"), 1.25, [4, 3]);
  g.font = "13px 'IBM Plex Mono', monospace";
  g.fillStyle = tok("--muted");
  g.textBaseline = "middle";
  g.textAlign = "left";
  g.fillText("tanh", X(3), Y(1) + 14);
  g.fillText("exp", X(-6), Y(0) - 14);
  g.fillText("−8", 10, mid + 12);
  g.textAlign = "right";
  g.fillText("+8", W - 10, mid + 12);
}

// The Integer vs float model: the check states and both nets compared on them, computed once when the tab opens.
type IvfRow = {
  id: string;
  label: string;
  limit: string;
  value: (c: Comparison) => number;
  text: (v: number) => string;
  pass: (v: number) => boolean;
};
const pct = (d: number) => (v: number) => `${v.toFixed(d)}%`;
const IVF_ROWS: IvfRow[] = [
  {
    id: "t1",
    label: "Test net, layer 1 gap (4→16)",
    limit: "1%",
    value: (c) => c.testNet.layerGaps[0],
    text: pct(3),
    pass: (v) => v < 1,
  },
  {
    id: "t2",
    label: "Test net, layer 2 gap (16→5)",
    limit: "1%",
    value: (c) => c.testNet.layerGaps[1],
    text: pct(3),
    pass: (v) => v < 1,
  },
  {
    id: "same",
    label: "Test net, same choice of action",
    limit: "≥ 99%",
    value: (c) => c.testNet.samePct,
    text: pct(1),
    pass: (v) => v >= 99,
  },
  {
    id: "l1",
    label: "Lab-shaped net, layer 1 gap (4→16)",
    limit: "1%",
    value: (c) => c.labNet.layerGaps[0],
    text: pct(3),
    pass: (v) => v < 1,
  },
  {
    id: "l2",
    label: "Lab-shaped net, layer 2 gap (16→1)",
    limit: "1%",
    value: (c) => c.labNet.layerGaps[1],
    text: pct(3),
    pass: (v) => v < 1,
  },
  {
    id: "valve",
    label: "Lab-shaped net, valve within 0.01",
    limit: "≥ 99%",
    value: (c) => c.labNet.withinPct,
    text: pct(1),
    pass: (v) => v >= 99,
  },
];
let ivf: { states: Int16Array[]; c: Comparison } | null = null;

function renderIvf() {
  if (!ivf) {
    const states = checkStates();
    ivf = { states, c: compareNets(states) };
  }
  const { states, c } = ivf;
  for (const r of IVF_ROWS) {
    const v = r.value(c),
      ok = r.pass(v),
      td = document.querySelectorAll(`#ivf-checks [data-c="${r.id}"] td`);
    td[1].textContent = r.text(v);
    td[3].textContent = ok ? "pass" : "fail";
    td[3].className = ok ? "pass" : "fail";
  }
  const vals = c.labNet.series.flat(),
    lo = Math.floor(Math.min(...vals) * 20) / 20,
    hi = Math.ceil(Math.max(...vals) * 20) / 20;
  $("#ivf-status").textContent =
    `Biggest valve gap: ${c.labNet.maxGap.toFixed(4)} (allowed 0.01). The random net's valve stays between ${lo.toFixed(2)} and ${hi.toFixed(2)}, so the chart shows only that band.`;
  const chosen = c.testNet.counts
    .map((n, a) => [a, n])
    .filter(([, n]) => n > 0)
    .map(([a, n]) => `action ${a} in ${n}`);
  $("#ivf-actions").textContent =
    `Here the whole-number test net picks ${chosen.join(" and ")} of the 1,000 situations.`;
  // worked example: the first check state through the Lab-shaped net, both ways
  const x = states[0],
    net = labShapedNet(),
    y = forward(net, x).at(-1)![0],
    yf = forwardRef(
      net,
      [...x].map((v) => v / 4096),
    ).at(-1)![0];
  const vi = valveOf(y),
    vf = valveOfRef(yf),
    neg = (t: string) => t.replace("-", "−"),
    f3 = (v: number) => neg((v / 4096).toFixed(3));
  $("#ivf-example").innerHTML =
    `situation: setpoint ${f3(x[0])} m, level ${f3(x[1])} m, error ${f3(x[2])} m, error so far ${f3(x[3])}<br>as whole numbers (× 4,096): ${[...x].map((v) => neg(String(v))).join(", ")}<br>whole numbers: output ${neg(String(y))}, valve = (5 × ${neg(String(y))} + 16384) ÷ 32768 = ${vi.toFixed(4)}<br>decimal maths: output ${neg(yf.toFixed(4))}, valve = (1.25 × ${neg(yf.toFixed(4))} + 1) ÷ 2 = ${vf.toFixed(4)}<br>gap ${Math.abs(vi - vf).toFixed(4)}, allowed 0.01`;
  const cv = $<HTMLCanvasElement>("#ivfchart"),
    dpr = window.devicePixelRatio || 1,
    W = cv.clientWidth,
    H = cv.clientHeight;
  if (!W || !H) return;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const g = cv.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = tok("--panel");
  g.fillRect(0, 0, W, H);
  const n = c.labNet.series.length,
    x0 = 44,
    x1 = W - 8,
    y0 = 10,
    y1 = H - 10;
  const X = (i: number) => x0 + ((x1 - x0) * i) / (n - 1),
    Y = (v: number) => y1 - ((y1 - y0) * (v - lo)) / (hi - lo);
  g.strokeStyle = tok("--line");
  g.lineWidth = 1;
  for (let k = 0; k <= 5; k++) {
    const xx = X((k * (n - 1)) / 5);
    g.beginPath();
    g.moveTo(xx, y0);
    g.lineTo(xx, y1);
    g.stroke();
  }
  g.font = "13px 'IBM Plex Mono', monospace";
  g.fillStyle = tok("--muted");
  g.textBaseline = "middle";
  g.textAlign = "right";
  g.fillText(hi.toFixed(2), x0 - 4, Y(hi));
  g.fillText(lo.toFixed(2), x0 - 4, Y(lo));
  const line = (k: 0 | 1, col: string, w: number, dash: number[] = []) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.setLineDash(dash);
    g.beginPath();
    c.labNet.series.forEach((p, i) => (i ? g.lineTo(X(i), Y(p[k])) : g.moveTo(X(i), Y(p[k]))));
    g.stroke();
    g.setLineDash([]);
  };
  line(0, tok("--ink"), 3);
  line(1, tok("--valve"), 1.25, [4, 3]);
}

function startFixedTest() {
  if (fixedTest.phase === "running") return;
  const runs = fixedTestRuns(SEGMENTS.training);
  const first = runs.next() as IteratorYieldResult<Progress>;
  fixedTest = { phase: "running", at: first.value };
  renderFixed();
  const work = () => {
    const t0 = performance.now();
    for (;;) {
      const r = runs.next();
      if (r.done) {
        fixedTest = { phase: "done", result: r.value };
        renderFixed();
        return;
      }
      fixedTest = { phase: "running", at: r.value };
      if (performance.now() - t0 > RUN_BUDGET_MS) break;
    }
    renderFixed();
    requestAnimationFrame(work);
  };
  requestAnimationFrame(work);
}

function renderFixed() {
  const btn = $<HTMLButtonElement>("#ft-run"),
    out = $("#ft-out"),
    st = $("#ft-status");
  const tryit = $("#panel-fixed .try");
  btn.disabled = fixedTest.phase === "running";
  tryit.hidden = fixedTest.phase !== "done";
  if (fixedTest.phase === "idle") {
    btn.textContent = "Run fixed test";
    out.innerHTML = `<div class="empty">Runs the five tests with the PI tuned once and with a PI retuned for each test, and shows an error score per test. Takes a moment.</div>`;
    st.textContent = "";
    return;
  }
  if (fixedTest.phase === "running") {
    const { segment, run, name } = fixedTest.at;
    btn.textContent = "Running…";
    out.innerHTML = "";
    st.textContent = `Test ${segment + 1} of ${SEGMENTS.training.length} (${name}), run ${run + 1} of 5.`;
    return;
  }
  const { rows, total } = fixedTest.result;
  const max = Math.max(...rows.flatMap((r) => [r.fixed.iae, r.retuned.iae]));
  const w = (v: number) => `${((70 * v) / max).toFixed(1)}%`;
  btn.textContent = "Run again";
  out.innerHTML = `<div class="ft">
    <div class="key"><span><i class="k-fixed"></i>PI tuned once for 1.00 m</span><span><i class="k-ret"></i>PI retuned for each test</span><span>error score, m·s</span></div>
    <div class="bars" id="ft-bars">${rows
      .map(
        (r) => `<div class="bar" data-seg="${r.name}"><span class="nm">${r.name}</span><div class="pair">
      <div class="v"><i class="f" style="width:${w(r.fixed.iae)}"></i><span data-k="fixed">${r.fixed.iae.toFixed(2)} m·s</span></div>
      <div class="v"><i class="r" style="width:${w(r.retuned.iae)}"></i><span data-k="retuned">${r.retuned.iae.toFixed(2)} m·s</span></div></div></div>`,
      )
      .join("")}</div>
    <table><tr><th>Valve movement</th><th class="num">Tuned once</th><th class="num">Retuned</th></tr>${rows
      .map(
        (r) =>
          `<tr><td>${r.name}</td><td class="num">${r.fixed.travel.toFixed(2)}</td><td class="num">${r.retuned.travel.toFixed(2)}</td></tr>`,
      )
      .join("")}
      <tr><td><b>Total</b></td><td class="num">${total.fixed.travel.toFixed(2)}</td><td class="num">${total.retuned.travel.toFixed(2)}</td></tr></table></div>`;
  st.textContent = `Total error score: tuned once ${total.fixed.iae.toFixed(2)} m·s, retuned ${total.retuned.iae.toFixed(2)} m·s.`;
}

/** The live chart; two = draw the net tank beside the PI tank and the net tank's level line (Net tab). */
function drawChart(
  c: HTMLCanvasElement,
  hist: Sample[],
  now: { level: number; setpoint: number; net: { level: number } | null },
  t: number,
  two = false,
) {
  const dpr = window.devicePixelRatio || 1,
    W = c.clientWidth,
    H = c.clientHeight;
  if (!W || !H) return;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
  }
  const g = c.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = tok("--panel");
  g.fillRect(0, 0, W, H);
  const t1 = Math.max(HISTORY_S, t),
    t0 = t1 - HISTORY_S;
  const x0 = 72,
    x1 = W - 8,
    y0 = 8,
    y1 = H - 22;
  const X = (s: number) => x0 + ((x1 - x0) * (s - t0)) / HISTORY_S,
    Y = (m: number) => y1 - ((y1 - y0) * m) / 2;
  g.font = "13px 'IBM Plex Mono', monospace";
  g.textBaseline = "middle";
  // disturbance bands
  g.fillStyle = tok("--dist");
  for (let i = 1; i < hist.length; i++)
    if (hist[i - 1].disturbed) g.fillRect(X(hist[i - 1].t), y0, X(hist[i].t) - X(hist[i - 1].t) + 0.5, y1 - y0);
  // grid
  g.strokeStyle = tok("--line");
  g.lineWidth = 1;
  g.fillStyle = tok("--muted");
  for (let m = 0; m <= 2; m += 0.5) {
    g.beginPath();
    g.moveTo(x0, Y(m));
    g.lineTo(x1, Y(m));
    g.stroke();
    g.textAlign = "right";
    g.fillText(m.toFixed(1), x0 - 4, Y(m));
  }
  for (let s = Math.ceil(t0 / 200) * 200; s < t1; s += 200) {
    g.beginPath();
    g.moveTo(X(s), y0);
    g.lineTo(X(s), y1);
    g.stroke();
    if (X(s) < x1 - 60) {
      g.textAlign = s === t0 ? "left" : "center";
      g.fillText(String(s), X(s), y1 + 12);
    }
  }
  g.textAlign = "right";
  g.fillText("t, s", x1, y1 + 12);
  const line = (f: (p: Sample) => number, col: string, w: number, dash: number[] = []) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.setLineDash(dash);
    g.beginPath();
    hist.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(f(p))) : g.moveTo(X(p.t), Y(f(p)))));
    g.stroke();
    g.setLineDash([]);
  };
  if (hist.length > 1) {
    line((p) => p.valve * 2, tok("--valve"), 1.5);
    line((p) => p.setpoint, tok("--ink"), 1.5, [5, 4]);
    line((p) => p.level, tok("--level"), 2.25);
    if (two) {
      g.strokeStyle = tok("--net");
      g.lineWidth = 2.25;
      g.setLineDash([2, 3]);
      g.beginPath();
      let pen = false; // the net line starts where Net was turned on
      for (const p of hist) {
        if (p.net === null) {
          pen = false;
          continue;
        }
        pen ? g.lineTo(X(p.t), Y(p.net)) : g.moveTo(X(p.t), Y(p.net));
        pen = true;
      }
      g.stroke();
      g.setLineDash([]);
    }
  }
  // the tank, or the PI tank (left) and net tank (right)
  const tank = (tx: number, tw: number, h: number, fill: string) => {
    g.fillStyle = fill;
    g.fillRect(tx, Y(h), tw, y1 - Y(h));
    g.strokeStyle = tok("--ink");
    g.lineWidth = 2;
    g.strokeRect(tx, y0, tw, y1 - y0);
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(tx - 2, Y(now.setpoint));
    g.lineTo(tx + tw + 2, Y(now.setpoint));
    g.stroke();
    g.setLineDash([]);
  };
  if (two) {
    tank(4, 16, now.level, tok("--water"));
    if (now.net) tank(26, 16, now.net.level, tok("--net"));
    else {
      g.strokeStyle = tok("--control");
      g.lineWidth = 1;
      g.strokeRect(26, y0, 16, y1 - y0);
    }
  } else tank(4, 36, now.level, tok("--water"));
  g.textAlign = "left";
  g.fillStyle = tok("--muted");
  g.fillText("m", 4, y1 + 12);
}

function render() {
  const s = live.state,
    on = live.disturbed();
  if (!on && s.disturbedUntil > 0) lastDisturbEnd = s.disturbedUntil;
  $("#chip").textContent = `${Math.floor(s.t)} s · ${paused ? "paused" : `${SPEED}× speed`}`;
  $("#r-level").textContent = `${s.level.toFixed(2)} m`;
  $("#r-sp").textContent = `${s.setpoint.toFixed(2)} m`;
  $("#r-valve").textContent = s.valve.toFixed(2);
  $("#sp-val").textContent = `${s.setpoint.toFixed(2)} m`;
  const sp = $<HTMLInputElement>("#sp");
  if (+sp.value !== s.setpoint) sp.value = String(s.setpoint); // dragging sets the same value, so this never fights the thumb
  const btn = $("#dist");
  btn.setAttribute("aria-pressed", String(on));
  const st = $("#status");
  st.classList.toggle("alert", on);
  st.textContent = on
    ? `Disturbance on: the outlet drains 20% faster for 60 s. ${Math.ceil(s.disturbedUntil - s.t)} s left. Tap again to restart the 60 s.`
    : lastDisturbEnd !== null
      ? `PI in control, aiming for ${s.setpoint.toFixed(2)} m. Disturbance ended at ${Math.round(lastDisturbEnd)} s.`
      : `PI holding the level at ${s.setpoint.toFixed(2)} m. Drag the setpoint or tap Disturbance.`;
  const now = document.getElementById("pi-now");
  if (now && (now.closest("details") as HTMLDetailsElement).open) {
    const e = s.setpoint - s.measured;
    now.innerHTML = `error = ${s.setpoint.toFixed(2)} − ${s.measured.toFixed(3)} = ${e.toFixed(3)} m<br>P = 1.0 × ${e.toFixed(3)} = ${s.pTerm.toFixed(3)}<br>I = ${s.iTerm.toFixed(3)}<br>valve = P + I = ${(s.pTerm + s.iTerm).toFixed(3)} → ${s.valve.toFixed(3)} (kept 0 to 1)`;
  }
  drawChart($<HTMLCanvasElement>("#chart"), s.history, s, s.t);
  if (NET && !$("#panel-net").hidden) NET.render((c, two) => drawChart(c, s.history, s, s.t, two));
  if (REPLAY && !$("#panel-replay").hidden) REPLAY.render();
}

let last = 0,
  carry = 0;
function frame(ms: number) {
  if (!paused && last) {
    carry = Math.min(carry + ((ms - last) / 1000) * SPEED, MAX_SIM_S_PER_FRAME);
    const whole = Math.floor(carry * 10) / 10;
    if (whole > 0) {
      live.step(whole);
      REPLAY?.step(whole);
      carry -= whole;
    }
  }
  last = ms;
  render();
  requestAnimationFrame(frame);
}

declare global {
  interface Window {
    __lab: unknown;
  }
}
window.__lab = {
  /** Stop the live clock; step() is then the only clock. */
  pause() {
    paused = true;
    render();
  },
  state: () => ({
    t: live.state.t,
    level: live.state.level,
    setpoint: live.state.setpoint,
    valve: live.state.valve,
    disturbed: live.disturbed(),
    net: live.state.net ? { level: live.state.net.level, valve: live.state.net.valve } : null,
    snapshot: null,
    replay: null,
    ...(REPLAY ? REPLAY.hooks.state() : {}),
  }),
  step(seconds: number) {
    live.step(seconds);
    REPLAY?.step(seconds);
    render();
  },
  setSetpoint(m: number) {
    live.setSetpoint(m);
    render();
  },
  disturb() {
    live.disturb();
    render();
  },
  // present only when the build inlined models/lab/ (spec "Lab")
  ...(NET
    ? {
        setNet(on: boolean) {
          NET.hooks.setNet(on);
          render();
        },
      }
    : {}),
  ...(REPLAY
    ? {
        setSnapshot(i: number) {
          REPLAY.hooks.setSnapshot(i);
          render();
        },
      }
    : {}),
};

mount();
renderFixed();
render();
requestAnimationFrame(frame);
document.fonts?.ready.then(() => {
  render();
  if (!$("#panel-tables").hidden) renderTables();
  if (!$("#panel-ivf").hidden) renderIvf();
});
