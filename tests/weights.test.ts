// Weight file loader (docs/specs/first-usable.md "Weight file", D-010). S5 adds the committed models/lab/ file.
import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { loadWeights, toWeightFile } from "../src/model/weights.ts";
import { labShapedNet } from "../src/model/nets.ts";

const good = () => JSON.parse(JSON.stringify(toWeightFile(labShapedNet(), { trainer: "random", seed: 8 })));

test("a weight file round-trips: toWeightFile then loadWeights gives the same layers", () => {
  const f = good();
  assert.equal(f.format, "phobos-weights");
  assert.equal(f.version, 1);
  assert.deepEqual(f.meta, { trainer: "random", seed: 8 });
  assert.ok(!("timestamp" in f) && !("timestamp" in f.meta));
  const { layers, meta } = loadWeights(f);
  assert.deepEqual(layers, labShapedNet());
  assert.deepEqual(meta, { trainer: "random", seed: 8 });
});

test("the loader throws on a bad format, version, length, value, shift or act, and when checkBound fails", () => {
  const bad: [string, (f: any) => void][] = [
    ["format", f => { f.format = "other"; }],
    ["version", f => { f.version = 2; }],
    ["w length", f => { f.layers[0].w.pop(); }],
    ["b length", f => { f.layers[1].b.push(0); }],
    ["w above int16", f => { f.layers[0].w[3] = 32768; }],
    ["b below int16", f => { f.layers[0].b[0] = -32769; }],
    ["w not an integer", f => { f.layers[0].w[0] = 1.5; }],
    ["shift 15", f => { f.layers[0].shift = 15; }],
    ["shift −1", f => { f.layers[1].shift = -1; }],
    ["act", f => { f.layers[0].act = "relu"; }],
    ["kind", f => { f.layers[0].kind = "conv"; }],
    ["layer chain", f => { f.layers[1].in = 8; f.layers[1].w = f.layers[1].w.slice(0, 8); }],
  ];
  for (const [name, spoil] of bad) {
    const f = good();
    spoil(f);
    assert.throws(() => loadWeights(f), Error, name);
  }
  assert.doesNotThrow(() => loadWeights(good()));
  assert.throws(() => loadWeights(good(), { limit: 2 ** 20 }), /checkBound/);
});

test("the committed models/lab/ weight files load, and spoiling them throws (S5)", () => {
  for (const name of ["copy-weights.json", "weights.json"]) {
    const text = readFileSync(new URL(`../models/lab/${name}`, import.meta.url), "utf8");
    const { layers, meta } = loadWeights(JSON.parse(text));
    assert.deepEqual(layers.map(l => [l.in, l.out, l.act]), [[4, 16, "tanh"], [16, 1, "tanh"]], name);
    assert.equal(meta.trainer, "copy", name);
    const spoils: [string, (f: any) => void][] = [
      ["version", f => { f.version = 2; }],
      ["w length", f => { f.layers[0].w.pop(); }],
      ["out of range", f => { f.layers[1].w[0] = 40000; }],
      ["shift", f => { f.layers[0].shift = 15; }],
    ];
    for (const [what, spoil] of spoils) {
      const f = JSON.parse(text);
      spoil(f);
      assert.throws(() => loadWeights(f), Error, `${name}: ${what}`);
    }
  }
});
