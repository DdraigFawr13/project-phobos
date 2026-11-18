// R10's hand-written rival (docs/specs/vulcan-bench.md R10, D-021): a table of line offsets by season and trait, 70
// integers, searched by the same ES loop, windows and score as the line net (src/vulcan/train.ts). A line's offset is
// its season offset plus the sum of the person's trait offsets, clamped to ±1000. Integer maths only.
import { ONE } from "../num/fixed.ts";
import { DOINGS, LINE_NEEDS, MAX_OFFSET, NEED_INPUTS, SEASONS, TRAITS } from "./inputs.ts";

const clampOffset = (v: number) => (v > MAX_OFFSET ? MAX_OFFSET : v < -MAX_OFFSET ? -MAX_OFFSET : v);

/** The table (70 integers, season then trait, line order): param[s × 5 + l] for season s, then
 *  param[20 + t × 5 + l] for trait t. A line's offset = its season offset + the sum of the person's trait offsets,
 *  clamped to ±1000. Reads only the season and trait inputs. */
export const TABLE_PARAMS = (SEASONS.length + TRAITS.length) * LINE_NEEDS.length;
const SEASON_AT = NEED_INPUTS.length + DOINGS.length + 2;
const TRAIT_AT = SEASON_AT + SEASONS.length + 2;
export function tableOffsets(params: ArrayLike<number>, x: Int16Array): number[] {
  const out: number[] = [];
  for (let l = 0; l < LINE_NEEDS.length; l++) {
    let v = 0;
    for (let s = 0; s < SEASONS.length; s++) if (x[SEASON_AT + s] === ONE) v += params[s * LINE_NEEDS.length + l];
    for (let t = 0; t < TRAITS.length; t++)
      if (x[TRAIT_AT + t] === ONE) v += params[(SEASONS.length + t) * LINE_NEEDS.length + l];
    out.push(clampOffset(v));
  }
  return out;
}

export interface TableFile {
  format: "phobos-vulcan-table";
  version: 1;
  params: number[];
  meta: { trainer: string; seed: number; vulcan: string; sigma?: number; alpha?: number };
}
export const toTableFile = (params: number[], meta: TableFile["meta"]): TableFile => ({
  format: "phobos-vulcan-table",
  version: 1,
  meta,
  params: [...params],
});
/** Throws on another format or version, or params that aren't 70 integers. */
export function loadTable(file: any): TableFile {
  if (file?.format !== "phobos-vulcan-table" || file.version !== 1)
    throw new Error(`table: format ${file?.format} v${file?.version}, want phobos-vulcan-table v1`);
  if (!Array.isArray(file.params) || file.params.length !== TABLE_PARAMS || !file.params.every(Number.isInteger))
    throw new Error(`table: want ${TABLE_PARAMS} integer params`);
  return file;
}
