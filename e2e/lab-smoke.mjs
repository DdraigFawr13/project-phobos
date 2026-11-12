// J1 browser smoke test (docs/specs/first-usable.md). Run: npm run test:browser
// Uses the container's Playwright and Chromium (WEB-05); not a dependency. Local only, not in CI.
// dist/lab.html is a fragment, so it is wrapped the way the Artifact host wraps it before loading.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
      await page.locator("summary", { hasText: "How it works" }).click();
      await lab("step", 1);
      const sums = await page.evaluate(() => document.getElementById("pi-now").textContent);
      check(/error = 1\.50 − .*valve = P \+ I/.test(sums), `How it works shows the live sums: "${sums.slice(0, 40)}…"`);
    } else {
      await lab("pause");
      await lab("setSetpoint", 1.5); await lab("step", 200); await lab("disturb"); await lab("step", 30);
    }
    // layout at 400 px: no sideways scroll, taps ≥ 44 px, text ≥ 13 px
    const lay = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      smallTaps: [...document.querySelectorAll("button, input, summary")].filter(e => e.getBoundingClientRect().height < 44).map(e => e.id || e.tagName),
      smallText: [...document.querySelectorAll("body *")].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13).map(e => e.tagName),
    }));
    check(lay.scrollW <= 400, `${scheme}: no sideways scroll (${lay.scrollW} px)`);
    check(lay.smallTaps.length === 0, `${scheme}: taps ≥ 44 px ${lay.smallTaps.join(" ")}`);
    check(lay.smallText.length === 0, `${scheme}: text ≥ 13 px ${lay.smallText.join(" ")}`);
    check(errors.length === 0, `${scheme}: no page errors ${errors.join(" | ")}`);
    mkdirSync(new URL("test-results/", root), { recursive: true });
    await page.screenshot({ path: new URL(`test-results/lab-400-${scheme}.png`, root).pathname, fullPage: true });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(fails.length ? `lab-smoke: ${fails.length} FAILED` : "lab-smoke: all passed");
process.exit(fails.length ? 1 : 0);
