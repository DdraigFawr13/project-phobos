// J1, J2 and the S3 Tables tab browser smoke test (docs/specs/first-usable.md). Run: npm run test:browser
// Uses the container's Playwright and Chromium (WEB-05); not a dependency. Local only, not in CI.
// dist/lab.html is a fragment, so it is wrapped the way the Artifact host wraps it before loading.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SEGMENTS, runFixedTest } from "../src/sim/fixed-test.ts";
import { TANH, EXP } from "../src/num/tables.gen.ts";
import { tableErrors } from "../src/num/table-errors.ts";

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
    check(tabs.join("|") === "Live|Fixed test|Tables", `tab row: ${tabs.join(", ")}`);
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
    check(entries.length === 5 && entries.every(([i, t, e]) => +t === TANH[+i] && +e === EXP[+i]), `entries ${entries.map(r => r.join("/")).join(", ")}`);
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
    check(errors.length === 0, `${scheme}: no page errors ${errors.join(" | ")}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(fails.length ? `lab-smoke: ${fails.length} FAILED` : "lab-smoke: all passed");
process.exit(fails.length ? 1 : 0);
