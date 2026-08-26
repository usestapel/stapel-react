#!/usr/bin/env -S node --experimental-strip-types
// AUTO-GEN driver for the scripted-fullstack navigation contract (Phase 1
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
//                 rebuild the root aggregate (default: the 3 Phase 1 pairs)
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

// ── aggregate-level gates (shared-layer audit G5) ────────────────────────────
// Two fields validate per-entry above and are still wrong in the aggregate:
//
//   icon      `shell-react`'s registry falls back to a generic square for a
//             name it does not know (`icons.tsx resolveNavIcon`), so a typo
//             ships a blank glyph with no error anywhere.
//   parentId  `resolveNav` drops a submenu whose parent no installed package
//             declares — silently. gdpr's `admin.privacy` hangs off
//             `admin.root`, which NOTHING declares, so a legally-required
//             staff screen vanishes from every container and "degrade
//             gracefully" hides a real page.
//
// Both are checked against the FULL aggregate (a parent may be declared by a
// sibling pair), so they cannot live in `validateEntry`.
const ICON_REGISTRY_FILE = resolve(
  ROOT,
  process.env.NAV_ICON_REGISTRY ?? "packages/shell-react/src/default/icons.tsx"
);
// Parent ids the CONTAINER synthesises rather than a pair declaring them
// (stapel-tools `_frontend_templates.py` builds `account.root` around the
// member section and, since tools 0.54.0 / shell-react 0.7.0, `admin.root`
// whenever any installed pair hangs a staff screen off it —
// account submenu, and — since stapel-tools 0.54.0 / shell-react 0.7.0 —
// `admin.root` whenever any installed pair hangs a staff screen off it, gated
// on the session's staff capability and refusing by name).
const CONTAINER_PARENT_IDS = new Set(
  (process.env.NAV_CONTAINER_PARENTS ?? "account.root,admin.root")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);
// list (default) reports and exits 0; strict fails. Same policy as the other
// fleet gates: the aggregate does not pass yet, and a gate nobody can go green
// against gets deleted.
const NAV_GATE_STRICT =
  process.argv.includes("--strict") || process.env.NAV_GATE === "strict";

/** Icon names `shell-react`'s registry can resolve to a real glyph. */
async function iconRegistryNames() {
  let src;
  try {
    src = await readFile(ICON_REGISTRY_FILE, "utf8");
  } catch {
    return null; // registry not on disk (partial checkout) — skip, don't guess
  }
  const block = /const REGISTRY[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src);
  if (!block) return null;
  return new Set(
    block[1]
      .split(",")
      .map((line) => /^\s*([A-Za-z_]\w*)\s*(?::|$)/.exec(line)?.[1])
      .filter(Boolean)
  );
}

/**
 * Check icons against the registry and every `submenu` parent against the ids
 * the aggregate (plus the container) actually declares. Returns the problem
 * lines; empty means clean.
 */
function auditAggregate(all, icons) {
  const declared = new Set();
  for (const m of all) for (const e of m.entries) declared.add(e.id);
  const problems = [];
  for (const m of all) {
    for (const e of m.entries) {
      if (icons && !icons.has(e.icon)) {
        problems.push(
          `    - ${m.package} "${e.id}": icon "${e.icon}" is not in shell-react's registry ` +
            `(renders the generic fallback square)`
        );
      }
      if (e.placement.level !== "submenu") continue;
      const parent = e.placement.parentId;
      if (declared.has(parent) || CONTAINER_PARENT_IDS.has(parent)) continue;
      problems.push(
        `    - ${m.package} "${e.id}": placement.parentId "${parent}" is declared by no ` +
          `installed package and is not a container-synthesised id — resolveNav drops ` +
          `this entry silently, so the screen has no door`
      );
    }
  }
  return problems;
}

const PLACEMENT_LEVELS = new Set(["top", "submenu"]);
/** `@stapel/core`'s NavSurface — the authorization axis. Optional in a
 * manifest: omitted, `resolveNav` derives it from `requiresAuth`. */
const NAV_SURFACES = new Set(["public", "member"]);

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
  need(
    entry.surface === undefined || NAV_SURFACES.has(entry.surface),
    `surface must be one of ${[...NAV_SURFACES].join("/")} when present (omit it to derive from requiresAuth)`
  );
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

  const problems = auditAggregate(all, await iconRegistryNames());
  if (problems.length > 0) {
    const verb = NAV_GATE_STRICT ? "✖" : "⚠";
    console.error(
      `${verb} gen:nav: ${problems.length} entr${problems.length === 1 ? "y" : "ies"} the shell ` +
        `cannot render as declared:\n` +
        problems.join("\n") +
        `\n  Register the icon in packages/shell-react/src/default/icons.tsx, or declare the ` +
        `parent\n  (a top-level entry with that id) in the pair that owns the section.` +
        (NAV_GATE_STRICT
          ? ""
          : `\n  (listing mode — pass --strict or set NAV_GATE=strict to fail on this)`)
    );
    if (NAV_GATE_STRICT) process.exit(1);
  }

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
