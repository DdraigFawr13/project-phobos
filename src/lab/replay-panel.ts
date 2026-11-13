// Lab's Replay tab (S6, J5): the training curve with a snapshot slider, a tank replaying the held-out tests with
// the chosen snapshot's weights, and the verdict of the final weights (models/lab/verdict.json, never the
// snapshot on screen). Reached only through main.ts's `__LAB_MODELS__ ? … : null`, like the Net tab. It reads the
// inlined files and the replay model only (SIM-01).
import { EXPLAIN, explainHtml } from "./explain.ts";
import { loadWeights } from "../model/weights.ts";
import { createReplay } from "../sim/replay.ts";
import { SEGMENTS, SEEDS, SEGMENT_S, runSegment, fixedPI } from "../sim/fixed-test.ts";
import type { Verdict } from "../sim/verdict.ts";
import type { EsExample } from "../train/es.ts";
import type { Layer } from "../num/layer.ts";

type LogEntry = { phase: "copy" | "es"; step: number; loss?: number; iae?: number };
export type ReplayModels = {
  log: { entries: LogEntry[]; esExample: EsExample };
  snapshots: { snapshots: { phase: "copy" | "es"; step: number; layers: unknown[] }[] };
  verdict: Verdict;
};
type Deps = { $: <T extends HTMLElement>(sel: string) => T; tok: (n: string) => string };

const neg = (t: string) => t.replace(/-/g, "−");
const f2 = (v: number) => v.toFixed(2);
const thousands = (n: number) => n.toLocaleString("en-GB");

export function replayPanel(models: ReplayModels, { $, tok }: Deps) {
  const snaps = models.snapshots.snapshots.map(s => ({ phase: s.phase, step: s.step, layers: loadWeights({ format: "phobos-weights", version: 1, layers: s.layers, meta: {} }).layers as Layer[] }));
  const copyLog = models.log.entries.filter(e => e.phase === "copy"), esLog = models.log.entries.filter(e => e.phase === "es");
  const v = models.verdict, ex = explainHtml(EXPLAIN.replay);
  let at = snaps.length - 1;
  const replay = createReplay(snaps[at].layers);
  let piTrainIae: number | null = null; // the fixed PI's training-set total, worked out when the tab first opens

  const row = (name: string, s: { net: number; fixed: number; retuned: number }, bold = false) =>
    `<tr><td>${bold ? `<b>${name}</b>` : name}</td>${(["net", "fixed", "retuned"] as const).map(k => `<td class="num" data-k="${k}">${f2(s[k])}</td>`).join("")}</tr>`;
  const table = (id: string, head: string, k: "iae" | "travel") => `<table id="${id}"><tr><th>${head}</th><th class="num">Net</th><th class="num">Tuned once</th><th class="num">Retuned</th></tr>${v.rows.map(r =>
    row(r.name, { net: r.net[k], fixed: r.fixed[k], retuned: r.retuned[k] })).join("")}${row("Total", { net: v.total.net[k], fixed: v.total.fixed[k], retuned: v.total.retuned[k] }, true)}</table>`;
  const yn = (b: boolean) => (b ? "yes" : "no");
  const worst = v.rows.map(r => ({ name: r.name, pct: (100 * (r.net.iae - r.fixed.iae)) / r.fixed.iae })).sort((a, b) => b.pct - a.pct);
  const over = worst.filter(w => w.pct > 5);
  const verdictLine = v.worthIt
    ? "Yes: on tests it never practised on, the net beats the PI tuned once."
    : "No: on tests it never practised on, the net does not beat the PI tuned once.";

  const html = `
    <section class="panel" id="panel-replay" data-panel="replay" role="tabpanel" aria-labelledby="tab-replay" hidden>
      ${ex.what}
      <canvas id="curve" role="img" aria-label="Training curve: copying loss on the left, tuning error score on the right, with the chosen snapshot marked"></canvas>
      <div class="key"><span><i class="k-net"></i>the net's score while training</span><span><i class="k-valve"></i>PI tuned once, on the same training tests (dashed)</span><span><i class="k-sp"></i>chosen snapshot</span></div>
      <div class="ctl"><label for="snap">Snapshot <span id="snap-val"></span></label>
        <input id="snap" type="range" min="0" max="${snaps.length - 1}" step="1" value="${at}"></div>
      <p class="status" id="snap-status"></p>
      <div class="reads">
        <div class="rd"><small>Test</small><b id="rp-name"></b></div>
        <div class="rd net"><small>Net level</small><b id="rp-level"></b></div>
        <div class="rd"><small>Error, m·s</small><b id="rp-iae"></b></div>
      </div>
      <canvas id="rpchart" role="img" aria-label="The chosen snapshot's net driving one held-out test: level, setpoint and valve over 300 seconds"></canvas>
      <div class="key"><span><i class="k-net"></i>net tank level</span><span><i class="k-sp"></i>setpoint (dashed)</span><span><i class="k-valve"></i>valve, drawn double</span><span><i class="k-dist"></i>disturbance</span></div>
      <p class="status" id="rp-status" aria-live="polite"></p>
      <h2 class="h2">Verdict on five tests the net never practised on</h2>
      <p class="note">These use the final net (the last snapshot), whatever the slider shows. Each test runs on noise seeds ${SEEDS.heldOut[0]} to ${SEEDS.heldOut.at(-1)}; each number is the mean of the 5 runs.</p>
      ${table("v-iae", "Error score, m·s", "iae")}
      ${table("v-travel", "Valve movement", "travel")}
      <p class="verdict" id="verdict">${verdictLine}</p>
      <ul class="checks" id="v-checks">
        <li>Lower total error score than the PI tuned once: <b class="${v.checks.lowerTotal ? "pass" : "fail"}">${yn(v.checks.lowerTotal)}</b> (${f2(v.total.net.iae)} against ${f2(v.total.fixed.iae)} m·s).</li>
        <li>No test more than 5% worse: <b class="${v.checks.noSegmentOver5 ? "pass" : "fail"}">${yn(v.checks.noSegmentOver5)}</b> (${over.length ? over.map(w => `${w.name} is ${Math.round(w.pct)}% worse`).join(", ") : `the worst, ${worst[0].name}, is ${neg(worst[0].pct.toFixed(1))}%`}).</li>
        <li>Valve movement at most twice the PI's: <b class="${v.checks.travelWithin2x ? "pass" : "fail"}">${yn(v.checks.travelWithin2x)}</b> (${f2(v.total.net.travel)} against ${f2(v.total.fixed.travel)}, so ${(v.total.net.travel / v.total.fixed.travel).toFixed(2)}×).</li>
      </ul>
      <p class="note">Yes needs all three. The PI retuned for each test scores ${f2(v.total.retuned.iae)} m·s in total, so retuning alone gains ${f2(v.total.fixed.iae - v.total.retuned.iae)} m·s on these tests.</p>
      ${ex.after}
    </section>`;

  function setSnapshot(i: number) {
    at = Math.max(0, Math.min(snaps.length - 1, Math.round(i)));
    replay.setLayers(snaps[at].layers);
  }

  function fillExample() {
    const e = models.log.esExample, n = e.eps.length, S = e.eps.reduce((a, x, k) => a + e.ranks[k] * x, 0);
    const d = Math.round((128 * S) / n), next = e.theta + d;
    const byRank = [...e.ranks.keys()].sort((a, b) => e.ranks[b] - e.ranks[a]);
    const m = (k: number) => `member ${k + 1}: ε = ${neg(e.eps[k].toFixed(3))}, tries ${neg(String(e.theta))} + round(32 × ${neg(e.eps[k].toFixed(3))}) = ${neg(String(e.theta + Math.round(32 * e.eps[k])))}, error score ${f2(e.iae[k])} m·s, rank ${neg(e.ranks[k].toFixed(3))}`;
    $("#es-example").innerHTML = `generation 1, the valve neuron's bias (number ${e.param + 1} of 97): ${neg(String(e.theta))}, that is ${neg((e.theta / 4096).toFixed(4))}<br>${m(0)}<br>${m(1)} (the mirror of member 1)<br>best, ${m(byRank[0])}<br>worst, ${m(byRank.at(-1)!)}<br>sum over all ${n} members of rank × ε = ${neg(S.toFixed(3))}<br>step = round(128 × ${neg(S.toFixed(3))} ÷ ${n}) = ${neg(String(d))}, so new value ${neg(String(next))}`;
  }

  function drawCurve() {
    const c = $<HTMLCanvasElement>("#curve"), dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = tok("--panel"); g.fillRect(0, 0, W, H);
    const mid = W / 2, y0 = 44, y1 = H - 22; // row 1: titles; row 2: top values; then the plot
    g.font = "13px 'IBM Plex Mono', monospace"; g.textBaseline = "middle"; g.fillStyle = tok("--muted");
    g.textAlign = "center"; g.fillText("copying: loss", mid / 2, 10); g.fillText("tuning: error, m·s", mid + mid / 2, 10);
    g.strokeStyle = tok("--line"); g.lineWidth = 1; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(mid, y0); g.lineTo(mid, y1); g.stroke(); g.setLineDash([]);
    // copy loss on a log scale, steps 0 to 2,000 on the left half
    const losses = copyLog.map(e => Math.log10(e.loss!)), lmax = Math.max(...losses), lmin = Math.min(...losses), cmax = copyLog.at(-1)!.step;
    const Xc = (s: number) => 8 + ((mid - 16) * s) / cmax, Yc = (l: number) => y1 - ((y1 - y0) * (l - lmin)) / (lmax - lmin);
    // ES IAE on the right half, generations 0 to 50, axis spanning the net's scores and the fixed PI's
    const iaes = esLog.map(e => e.iae!), ref = piTrainIae ?? Math.min(...iaes);
    const imax = Math.max(...iaes, ref) + 0.3, imin = Math.min(...iaes, ref) - 0.3, emax = esLog.at(-1)!.step;
    const Xe = (s: number) => mid + 8 + ((mid - 16) * s) / emax, Ye = (v: number) => y1 - ((y1 - y0) * (v - imin)) / (imax - imin);
    const path = (pts: [number, number][], col: string, w: number, dash: number[] = []) => {
      g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash); g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
    };
    path(copyLog.map(e => [Xc(e.step), Yc(Math.log10(e.loss!))]), tok("--net"), 2);
    path(esLog.map(e => [Xe(e.step), Ye(e.iae!)]), tok("--net"), 2);
    if (piTrainIae !== null) path([[Xe(0), Ye(piTrainIae)], [Xe(emax), Ye(piTrainIae)]], tok("--valve"), 1.5, [5, 4]);
    g.fillStyle = tok("--muted"); g.textAlign = "left";
    g.fillText(copyLog[0].loss!.toFixed(3), 8, 28); g.fillText(copyLog.at(-1)!.loss!.toFixed(5), 8, y1 + 12);
    g.textAlign = "right"; g.fillText(f2(imax - 0.3), W - 8, 28); g.fillText(f2(imin + 0.3), W - 8, y1 + 12);
    // the chosen snapshot
    const s = snaps[at], x = s.phase === "copy" ? Xc(s.step) : Xe(s.step);
    const y = s.phase === "copy" ? Yc(Math.log10(copyLog.find(e => e.step === s.step)!.loss!)) : Ye(esLog.find(e => e.step === s.step)!.iae!);
    g.strokeStyle = tok("--ink"); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
    g.fillStyle = tok("--ink"); g.beginPath(); g.arc(x, y, 4, 0, 2 * Math.PI); g.fill();
  }

  function drawTank() {
    const c = $<HTMLCanvasElement>("#rpchart"), dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext("2d")!, s = replay.state, hist = s.history;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = tok("--panel"); g.fillRect(0, 0, W, H);
    const x0 = 72, x1 = W - 8, y0 = 8, y1 = H - 22;
    const X = (t: number) => x0 + ((x1 - x0) * t) / SEGMENT_S, Y = (m: number) => y1 - ((y1 - y0) * m) / 2;
    g.font = "13px 'IBM Plex Mono', monospace"; g.textBaseline = "middle";
    g.fillStyle = tok("--dist");
    for (let i = 1; i < hist.length; i++) if (hist[i].disturbed) g.fillRect(X(hist[i - 1].t), y0, X(hist[i].t) - X(hist[i - 1].t) + 0.5, y1 - y0);
    g.strokeStyle = tok("--line"); g.lineWidth = 1; g.fillStyle = tok("--muted");
    for (let m = 0; m <= 2; m += 0.5) { g.beginPath(); g.moveTo(x0, Y(m)); g.lineTo(x1, Y(m)); g.stroke(); g.textAlign = "right"; g.fillText(m.toFixed(1), x0 - 4, Y(m)); }
    for (let t = 0; t <= SEGMENT_S; t += 100) { g.beginPath(); g.moveTo(X(t), y0); g.lineTo(X(t), y1); g.stroke(); g.textAlign = t === 0 ? "left" : t === SEGMENT_S ? "right" : "center"; if (t < SEGMENT_S) g.fillText(String(t), X(t), y1 + 12); }
    g.textAlign = "right"; g.fillText("t, s", x1, y1 + 12);
    const line = (f: (p: (typeof hist)[number]) => number, col: string, w: number, dash: number[] = []) => {
      g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash); g.beginPath();
      hist.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(f(p))) : g.moveTo(X(p.t), Y(f(p))))); g.stroke(); g.setLineDash([]);
    };
    if (hist.length > 1) { line(p => p.valve * 2, tok("--valve"), 1.5); line(p => p.setpoint, tok("--ink"), 1.5, [5, 4]); line(p => p.level, tok("--net"), 2.25); }
    g.fillStyle = tok("--net"); g.fillRect(4, Y(s.level), 36, y1 - Y(s.level));
    g.strokeStyle = tok("--ink"); g.lineWidth = 2; g.strokeRect(4, y0, 36, y1 - y0);
    g.setLineDash([4, 3]); g.beginPath(); g.moveTo(2, Y(s.setpoint)); g.lineTo(42, Y(s.setpoint)); g.stroke(); g.setLineDash([]);
    g.textAlign = "left"; g.fillStyle = tok("--muted"); g.fillText("m", 4, y1 + 12);
  }

  function render() {
    const s = snaps[at], rs = replay.state;
    const sl = $<HTMLInputElement>("#snap");
    if (+sl.value !== at) sl.value = String(at);
    const score = s.phase === "copy" ? `loss ${copyLog.find(e => e.step === s.step)!.loss!.toFixed(5)}` : `training error ${f2(esLog.find(e => e.step === s.step)!.iae!)} m·s`;
    $("#snap-val").textContent = `${at + 1} of ${snaps.length}`;
    $("#snap-status").textContent = s.phase === "copy"
      ? `Copying the PI, after ${thousands(s.step)} of ${thousands(copyLog.at(-1)!.step)} steps: ${score}.`
      : `Tuning, after generation ${s.step} of ${esLog.at(-1)!.step}: ${score}${piTrainIae !== null ? ` (PI tuned once: ${f2(piTrainIae)} m·s)` : ""}.`;
    $("#rp-name").textContent = rs.name;
    $("#rp-level").textContent = `${rs.level.toFixed(2)} m`;
    $("#rp-iae").textContent = `${f2(rs.iae)}`;
    const done = rs.finished.map(f => `${f.name} ${f2(f.iae)}`).join(", ");
    $("#rp-status").textContent = `Test ${rs.segment + 1} of ${SEGMENTS.heldOut.length}, ${Math.floor(rs.t - rs.segment * SEGMENT_S)} s of ${SEGMENT_S}, noise seed ${SEEDS.heldOut[0]}. Error is the score so far in this test.${done ? ` Done this round: ${done}.` : ""}`;
    const now = document.getElementById("es-example");
    if (now && (now.closest("details") as HTMLDetailsElement).open && !now.textContent) fillExample();
    drawCurve(); drawTank();
  }

  function mount(rerender: () => void) {
    const sl = $<HTMLInputElement>("#snap");
    sl.addEventListener("input", () => { setSnapshot(+sl.value); rerender(); });
    $("#panel-replay details")?.addEventListener("toggle", rerender);
  }

  /** When the tab first opens: the fixed PI's training IAE for the dashed line (25 runs of 300 s). */
  function opened() {
    if (piTrainIae !== null) return;
    let t = 0;
    for (const seg of SEGMENTS.training) for (const sd of SEEDS.training) t += runSegment(seg, fixedPI(), sd).iae / SEEDS.training.length;
    piTrainIae = t;
  }

  return {
    tab: ["replay", "Replay"] as const, html, mount, render, opened,
    step(seconds: number) { replay.step(seconds); },
    hooks: {
      setSnapshot,
      state: () => ({ snapshot: { phase: snaps[at].phase, step: snaps[at].step }, replay: { t: replay.state.t, segment: replay.state.segment, level: replay.state.level, valve: replay.state.valve } }),
    },
  };
}
