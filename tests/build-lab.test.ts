// S5 J4: scripts/build-lab.ts inlines models/lab/*.json when they exist and leaves the Net panel out when they
// don't (docs/specs/first-usable.md "Lab", J4). Builds in memory; writes nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildLabHtml } from "../scripts/build-lab.ts";

const MODELS = new URL("../models/lab/", import.meta.url);

test("Lab built with models/lab/ has the Net and Replay panels and the committed weights; built without, it has none of them", async () => {
  const empty = mkdtempSync(join(tmpdir(), "phobos-no-models-"));
  try {
    const withModels = await buildLabHtml(MODELS);
    const without = await buildLabHtml(pathToFileURL(empty + "/"));
    assert.match(withModels, /data-panel="net"/);
    assert.doesNotMatch(without, /data-panel="net"/);
    assert.match(withModels, /data-panel="replay"/);
    assert.doesNotMatch(without, /data-panel="replay"/);
    // the inlined weights are the committed file's numbers (first layer's first weights)
    const w = JSON.parse(readFileSync(new URL("weights.json", MODELS), "utf8"))
      .layers[0].w.slice(0, 8)
      .join(",");
    assert.ok(withModels.includes(w), "weights inlined");
    assert.ok(!without.includes("phobos-weights"), "no weights without models/lab/");
    // both pages still carry the earlier tabs
    for (const html of [withModels, without]) assert.match(html, /data-panel="ivf"/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
