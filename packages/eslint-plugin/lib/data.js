// Data layer for the guardrail rules (frontend-guardrails §2.1: "Data-driven,
// out of the SAME artifacts"). Rules never carry their own token / i18n lists —
// they read the generated manifests the codegen writes, so lint and code cannot
// drift. Everything here is defensive: a missing manifest degrades a rule to a
// no-op (empty catalog) rather than crashing the lint run, and every lookup is
// overridable via `settings.stapel` so consumers (and RuleTester) stay
// deterministic.
import { createRequire } from "node:module";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** Walk up from `start` until a directory contains `marker`; null if none. */
function findUp(marker, start) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, marker))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Nearest pnpm/monorepo workspace root above `from`. */
function workspaceRoot(from) {
  return (
    findUp("pnpm-workspace.yaml", from) ??
    findUp("pnpm-lock.yaml", from) ??
    null
  );
}

// ── Token catalog ──────────────────────────────────────────────────────────

function loadTokensManifest(settings) {
  if (settings.tokensManifest) return settings.tokensManifest;
  if (settings.tokensManifestPath) return readJson(settings.tokensManifestPath);
  // The token authority is @stapel/tokens — a real dependency of this plugin.
  try {
    return require("@stapel/tokens/manifest.json");
  } catch {
    /* fall through to workspace discovery */
  }
  const root = workspaceRoot(HERE);
  if (root) {
    const m = readJson(join(root, "packages", "tokens", "manifest.json"));
    if (m) return m;
  }
  return null;
}

function buildTokenCatalog(manifest) {
  const t = manifest?.tokens ?? {};
  const core = new Set(t.core ?? []);
  const component = new Set(t.component ?? []);
  const ramps = new Set(manifest?.ramps?.names ?? []);
  const all = new Set([...core, ...component]);
  return {
    core,
    component,
    ramps,
    all,
    /** true if `name` is a known L2 core or L3 component token */
    hasToken: (name) => all.has(name),
    /** true if `name` is a known L1 raw ramp (e.g. "gray", "brand") */
    hasRamp: (name) => ramps.has(name),
    loaded: all.size > 0 || ramps.size > 0,
  };
}

let _tokenCatalogDefault;
export function loadTokenCatalog(settings = {}) {
  const overridden =
    settings.tokensManifest || settings.tokensManifestPath;
  if (overridden) return buildTokenCatalog(loadTokensManifest(settings));
  if (!_tokenCatalogDefault) {
    _tokenCatalogDefault = buildTokenCatalog(loadTokensManifest(settings));
  }
  return _tokenCatalogDefault;
}

// ── i18n key registry ────────────────────────────────────────────────────────

function discoverWorkspaceI18nKeys(from) {
  const root = workspaceRoot(from);
  if (!root) return [];
  const pkgsDir = join(root, "packages");
  if (!existsSync(pkgsDir)) return [];
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(pkgsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
  for (const name of entries) {
    const manifest = readJson(join(pkgsDir, name, "manifest.json"));
    if (manifest && Array.isArray(manifest.i18nKeys)) {
      out.push(manifest);
    }
  }
  return out;
}

function buildI18nRegistry(manifests, extraKeys) {
  const keys = new Set(extraKeys ?? []);
  for (const m of manifests) {
    for (const k of m.i18nKeys ?? []) keys.add(k);
  }
  // Managed namespaces = the top-level segment of every known key. The
  // existence rule only fires inside a MANAGED namespace (false-positive
  // policy, §2.2): an unknown key under a namespace nobody manages is treated
  // as an app-local key, not a typo.
  const namespaces = new Set();
  for (const k of keys) {
    const dot = k.indexOf(".");
    if (dot > 0) namespaces.add(k.slice(0, dot));
  }
  return {
    keys,
    namespaces,
    has: (k) => keys.has(k),
    manages: (k) => {
      const dot = k.indexOf(".");
      return dot > 0 && namespaces.has(k.slice(0, dot));
    },
    loaded: keys.size > 0,
  };
}

let _i18nDefault;
export function loadI18nRegistry(settings = {}) {
  if (settings.i18nKeys) {
    return buildI18nRegistry([], settings.i18nKeys);
  }
  if (settings.i18nManifests) {
    return buildI18nRegistry(settings.i18nManifests, settings.extraI18nKeys);
  }
  if (!_i18nDefault) {
    _i18nDefault = buildI18nRegistry(
      discoverWorkspaceI18nKeys(process.cwd ? process.cwd() : HERE),
      undefined
    );
  }
  return _i18nDefault;
}

/** Read `context.settings.stapel` (flat config) with a stable empty default. */
export function stapelSettings(context) {
  return (context.settings && context.settings.stapel) || {};
}

// Test hook: clear memoized defaults so RuleTester cases stay independent.
export function __resetCaches() {
  _tokenCatalogDefault = undefined;
  _i18nDefault = undefined;
}

export { resolve as _resolve };
