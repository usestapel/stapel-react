// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Introspection-gating, layer 1 (frontend-guardrails §5.1): showcase/demo
 * tooling stays OUT of the pair's production bundle *by construction*. This
 * pair ships no demo/ yet (follow-up alongside contract enrollment), so the
 * test asserts the invariants that must hold from day one: no showcase
 * package anywhere near the runtime graph, and a published tarball free of
 * demo/showcase files.
 *
 * Runs via the dedicated `test:pack` script (CI serializes it across packages
 * with --workspace-concurrency=1): the `npm pack` below is real I/O, too
 * heavy for the parallel turbo `test` graph.
 */
const PKG_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const pkg = JSON.parse(
  readFileSync(resolve(PKG_DIR, "package.json"), "utf8")
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  files?: string[];
};

const INTROSPECTION_ONLY = ["@stapel/showcase", "@stapel/showcase-viewer"];

describe("prod bundle carries no showcase/demo code (§5.1)", () => {
  it("no showcase package is a dependency in ANY group (none needed until demos exist)", () => {
    const everywhere = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    const leaked = INTROSPECTION_ONLY.filter((name) => name in everywhere);
    expect(leaked).toEqual([]);
  });

  it("the published `files` allowlist excludes demo/", () => {
    const files = pkg.files ?? [];
    expect(files).not.toContain("demo");
    expect(files.some((f) => /(^|\/)demo(\/|$)/.test(f))).toBe(false);
  });

  it("the packed tarball contains no demo or showcase files", () => {
    // `npm pack --dry-run --json` reports exactly what would publish, honoring
    // the files allowlist + .npmignore — the ground truth, not just config.
    const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: PKG_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    // npm <11 emits an array `[{ files }]`; npm >=11 emits an object keyed
    // by package name. Tolerate both: take the sole report.
    const parsed: unknown = JSON.parse(out);
    const report = (
      Array.isArray(parsed)
        ? parsed[0]
        : Object.values(parsed as Record<string, unknown>)[0]
    ) as { files: { path: string }[] };
    const paths: string[] = report.files.map((f) => f.path);
    expect(paths.filter((p) => /(^|\/)demo(\/|\.)/i.test(p))).toEqual([]);
    expect(paths.filter((p) => /showcase/i.test(p))).toEqual([]);
  }, 120_000); // real npm-pack I/O; runs in the serialized `test:pack` CI step
});
