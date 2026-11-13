// `npm run train:lab`: trains the Lab net and writes models/lab/ (docs/specs/first-usable.md "Trainer").
// S5: the copy phase only; weights.json is copy-weights.json until S6 adds the ES phase. Prints the time taken
// (D-008: a run over 10 minutes moves the block to a Python trainer).
import { mkdirSync, writeFileSync } from "node:fs";
import { copyFiles } from "../src/train/copy.ts";

const t0 = performance.now();
const files = copyFiles();
const dir = new URL("../models/lab/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [name, text] of Object.entries(files)) writeFileSync(new URL(name, dir), text);
console.log(`train:lab: wrote ${Object.keys(files).join(", ")} in ${((performance.now() - t0) / 1000).toFixed(2)} s`);
