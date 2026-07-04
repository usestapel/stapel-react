// Emits dist/tokens.css from the compiled TS tokens. Runs after `tsc` in the
// package build; deterministic output (see test/css.test.ts).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { generateTokensCss } = await import(join(here, "../dist/css.js"));

const out = join(here, "../dist/tokens.css");
writeFileSync(out, generateTokensCss(), "utf8");
console.log(`wrote ${out}`);
