// Action mask and argmax in the integer runtime (spec "Runtime"; D-006). −32768 marks a forbidden action, so
// allowed scores are clamped to ≥ −32767 and always beat it. The lowest index wins ties.
export const FORBIDDEN = -32768;

export function mask(scores: Int16Array, allowed: boolean[]): Int16Array {
  const m = new Int16Array(scores.length);
  for (let i = 0; i < scores.length; i++) m[i] = !allowed[i] ? FORBIDDEN : scores[i] < -32767 ? -32767 : scores[i];
  return m;
}

/** Index of the largest score, lowest index on ties; −1 if every action is forbidden (−32768). */
export function argmax(v: Int16Array): number {
  let best = -1;
  for (let i = 0; i < v.length; i++) if (v[i] !== FORBIDDEN && (best < 0 || v[i] > v[best])) best = i;
  return best;
}
