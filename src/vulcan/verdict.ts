// The verdict (docs/specs/vulcan-bench.md J6; D-020, D-021 R9 and R10, D-022): Yes only if Morgan picks the net in
// at least 16 of its 24 blind pairs **and** the floor holds on every held-out seed. The table's 12 pairs and its floor
// are counted and printed beside it but never change the net's verdict. The key comes from pairKey() (pairs.ts).
// Pure: picks.json is the ArtifactData `list` output of the report page's `picks` collection, read as id → data.v.
import { pairKey, type KeyEntry } from "./pairs.ts";
import { floorMisses, missList, type FloorFile, type FloorKey } from "./floor.ts";
import type { Kind } from "./train.ts";

export const PASS_PICKS = 16;

export type Picks = Map<string, "A" | "B">;

/** Picks from the ArtifactData list output saved as is: its text (one JSON doc per line between banner lines), or
 *  JSON holding a list of docs (or a bare list), each with an `id` and `data.v` of "A" or "B". Throws on any other
 *  value. */
export function readPicks(file: unknown): Picks {
  if (typeof file === "string") {
    // As the tool prints it: banner lines around one JSON doc per line, or plain JSON.
    try {
      return readPicks(JSON.parse(file));
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
    const docs = file
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{") && l.endsWith("}"))
      .map((l) => JSON.parse(l));
    return readPicks({ docs });
  }
  const f = file as Record<string, unknown>;
  const list = Array.isArray(file)
    ? file
    : (["docs", "documents", "items", "results", "data"].map((k) => f?.[k]).find(Array.isArray) as unknown[]);
  if (!list) throw new Error("picks: no list of docs found (want the ArtifactData list output)");
  const out: Picks = new Map();
  for (const d of list as { id?: string; doc_id?: string; data?: { v?: unknown } }[]) {
    const id = String(d.id ?? d.doc_id ?? "")
      .split("/")
      .pop()!;
    const v = d.data?.v;
    if (v !== "A" && v !== "B") throw new Error(`picks: ${id || "a doc"} has v ${JSON.stringify(v)}, want "A" or "B"`);
    out.set(id, v);
  }
  return out;
}

export interface Score {
  picked: number;
  of: number;
}
export interface SeedVerdict {
  seed: string;
  misses: FloorKey[];
  holds: boolean;
  /** The table's floor misses on this seed (printed, not judged). */
  tableMisses: FloorKey[];
}
export interface Verdict {
  net: Score;
  table: Score;
  /** Net pair ids with no pick: no verdict until they are rated. */
  unrated: string[];
  seeds: SeedVerdict[];
  floorHolds: boolean;
  tableFloorHolds: boolean;
  yes: boolean;
}

export function verdictOf(picks: Picks, floor: FloorFile, key: KeyEntry[] = pairKey()): Verdict {
  const score = (kind: Kind): Score => {
    const ks = key.filter((k) => k.kind === kind);
    return { picked: ks.filter((k) => picks.get(k.id) === k.side).length, of: ks.length };
  };
  const unrated = key.filter((k) => k.kind === "net" && !picks.has(k.id)).map((k) => k.id);
  const seeds = floor.seeds.map((s) => {
    const misses = missList(floorMisses(s.today, s.net, floor.worse));
    return {
      seed: s.seed,
      misses,
      holds: misses.length === 0,
      tableMisses: missList(floorMisses(s.today, s.table, floor.worse)),
    };
  });
  const net = score("net");
  const floorHolds = seeds.length === 5 && seeds.every((s) => s.holds);
  return {
    net,
    table: score("table"),
    unrated,
    seeds,
    floorHolds,
    tableFloorHolds: seeds.every((s) => s.tableMisses.length === 0),
    yes: unrated.length === 0 && net.picked >= PASS_PICKS && floorHolds,
  };
}

/** The lines `verdict:vulcan` prints. */
export function verdictText(v: Verdict): string {
  const seed = (s: SeedVerdict) =>
    `  ${s.seed}: net ${s.holds ? "holds" : `misses ${s.misses.join(", ")}`}; table ${
      s.tableMisses.length ? `misses ${s.tableMisses.join(", ")}` : "holds"
    }`;
  return [
    `net picked in ${v.net.picked} of ${v.net.of} pairs (needs ${PASS_PICKS})`,
    `table picked in ${v.table.picked} of ${v.table.of} pairs (shown only; not part of the verdict)`,
    ...(v.unrated.length ? [`unrated net pairs: ${v.unrated.join(" ")}`] : []),
    "floor, held-out seeds (D-020, R9, D-022):",
    ...v.seeds.map(seed),
    `floor: net ${v.floorHolds ? "holds" : "misses"} on every seed; table ${v.tableFloorHolds ? "holds" : "misses"}`,
    `verdict: ${v.unrated.length ? "none yet (rate every pair first)" : v.yes ? "Yes" : "No"}`,
  ].join("\n");
}
