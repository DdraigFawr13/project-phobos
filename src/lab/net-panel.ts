// Lab's Net tab (S5, J4): the trained net runs a second tank beside the PI's, with a heat map of its 97 numbers.
// Only main.ts's `__LAB_MODELS__ ? netPanel(…) : null` reaches this module, so a build without models/lab/
// drops it and the page has no Net panel (spec "Lab"). It reads the live model and the inlined files only (SIM-01).
import { EXPLAIN, explainHtml } from "./explain.ts";
import { SETPOINT, type Live } from "../sim/live.ts";
import { loadWeights } from "../model/weights.ts";
import { valveOf, valveOfRef } from "../model/nets.ts";
import { forward } from "../runtime/net.ts";
import { forwardRef } from "../ref/dense.ts";
import { checkStates } from "../sim/check-states.ts";
import type { Layer } from "../num/layer.ts";

export type LabModels = { weights: unknown; log?: { entries: { phase: string; step: number; loss?: number }[] } };
type Deps = { live: Live; $: <T extends HTMLElement>(sel: string) => T; tok: (n: string) => string };

const HEAT_ROWS = ["setpoint", "level", "error", "error so far", "bias", "to valve"];
const neg = (t: string) => t.replace(/-/g, "−");

export function netPanel(models: LabModels, { live, $, tok }: Deps) {
  const layers: Layer[] = loadWeights(models.weights).layers;
  let since: { t: number; level: number } | null = null;
  const ex = explainHtml(EXPLAIN.net);

  // Each layer's real numbers (w / 2^shift, b / 4096), scaled by the layer's largest |value| for the colours.
  const real = layers.map((L) => ({ w: [...L.w].map((v) => v / 2 ** L.shift), b: [...L.b].map((v) => v / 4096) }));
  const maxOf = real.map((r) => Math.max(...r.w.map(Math.abs), ...r.b.map(Math.abs)));
  const cell = (v: number, k: number) =>
    `<i class="${v >= 0 ? "pos" : "neg"}" style="opacity:${(0.15 + (0.85 * Math.abs(v)) / maxOf[k]).toFixed(2)}" title="${neg(v.toFixed(3))}"></i>`;
  const [L1, L2] = [real[0], real[1]];
  const rows = [
    ...[0, 1, 2, 3].map((i) => Array.from({ length: 16 }, (_, o) => cell(L1.w[o * 4 + i], 0))),
    L1.b.map((v) => cell(v, 0)),
    L2.w.map((v) => cell(v, 1)),
  ];
  const heat =
    rows.map((r, k) => `<span class="hl">${HEAT_ROWS[k]}</span>${r.join("")}`).join("") +
    `<span class="hl">valve bias</span>${cell(L2.b[0], 1)}`;
  const top = Math.max(...maxOf).toFixed(2);

  const html = `
    <section class="panel" id="panel-net" data-panel="net" role="tabpanel" aria-labelledby="tab-net" hidden>
      ${ex.what}
      <div class="reads">
        <div class="rd lvl"><small>PI level</small><b id="n-pi"></b></div>
        <div class="rd net"><small>Net level</small><b id="n-net"></b></div>
        <div class="rd"><small>Setpoint</small><b id="n-sp"></b></div>
      </div>
      <canvas id="netchart" role="img" aria-label="PI tank and net tank side by side, their levels and the setpoint over the last 600 seconds"></canvas>
      <div class="key"><span><i class="k-level"></i>PI tank level (left tank)</span><span><i class="k-net"></i>net tank level (right tank, dotted)</span><span><i class="k-sp"></i>setpoint (dashed)</span><span><i class="k-valve"></i>PI valve, drawn double</span><span><i class="k-dist"></i>disturbance</span></div>
      <div class="ctl"><label for="sp-net">Setpoint, both tanks <span id="sp-net-val"></span></label>
        <input id="sp-net" type="range" min="${SETPOINT.min}" max="${SETPOINT.max}" step="${SETPOINT.step}" value="${live.state.setpoint}"></div>
      <div class="row"><button class="btn" id="net-on" type="button" aria-pressed="false">Net on</button><button class="btn" id="dist-net" type="button" aria-pressed="false">Disturbance</button></div>
      <p class="status" id="net-status" aria-live="polite"></p>
      <p class="note">The net's 97 learned numbers, one square each. Purple is positive, grey is negative; a stronger square is a bigger number (largest ${top}). How it works explains the rows.</p>
      <div class="heat" id="heat" role="img" aria-label="Heat map of the net's 97 weights and biases">${heat}</div>
      ${ex.after}
    </section>`;

  // Training summary and closeness, worked out once when the tab first opens.
  let summary = false;
  function fillSummary() {
    if (summary) return;
    summary = true;
    const log = models.log?.entries.filter((e) => e.phase === "copy" && e.loss !== undefined) ?? [];
    const { states, piValve } = checkStates({ withPI: true });
    let gap = 0,
      within = 0;
    states.forEach((s, i) => {
      const vi = valveOf(forward(layers, s).at(-1)![0]);
      gap += Math.abs(vi - piValve[i]);
      if (
        Math.abs(
          vi -
            valveOfRef(
              forwardRef(
                layers,
                [...s].map((v) => v / 4096),
              ).at(-1)![0],
            ),
        ) <= 0.01
      )
        within++;
    });
    const first = log[0],
      last = log.at(-1);
    $("#net-train").textContent =
      `The PI drove the tank for 50 runs of 400 s, each starting at a random level with two random setpoints and one 60 s disturbance at a random time. The disturbances matter: without them the error so far always matched the level, so the net learned to ignore it and could not hold a low level. Every 2 s Phobos saved what the net would have seen and the valve the PI chose: 10,000 situations. Training then took ${last ? last.step.toLocaleString("en-GB") : "2,000"} small steps. Each step looks at 64 situations, works out which way each of the 97 numbers should move to bring the net's valve closer to the PI's, and moves it a little; part of the last step's move carries on (momentum).${first && last ? ` The loss fell from ${first.loss!.toFixed(4)} to ${last.loss!.toFixed(5)}.` : ""} On the 1,000 saved situations from the Fixed test tab, this page measures the net's valve at ${(gap / states.length).toFixed(3)} from the PI's on average (the test's limit is 0.05).`;
    $("#net-ivf").textContent =
      `On those 1,000 situations the whole-number valve is within 0.01 of the decimal one in ${(within / 10).toFixed(1)}% of them (limit 99%).`;
  }

  function mount(render: () => void) {
    const sp = $<HTMLInputElement>("#sp-net");
    sp.addEventListener("input", () => {
      live.setSetpoint(+sp.value);
      render();
    });
    $("#net-on").addEventListener("click", () => {
      setNet(!live.state.net);
      render();
    });
    $("#dist-net").addEventListener("click", () => {
      live.disturb();
      render();
    });
  }

  function setNet(on: boolean) {
    live.setNet(on ? layers : null);
    since = on ? { t: live.state.t, level: live.state.level } : null;
  }

  function render(drawChart: (c: HTMLCanvasElement, two: boolean) => void) {
    const s = live.state,
      n = s.net,
      on = live.disturbed();
    $("#n-pi").textContent = `${s.level.toFixed(2)} m`;
    $("#n-net").textContent = n ? `${n.level.toFixed(2)} m` : "– m";
    $("#n-sp").textContent = `${s.setpoint.toFixed(2)} m`;
    $("#sp-net-val").textContent = `${s.setpoint.toFixed(2)} m`;
    const sp = $<HTMLInputElement>("#sp-net");
    if (+sp.value !== s.setpoint) sp.value = String(s.setpoint);
    const btn = $("#net-on");
    btn.setAttribute("aria-pressed", String(!!n));
    btn.textContent = n ? "Net off" : "Net on";
    $("#dist-net").setAttribute("aria-pressed", String(on));
    const st = $("#net-status");
    st.classList.toggle("alert", on);
    st.textContent = !n
      ? "Net off. Tap Net on to start a second tank, run by the net, at the PI tank's level."
      : on
        ? `Disturbance on for both tanks: the outlets drain 20% faster. ${Math.ceil(s.disturbedUntil - s.t)} s left.`
        : `Net on: the net tank started steady at the PI tank's level, ${since!.level.toFixed(2)} m, at ${Math.floor(since!.t)} s.`;
    const now = document.getElementById("net-now");
    if (now && (now.closest("details") as HTMLDetailsElement).open) {
      if (!n || !n.inputs) now.textContent = "Tap Net on to see the net's sums for its tank here.";
      else {
        const x = n.inputs,
          outs = forward(layers, x),
          y = outs.at(-1)![0],
          f3 = (v: number) => neg((v / 4096).toFixed(3));
        now.innerHTML = `inputs: setpoint ${f3(x[0])} m, level ${f3(x[1])} m, error ${f3(x[2])} m, error so far ${f3(x[3])}<br>as whole numbers (× 4,096): ${neg([...x].join(", "))}<br>16 neurons, each −1 to 1: ${neg([...outs[0]].map((v) => (v / 4096).toFixed(2)).join(" "))}<br>valve neuron: ${neg(String(y))} (${f3(y)})<br>valve = (5 × ${neg(String(y))} + 16384) ÷ 32768 = ${valveOf(y).toFixed(3)}${valveOf(y) === 0 || valveOf(y) === 1 ? " (kept 0 to 1)" : ""}`;
      }
    }
    drawChart($<HTMLCanvasElement>("#netchart"), !!n);
  }

  return {
    tab: ["net", "Net"] as const,
    html,
    mount,
    render,
    fillSummary,
    hooks: {
      setNet(on: boolean) {
        setNet(on);
      },
    },
  };
}
