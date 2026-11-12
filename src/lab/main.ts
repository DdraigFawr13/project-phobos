// Lab: the Live tab (S1, the tank under the fixed PI), the Fixed test tab (S2) and the Tables tab (S3). Each view
// reads one model (live.state, fixedTest, the committed tables) and nothing else (SIM-01).
import { createLive, SETPOINT, HISTORY_S, type Sample } from "../sim/live.ts";
import { SEGMENTS, fixedTestRuns, type FixedTestResult, type Progress } from "../sim/fixed-test.ts";
import { EXPLAIN, explainHtml } from "./explain.ts";
import { TANH, EXP } from "../num/tables.gen.ts";
import { tanhQ, expQ } from "../num/act.ts";
import { tableErrors, type TableError } from "../num/table-errors.ts";

const SPEED = 10; // simulated seconds per real second (spec "Lab")
const MAX_SIM_S_PER_FRAME = 30; // cap catch-up after the tab was hidden

const live = createLive({ seed: 1, level: 1.0, setpoint: 1.0 });
let paused = false;
let lastDisturbEnd: number | null = null;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const TABS = [["live", "Live"], ["fixed", "Fixed test"], ["tables", "Tables"]] as const;
type Tab = (typeof TABS)[number][0];

// The Fixed test model: idle, running (with progress) or done. The live tank keeps running meanwhile.
type FixedTest = { phase: "idle" } | { phase: "running"; at: Progress } | { phase: "done"; result: FixedTestResult };
let fixedTest: FixedTest = { phase: "idle" };
const RUN_BUDGET_MS = 12; // runs per frame stop after this, so the page keeps drawing on a slow phone

function mount() {
  const ex = explainHtml(EXPLAIN.live), fx = explainHtml(EXPLAIN.fixed), tx = explainHtml(EXPLAIN.tables);
  $("#app").innerHTML = `
    <div class="lhead"><h1>Phobos Lab</h1><span class="chip" id="chip"></span></div>
    <div class="tabs" role="tablist" aria-label="Lab tabs">${TABS.map(([id, name], i) =>
      `<button class="tab" type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${name}</button>`).join("")}</div>
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
      <table id="t-entries"><tr><th>Input</th><th class="num">tanh(input)</th><th class="num">exp(−input)</th></tr>${ENTRY_ROWS.map(i =>
        `<tr data-i="${i}"><td class="mono">${i / 128}</td><td class="num">${TANH[i]}</td><td class="num">${EXP[i]}</td></tr>`).join("")}</table>
      <table id="t-gaps"><tr><th>Worst miss, all 65,536 inputs</th><th class="num">Steps off</th><th class="num">% of height</th><th></th></tr>
        <tr data-f="tanh"><td>tanh table</td><td class="num"></td><td class="num"></td><td></td></tr>
        <tr data-f="exp"><td>exp table</td><td class="num"></td><td class="num"></td><td></td></tr></table>
      <p class="status" id="t-status">A step is 1/4,096, the smallest change these whole numbers can make. A table passes if it never misses the exact curve by more than ${GAP_LIMIT} steps.</p>
      ${tx.after}
    </section>`;
  const tabs = [...document.querySelectorAll<HTMLButtonElement>(".tab")];
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => showTab(TABS[i][0]));
    b.addEventListener("keydown", e => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus(); showTab(TABS[tabs.indexOf(next)][0]);
    });
  });
  $("#ft-run").addEventListener("click", startFixedTest);
  const sp = $<HTMLInputElement>("#sp");
  sp.addEventListener("input", () => { live.setSetpoint(+sp.value); render(); });
  $("#dist").addEventListener("click", () => { live.disturb(); render(); });
}

function showTab(id: Tab) {
  for (const [t] of TABS) {
    const on = t === id, b = $(`#tab-${t}`);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
    $(`#panel-${t}`).hidden = !on;
  }
  if (id === "tables") renderTables();
  render();
}

// The Tables model: the committed tables, plus their largest gaps measured once when the tab first opens.
const ENTRY_ROWS = [0, 128, 256, 512, 1024];
const GAP_LIMIT = 2; // LSB, spec S3
let gaps: { tanh: TableError; exp: TableError } | null = null;

function renderTables() {
  gaps ??= tableErrors();
  for (const f of ["tanh", "exp"] as const) {
    const g = gaps[f], td = document.querySelectorAll(`#t-gaps [data-f="${f}"] td`);
    td[1].textContent = String(g.lsb);
    td[2].textContent = `${g.pct.toFixed(3)}%`;
    td[3].textContent = g.lsb <= GAP_LIMIT ? "pass" : "fail";
    td[3].className = g.lsb <= GAP_LIMIT ? "pass" : "fail";
  }
  const c = $<HTMLCanvasElement>("#tchart"), dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
  if (!W || !H) return;
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const g = c.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = tok("--panel"); g.fillRect(0, 0, W, H);
  const mid = H / 2, X = (x: number) => 8 + ((W - 16) * (x + 8)) / 16, Y = (y: number) => mid - (mid - 14) * y;
  g.strokeStyle = tok("--line"); g.lineWidth = 1;
  g.beginPath(); g.moveTo(8, mid); g.lineTo(W - 8, mid); g.moveTo(X(0), 8); g.lineTo(X(0), H - 8); g.stroke();
  const q = (x: number) => Math.max(-32768, Math.min(32767, Math.round(x * 4096)));
  const curve = (f: (x: number) => number, col: string, w: number, dash: number[] = []) => {
    g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash); g.beginPath();
    for (let k = 0; k <= 320; k++) { const x = -8 + k * 0.05, y = f(x); k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); }
    g.stroke(); g.setLineDash([]);
  };
  curve(x => tanhQ(q(x)) / 4096, tok("--ink"), 3); curve(Math.tanh, tok("--valve"), 1.25, [4, 3]);
  curve(x => expQ(q(x)) / 4096, tok("--ink"), 3); curve(x => Math.exp(Math.min(0, x)), tok("--valve"), 1.25, [4, 3]);
  g.font = "13px 'IBM Plex Mono', monospace"; g.fillStyle = tok("--muted"); g.textBaseline = "middle";
  g.textAlign = "left"; g.fillText("tanh", X(3), Y(1) + 14); g.fillText("exp", X(-6), Y(0) - 14); g.fillText("−8", 10, mid + 12);
  g.textAlign = "right"; g.fillText("+8", W - 10, mid + 12);
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
      if (r.done) { fixedTest = { phase: "done", result: r.value }; renderFixed(); return; }
      fixedTest = { phase: "running", at: r.value };
      if (performance.now() - t0 > RUN_BUDGET_MS) break;
    }
    renderFixed();
    requestAnimationFrame(work);
  };
  requestAnimationFrame(work);
}

function renderFixed() {
  const btn = $<HTMLButtonElement>("#ft-run"), out = $("#ft-out"), st = $("#ft-status");
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
  const max = Math.max(...rows.flatMap(r => [r.fixed.iae, r.retuned.iae]));
  const w = (v: number) => `${((70 * v) / max).toFixed(1)}%`;
  btn.textContent = "Run again";
  out.innerHTML = `<div class="ft">
    <div class="key"><span><i class="k-fixed"></i>PI tuned once for 1.00 m</span><span><i class="k-ret"></i>PI retuned for each test</span><span>error score, m·s</span></div>
    <div class="bars" id="ft-bars">${rows.map(r => `<div class="bar" data-seg="${r.name}"><span class="nm">${r.name}</span><div class="pair">
      <div class="v"><i class="f" style="width:${w(r.fixed.iae)}"></i><span data-k="fixed">${r.fixed.iae.toFixed(2)} m·s</span></div>
      <div class="v"><i class="r" style="width:${w(r.retuned.iae)}"></i><span data-k="retuned">${r.retuned.iae.toFixed(2)} m·s</span></div></div></div>`).join("")}</div>
    <table><tr><th>Valve movement</th><th class="num">Tuned once</th><th class="num">Retuned</th></tr>${rows.map(r =>
      `<tr><td>${r.name}</td><td class="num">${r.fixed.travel.toFixed(2)}</td><td class="num">${r.retuned.travel.toFixed(2)}</td></tr>`).join("")}
      <tr><td><b>Total</b></td><td class="num">${total.fixed.travel.toFixed(2)}</td><td class="num">${total.retuned.travel.toFixed(2)}</td></tr></table></div>`;
  st.textContent = `Total error score: tuned once ${total.fixed.iae.toFixed(2)} m·s, retuned ${total.retuned.iae.toFixed(2)} m·s.`;
}

const tok = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function drawChart(c: HTMLCanvasElement, hist: Sample[], now: { level: number; setpoint: number }, t: number) {
  const dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
  if (!W || !H) return;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  const g = c.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = tok("--panel"); g.fillRect(0, 0, W, H);
  const t1 = Math.max(HISTORY_S, t), t0 = t1 - HISTORY_S;
  const x0 = 72, x1 = W - 8, y0 = 8, y1 = H - 22;
  const X = (s: number) => x0 + ((x1 - x0) * (s - t0)) / HISTORY_S, Y = (m: number) => y1 - ((y1 - y0) * m) / 2;
  g.font = "13px 'IBM Plex Mono', monospace"; g.textBaseline = "middle";
  // disturbance bands
  g.fillStyle = tok("--dist");
  for (let i = 1; i < hist.length; i++) if (hist[i - 1].disturbed) g.fillRect(X(hist[i - 1].t), y0, X(hist[i].t) - X(hist[i - 1].t) + 0.5, y1 - y0);
  // grid
  g.strokeStyle = tok("--line"); g.lineWidth = 1; g.fillStyle = tok("--muted");
  for (let m = 0; m <= 2; m += 0.5) { g.beginPath(); g.moveTo(x0, Y(m)); g.lineTo(x1, Y(m)); g.stroke(); g.textAlign = "right"; g.fillText(m.toFixed(1), x0 - 4, Y(m)); }
  for (let s = Math.ceil(t0 / 200) * 200; s < t1; s += 200) {
    g.beginPath(); g.moveTo(X(s), y0); g.lineTo(X(s), y1); g.stroke();
    if (X(s) < x1 - 60) { g.textAlign = s === t0 ? "left" : "center"; g.fillText(String(s), X(s), y1 + 12); }
  }
  g.textAlign = "right"; g.fillText("t, s", x1, y1 + 12);
  const line = (f: (p: Sample) => number, col: string, w: number, dash: number[] = []) => {
    g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash); g.beginPath();
    hist.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(f(p))) : g.moveTo(X(p.t), Y(f(p)))));
    g.stroke(); g.setLineDash([]);
  };
  if (hist.length > 1) { line(p => p.valve * 2, tok("--valve"), 1.5); line(p => p.setpoint, tok("--ink"), 1.5, [5, 4]); line(p => p.level, tok("--level"), 2.25); }
  // the tank
  const tx = 4, tw = 36;
  g.fillStyle = tok("--water"); g.fillRect(tx, Y(now.level), tw, y1 - Y(now.level));
  g.strokeStyle = tok("--ink"); g.lineWidth = 2; g.strokeRect(tx, y0, tw, y1 - y0);
  g.setLineDash([4, 3]); g.beginPath(); g.moveTo(tx - 2, Y(now.setpoint)); g.lineTo(tx + tw + 2, Y(now.setpoint)); g.stroke(); g.setLineDash([]);
  g.textAlign = "left"; g.fillStyle = tok("--muted"); g.fillText("m", 4, y1 + 12);
}

function render() {
  const s = live.state, on = live.disturbed();
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
}

let last = 0, carry = 0;
function frame(ms: number) {
  if (!paused && last) {
    carry = Math.min(carry + ((ms - last) / 1000) * SPEED, MAX_SIM_S_PER_FRAME);
    const whole = Math.floor(carry * 10) / 10;
    if (whole > 0) { live.step(whole); carry -= whole; }
  }
  last = ms;
  render();
  requestAnimationFrame(frame);
}

declare global { interface Window { __lab: unknown } }
window.__lab = {
  /** Stop the live clock; step() is then the only clock. */
  pause() { paused = true; render(); },
  state: () => ({ t: live.state.t, level: live.state.level, setpoint: live.state.setpoint, valve: live.state.valve, disturbed: live.disturbed(), net: null, snapshot: null }),
  step(seconds: number) { live.step(seconds); render(); },
  setSetpoint(m: number) { live.setSetpoint(m); render(); },
  disturb() { live.disturb(); render(); },
};

mount();
renderFixed();
render();
requestAnimationFrame(frame);
document.fonts?.ready.then(() => { render(); if (!$("#panel-tables").hidden) renderTables(); });
