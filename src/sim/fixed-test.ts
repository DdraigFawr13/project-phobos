// The fixed test (spec "Fixed test", J2): five 300 s segments, each run on noise seeds 1 to 5 (training) or
// 101 to 105 (held-out), for the PI tuned once at 1.0 m and the PI retuned for each segment's target.
// IAE is always on the true level, never the measured one. Units: m, s, m·s.
import { makeRng } from "../rng.ts";
import { makePlant, steadyValve, TANK } from "./plant.ts";
import { makePI, imcTi, FIXED_PI, type Controller } from "./pi.ts";

export type Segment = {
  name: string;
  start: number; // m, steady level at t = 0
  setpoint: number; // m, from t = 0 on
  disturb: [number, number] | null; // s, outflow × 1.2 from the first time up to (not including) the second
};

export const SEGMENT_S = 300;
export const STEPS = Math.round(SEGMENT_S / TANK.dt); // 3,000

const step = (a: number, b: number): Segment => ({
  name: `${a.toFixed(2)}→${b.toFixed(2)}`,
  start: a,
  setpoint: b,
  disturb: null,
});
const dist = (h: number): Segment => ({ name: `dist@${h.toFixed(2)}`, start: h, setpoint: h, disturb: [60, 120] });

export const SEGMENTS = {
  training: [step(0.5, 0.25), step(0.25, 1.0), step(1.0, 1.75), step(1.75, 0.5), dist(1.0)],
  heldOut: [step(0.75, 0.15), step(0.15, 1.4), step(1.4, 1.9), step(1.9, 0.75), dist(0.35)],
} as const satisfies Record<string, Segment[]>;
export const SEEDS = { training: [1, 2, 3, 4, 5], heldOut: [101, 102, 103, 104, 105] } as const;

export type Score = { iae: number; travel: number }; // m·s; Σ |change in clamped valve|
export type Row = { name: string; fixed: Score; retuned: Score };
export type FixedTestResult = { rows: Row[]; total: { fixed: Score; retuned: Score } };

/** The PI retuned for a segment: Ti = 40·√target, where a dist@ segment's target is its level. */
export const retunedPI = (seg: Segment) => makePI(FIXED_PI.Kp, imcTi(seg.setpoint));
export const fixedPI = () => makePI(FIXED_PI.Kp, FIXED_PI.Ti);

/** One run of one segment. The plant and controller start steady at seg.start; the setpoint steps at t = 0. */
export function runSegment(seg: Segment, ctrl: Controller, seed: number, noise = true): Score {
  const plant = makePlant({ level: seg.start, rng: noise ? makeRng(seed) : undefined });
  ctrl.reset(seg.start, seg.setpoint);
  const [d0, d1] = seg.disturb ? seg.disturb.map((s) => Math.round(s / TANK.dt)) : [0, 0];
  let iae = 0,
    travel = 0,
    prev = steadyValve(seg.start);
  for (let n = 0; n < STEPS; n++) {
    const valve = Math.min(1, Math.max(0, ctrl.step(plant.measure(), seg.setpoint)));
    travel += Math.abs(valve - prev);
    prev = valve;
    const level = plant.step(valve, n >= d0 && n < d1);
    iae += Math.abs(level - seg.setpoint) * TANK.dt;
  }
  return { iae, travel };
}

const mean = (xs: Score[]): Score => ({
  iae: xs.reduce((a, x) => a + x.iae, 0) / xs.length,
  travel: xs.reduce((a, x) => a + x.travel, 0) / xs.length,
});

export type Progress = { segment: number; run: number; name: string }; // 0-based segment and run (seed) index

/** The fixed test one run at a time: yields before each run (so Lab can show progress) and returns the result.
 *  Mean over seeds per segment; totals are sums over segments. Fixed and retuned see the same noise sequence. */
export function* fixedTestRuns(
  segments: readonly Segment[],
  opts: { seeds?: readonly number[]; noise?: boolean } = {},
): Generator<Progress, FixedTestResult> {
  const seeds = opts.seeds ?? SEEDS.training,
    noise = opts.noise ?? true;
  const rows: Row[] = [];
  for (const [i, seg] of segments.entries()) {
    const fixed: Score[] = [],
      retuned: Score[] = [];
    for (const [j, seed] of seeds.entries()) {
      yield { segment: i, run: j, name: seg.name };
      fixed.push(runSegment(seg, fixedPI(), seed, noise));
      retuned.push(runSegment(seg, retunedPI(seg), seed, noise));
    }
    rows.push({ name: seg.name, fixed: mean(fixed), retuned: mean(retuned) });
  }
  const sum = (k: "fixed" | "retuned"): Score => ({
    iae: rows.reduce((a, r) => a + r[k].iae, 0),
    travel: rows.reduce((a, r) => a + r[k].travel, 0),
  });
  return { rows, total: { fixed: sum("fixed"), retuned: sum("retuned") } };
}

export function runFixedTest(
  segments: readonly Segment[],
  opts: { seeds?: readonly number[]; noise?: boolean } = {},
): FixedTestResult {
  const g = fixedTestRuns(segments, opts);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

/** `npm run fixed-test`'s table: name, fixed IAE, retuned IAE, in m·s to 2 decimals. */
export function formatTable(r: FixedTestResult): string {
  const line = (a: string, b: string, c: string) => `${a.padEnd(10)}  ${b.padStart(8)}  ${c.padStart(10)}`;
  return (
    [
      line("segment", "fixedIAE", "retunedIAE"),
      ...r.rows.map((x) => line(x.name, x.fixed.iae.toFixed(2), x.retuned.iae.toFixed(2))),
      line("total", r.total.fixed.iae.toFixed(2), r.total.retuned.iae.toFixed(2)),
    ].join("\n") + "\n"
  );
}
