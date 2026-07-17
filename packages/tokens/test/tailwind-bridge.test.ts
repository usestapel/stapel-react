import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Proof (frontend-guardrails, user decision 2026-07-06) that the Tailwind
// bridge yields VANILLA, STATIC utilities the JIT can see — and that the
// legacy-port anti-pattern (interpolated arbitrary values) is JIT-invisible.
// We drive the real Tailwind v4 CLI over a mini fixture and inspect its output.

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(here, "fixtures/tailwind");
const pkgRoot = resolve(here, "..");
const repoRoot = resolve(here, "../../..");

function tailwindBin(): string | null {
  for (const p of [
    resolve(pkgRoot, "node_modules/.bin/tailwindcss"),
    resolve(repoRoot, "node_modules/.bin/tailwindcss"),
  ]) {
    if (existsSync(p)) return p;
  }
  return null;
}

describe("Tailwind bridge — static utilities are JIT-visible", () => {
  const bin = tailwindBin();

  it("compiles the fixture and emits utilities for every static token class", () => {
    if (!bin) throw new Error("tailwindcss CLI not found — is @tailwindcss/cli installed?");
    const outFile = resolve(mkdtempSync(resolve(tmpdir(), "stapel-tw-")), "out.css");
    execFileSync(bin, ["-i", "input.css", "-o", outFile], {
      cwd: fixtureDir,
      stdio: "pipe",
    });
    const css = readFileSync(outFile, "utf8");

    // 1) Static utilities from markup.html are present…
    expect(css).toContain(".bg-surface");
    expect(css).toContain(".text-text");
    expect(css).toContain(".border-border");
    expect(css).toContain(".bg-brand");
    expect(css).toContain(".text-link");
    expect(css).toContain(".bg-brand-subtle");
    // …and the static class from the .tsx source is picked up too.
    expect(css).toContain(".bg-surface-raised");

    // 2) …and they chain through our CSS custom properties (the bridge).
    expect(css).toContain("var(--stapel-surface)");
    expect(css).toContain("var(--stapel-brand)");

    // 3) The interpolated anti-pattern is INVISIBLE: no utility resolves the
    //    `bg-[${brand}]` source text to the brand var.
    expect(css).not.toContain("${brand}");
    expect(css).not.toMatch(/\.bg-\\?\[\\?\$/);
  }, 60_000); // spawns the tailwindcss CLI — slow under parallel full-CI load
});
