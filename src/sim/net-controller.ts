// A Controller that runs an integer net on the Lab net inputs (spec "Controller interface", "Lab net inputs").
// The inputs (and their float error integral) live in net-inputs.ts; the net itself is integer only.
import { forward } from "../runtime/net.ts";
import { valveOf } from "../model/nets.ts";
import { makeNetInputs } from "./net-inputs.ts";
import type { Controller } from "./pi.ts";
import type { Layer } from "../num/layer.ts";

export function makeNetController(layers: Layer[]): Controller & { readonly last: Int16Array | null } {
  const inputs = makeNetInputs();
  let last: Int16Array | null = null;
  return {
    get last() {
      return last;
    },
    reset(level) {
      inputs.reset(level);
      last = null;
    },
    step(measured, setpoint) {
      last = inputs.next(measured, setpoint);
      const valve = valveOf(forward(layers, last).at(-1)![0]);
      inputs.after(valve);
      return valve;
    },
  };
}
