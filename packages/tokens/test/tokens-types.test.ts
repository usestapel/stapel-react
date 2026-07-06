import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Proof that the generated token-name unions are enforced by the compiler:
// tsc must accept the valid usages AND the @ts-expect-error'd bad ones (i.e.
// the union genuinely rejects typos). A regression that widened cssVar to
// `string` would make the @ts-expect-error lines unused → tsc fails here.

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

describe("typed token names (tsc on a consumer fixture)", () => {
  it("type-checks the consumer fixture cleanly", () => {
    const tsc = require.resolve("typescript/bin/tsc");
    const cfg = resolve(here, "fixtures/tsconfig.consumer.json");
    // Throws (non-zero exit) if tsc reports any diagnostic.
    execFileSync(process.execPath, [tsc, "--noEmit", "-p", cfg], { stdio: "pipe" });
    expect(true).toBe(true);
  });
});
