#!/usr/bin/env -S node --experimental-strip-types
// AUTO-GEN driver for the scripted-fullstack navigation contract (Ф1
// lib-side core, mirrors scripts/gen-manifest.mjs's driver shape). A pair
// that owns a navigable screen declares `NavEntry` values in its own
// `src/nav/manifest.ts` (against `@stapel/core`'s `NavEntry`/
// `PackageNavManifest` types — pure data, no React, no I/O). This script:
//
//   1. reads the CURRENT target's `src/nav/manifest.ts` (env NAV_PKG_DIR),
//      validates its entries, and writes that pair's own
//      `packages/<pair>/nav-manifest.json` (the `./nav-manifest` export
//      subpath points here).
//   2. rebuilds the ROOT `nav-manifest.json` from the FULL known set of
//      wired packages (env NAV_PACKAGES) every run — not just the current
//      target — so there is no bootstrap ordering problem: the aggregate is
//      always self-consistent after a single invocation, regardless of
//      which package's env drove it.
//
// `resolveNav` (`@stapel/shell-react`) is the single function that turns
// the root aggregate's `packages` array + a project's override file into
// the tree a shell renders — the SAME function scaffold codegen bakes a
// default from and the shipped app re-applies at runtime.
//
//   NAV_PKG_DIR   current target package dir (default packages/auth-react)
//   NAV_PACKAGES  comma-separated list of every wired package dir, used to
//                 rebuild the root aggregate (default: the 3 Ф1 pairs)
//
//   node --experimental-strip-types scripts/gen-nav-manifest.mjs   # generate
//   pnpm gen:nav                                                   # generate (root script)
//   pnpm gen:nav:check                                             # drift gate
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PKG_DIR = resolve(ROOT, process.env.NAV_PKG_DIR ?? "packages/auth-react");
const NAV_PACKAGES = (
  process.env.NAV_PACKAGES ??
  "packages/auth-react,packages/profiles-react,packages/notifications-react"
)
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

const OUT_ROOT_MANIFEST = resolve(ROOT, "nav-manifest.json");

const PLACEMENT_LEVELS = new Set(["top", "submenu"]);

/** Structural validation against `@stapel/core`'s `NavEntry` contract — a
 * hand-rolled check (not a JSON-schema dependency) since the shape is small
 * and stable; keep this in sync with `packages/core/src/nav.ts`. */
function validateEntry(pkgName, entry, index) {
  const where = `${pkgName}'s src/nav/manifest.ts entries[${index}]`;
  const need = (cond, msg) => {
    if (!cond) throw new Error(`gen:nav: ${where} ${msg}`);
  };
  need(typeof entry === "object" && entry !== null, "must be an object");
  need(typeof entry.id === "string" && entry.id.length > 0, "needs a non-empty string id");
  need(
    typeof entry.labelKey === "string" && entry.labelKey.length > 0,
    "needs a non-empty string labelKey"
  );
  need(typeof entry.icon === "string" && entry.icon.length > 0, "needs a non-empty string icon");
  need(
    typeof entry.route === "object" && entry.route !== null && typeof entry.route.path === "string" && entry.route.path.length > 0,
    "needs route.path (non-empty string)"
  );
  need(
    entry.route.index === undefined || typeof entry.route.index === "boolean",
    "route.index must be a boolean when present"
  );
  need(
    typeof entry.component === "object" &&
      entry.component !== null &&
      typeof entry.component.export === "string" &&
      entry.component.export.length > 0 &&
      typeof entry.component.subpath === "string" &&
      entry.component.subpath.length > 0,
    "needs component.export and component.subpath (non-empty strings)"
  );
  need(
    typeof entry.placement === "object" &&
      entry.placement !== null &&
      PLACEMENT_LEVELS.has(entry.placement.level),
    `placement.level must be one of ${[...PLACEMENT_LEVELS].join("/")}`
  );
  if (entry.placement.level === "submenu") {
    need(
      typeof entry.placement.parentId === "string" && entry.placement.parentId.length > 0,
      "placement.level 'submenu' needs a non-empty placement.parentId"
    );
  }
  need(typeof entry.menuVisibleDefault === "boolean", "needs a boolean menuVisibleDefault");
  need(typeof entry.requiresAuth === "boolean", "needs a boolean requiresAuth");
  need(typeof entry.order === "number" && Number.isFinite(entry.order), "needs a finite number order");
}

function validateEntries(pkgName, entries) {
  if (!Array.isArray(entries)) {
    throw new Error(`gen:nav: ${pkgName}'s src/nav/manifest.ts must export navEntries as an array`);
  }
  const seen = new Set();
  entries.forEach((entry, i) => {
    validateEntry(pkgName, entry, i);
    if (seen.has(entry.id)) {
      throw new Error(`gen:nav: ${pkgName}'s src/nav/manifest.ts has a duplicate entry id "${entry.id}"`);
    }
    seen.add(entry.id);
  });
}

/** Load one package dir's manifest.ts + package.json into a validated
 * `PackageNavManifest`. */
async function loadPackageNavManifest(pkgDirAbs) {
  const pkg = JSON.parse(await readFile(resolve(pkgDirAbs, "package.json"), "utf8"));
  const mod = await import(resolve(pkgDirAbs, "src/nav/manifest.ts"));
  const entries = mod.navEntries;
  validateEntries(pkg.name, entries);
  return {
    package: pkg.name,
    version: pkg.version,
    entries,
  };
}

async function main() {
  // 1. Current target: write that pair's own nav-manifest.json.
  const current = await loadPackageNavManifest(PKG_DIR);
  const outPkgManifest = resolve(PKG_DIR, "nav-manifest.json");
  await writeFile(outPkgManifest, `${JSON.stringify(current, null, 2)}\n`);

  // 2. Rebuild the root aggregate from the FULL known set every run.
  const all = [];
  const globalIds = new Set();
  for (const dir of NAV_PACKAGES) {
    const manifest =
      resolve(ROOT, dir) === PKG_DIR ? current : await loadPackageNavManifest(resolve(ROOT, dir));
    for (const entry of manifest.entries) {
      if (globalIds.has(entry.id)) {
        throw new Error(
          `gen:nav: entry id "${entry.id}" is declared by more than one installed package — ids must be globally unique`
        );
      }
      globalIds.add(entry.id);
    }
    all.push(manifest);
  }
  // Stable order: by package name, so the aggregate diffs deterministically
  // regardless of NAV_PACKAGES' order.
  all.sort((a, b) => a.package.localeCompare(b.package));

  const rootManifest = {
    $generated:
      "by scripts/gen-nav-manifest.mjs — do not edit; drift-gated (pnpm gen:nav:check)",
    packages: all,
  };
  await writeFile(OUT_ROOT_MANIFEST, `${JSON.stringify(rootManifest, null, 2)}\n`);

  const totalEntries = all.reduce((n, m) => n + m.entries.length, 0);
  console.error(
    `gen:nav: ${current.package} → ${outPkgManifest} (${current.entries.length} entries); ` +
      `root aggregate: ${all.length} packages, ${totalEntries} entries → ${OUT_ROOT_MANIFEST}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
