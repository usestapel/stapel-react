// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Introspection-gating (frontend-guardrails §5.1): showcase/demo tooling stays
 * OUT of the pair's production bundle *by construction*, and the antd skin
 * stays out of the main entry.
 *
 * Runs via the dedicated `test:pack` script (CI serializes it across packages
 * with --workspace-concurrency=1): the `npm pack` below is real I/O, too heavy
 * for the parallel turbo `test` graph.
 */
const PKG_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(PKG_DIR, "package.json"), "utf8")) as {
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
    expect(INTROSPECTION_ONLY.filter((name) => name in runtime)).toEqual([]);
  });

  it("@stapel/showcase is present, but only as a devDependency", () => {
    expect(pkg.devDependencies ?? {}).toHaveProperty("@stapel/showcase");
  });

  it("the published `files` allowlist excludes demo/", () => {
    const files = pkg.files ?? [];
    expect(files).not.toContain("demo");
    expect(files.some((f) => /(^|\/)demo(\/|$)/.test(f))).toBe(false);
  });

  it("the packed tarball contains no demo or showcase files", () => {
    const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: PKG_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed: unknown = JSON.parse(out);
    const report = (
      Array.isArray(parsed)
        ? parsed[0]
        : Object.values(parsed as Record<string, unknown>)[0]
    ) as { files: { path: string }[] };
    const paths: string[] = report.files.map((f) => f.path);
    expect(paths.filter((p) => /(^|\/)demo(\/|\.)/i.test(p))).toEqual([]);
    expect(paths.filter((p) => /showcase/i.test(p))).toEqual([]);
  }, 120_000);
});

/**
 * The skin and the locales stay OUT of the main entry — by construction, not
 * by care. `size-limit` measures the consequence; these assertions name the
 * cause, so a regression reads as "antd leaked into the headless entry" rather
 * than as "the budget moved".
 */
describe("the main entry stays headless and monolingual", () => {
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

  it("mentions no antd and no token bridge", () => {
    const main = distFile("dist/index.js");
    for (const specifier of ["antd", "@stapel/tokens-antd"]) {
      expect(main.includes(`"${specifier}`), `${specifier} leaked into dist/index.js`).toBe(
        false
      );
    }
  });

  it("does not import the ru/es bundles (they are opt-in subpaths)", () => {
    const main = distFile("dist/index.js");
    expect(main.includes("i18n/ru.js")).toBe(false);
    expect(main.includes("i18n/es.js")).toBe(false);
  });

  it("publishes the skin and both locales as their own subpaths", () => {
    const exports = pkg.exports ?? {};
    expect(exports).toHaveProperty("./default");
    expect(exports).toHaveProperty("./i18n/ru");
    expect(exports).toHaveProperty("./i18n/es");
    expect(pkg.files ?? []).toContain("dist");
    expect(pkg.files ?? []).toContain("src");
  });

  it("keeps the docs pair a PEER — never a bundled dependency", () => {
    // Two copies of the docs client in one app means two caches, two runtimes
    // and two ideas of what a folder is: the seam defect this package exists
    // to avoid, arriving through package.json instead of through code.
    expect(pkg.peerDependencies ?? {}).toHaveProperty("@stapel/docs-react");
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain("@stapel/docs-react");
  });
});
