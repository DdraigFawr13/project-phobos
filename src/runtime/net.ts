// A net is a list of dense layers run in order (spec "Runtime"). Returns every layer's output, last one last.
import { dense } from "./dense.ts";
import type { Layer } from "../num/layer.ts";

export function forward(layers: Layer[], x: Int16Array): Int16Array[] {
  const outs: Int16Array[] = [];
  for (const L of layers) {
    x = dense(L, x);
    outs.push(x);
  }
  return outs;
}
