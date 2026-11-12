// Lab v0 (S1): the tank under the fixed PI, live. The view reads one model (live.state) and nothing else (SIM-01).
import { createLive, SETPOINT, HISTORY_S, type Sample } from "../sim/live.ts";
import { EXPLAIN, explainHtml } from "./explain.ts";

const SPEED = 10; // simulated seconds per real second (spec "Lab")
const MAX_SIM_S_PER_FRAME = 30; // cap catch-up after the tab was hidden

const live = createLive({ seed: 1, level: 1.0, setpoint: 1.0 });
let paused = false;
let lastDisturbEnd: number | null = null;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

function mount() {
  const ex = explainHtml(EXPLAIN.live);
  $("#app").innerHTML = `
    <div class="lhead"><h1>Phobos Lab</h1><span class="chip" id="chip"></span></div>
    <section class="panel" id="panel-live" data-panel="live" aria-label="Live">
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
    </section>`;
  const sp = $<HTMLInputElement>("#sp");
  sp.addEventListener("input", () => { live.setSetpoint(+sp.value); render(); });
  $("#dist").addEventListener("click", () => { live.disturb(); render(); });
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
render();
requestAnimationFrame(frame);
document.fonts?.ready.then(render);
