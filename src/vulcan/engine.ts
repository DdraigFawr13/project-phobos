// Reaching Vulcan (docs/specs/vulcan-bench.md "Reaching Vulcan", R6): a Vulcan checkout at VULCAN_DIR (default
// ../Project-Vulcan, beside this repo) whose HEAD is the commit in `vulcan.pin` and whose tree is clean. Every bench
// result carries that commit. The engine is loaded through Vulcan's own `tools/engine.mjs` (Vite's module runner),
// so it needs Vulcan's node_modules (docs/vulcan-setup.md). Only the types the bench uses are declared here.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** A row of one of Vulcan's entity tables (`world.entities.<kind>`); fields as Vulcan's tables declare them. */
export type Row = Record<string, any> & { id: number };
export interface PersonRow extends Row {
  name: string;
  status: string;
  doing: string;
}
export interface NeedRow extends Row {
  person: number;
  need: string;
  value: number;
  low: number;
}
export interface ItemRow extends Row {
  kind: string;
  count: number;
  holder: number;
  x: number;
  y: number;
  z: number;
}
export interface TraitRow extends Row {
  person: number;
  trait: string;
}
export interface World {
  tick: number;
  entities: {
    person: PersonRow[];
    need: NeedRow[];
    item: ItemRow[];
    trait: TraitRow[];
    mood: (Row & { value: number })[];
    store: (Row & { x: number; y: number; z: number })[];
    house?: (Row & { state: string })[];
    [kind: string]: Row[] | undefined;
  };
  [key: string]: unknown;
}
/** A ledger line as `step` returns it. */
export interface Line {
  id: number;
  type: string;
  data: Record<string, any>;
  [key: string]: unknown;
}
export interface Content {
  items: { id: string; good?: string }[];
  life: { scale: number; needs: { id: string; seek?: number; low?: number }[] };
  calendar: { daysPerMonth: number; monthsPerYear: number; seasons: string[]; [key: string]: unknown };
  [key: string]: unknown;
}
export interface Sim {
  content: Content;
  notable(line: Line): boolean;
  /** Event templates by line type, from `content.events` (Vulcan `src/engine/sim/world.ts`). */
  templates?: Map<string, string>;
  hooks: { line?: LineHook };
  [key: string]: unknown;
}
export type LineNeed = "food" | "water" | "rest" | "recreation" | "warmth";
/** What a line hook is told: Vulcan's `SystemContext`, of which the bench reads only these. */
export interface SystemContext {
  world: World;
  content: Content;
  [key: string]: unknown;
}
export type LineHook = (ctx: SystemContext, p: PersonRow, need: LineNeed, today: number) => number;

/** What S1's `tools/engine-entry.ts` exports and the bench uses. */
export interface Engine {
  createSim(content: Content): Sim;
  createWorld(sim: Sim, seed: string): World;
  step(world: World, sim: Sim, ticks: number): Line[];
  content: Content;
  TICKS_PER_DAY: number;
  MAP_SEEDS: readonly string[];
  setLineHook(sim: Sim, hook: LineHook | undefined): void;
  /** Vulcan `src/engine/core/clock.ts`: `season` is an index into `calendar.seasons`. */
  clockAt(
    tick: number,
    calendar: Content["calendar"],
  ): { year: number; month: number; day: number; hour: number; minute: number; season: number };
  hoursOf(world: World, content: Content, person: number): { workFrom: number; workTo: number; sleepFrom: number };
  growSpot(world: World, content: Content): unknown;
}

export interface Vulcan {
  engine: Engine;
  /** The full hash of the checkout's HEAD, equal to `vulcan.pin`. */
  commit: string;
  dir: string;
}

/** The Vulcan checkout the bench reads: VULCAN_DIR, or ../Project-Vulcan beside this repo. */
export const vulcanDir = (): string => resolve(process.env.VULCAN_DIR ?? resolve(ROOT, "../Project-Vulcan"));

/** The pinned Vulcan commit (full hash), from `vulcan.pin`. */
export const readPin = (): string => readFileSync(resolve(ROOT, "vulcan.pin"), "utf8").trim();

const git = (dir: string, ...args: string[]): string =>
  execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** Why `dir` can't be benched (not a checkout, dirty, or not at the pin), or null when it can. */
export function refusal(dir: string, pin = readPin()): string | null {
  let head: string;
  try {
    head = git(dir, "rev-parse", "HEAD");
  } catch {
    return `Vulcan checkout ${dir} not found (set VULCAN_DIR; docs/vulcan-setup.md)`;
  }
  const status = git(dir, "status", "--porcelain");
  if (status) return `Vulcan checkout ${dir} has uncommitted changes: ${status.split("\n").join("; ")}`;
  if (head !== pin) return `Vulcan checkout ${dir} is at ${head}, not the pinned ${pin} (vulcan.pin)`;
  return null;
}

/** Checks the checkout, then loads Vulcan's engine; throws with the reason when it refuses. */
export async function loadVulcan(dir = vulcanDir()): Promise<Vulcan> {
  const why = refusal(dir);
  if (why) throw new VulcanRefused(why);
  const mod = (await import(pathToFileURL(resolve(dir, "tools/engine.mjs")).href)) as { engine: Engine };
  return { engine: mod.engine, commit: readPin(), dir };
}

export class VulcanRefused extends Error {}
