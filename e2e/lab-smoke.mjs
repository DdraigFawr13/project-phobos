// J1, J2, the S3 Tables tab, the S4 Integer vs float tab, J4 (S5 Net tab) and J5 (S6 Replay tab) browser smoke test (docs/specs/first-usable.md). Run: npm run test:browser
// Uses the container's Playwright and Chromium (WEB-05); not a dependency. Local only, not in CI.
// dist/lab.html is a fragment, so it is wrapped the way the Artifact host wraps it before loading.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SEGMENTS, runFixedTest } from "../src/sim/fixed-test.ts";
import { TANH, EXP } from "../src/num/tables.gen.ts";
import { tableErrors } from "../src/num/table-errors.ts";
import { compareNets } from "../src/ref/agreement.ts";
import { checkStates } from "../src/sim/check-states.ts";
import { loadWeights } from "../src/model/weights.ts";
import { forward } from "../src/runtime/net.ts";
import { valveOf } from "../src/model/nets.ts";

const model = f => JSON.parse(readFileSync(new URL(`../models/lab/${f}`, import.meta.url), "utf8"));
const committed = loadWeights(model("weights.json")).layers;
const snapshots = model("snapshots.json").snapshots, verdict = model("verdict.json"), esExample = model("log.json").esExample;

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = new URL("../", import.meta.url);
const frag = readFileSync(new URL("dist/lab.html", root), "utf8");
const page_ = join(tmpdir(), "phobos-lab-smoke.html");
writeFileSync(page_, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${frag}</body></html>`);

const fails = [];
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) fails.push(msg); };
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
try {
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme });
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
    await page.goto("file://" + page_);
    await page.waitForFunction(() => typeof window.__lab === "object");
    const lab = (fn, ...a) => page.evaluate(([f, args]) => window.__lab[f](...args), [fn, a]);

    if (scheme === "light") {
      await lab("pause");
      await lab("setSetpoint", 1.5);
      await lab("step", 300);
      let s = await lab("state");
      check(Math.abs(s.level - 1.5) < 0.05, `setpoint 1.5 m: level ${s.level.toFixed(3)} m after 300 s`);
      const before = s.level;
      await lab("disturb");
      await lab("step", 30);
      s = await lab("state");
      check(before - s.level > 0.02, `disturbance: level dropped ${(before - s.level).toFixed(3)} m in 30 s`);
      await lab("step", 300);
      s = await lab("state");
      check(Math.abs(s.level - 1.5) < 0.05, `recovered: level ${s.level.toFixed(3)} m after 300 s more`);
      // the screen answers: readouts and status follow the model
      const shown = await page.evaluate(() => [document.getElementById("r-level").textContent, document.getElementById("status").textContent]);
      check(shown[0] === `${s.level.toFixed(2)} m`, `level readout shows ${shown[0]}`);
      check(/Disturbance ended/.test(shown[1]), `status after the disturbance: "${shown[1]}"`);
      // the slider drives the model
      await page.locator("#sp").fill("0.25");
      s = await lab("state");
      check(s.setpoint === 0.25, `slider to 0.25 sets setpoint ${s.setpoint}`);
      await lab("setSetpoint", 1.5);
      const thumb = await page.evaluate(() => document.getElementById("sp").value);
      check(+thumb === 1.5, `slider follows the model: ${thumb}`);
      // How it works shows the PI's sums for the current state
      await page.locator("#panel-live summary").click();
      await lab("step", 1);
      const sums = await page.evaluate(() => document.getElementById("pi-now").textContent);
      check(/error = 1\.50 − .*valve = P \+ I/.test(sums), `How it works shows the live sums: "${sums.slice(0, 40)}…"`);
    } else {
      await lab("pause");
      await lab("setSetpoint", 1.5); await lab("step", 200); await lab("disturb"); await lab("step", 30);
    }
    const layout = async (where) => {
      const lay = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        smallTaps: [...document.querySelectorAll("button, input, summary")].filter(e => !e.closest("[hidden]") && e.getBoundingClientRect().height < 44).map(e => e.id || e.tagName),
        smallText: [...document.querySelectorAll("body *")].filter(e => !e.closest("[hidden]") && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13).map(e => e.tagName),
      }));
      check(lay.scrollW <= 400, `${scheme} ${where}: no sideways scroll (${lay.scrollW} px)`);
      check(lay.smallTaps.length === 0, `${scheme} ${where}: taps ≥ 44 px ${lay.smallTaps.join(" ")}`);
      check(lay.smallText.length === 0, `${scheme} ${where}: text ≥ 13 px ${lay.smallText.join(" ")}`);
    };
    mkdirSync(new URL("test-results/", root), { recursive: true });
    const shot = name => page.screenshot({ path: new URL(`test-results/${name}-${scheme}.png`, root).pathname, fullPage: true });
    await layout("Live");
    await shot("lab-400");

    // J2: the Fixed test tab runs the training set and prints the same numbers as Node
    const tabs = await page.locator('[role="tab"]').allTextContents();
    check(tabs.join("|") === "Live|Fixed test|Tables|Integer vs float|Net|Replay", `tab row: ${tabs.join(", ")}`);
    await page.locator('[role="tab"]', { hasText: "Fixed test" }).click();
    check(await page.locator("#panel-live").isHidden(), "Live panel hidden on the Fixed test tab");
    await page.locator("#ft-run").click();
    await page.locator("#ft-run", { hasText: "Run again" }).waitFor();
    const want = runFixedTest(SEGMENTS.training);
    const bars = await page.evaluate(() => [...document.querySelectorAll("#ft-bars .bar")].map(b => [b.dataset.seg, b.querySelector('[data-k="fixed"]').textContent, b.querySelector('[data-k="retuned"]').textContent]));
    check(bars.length === 5, `5 bar pairs (${bars.length})`);
    for (const [i, r] of want.rows.entries()) {
      const got = bars[i] ?? [];
      check(got[0] === r.name && got[1] === `${r.fixed.iae.toFixed(2)} m·s` && got[2] === `${r.retuned.iae.toFixed(2)} m·s`, `${r.name}: page ${got.slice(1).join(" / ")}, Node ${r.fixed.iae.toFixed(2)} / ${r.retuned.iae.toFixed(2)}`);
    }
    const total = await page.locator("#ft-status").textContent();
    check(total.includes(`tuned once ${want.total.fixed.iae.toFixed(2)} m·s, retuned ${want.total.retuned.iae.toFixed(2)} m·s`), `total line: "${total}"`);
    if (scheme === "light") await page.locator("#panel-fixed summary").click();
    await layout("Fixed test");
    await shot("lab-400-fixed");

    // S3: the Tables tab prints the committed entries and the same largest gaps as Node
    await page.locator('[role="tab"]', { hasText: "Tables" }).click();
    check(await page.locator("#panel-fixed").isHidden(), "Fixed test panel hidden on the Tables tab");
    const entries = await page.evaluate(() => [...document.querySelectorAll("#t-entries tr[data-i]")].map(r => [...r.children].map(c => c.textContent)));
    check(entries.length === 5 && entries.every(([x, t, e]) => +t === TANH[+x * 128] && +e === EXP[+x * 128]), `entries ${entries.map(r => r.join("/")).join(", ")}`);
    const gw = tableErrors();
    const gaps = await page.evaluate(() => [...document.querySelectorAll("#t-gaps tr[data-f]")].map(r => [r.dataset.f, ...[...r.children].slice(1).map(c => c.textContent)]));
    for (const [f, lsb, pct, verdict] of gaps) {
      const w = gw[f];
      check(+lsb === w.lsb && pct === `${w.pct.toFixed(3)}%` && verdict === (w.lsb <= 2 ? "pass" : "fail"), `${f} gap: page ${lsb} / ${pct} / ${verdict}, Node ${w.lsb} / ${w.pct.toFixed(3)}%`);
    }
    check(gaps.length === 2, `2 gap rows (${gaps.length})`);
    const ink = await page.evaluate(() => { const c = document.getElementById("tchart"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) n++; return n; });
    check(ink > 1000, `tables chart drew curves (${ink} non-background pixels)`);
    if (scheme === "light") await page.locator("#panel-tables summary").click();
    await layout("Tables");
    await shot("lab-400-tables");

    // S4: the Integer vs float tab prints the same comparison as Node
    await page.locator('[role="tab"]', { hasText: "Integer vs float" }).click();
    check(await page.locator("#panel-tables").isHidden(), "Tables panel hidden on the Integer vs float tab");
    const cmp = compareNets(checkStates());
    const wantRows = {
      t1: `${cmp.testNet.layerGaps[0].toFixed(3)}%`, t2: `${cmp.testNet.layerGaps[1].toFixed(3)}%`, same: `${cmp.testNet.samePct.toFixed(1)}%`,
      l1: `${cmp.labNet.layerGaps[0].toFixed(3)}%`, l2: `${cmp.labNet.layerGaps[1].toFixed(3)}%`, valve: `${cmp.labNet.withinPct.toFixed(1)}%`,
    };
    const ivRows = await page.evaluate(() => [...document.querySelectorAll("#ivf-checks tr[data-c]")].map(r => [r.dataset.c, r.children[1].textContent, r.children[3].textContent]));
    check(ivRows.length === 6, `6 check rows (${ivRows.length})`);
    for (const [id, got, verdict] of ivRows) check(got === wantRows[id] && verdict === "pass", `${id}: page ${got} ${verdict}, Node ${wantRows[id]}`);
    const ivStatus = await page.locator("#ivf-status").textContent();
    check(ivStatus.includes(`Biggest valve gap: ${cmp.labNet.maxGap.toFixed(4)}`), `valve gap line: "${ivStatus}"`);
    const ivInk = await page.evaluate(() => { const c = document.getElementById("ivfchart"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) n++; return n; });
    check(ivInk > 1000, `valve chart drew lines (${ivInk} non-background pixels)`);
    if (scheme === "light") {
      await page.locator("#panel-ivf summary").click();
      const ex = await page.locator("#ivf-example").textContent();
      check(/as whole numbers \(× 4,096\): 1024, 2028, −1004, 1810/.test(ex) && /gap 0\.0\d{3}, allowed 0\.01/.test(ex), `worked example: "${ex.slice(0, 80)}…"`);
    }
    await layout("Integer vs float");
    await shot("lab-400-ivf");

    // J4: Net on runs the committed net on a second tank; it holds 1.0 m
    await page.locator('[role="tab"]', { hasText: "Net" }).click();
    check(await page.locator("#panel-ivf").isHidden(), "Integer vs float panel hidden on the Net tab");
    let n = await lab("state");
    check(n.net === null, "Net starts off");
    check(/Net off\./.test(await page.locator("#net-status").textContent()), "status says Net off");
    await lab("pause");
    await lab("setNet", true);
    await lab("setSetpoint", 1.0);
    n = await lab("state");
    check(n.net && n.net.level === n.level, `Net on: net tank starts at the PI tank's level (${n.net?.level})`);
    await lab("step", 300);
    n = await lab("state");
    check(n.net && Math.abs(n.net.level - 1.0) < 0.05, `J4: net tank level ${n.net?.level.toFixed(3)} m after 300 s at setpoint 1.0`);
    check(n.net && n.net.valve > 0 && n.net.valve < 1, `state().net.valve ${n.net?.valve}`);
    const reads = await page.evaluate(() => [document.getElementById("n-net").textContent, document.getElementById("net-on").textContent, document.getElementById("net-on").getAttribute("aria-pressed")]);
    check(reads[0] === `${n.net.level.toFixed(2)} m` && reads[1] === "Net off" && reads[2] === "true", `net readout and toggle: ${reads.join(" / ")}`);
    const cells = await page.locator("#heat i").count();
    check(cells === 97, `heat map has 97 squares (${cells})`);
    const netInk = await page.evaluate(() => { const c = document.getElementById("netchart"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) k++; return k; });
    check(netInk > 1000, `net chart drew (${netInk} non-background pixels)`);
    if (scheme === "light") {
      await page.locator("#panel-net summary").click();
      await lab("step", 1);
      const sums = await page.locator("#net-now").textContent();
      // the page's worked example ends in the valve the committed net gives for those inputs, worked out in Node
      const nums = /as whole numbers \(× 4,096\): ([−\d, ]+)16/.exec(sums)?.[1].replace(/−/g, "-").split(", ").map(Number);
      const want = nums ? valveOf(forward(committed, Int16Array.from(nums)).at(-1)[0]).toFixed(3) : "?";
      check(nums?.length === 4 && /32768 = [\d.]+( \(kept 0 to 1\))?$/.test(sums) && sums.includes(`32768 = ${want}`), `Net worked example: "…${sums.slice(-40)}", Node ${want}`);
      const train = await page.locator("#net-train").textContent();
      check(/from 0\.\d{4} to 0\.\d{5}\..*at 0\.0\d\d from the PI's/.test(train), `training summary: "${train.slice(-120)}"`);
    } else {
      await lab("disturb"); await lab("step", 20);
      check(/Disturbance on for both tanks/.test(await page.locator("#net-status").textContent()), "status shows the disturbance on both tanks");
    }
    await layout("Net");
    await shot("lab-400-net");
    await page.locator("#net-on").click();
    check((await lab("state")).net === null, "tapping Net off turns the net tank off");

    // J5: the Replay tab follows the snapshot slider; the verdict is the final weights' and never changes with it
    await page.locator('[role="tab"]', { hasText: "Replay" }).click();
    check(await page.locator("#panel-net").isHidden(), "Net panel hidden on the Replay tab");
    const vtext = async () => page.locator("#verdict").textContent();
    const v0text = await vtext();
    check(v0text.startsWith(verdict.worthIt ? "Yes" : "No"), `verdict line: "${v0text}"`);
    const cellsIae = await page.locator('#v-iae td[data-k="net"]').allTextContents();
    check(cellsIae.join("|") === [...verdict.rows.map(r => r.net.iae), verdict.total.net.iae].map(v => v.toFixed(2)).join("|"), `verdict net IAE cells: ${cellsIae.join(", ")}`);
    const cellsTr = await page.locator('#v-travel td[data-k="fixed"]').allTextContents();
    check(cellsTr.join("|") === [...verdict.rows.map(r => r.fixed.travel), verdict.total.fixed.travel].map(v => v.toFixed(2)).join("|"), `verdict fixed-PI travel cells: ${cellsTr.join(", ")}`);
    await lab("setSnapshot", 0);
    let r = await lab("state");
    check(r.snapshot?.phase === snapshots[0].phase && r.snapshot?.step === snapshots[0].step, `setSnapshot(0): state().snapshot ${JSON.stringify(r.snapshot)}`);
    check(r.replay?.t === 0 && r.replay?.segment === 0, `the replay restarts at 0 s on the first held-out test (${JSON.stringify(r.replay && { t: r.replay.t, segment: r.replay.segment })})`);
    check(await page.locator("#snap").inputValue() === "0", "the slider shows snapshot 0");
    await lab("step", 10);
    const valveFirst = (await lab("state")).replay.valve;
    const last = snapshots.length - 1;
    await lab("setSnapshot", last);
    r = await lab("state");
    check(r.snapshot?.phase === "es" && r.snapshot?.step === snapshots[last].step, `setSnapshot(${last}): state().snapshot ${JSON.stringify(r.snapshot)}`);
    await lab("step", 10);
    const valveLast = (await lab("state")).replay.valve;
    check(valveFirst !== valveLast, `the replay valve after 10 s differs between snapshots (${valveFirst} and ${valveLast})`);
    check(await vtext() === v0text, "the verdict text stays the same across snapshots");
    const curveInk = await page.evaluate(() => { const c = document.getElementById("curve"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) k++; return k; });
    check(curveInk > 1000, `training curve drew (${curveInk} non-background pixels)`);
    await page.locator("#snap").fill("12");
    check((await lab("state")).snapshot?.step === snapshots[12].step, "dragging the slider picks that snapshot");
    if (scheme === "light") {
      await page.locator("#panel-replay summary").click();
      await page.waitForFunction(() => document.getElementById("es-example").textContent.length > 0); // filled on the toggle event
      const ex = await page.locator("#es-example").textContent();
      check(ex.includes(`new value ${String(esExample.next).replace("-", "−")}`), `ES worked example ends at the trained value ${esExample.next}: "…${ex.slice(-80)}"`);
    }
    await lab("step", 150); // so the screenshot shows the replay tank partway through the first held-out test
    await layout("Replay");
    await shot("lab-400-replay");
    check(errors.length === 0, `${scheme}: no page errors ${errors.join(" | ")}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(fails.length ? `lab-smoke: ${fails.length} FAILED` : "lab-smoke: all passed");
process.exit(fails.length ? 1 : 0);
