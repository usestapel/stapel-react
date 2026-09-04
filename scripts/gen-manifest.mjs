#!/usr/bin/env node
// AUTO-GEN driver for a pair's self-description (frontend-core-architecture
// §2.4, §4 checklist #8). Closes failure mode F8 ("the model knows *an* auth
// SDK from training, not YOUR @stapel/auth-react@<version>"): the package
// carries its own ground truth, one Read away, in two forms —
//
//   manifest.json  machine-readable catalog (harness tool-descriptions, MCP
//                  projection, "did the code use the SDK or hand-roll it?" review)
//   llms.txt       a prose surface slice a harness drops into the coder's
//                  context INSTEAD of reading 11.8k lines of schema.ts
//
// BOTH are generated from the SAME codegen artifacts as the code (schema.json,
// flows.json, the generated error map, package exports) and stand under the
// same drift gate (`pnpm gen:manifest:check`) — so the description can't drift
// from the surface it describes.
//
//   MANIFEST_PKG_DIR   package dir (default packages/auth-react)
//   MANIFEST_MODULE    backend module name (default "stapel-auth")
//   MANIFEST_TAGPREFIX operation path prefix filter (default "/auth/api/v1/")
//   API_SCHEMA         source schema.json (default ../<MANIFEST_MODULE>/docs/schema.json)
//   MANIFEST_NO_HTTP   "1" for an L1 library with a backend module/contract but
//                      no HTTP surface (no schema.json ever) — generic render
//   MANIFEST_LAYERS    comma-separated layer list (default api,model,flows,headless,i18n)
//
//   node scripts/gen-manifest.mjs      # generate
//   pnpm gen:manifest                  # generate (root script)
//   pnpm gen:manifest:check            # drift gate (fails on divergence)
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { manifestEvents, renderLlmsEvents } from "./events-lib.mjs";
import { manifestDemos, renderLlmsDemos } from "./demos-lib.mjs";
import { parseKeyFactory, extractHooks, buildHooks, renderLlmsHooks } from "./hooks-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Sibling backends live one directory up by default. `SIBLING_ROOT` re-points
// that at a set of PINNED worktrees (`scripts/pin-siblings.mjs`) so a local
// regen reads exactly what CI checks against, instead of whatever the sibling
// checkouts happen to be sitting on — the drift that put commit 3a6211a in
// this repo's history.
const SIBLING_ROOT = process.env.SIBLING_ROOT ?? "..";


const PKG_DIR = resolve(ROOT, process.env.MANIFEST_PKG_DIR ?? "packages/auth-react");
const MODULE = process.env.MANIFEST_MODULE ?? "stapel-auth";
// A package with NO backend Django module of its own (today: @stapel/core,
// the frontend runtime substrate every `-react` pair builds on — it has no
// DRF endpoints, no generated schema/flows/errors, see its src/index.ts
// closing note) sets `MANIFEST_MODULE=""` explicitly. That is the ONLY
// signal this script needs to switch its render from "backend pair" to
// "generic runtime package" — same generator, same drift gate, no second
// mechanism (badge-canon §3: chini generator, ne hand-author the artifact).
const HAS_BACKEND = MODULE.trim().length > 0;
// An L1 library with a real backend module (contract worth stating) but NO
// HTTP surface of its own (today: stapel-attributes — a pure Python engine,
// no DRF endpoints) sets `MANIFEST_NO_HTTP=1`. Unlike MANIFEST_MODULE="" this
// keeps `backend.module`/`backend.contract` (still pinned against the
// module's pyproject) but skips reading a schema.json that will never exist,
// and renders with the generic (exports-catalog) narrative instead of the
// operations/flows-driven one.
const NO_HTTP = process.env.MANIFEST_NO_HTTP === "1";
const USE_GENERIC_RENDER = !HAS_BACKEND || NO_HTTP;
// The fixed api/model/flows/headless/i18n shape assumes an HTTP-calling pair;
// a library without one names its own layers (attributes-react: headless,
// default, i18n — no api/model/flows dirs exist).
const LAYERS = (process.env.MANIFEST_LAYERS ?? "api,model,flows,headless,i18n")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PATH_PREFIX = process.env.MANIFEST_TAGPREFIX ?? "/auth/api/v1/";
// §17-native per-module contract: the schema source is the backend module's
// own committed docs/schema.json (default: the auth pair, matching the other
// auth defaults above). The monolith aggregate is retired as a contract source.
const SCHEMA_PATH =
  process.env.API_SCHEMA ??
  resolve(ROOT, `${SIBLING_ROOT}/${MODULE}/docs/schema.json`);
// Backend version source → `backend.contract` (frontend-core-architecture
// §2.4 / §3.4.2: drift must be ADDRESSABLE — the manifest states which backend
// range this surface was generated against). Read from the backend module's
// pyproject at gen time; a backend minor bump reddens the drift gate exactly
// like a schema change would. Same sibling convention as gen-errors.
const BACKEND_PYPROJECT =
  process.env.MANIFEST_BACKEND_PYPROJECT ??
  resolve(ROOT, `${SIBLING_ROOT}/${MODULE}/pyproject.toml`);

// ── prose knobs (frontend-core-architecture §2.4) ────────────────────────────
// The llms.txt narrative and the i18n-key scan name a pair's public entry
// points (`<XProvider>`, `explainXError`, `xQueryKeys`, `registerXI18n`, the
// `x.` i18n namespace). These derive from the react module slug — the last
// path segment of MANIFEST_PKG_DIR minus the `-react` suffix — so a NEW pair
// self-describes with zero extra env, while each name stays overridable in the
// same style as gen-flows' FLOW_* knobs. Defaults reproduce the auth surface.
const MODULE_BASE =
  process.env.MANIFEST_MODULE_BASE ??
  (PKG_DIR.split("/").pop() ?? "auth-react").replace(/-react$/, "");
const CAMEL = MODULE_BASE.charAt(0).toUpperCase() + MODULE_BASE.slice(1);
const PROVIDER = process.env.MANIFEST_PROVIDER ?? `${CAMEL}Provider`;
const QUERY_KEYS = process.env.MANIFEST_QUERYKEYS ?? `${MODULE_BASE}QueryKeys`;
const I18N_REGISTER = process.env.MANIFEST_I18N_REGISTER ?? `register${CAMEL}I18n`;
const ERROR_FN = process.env.MANIFEST_ERROR_FN ?? `explain${CAMEL}Error`;
const API_HOOK = process.env.MANIFEST_API_HOOK ?? `use${CAMEL}Api`;
const I18N_PREFIX = process.env.MANIFEST_I18N_PREFIX ?? MODULE_BASE;
// Query-hook catalog (§2.4): the model layer's exported use*-hooks and the key
// factory that names their keys. Same slug-derived defaults + override knobs.
const MODEL_DIR = process.env.MANIFEST_MODEL_DIR ?? "src/model";
const QUERYKEYS_FILE = process.env.MANIFEST_QUERYKEYS_FILE ?? "src/model/queryKeys.ts";

const OUT_MANIFEST = resolve(PKG_DIR, "manifest.json");
const OUT_LLMS = resolve(PKG_DIR, "llms.txt");
const LLMS_TOKEN_BUDGET = 6000; // §2.4 — a pair's slice must fit an agent's context

/**
 * Derive the semver contract range from the backend module's pyproject
 * version: `0.5.3` → `>=0.5 <0.6` (pre-1.0 minors are breaking, so the range
 * is one backend minor wide — frontend-standard §3).
 */
async function backendContract() {
  const src = await readFile(BACKEND_PYPROJECT, "utf8");
  const m = src.match(/^version\s*=\s*"(\d+)\.(\d+)(?:\.\d+)?"/m);
  if (!m) {
    throw new Error(
      `gen:manifest: no version in ${BACKEND_PYPROJECT} — cannot derive backend.contract`
    );
  }
  const [, major, minor] = m;
  return `>=${major}.${minor} <${major}.${Number(minor) + 1}`;
}

const refName = (schema) =>
  schema && schema.$ref ? schema.$ref.split("/").pop() : null;

/** Success (2xx) JSON response schema name for an operation, if any. */
function responseName(responses) {
  for (const code of Object.keys(responses ?? {})) {
    if (!/^2\d\d$/.test(code)) continue;
    const s = responses[code]?.content?.["application/json"]?.schema;
    const n = refName(s);
    if (n && n !== "StapelError") return n;
  }
  return null;
}

/** Extract the auth-scoped operation catalog from the unified OpenAPI. */
function operations(schema) {
  const out = {};
  for (const [path, item] of Object.entries(schema.paths ?? {})) {
    if (!path.startsWith(PATH_PREFIX)) continue;
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const op = item[method];
      if (!op) continue;
      const id = op.operationId ?? `${method}_${path}`;
      out[id] = {
        method: method.toUpperCase(),
        path,
        tag: (op.tags ?? [])[0] ?? null,
        request:
          refName(op.requestBody?.content?.["application/json"]?.schema) ?? null,
        response: responseName(op.responses),
      };
    }
  }
  // Stable key order.
  return Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])));
}

/** Parse `export { ... }` / `export type { ... }` names (alias = public name). */
function parseExports(indexSrc) {
  const runtime = new Set();
  const types = new Set();
  const re = /export\s+(type\s+)?\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(indexSrc))) {
    const isType = Boolean(m[1]);
    for (let name of m[2].split(",")) {
      name = name.trim();
      if (!name) continue;
      const asMatch = name.match(/\bas\s+(\w+)$/);
      const publicName = asMatch ? asMatch[1] : name.split(/\s+/)[0];
      if (!/^\w+$/.test(publicName)) continue;
      (isType ? types : runtime).add(publicName);
    }
  }
  return {
    runtime: [...runtime].sort(),
    types: [...types].sort(),
  };
}

/** Canonical flows (flows.json projection) trimmed for the manifest. */
function flowsCatalog(flows) {
  const out = {};
  for (const f of flows) {
    out[f.id] = {
      titleKey: f.titleKey,
      descriptionKey: f.descriptionKey,
      steps: f.steps.map((s) => ({
        kind: s.kind,
        order: s.order,
        noteKey: s.noteKey,
        endpoints: s.endpoints.map((e) => `${e.method} ${e.path}`),
      })),
      endpoints: f.steps.flatMap((s) => s.endpoints.map((e) => `${e.method} ${e.path}`)),
    };
  }
  return out;
}

/** i18n keys the pair owns: UI keys + flow keys + error keys, de-duplicated. */
function i18nKeys(uiKeysSrc, flows, errors) {
  const keys = new Set();
  // Segments may be camelCase: the §B5 canon namespace is
  // `profiles.initialSetup.*` (mirroring the storage canon key
  // `stapel.profiles.initialSetup.lastPromptAt`), so the class must not be
  // lowercase-only or those keys silently drop out of the registry the
  // i18n-key-exists lint reads.
  const uiKeyRe = new RegExp(`"(${I18N_PREFIX}\\.[a-zA-Z0-9_.]+)"`, "g");
  for (const m of uiKeysSrc.matchAll(uiKeyRe)) keys.add(m[1]);
  for (const f of flows) {
    keys.add(f.titleKey);
    keys.add(f.descriptionKey);
    for (const s of f.steps) if (s.noteKey) keys.add(s.noteKey);
  }
  for (const e of errors) keys.add(e.code);
  return [...keys].sort();
}

/**
 * The pair's query-hook catalog (§2.4): scan the model dir for exported use*
 * hooks, resolve their keys against the key factory. A pair without a model dir
 * (or key factory) degrades to an empty catalog rather than failing.
 */
async function hooksCatalog() {
  let factoryMap = new Map();
  try {
    const factorySrc = await readFile(resolve(PKG_DIR, QUERYKEYS_FILE), "utf8");
    factoryMap = parseKeyFactory(factorySrc, QUERYKEYS_FILE, QUERY_KEYS);
  } catch {
    /* no key factory → keys stay unresolved */
  }
  let files = [];
  try {
    files = (await readdir(resolve(PKG_DIR, MODEL_DIR)))
      .filter((f) => /\.tsx?$/.test(f))
      .sort();
  } catch {
    return {}; // no model dir → no hooks
  }
  const all = [];
  for (const f of files) {
    const rel = `${MODEL_DIR}/${f}`;
    const src = await readFile(resolve(PKG_DIR, rel), "utf8");
    all.push(...extractHooks(src, rel, QUERY_KEYS));
  }
  return buildHooks(all, factoryMap);
}

function renderLlms(m, factories, eventsJson, demosJson) {
  const L = [];
  L.push(`# ${m.package} ${m.version}`);
  L.push("");
  L.push(
    `Headless React flow pair for ${m.backend.module} (contract ${m.backend.contract}) — business + state, zero visual opinion.`
  );
  L.push(
    "Built on @stapel/core: typed client + StapelApiError envelope, auth token refresh,"
  );
  L.push(
    "verification-403 interception, i18n engine, analytics facade, TanStack Query layer."
  );
  L.push("");
  L.push("## The one right way (do this, the rest is a review/lint smell)");
  L.push(
    `- No raw fetch/axios. The client is injected via <${PROVIDER}>/StapelConfigProvider;`
  );
  L.push("  every hook and flow already carries auth, refresh, and the error envelope.");
  L.push(
    "- Render errors, never try/catch them: a flow's state carries FlowError{code,params};"
  );
  L.push(`  render \`t(code, params)\` and branch on \`${ERROR_FN}(code)\` remediation.`);
  L.push(`- Server state = the use* hooks (query layer); keys come only from ${QUERY_KEYS}.`);
  L.push(`- User strings = i18n keys (${I18N_REGISTER}); never string literals.`);
  L.push("- Sign-in UI = a headless flow component; copy it (shadcn-style) to restyle.");
  L.push("");
  L.push("## Layers");
  L.push("api (typed client) · model (hooks, session) · flows (machines) · headless · i18n");
  L.push("");
  if (factories.length > 0) {
    L.push("## Machines (createFlowMachine; analytics funnel flow.<id>.<step>)");
    for (const f of factories) L.push(`- ${f}`);
    L.push("");
  }
  L.push("## Documented flows (flows.json — canonical id, steps, endpoints)");
  for (const [id, f] of Object.entries(m.flows)) {
    L.push(`- ${id}: ${f.endpoints.join(", ") || "(no http steps)"}`);
  }
  L.push("");
  L.push("## Operations (typed; use the named op, never a path string)");
  L.push("Request/response schema names are in manifest.json + the generated types.");
  // Token economy (§2.4): every operation lives under the module's one path
  // prefix, so state it once here and render module-relative paths below —
  // which is also exactly how the pair's own api layer spells them. The
  // manifest.json catalog keeps the full absolute paths.
  L.push(`Paths are relative to \`${PATH_PREFIX}\`.`);
  for (const [id, op] of Object.entries(m.operations)) {
    const shownPath = op.path.startsWith(PATH_PREFIX)
      ? op.path.slice(PATH_PREFIX.length - 1)
      : op.path;
    L.push(`- ${id}: ${op.method} ${shownPath}`);
  }
  L.push("");
  const hookLines = renderLlmsHooks(m.hooks);
  if (hookLines.length > 0) {
    for (const line of hookLines) L.push(line);
    L.push("");
  }
  L.push("## Errors (render t(code, params); UX from remediation)");
  // Digest, not catalogue: the full code→spec map is manifest.json §errors (and
  // the generated AUTH_ERRORS). Here we keep llms.txt within its token budget
  // (§2.4) by summarising by remediation and enumerating only the param-bearing
  // keys — the ones an agent needs the exact `{slot}` names for.
  const errEntries = Object.entries(m.errors);
  const byRemediation = {};
  for (const [, e] of errEntries)
    byRemediation[e.remediation] = (byRemediation[e.remediation] ?? 0) + 1;
  const histogram = Object.entries(byRemediation)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([r, n]) => `${r} ${n}`)
    .join(" · ");
  L.push(
    `${errEntries.length} keys (full catalog: manifest.json §errors). By remediation: ${histogram}.`
  );
  const withParams = errEntries.filter(([, e]) => e.params.length);
  if (withParams.length > 0) {
    L.push("Param-bearing keys (interpolation slots matter):");
    for (const [code, e] of withParams) {
      L.push(`- ${code} [${e.status}] → ${e.remediation} {${e.params.join(",")}}`);
    }
  }
  L.push("");
  for (const line of renderLlmsEvents(eventsJson)) L.push(line);
  L.push("");
  if (demosJson.demos.length > 0) {
    for (const line of renderLlmsDemos(demosJson)) L.push(line);
    L.push("");
  }
  L.push("## Snippets");
  const sampleFlow = factories.find((n) => /Flow$/.test(n));
  if (sampleFlow) {
    L.push("```tsx");
    L.push("// A flow machine drives state; you render each step.");
    L.push(`const flow = ${sampleFlow}({ api: ${API_HOOK}() });`);
    L.push("const s = useFlow(flow.machine);");
    L.push(
      "if (s.step.endsWith('Error')) return <p>{t(s.error.code, s.error.params)}</p>;"
    );
    L.push("```");
  }
  L.push("```tsx");
  L.push("// Error rendering + remediation branch (one pattern for every pair).");
  L.push(`const r = ${ERROR_FN}(err.code); // 'wait_and_retry' | 'verify' | ...`);
  L.push("return <Alert action={r}>{t(err.code, err.params)}</Alert>;");
  L.push("```");
  return L.join("\n") + "\n";
}

/**
 * llms.txt for a package with NO backend pairing (`backend: null` in the
 * manifest) — the frontend RUNTIME substrate every `@stapel/<module>-react`
 * pair is built on, not a pair itself. There is no operations/flows/errors
 * catalog to render (no Django module produced one), so this narrates from
 * what such a package DOES have: its own `provides`-equivalent
 * (`package.json`'s description — the only honest source, see `main()`) and
 * its real exports (`parseExports`, same mechanism every pair's render uses).
 * Hooks/events/demos sections are shared verbatim with the pair renderer —
 * one rendering library, not a forked one, even though the narrative differs.
 */
// What a backend-less package IS, for the llms.txt a harness reads instead of the
// source. The default describes @stapel/core; every other runtime package passes
// its own sentence through MANIFEST_RUNTIME_BLURB (root package.json).
const RUNTIME_BLURB =
  process.env.MANIFEST_RUNTIME_BLURB ||
  "No backend Django module of its own — this is the frontend RUNTIME every " +
    "@stapel/<module>-react pair is built on top of: client + error envelope, " +
    "session/refresh seam, TanStack Query layer, i18n engine, analytics seam, " +
    "flow-machine primitive, encrypted repositories. A pair depends on this " +
    "and never re-implements what is exported here.";

function renderLlmsGeneric(m, factories, eventsJson, demosJson) {
  const L = [];
  L.push(`# ${m.package} ${m.version}`);
  L.push("");
  L.push(m.description || `${m.package} — no provides one-liner in package.json yet.`);
  L.push("");
  L.push(RUNTIME_BLURB);
  L.push("");
  // A generic-render package MAY still have a real backend module + pinned
  // contract (MANIFEST_NO_HTTP=1: an L1 library, not a substrate) — state it,
  // since `backend` in manifest.json is the drift-gated source of truth.
  if (m.backend) {
    L.push(`Backend: ${m.backend.module} (contract ${m.backend.contract}).`);
    L.push("");
  }
  if (factories.length > 0) {
    L.push("## Factories (createFlowMachine-style; analytics funnel flow.<id>.<step>)");
    for (const f of factories) L.push(`- ${f}`);
    L.push("");
  }
  L.push("## Exports (call these, never hand-roll the equivalent) — see full");
  L.push("signatures/JSDoc in the package README and src/index.ts.");
  L.push("### runtime");
  for (const name of m.exports.runtime) L.push(`- ${name}`);
  L.push("");
  if (m.exports.types.length > 0) {
    L.push("### types");
    for (const name of m.exports.types) L.push(`- ${name}`);
    L.push("");
  }
  const hookLines = renderLlmsHooks(m.hooks);
  if (hookLines.length > 0) {
    for (const line of hookLines) L.push(line);
    L.push("");
  }
  for (const line of renderLlmsEvents(eventsJson)) L.push(line);
  L.push("");
  if (demosJson.demos.length > 0) {
    for (const line of renderLlmsDemos(demosJson)) L.push(line);
    L.push("");
  }
  L.push("## Snippets");
  L.push("```tsx");
  L.push("// One-provider setup (StapelConfigProvider + QueryClientProvider + I18nProvider).");
  L.push("const client = createStapelClient({ baseUrl, getAccessToken });");
  L.push("<StapelProvider client={client} queryClient={queryClient} i18n={i18n}>");
  L.push("  <App />");
  L.push("</StapelProvider>");
  L.push("```");
  L.push("```tsx");
  L.push("// Error narrowing — never a cast (stapel/no-raw-error-shape).");
  L.push("if (isStapelApiError(err)) return <Alert>{t(err.code, err.params)}</Alert>;");
  L.push("```");
  return L.join("\n") + "\n";
}

/** Read a JSON file that a package without a backend pairing simply never
 * has (no codegen pipeline produced it) — ENOENT degrades to `fallback`,
 * same discipline already applied to flows/events/demos above; any other
 * failure (malformed JSON) still throws. */
async function readJsonOptional(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e?.code === "ENOENT") return fallback;
    throw e;
  }
}

async function main() {
  const pkg = JSON.parse(await readFile(resolve(PKG_DIR, "package.json"), "utf8"));
  // A backend-less package (@stapel/core today) has no OpenAPI schema to
  // read at all — there is no sibling Django module to generate one from.
  const schema =
    HAS_BACKEND && !NO_HTTP
      ? JSON.parse(await readFile(SCHEMA_PATH, "utf8"))
      : { paths: {} };
  // Zero-flow pairs (slim wave §21/S3) carry no generated flows.json at all —
  // gen:flows skips emission for them; treat that as an empty flow list.
  let flows = [];
  try {
    flows = JSON.parse(
      await readFile(resolve(PKG_DIR, "src/flows/generated/flows.json"), "utf8")
    );
  } catch (e) {
    if (e?.code !== "ENOENT") throw e;
  }
  // errors.json/i18n keys are codegen'd FROM a backend's error catalog — a
  // package with none (@stapel/core: it defines the error ENVELOPE mechanism,
  // not a catalog of codes; those belong to whichever backend module a pair
  // fronts) has neither file. ENOENT degrades honestly to empty, same as flows.
  const errors = await readJsonOptional(resolve(PKG_DIR, "src/i18n/generated/errors.json"), []);
  const indexSrc = await readFile(resolve(PKG_DIR, "src/index.ts"), "utf8");
  const uiKeysSrc = await readFile(resolve(PKG_DIR, "src/i18n/keys.ts"), "utf8").catch((e) => {
    if (e?.code === "ENOENT") return "";
    throw e;
  });
  // events.json is generated by gen-events (runs before gen-manifest); degrade
  // to an empty registry if a pair has none yet.
  const eventsJson = JSON.parse(
    await readFile(
      resolve(PKG_DIR, "src/analytics/generated/events.json"),
      "utf8"
    ).catch(() => '{"defined":[],"flows":[]}')
  );
  // demos.json is generated by gen-demos (runs before gen-manifest); degrade to
  // an empty registry if a pair has no demos yet (§4.3).
  const demosJson = JSON.parse(
    await readFile(resolve(PKG_DIR, "demo/generated/demos.json"), "utf8").catch(
      () => '{"demos":[]}'
    )
  );

  const exportsCatalog = parseExports(indexSrc);
  const factories = exportsCatalog.runtime.filter((n) => /^create\w+(Flow|Controller)$/.test(n));

  const errorsBlock = {};
  for (const e of errors) {
    errorsBlock[e.code] = {
      status: e.status,
      params: e.params,
      remediation: e.remediation,
    };
  }

  const manifest = {
    $generated: "by scripts/gen-manifest.mjs — do not edit; drift-gated (pnpm gen:manifest:check)",
    package: pkg.name,
    version: pkg.version,
    backend: HAS_BACKEND ? { module: MODULE, contract: await backendContract() } : null,
    // "layers" names a pair's fixed api/model/flows/headless/i18n shape — a
    // backend-less runtime package has no such pairing, so the key is simply
    // absent rather than a fabricated taxonomy (honest gap, not an invention).
    ...(HAS_BACKEND ? { layers: LAYERS } : {}),
    // `description` is the one-liner an agent reads FIRST — for a pair it is
    // derived from backend.module in the render narrative below. A
    // backend-less package (or a library with a backend but no HTTP surface)
    // has no such narrative to derive it from, so its own (human-written,
    // npm-facing) package.json description is the only honest source.
    ...(USE_GENERIC_RENDER ? { description: pkg.description ?? "" } : {}),
    flows: flowsCatalog(flows),
    machines: factories,
    operations: operations(schema),
    hooks: await hooksCatalog(),
    errors: errorsBlock,
    events: manifestEvents(eventsJson),
    demos: manifestDemos(demosJson),
    i18nKeys: i18nKeys(uiKeysSrc, flows, errors),
    exports: exportsCatalog,
  };

  const llms = USE_GENERIC_RENDER
    ? renderLlmsGeneric(manifest, factories, eventsJson, demosJson)
    : renderLlms(manifest, factories, eventsJson, demosJson);
  const approxTokens = Math.ceil(llms.length / 4);
  if (approxTokens > LLMS_TOKEN_BUDGET) {
    throw new Error(
      `llms.txt is ~${approxTokens} tokens, over the ${LLMS_TOKEN_BUDGET} budget (§2.4). Trim the surface.`
    );
  }

  await writeFile(OUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(OUT_LLMS, llms);

  console.error(
    `gen:manifest: ${Object.keys(manifest.operations).length} ops, ` +
      `${Object.keys(manifest.flows).length} flows, ${errors.length} errors, ` +
      `llms.txt ~${approxTokens} tok\n              → ${OUT_MANIFEST}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
