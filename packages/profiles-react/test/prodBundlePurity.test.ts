// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Introspection-gating, layer 1 (frontend-guardrails §5.1): the showcase/demo
 * tooling is OUT of the pair's production bundle *by construction*, not by a
 * runtime flag. A pair is a headless product surface; the showcase format
 * (`@stapel/showcase`) and the `*.demo.tsx` files exist only to author demos and
 * must never reach a customer's app or the published tarball. This test is the
 * teeth: it fails if a demo dependency leaks into the runtime graph or the demos
 * slip into the shipped files.
 *
 * Runs via the dedicated `test:pack` script (CI serializes it across packages
 * with --workspace-concurrency=1): the `npm pack` below is real I/O, too heavy
 * for the parallel turbo `test` graph, so the default `test` run excludes it.
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
  it("no showcase package is a runtime (deps) or peer dependency", () => {
    const runtime = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };
    const leaked = INTROSPECTION_ONLY.filter((name) => name in runtime);
    expect(leaked).toEqual([]);
  });

  it("@stapel/showcase is present, but only as a devDependency", () => {
    // It IS used (to author demos) — so assert the intended location, not just
    // absence, to catch an accidental promotion to dependencies.
    expect(pkg.devDependencies ?? {}).toHaveProperty("@stapel/showcase");
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
    const paths: string[] = JSON.parse(out)[0].files.map(
      (f: { path: string }) => f.path
    );
    expect(paths.filter((p) => /(^|\/)demo(\/|\.)/i.test(p))).toEqual([]);
    expect(paths.filter((p) => /showcase/i.test(p))).toEqual([]);
  }, 120_000); // real npm-pack I/O; generous — runs in the serialized `test:pack` CI step
});
