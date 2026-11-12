// The dense layer type (spec "Numbers", "Weight file"). y = act(sat16(shr(Σ w·x, shift) + b)).
export type Act = "tanh" | "exp" | "none";

export type Layer = {
  kind: "dense";
  in: number;
  out: number;
  /** A weight's real value is w / 2^shift; shift is in [0, 14]. */
  shift: number;
  /** Row-major [out][in], flattened: w[o * in + i]. */
  w: Int16Array;
  /** Q12 at output scale. */
  b: Int16Array;
  act: Act;
};
