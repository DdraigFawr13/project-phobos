// npm run verdict:vulcan -- <picks.json> (docs/specs/vulcan-bench.md J6; D-020, D-021 R9 and R10, D-022). Reads
// Morgan's picks (the ArtifactData `list` output of the report page's `picks` collection, saved as is), the committed
// pair list and floor, rebuilds the key from the seeded draws (pairs.ts pairKey) and prints the net's picks out of 24,
// the table's out of 12, each seed's floor result for both, and Yes or No for the net. Needs no Vulcan checkout.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pairKey, type Pair } from "../src/vulcan/pairs.ts";
import { readPicks, verdictOf, verdictText } from "../src/vulcan/verdict.ts";
import type { FloorFile } from "../src/vulcan/floor.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const path = process.argv[2];
if (!path) {
  process.stderr.write("usage: npm run verdict:vulcan -- <picks.json>\n");
  process.exit(1);
}
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const pairs: Pair[] = read(resolve(ROOT, "models/vulcan/pairs.json"));
const floor: FloorFile = read(resolve(ROOT, "models/vulcan/floor.json"));
const key = pairKey();
const ids = pairs.map((p) => p.id).join(" ");
if (ids !== key.map((k) => k.id).join(" ")) {
  process.stderr.write("verdict:vulcan: models/vulcan/pairs.json does not match the key's 36 pair ids\n");
  process.exit(1);
}
const picks = readPicks(readFileSync(resolve(path), "utf8"));
const extra = [...picks.keys()].filter((id) => !key.some((k) => k.id === id));
if (extra.length) process.stderr.write(`verdict:vulcan: ignoring picks for unknown ids ${extra.join(" ")}\n`);
process.stdout.write(`vulcan ${floor.vulcan}\n${verdictText(verdictOf(picks, floor, key))}\n`);
