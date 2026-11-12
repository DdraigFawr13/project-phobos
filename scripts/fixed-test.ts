// npm run fixed-test: the training set's IAE per segment for the fixed and the retuned PI, in m·s (spec "Fixed test").
import { SEGMENTS, runFixedTest, formatTable } from "../src/sim/fixed-test.ts";

process.stdout.write(formatTable(runFixedTest(SEGMENTS.training)));
