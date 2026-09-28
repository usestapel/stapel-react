// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `/upload` is framework-free: it runs in a worker, a plain script, or any
 * host. Its runtime imports stay inside the folder; the generated contract is
 * reached for types only. And the main entry does not pull it in.
 */
const SRC = resolve(fileURLToPath(new URL(".", import.meta.url)), "../src");

describe("/upload subpath purity", () => {
  it("imports nothing at runtime outside src/upload", () => {
    const dir = join(SRC, "upload");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
      const text = readFileSync(join(dir, f), "utf8");
      for (const m of text.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gms)) {
        const typeOnly = Boolean(m[1]);
        const spec = m[2] as string;
        if (typeOnly) continue;
        expect(spec.startsWith("./"), `${f} imports ${spec} at runtime`).toBe(true);
      }
    }
  });

  it("is not re-exported from the main entry", () => {
    const index = readFileSync(join(SRC, "index.ts"), "utf8");
    expect(index).not.toMatch(/["']\.\/upload/);
  });
});
