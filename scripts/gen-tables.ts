// Writes src/num/tables.gen.ts (spec "Tables"). Run: npm run gen-tables. Commit the result; tests/tables.test.ts
// checks a fresh generation against the committed file within 1 LSB.
import { writeFileSync } from "node:fs";
import { tablesSource } from "../src/num/gen.ts";

const out = new URL("../src/num/tables.gen.ts", import.meta.url);
writeFileSync(out, tablesSource());
console.log(`gen-tables: wrote src/num/tables.gen.ts`);
