// The verdict (docs/specs/first-usable.md "Verdict", J5; D-011): on the held-out segments and noise seeds 101 to
// 105, the net's IAE and valve travel beside the fixed and the retuned PI's, and D-011's yes/no. Also the
// training-set IAE that ES minimises. Same segment runs as the fixed test (fixed-test.ts), so the columns match.
import { SEGMENTS, SEEDS, runSegment, runFixedTest, type Segment, type Score } from "./fixed-test.ts";
import { makeNetController } from "./net-controller.ts";
import type { Layer } from "../num/layer.ts";

export type VerdictRow = { name: string; net: Score; fixed: Score; retuned: Score };
export type Checks = { lowerTotal: boolean; noSegmentOver5: boolean; travelWithin2x: boolean };
export type Verdict = {
  version: 1; seeds: number[]; rows: VerdictRow[];
  total: { net: Score; fixed: Score; retuned: Score };
  checks: Checks; worthIt: boolean;
};

/** The net on each segment: mean IAE and travel over the seeds; total = sum over segments. */
export function scoreNet(layers: Layer[], segments: readonly Segment[], seeds: readonly number[]) {
  const rows = segments.map(seg => {
    let iae = 0, travel = 0;
    for (const s of seeds) { const r = runSegment(seg, makeNetController(layers), s); iae += r.iae; travel += r.travel; }
    return { name: seg.name, iae: iae / seeds.length, travel: travel / seeds.length };
  });
  const total = { iae: rows.reduce((a, r) => a + r.iae, 0), travel: rows.reduce((a, r) => a + r.travel, 0) };
  return { rows, total };
}

/** ES's score: total training-set IAE (5 segments, mean over seeds 1 to 5), in m·s. Lower is better. */
export const trainingIae = (layers: Layer[]) => scoreNet(layers, SEGMENTS.training, SEEDS.training).total.iae;

const sum = (rows: VerdictRow[], k: "net" | "fixed" | "retuned"): Score => ({
  iae: rows.reduce((a, r) => a + r[k].iae, 0), travel: rows.reduce((a, r) => a + r[k].travel, 0),
});

/** D-011: worth it when total IAE is lower than the fixed PI's, no segment is more than 5% worse, and total valve
 *  travel is at most 2× the fixed PI's (travel includes the twitching at sensor noise; Morgan kept that, 2026-11-13). */
export function judge(rows: VerdictRow[]) {
  const total = { net: sum(rows, "net"), fixed: sum(rows, "fixed"), retuned: sum(rows, "retuned") };
  const checks: Checks = {
    lowerTotal: total.net.iae < total.fixed.iae,
    noSegmentOver5: rows.every(r => r.net.iae <= 1.05 * r.fixed.iae),
    travelWithin2x: total.net.travel <= 2 * total.fixed.travel,
  };
  return { total, checks, worthIt: checks.lowerTotal && checks.noSegmentOver5 && checks.travelWithin2x };
}

/** The held-out verdict for a net (models/lab/verdict.json is this for the final weights). */
export function verdictOf(layers: Layer[]): Verdict {
  const pi = runFixedTest(SEGMENTS.heldOut, { seeds: SEEDS.heldOut });
  const net = scoreNet(layers, SEGMENTS.heldOut, SEEDS.heldOut);
  const rows = pi.rows.map((r, i) => ({ name: r.name, net: { iae: net.rows[i].iae, travel: net.rows[i].travel }, fixed: r.fixed, retuned: r.retuned }));
  return { version: 1, seeds: [...SEEDS.heldOut], rows, ...judge(rows) };
}
