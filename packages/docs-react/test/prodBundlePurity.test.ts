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
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  devDependencies?: Record<string, string>;
  files?: string[];
  exports?: Record<string, unknown>;
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
    // It IS used (to author the demos this pair now ships) — assert the
    // intended location, not just absence, to catch a promotion to dependencies.
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

/**
 * Introspection-gating, layer 2: the OPTIONAL EDITOR ENGINES stay out of the
 * main entry — by construction, not by care.
 *
 * The editors research put the byte budget above the choice of editor: the
 * lightest WYSIWYG measured (109 KB gzip) is six times the whole `auth-react`
 * pair, and this pair's main entry is budgeted at 12 KB. So `@codemirror/*`
 * and `@milkdown/crepe` are OPTIONAL peers reached only through a dynamic
 * `import()` behind the `./editors/*` subpaths. `size-limit` measures the
 * consequence; these assertions name the cause, so a regression is reported as
 * "an engine leaked into the main entry" rather than as "the budget moved".
 */
describe("the optional editor engines stay out of the main entry", () => {
  const ENGINE_SPECIFIERS = ["@codemirror/", "@milkdown/"];

  function distFile(relative: string): string {
    const path = resolve(PKG_DIR, relative);
    try {
      return readFileSync(path, "utf8");
    } catch {
      throw new Error(
        `${relative} is missing — build the package before test:pack (CI runs build first).`
      );
    }
  }

  it("no engine is a runtime dependency; every one is an OPTIONAL peer", () => {
    const runtime = pkg.dependencies ?? {};
    const meta = pkg.peerDependenciesMeta ?? {};
    const peers = Object.keys(pkg.peerDependencies ?? {}).filter((name) =>
      ENGINE_SPECIFIERS.some((prefix) => name.startsWith(prefix))
    );
    expect(peers.length).toBeGreaterThan(0);
    for (const name of peers) {
      expect(Object.keys(runtime)).not.toContain(name);
      expect(meta[name]?.optional, `${name} must be an OPTIONAL peer`).toBe(true);
    }
  });

  it("the built main entry mentions no engine package at all", () => {
    const main = distFile("dist/index.js");
    for (const prefix of ENGINE_SPECIFIERS) {
      expect(main.includes(prefix), `${prefix} leaked into dist/index.js`).toBe(false);
    }
  });

  it("the engine subpaths reference their packages ONLY through a dynamic import", () => {
    for (const entry of [
      "dist/editors/codemirror/CodeMirrorEditor.js",
      "dist/editors/milkdown/MilkdownEditor.js",
    ]) {
      const source = distFile(entry);
      // A static `import … from "@codemirror/view"` would make the package a
      // hard requirement of the subpath — and would break the build of any
      // host that did not install an OPTIONAL peer.
      expect(/^\s*import\s[^;]*from\s*["'](@codemirror|@milkdown)\//m.test(source)).toBe(
        false
      );
      expect(/^\s*export\s[^;]*from\s*["'](@codemirror|@milkdown)\//m.test(source)).toBe(
        false
      );
    }
  });

  it("the engine subpaths are published (exports map + the files allowlist)", () => {
    expect(pkg.exports ?? {}).toHaveProperty("./editors/codemirror");
    expect(pkg.exports ?? {}).toHaveProperty("./editors/milkdown");
    expect(pkg.files ?? []).toContain("dist");
  });
});
