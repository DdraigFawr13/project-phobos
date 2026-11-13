// ES phase (docs/specs/first-usable.md "Trainer", D-008, D-013, D-017): evolution strategies tune the integer net
// directly, so the net that ships is the net that was scored. Shifts stay as quantisation set them; every weight
// and bias is an int16 that moves in whole LSB steps. Node only (it is fed a fitness evaluator, see pool.ts).
import { makeRng, type Rng } from "../rng.ts";
import { sat16 } from "../num/fixed.ts";
import type { Layer } from "../num/layer.ts";

/** D-017 (re-checked in S6): noise 32 LSB and step 128 replace the spec's first guesses 64 and 512, which made
 *  training IAE swing by about ±2 m·s between generations instead of falling. */
export const ES = { sigma: 32, alpha: 128, generations: 50, population: 32, seed: 17, snapshotEvery: 5 } as const;

/** Lower is better: each member's total training IAE, in m·s, in the order given. */
export type Evaluate = (members: number[][]) => Promise<number[]>;

/** The net's 97 numbers in order: layer by layer, w (row-major) then b. */
export const flatten = (layers: Layer[]) => layers.flatMap((l) => [...l.w, ...l.b]);
/** The same layers (shifts, shapes, acts) with numbers from theta, in flatten's order. */
export function withParams(layers: Layer[], theta: number[]): Layer[] {
  let k = 0;
  return layers.map((l) => ({
    ...l,
    w: Int16Array.from(l.w, () => theta[k++]),
    b: Int16Array.from(l.b, () => theta[k++]),
  }));
}

/** Standard normal draws by Box-Muller: each pair of uniforms gives two draws, cos then sin. */
export function makeGauss(rng: Rng): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = rng.uniform();
    while (u === 0) u = rng.uniform();
    const v = rng.uniform(),
      m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  };
}

/** Centred ranks in [−0.5, 0.5]: the lowest IAE gets +0.5, the highest −0.5. Ties keep index order. */
export function centredRanks(iae: number[]): number[] {
  const order = [...iae.keys()].sort((a, b) => iae[b] - iae[a] || a - b); // worst first
  const r: number[] = new Array(iae.length);
  order.forEach((k, n) => {
    r[k] = n / (iae.length - 1) - 0.5;
  });
  return r;
}

/** One member: θ + round(σ·ε) LSB, saturated. */
export const perturb = (theta: number[], eps: number[], sigma: number) =>
  theta.map((t, i) => sat16(t + Math.round(sigma * eps[i])));

/** θ += round(α × Σ_k r_k ε_k / population) LSB, saturated. */
export function update(theta: number[], eps: number[][], ranks: number[], alpha: number): number[] {
  return theta.map((t, i) => {
    let s = 0;
    for (let k = 0; k < eps.length; k++) s += ranks[k] * eps[k][i];
    return sat16(t + Math.round((alpha * s) / eps.length));
  });
}

/** One generation: 16 antithetic pairs (ε, −ε), scored together, then the rank-weighted step. Draws come only
 *  from gauss, never from the scores, so a run's noise is fixed by the seed alone. */
export async function esGeneration(
  theta: number[],
  gauss: () => number,
  evaluate: Evaluate,
  opts: { sigma?: number; alpha?: number; population?: number } = {},
) {
  const sigma = opts.sigma ?? ES.sigma,
    alpha = opts.alpha ?? ES.alpha,
    pop = opts.population ?? ES.population;
  const eps: number[][] = [];
  for (let k = 0; k < pop / 2; k++) {
    const e = theta.map(() => gauss());
    eps.push(
      e,
      e.map((x) => -x),
    );
  }
  const iae = await evaluate(eps.map((e) => perturb(theta, e, sigma)));
  const ranks = centredRanks(iae);
  return { theta: update(theta, eps, ranks, alpha), eps, iae, ranks };
}

/** Generation 1 for one parameter, for Lab's worked example: the members' noise, scores and ranks, and the step. */
export type EsExample = { param: number; theta: number; eps: number[]; iae: number[]; ranks: number[]; next: number };

/** The ES phase from the copied net. Logs training IAE at generation 0 (the copied net) and after each
 *  generation; a snapshot every 5 generations. */
export async function trainEs(
  start: Layer[],
  evaluate: Evaluate,
  opts: { generations?: number; onGeneration?: (g: number, iae: number) => void } = {},
) {
  const gens = opts.generations ?? ES.generations,
    gauss = makeGauss(makeRng(ES.seed));
  let theta = flatten(start);
  const log: { step: number; iae: number }[] = [{ step: 0, iae: (await evaluate([theta]))[0] }];
  const snapshots: { step: number; layers: Layer[] }[] = [];
  let example: EsExample | null = null;
  for (let g = 1; g <= gens; g++) {
    const r = await esGeneration(theta, gauss, evaluate);
    if (g === 1) {
      const p = theta.length - 1; // the valve neuron's bias
      example = {
        param: p,
        theta: theta[p],
        eps: r.eps.map((e) => e[p]),
        iae: r.iae,
        ranks: r.ranks,
        next: r.theta[p],
      };
    }
    theta = r.theta;
    const iae = (await evaluate([theta]))[0];
    log.push({ step: g, iae });
    opts.onGeneration?.(g, iae);
    if (g % ES.snapshotEvery === 0) snapshots.push({ step: g, layers: withParams(start, theta) });
  }
  return { layers: withParams(start, theta), log, snapshots, example: example! };
}
