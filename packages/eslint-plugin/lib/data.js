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

// ── analytics event registry (events.json / manifest.events) ─────────────────
//
// The known-event lint (G4) reads the SAME generated projection the report (G5)
// reads: the `events` section of each package manifest.json (defineEvent call
// sites → `defined`, flows.json funnels → `flows`). A missing manifest / events
// section degrades the rule to a no-op (empty catalog), never a crash — exactly
// like the token and i18n loaders above (§2.1: one source, all projections).

function discoverWorkspaceEventManifests(from) {
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
    if (manifest && manifest.events) out.push(manifest);
  }
  return out;
}

/** Strip the `<step>` / `*` placeholder tail off a flow event pattern. */
function flowBaseOf(eventPattern) {
  return String(eventPattern)
    .replace(/\.<step>$/, "")
    .replace(/\.\*$/, "");
}

function buildEventsCatalog(manifests, extraNames) {
  const defined = new Set(extraNames ?? []);
  const flowBases = new Set();
  for (const m of manifests) {
    const ev = m.events;
    if (!ev) continue;
    for (const d of ev.defined ?? []) if (d && d.name) defined.add(d.name);
    for (const f of ev.flows ?? []) {
      if (f && f.event) flowBases.add(flowBaseOf(f.event));
      if (f && f.flow) flowBases.add(`flow.${f.flow}`);
    }
  }
  return {
    defined,
    flowBases,
    /**
     * A name is known if it is a declared event, OR it is a flow event under a
     * known funnel base (`flow.<id>.<step>`) — flow steps are open-ended, so we
     * match by prefix rather than enumerating every step.
     */
    isKnown: (name) => {
      if (defined.has(name)) return true;
      for (const base of flowBases) {
        if (name === base || name.startsWith(base + ".")) return true;
      }
      return false;
    },
    loaded: defined.size > 0 || flowBases.size > 0,
  };
}

let _eventsCatalogDefault;
export function loadEventsCatalog(settings = {}) {
  if (settings.eventNames) {
    return buildEventsCatalog([], settings.eventNames);
  }
  if (settings.eventsManifests) {
    return buildEventsCatalog(settings.eventsManifests, settings.extraEventNames);
  }
  if (!_eventsCatalogDefault) {
    _eventsCatalogDefault = buildEventsCatalog(
      discoverWorkspaceEventManifests(process.cwd ? process.cwd() : HERE),
      undefined
    );
  }
  return _eventsCatalogDefault;
}

// ── operation-path catalog (manifest.operations) ─────────────────────────────
//
// The no-string-paths lint reads the SAME generated projection the code and the
// llms.txt read: the `operations` section of each package manifest.json (schema
// operationId → { method, path }). A path an agent hand-writes is authoritative
// only if it matches a catalogued operation — so the rule can name the op to
// call instead. A missing manifest / operations section degrades the data to an
// empty catalog (the rule still flags the syntactic `client.<verb>("/…")` shape,
// never crashes) — exactly like the token / i18n / events loaders above (§2.1).

function discoverWorkspaceOperationManifests(from) {
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
    if (manifest && manifest.operations) out.push(manifest);
  }
  return out;
}

function buildOperationCatalog(manifests, extraPaths) {
  // path → { pkg, operation } for the exact-match lookup + a set of paths for
  // template-prefix matching (`\`${base}/me/\`` shares the trailing segments).
  const byPath = new Map();
  for (const p of extraPaths ?? []) if (p) byPath.set(p, { pkg: null, operation: null });
  for (const m of manifests) {
    const pkg = m.package ?? null;
    for (const [id, op] of Object.entries(m.operations ?? {})) {
      if (op && typeof op.path === "string" && !byPath.has(op.path)) {
        byPath.set(op.path, { pkg, operation: id });
      }
    }
  }
  const paths = [...byPath.keys()];
  /**
   * The catalogued operation for a path string, by exact match or — for a
   * client-relative literal like `/me/` under a `/auth/api` base URL — by
   * trailing-segment suffix. Returns { pkg, operation } or null.
   */
  const resolve = (str) => {
    // A meaningful path has a segment beyond the leading slash — never resolve a
    // bare "/" (every catalogued path ends with one, so it would match all).
    if (typeof str !== "string" || str.length < 2 || !/[A-Za-z0-9]/.test(str)) {
      return null;
    }
    const exact = byPath.get(str);
    if (exact) return exact;
    // Suffix match aligns at a segment boundary because `str` starts with "/".
    for (const p of paths) if (str.startsWith("/") && p.endsWith(str)) return byPath.get(p);
    return null;
  };
  return {
    byPath,
    paths,
    resolve,
    /** Exact catalogued operation for a literal path string, else null. */
    lookup: (str) => byPath.get(str) ?? null,
    /** True if `str` is (or ends with) a catalogued operation path. */
    matches: (str) => resolve(str) !== null,
    loaded: byPath.size > 0,
  };
}

let _operationCatalogDefault;
export function loadOperationCatalog(settings = {}) {
  if (settings.operationPaths) {
    return buildOperationCatalog([], settings.operationPaths);
  }
  if (settings.operationsManifests) {
    return buildOperationCatalog(settings.operationsManifests, settings.extraOperationPaths);
  }
  if (!_operationCatalogDefault) {
    _operationCatalogDefault = buildOperationCatalog(
      discoverWorkspaceOperationManifests(process.cwd ? process.cwd() : HERE),
      undefined
    );
  }
  return _operationCatalogDefault;
}

// ── reserved backend-path catalog (reserved-paths.json) ──────────────────────
//
// no-reserved-backend-route reads the SAME projection stapel-tools' project
// generator emits at the workspace root: a flat array of path PREFIXES a
// backend module reserves under its own slug (`/<mod>/api/…`,
// `/<mod>/swagger…`), plus the project-wide infra prefixes nginx enforces
// (`/admin`, `/staticfiles`, `/media` — §57 canon, compose_templates.NGINX_CONF).
// Schema: `{ "reservedPathPrefixes": string[] }`. A bare module ROOT
// (`/<mod>`) must never appear in the list — roots belong to the frontend SPA
// by convention; only sub-path reservations are catalogued. A missing/
// unreadable file degrades the rule to a no-op (empty catalog, never a
// crash) — exactly like the token/i18n/events/operation loaders above (§2.1).

function discoverReservedPathsFile(from) {
  const root = workspaceRoot(from);
  if (root) {
    const p = join(root, "reserved-paths.json");
    if (existsSync(p)) return p;
  }
  const local = join(from, "reserved-paths.json");
  if (existsSync(local)) return local;
  return null;
}

function buildReservedPathCatalog(prefixes) {
  const list = (prefixes ?? []).filter(
    (p) => typeof p === "string" && p.length > 0
  );
  return {
    prefixes: list,
    loaded: list.length > 0,
    /**
     * The reserved prefix a route path falls INTO — equal to it, or past a
     * segment boundary beneath it — else null. A route that merely shares a
     * prefix's leading segment (a bare module root, e.g. "/calendar" against
     * reserved "/calendar/api") does NOT match: roots are the frontend's by
     * canon, only sub-paths are reserved.
     */
    matches: (route) => {
      if (typeof route !== "string" || !route.startsWith("/")) return null;
      for (const p of list) {
        const boundary = p.endsWith("/") ? p : `${p}/`;
        if (route === p || route.startsWith(boundary)) return p;
      }
      return null;
    },
  };
}

let _reservedPathCatalogDefault;
export function loadReservedPathCatalog(settings = {}) {
  if (settings.reservedPaths) {
    return buildReservedPathCatalog(settings.reservedPaths);
  }
  if (settings.reservedPathsFile) {
    // Explicit override → never memoized (mirrors the other loaders: only the
    // zero-config discovered default is cached).
    return buildReservedPathCatalog(
      readJson(settings.reservedPathsFile)?.reservedPathPrefixes
    );
  }
  if (!_reservedPathCatalogDefault) {
    const file = discoverReservedPathsFile(
      process.cwd ? process.cwd() : HERE
    );
    _reservedPathCatalogDefault = buildReservedPathCatalog(
      file ? readJson(file)?.reservedPathPrefixes : undefined
    );
  }
  return _reservedPathCatalogDefault;
}

/** Read `context.settings.stapel` (flat config) with a stable empty default. */
export function stapelSettings(context) {
  return (context.settings && context.settings.stapel) || {};
}

// Test hook: clear memoized defaults so RuleTester cases stay independent.
export function __resetCaches() {
  _tokenCatalogDefault = undefined;
  _i18nDefault = undefined;
  _eventsCatalogDefault = undefined;
  _operationCatalogDefault = undefined;
  _reservedPathCatalogDefault = undefined;
}

export { resolve as _resolve };
