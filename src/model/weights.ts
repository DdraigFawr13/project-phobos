// Phobos weight files (spec "Weight file", D-010): format "phobos-weights", version 1, no timestamp.
import { checkBound } from "../num/quantise.ts";
import type { Act, Layer } from "../num/layer.ts";

export type LayerJson = { kind: "dense"; in: number; out: number; shift: number; w: number[]; b: number[]; act: Act };
export type Meta = { trainer: string; seed: number };
export type WeightFile = { format: "phobos-weights"; version: 1; layers: LayerJson[]; meta: Meta };

export const toWeightFile = (layers: Layer[], meta: Meta): WeightFile => ({
  format: "phobos-weights",
  version: 1,
  meta,
  layers: layers.map((l) => ({
    kind: "dense",
    in: l.in,
    out: l.out,
    shift: l.shift,
    w: [...l.w],
    b: [...l.b],
    act: l.act,
  })),
});

const isInt16 = (v: unknown) => Number.isInteger(v) && (v as number) >= -32768 && (v as number) <= 32767;

/** Throws on another format or version, a wrong w or b length, a value outside int16, a shift outside [0, 14],
 *  an unknown kind or act, a layer whose `in` isn't the previous layer's `out`, or a failed checkBound. */
export function loadWeights(file: any, opts: { limit?: number } = {}): { layers: Layer[]; meta: Meta } {
  if (file?.format !== "phobos-weights") throw new Error(`weights: format ${file?.format}, want phobos-weights`);
  if (file.version !== 1) throw new Error(`weights: version ${file.version}, want 1`);
  if (!Array.isArray(file.layers) || file.layers.length === 0) throw new Error("weights: no layers");
  const layers = (file.layers as any[]).map((l, k): Layer => {
    const at = `weights: layer ${k}`;
    if (l.kind !== "dense") throw new Error(`${at}: kind ${l.kind}`);
    if (!["tanh", "exp", "none"].includes(l.act)) throw new Error(`${at}: act ${l.act}`);
    if (!Number.isInteger(l.in) || !Number.isInteger(l.out) || l.in < 1 || l.out < 1)
      throw new Error(`${at}: in ${l.in}, out ${l.out}`);
    if (!Number.isInteger(l.shift) || l.shift < 0 || l.shift > 14)
      throw new Error(`${at}: shift ${l.shift} outside [0, 14]`);
    if (!Array.isArray(l.w) || l.w.length !== l.in * l.out)
      throw new Error(`${at}: w has ${l.w?.length} values, want ${l.in * l.out}`);
    if (!Array.isArray(l.b) || l.b.length !== l.out)
      throw new Error(`${at}: b has ${l.b?.length} values, want ${l.out}`);
    if (!l.w.every(isInt16) || !l.b.every(isInt16)) throw new Error(`${at}: a value is not an int16`);
    if (k > 0 && l.in !== file.layers[k - 1].out)
      throw new Error(`${at}: in ${l.in}, but the previous layer outputs ${file.layers[k - 1].out}`);
    const layer: Layer = {
      kind: "dense",
      in: l.in,
      out: l.out,
      shift: l.shift,
      w: Int16Array.from(l.w),
      b: Int16Array.from(l.b),
      act: l.act,
    };
    checkBound(layer, opts.limit);
    return layer;
  });
  return { layers, meta: file.meta };
}
