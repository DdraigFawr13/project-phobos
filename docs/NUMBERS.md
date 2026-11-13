# Numbers

How Phobos's integer runtime represents numbers. The rules are D-006 and D-007; the design is `docs/specs/first-usable.md` "Numbers" and "Tables". Code: `src/num/`. Lab's Tables tab shows the tables and their measured error.

## Values

- Q12 int16: 1.0 = 4096, range [−8, 8). One LSB = 1/4096 ≈ 0.00024.
- `sat16(x)` clamps to [−32768, 32767]. Saturate, never wrap.
- `shr(x, n)` = `Math.floor(x / 2 ** n)`: a floor shift, exact for integers below 2^53 because a power-of-two divide is exact in doubles. JS `>>` wraps above 2^31, and Structured Text integer division truncates, so an exporter must emit a floor, not a divide (D-006).

## Dense layer

- `y = act(sat16(shr(Σ w·x, shift) + b))`. A weight's real value is w / 2^shift, shift in [0, 14]. The bias is Q12 at output scale. `w` is row-major `[out][in]`, flattened (`src/num/layer.ts`).
- Sums are plain JS numbers. `checkBound(layer, limit = 2 ** 53)` throws when the largest row sum Σ|w| × 32768 reaches `limit`.
- At full scale a 4→16 layer reaches about 4.3 × 10^9 and a 16→1 layer about 1.7 × 10^10 (spec "Numbers"): far below 2^53 but above 2^31. A 32-bit PLC exporter will need smaller weights or wider sums (Later, D-004).

## Runtime, mask and the float reference (S4)

- `src/runtime/`: `dense(layer, x)` applies the layer's act; `forward(layers, x)` returns every layer's output; `mask(scores, allowed)` sets forbidden scores to −32768 and clamps allowed ones to ≥ −32767; `argmax(v)` skips −32768, the lowest index wins ties, and it returns −1 when every action is forbidden. No `Math.*` (a test greps for it).
- `src/ref/`: the float reference, used by tests and Lab's Integer vs float tab only. Weights w / 2^shift, biases b / 4096, fed the integer inputs / 4096, no saturation; exp is exp(min(x, 0)), the function its table covers.
- Layer gap: each layer gets the integer previous-layer output (dequantised) in both versions; range 2 for tanh, 1 for exp, and max(1, float max − min over all outputs and check states) for no activation.
- Measured 2026-11-12 on the 1,000 check states (`tests/runtime.test.ts`): test net (seed 7) layer gaps 0.028% and 0.007%, same masked action 100.0% (actions 1 and 3 chosen, 200 and 800 times); Lab-shaped net (seed 8) layer gaps 0.026% and 0.026%, valve within 0.01 on 100.0%, largest valve gap 0.0005. Limits: 1% and 99% (D-007). Golden outputs: `tests/golden/runtime-testnet.json`.
- Weight files (`src/model/weights.ts`): `loadWeights` also throws on an unknown `kind` or `act` and when a layer's `in` isn't the previous layer's `out`; both go beyond the spec's list.

## Quantising

Outside the runtime only (`src/num/quantise.ts`), with `Math.round` then saturation: shift = the largest integer in [0, 14] with max|w| × 2^shift ≤ 32767; w = round(w × 2^shift); b = round(b × 4096).

## Tables

- `scripts/gen-tables.ts` (`npm run gen-tables`) writes `src/num/tables.gen.ts`, committed. 1,025 entries each: `TANH[i] = round(4096 × tanh(i / 128))`, `EXP[i] = round(4096 × exp(−i / 128))`.
- Lookup on a = |x|: index a >> 5, fraction a & 31, result t[i] + shr((t[i+1] − t[i]) × f, 5). tanh clamps its input to [−32767, 32767] and negates for x < 0; exp clamps to [−32767, 0], so a positive input gives 4096.
- Measured 2026-11-12 over all 65,536 int16 inputs against round(4096 × f(x / 4096)): largest gap 1 LSB for tanh (0.012% of its 8,192 LSB range) and 1 LSB for exp (0.024% of 4,096); the limit is 2 LSB (`tests/tables.test.ts`).
- `Math.tanh` and `Math.exp` can differ across Node versions, so the test compares a fresh generation with the committed tables within 1 LSB, not for equality (spec Risks). Regenerate only on purpose, in a commit that says why (SIM-02).
