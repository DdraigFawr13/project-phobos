// `npm run train:lab`: trains the Lab net and writes models/lab/ (docs/specs/first-usable.md "Trainer"): the copy
// phase, the ES phase on worker threads, and the held-out verdict. Prints the time taken (D-008: a run over
// 10 minutes moves the block to a Python trainer).
import { mkdirSync, writeFileSync } from "node:fs";
import { labFiles } from "../src/train/lab-files.ts";

const t0 = performance.now();
const secs = () => ((performance.now() - t0) / 1000).toFixed(1);
const files = await labFiles({ onGeneration: (g, iae) => { if (g % 5 === 0) console.log(`train:lab: ES generation ${g}, training IAE ${iae.toFixed(3)} m·s, ${secs()} s`); } });
const dir = new URL("../models/lab/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [name, text] of Object.entries(files)) writeFileSync(new URL(name, dir), text);
console.log(`train:lab: wrote ${Object.keys(files).join(", ")} in ${secs()} s`);
