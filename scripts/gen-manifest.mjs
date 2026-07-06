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
//   MANIFEST_TAGPREFIX operation path prefix filter (default "/auth/api/")
//   API_SCHEMA         source schema.json (default sibling monolith)
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

const PKG_DIR = resolve(ROOT, process.env.MANIFEST_PKG_DIR ?? "packages/auth-react");
const MODULE = process.env.MANIFEST_MODULE ?? "stapel-auth";
const PATH_PREFIX = process.env.MANIFEST_TAGPREFIX ?? "/auth/api/";
const SCHEMA_PATH =
  process.env.API_SCHEMA ??
  resolve(ROOT, "../stapel-example-monolith/codegen/generated/schema.json");
// Backend version source → `backend.contract` (frontend-core-architecture
// §2.4 / §3.4.2: drift must be ADDRESSABLE — the manifest states which backend
// range this surface was generated against). Read from the backend module's
// pyproject at gen time; a backend minor bump reddens the drift gate exactly
// like a schema change would. Same sibling convention as gen-errors.
const BACKEND_PYPROJECT =
  process.env.MANIFEST_BACKEND_PYPROJECT ??
  resolve(ROOT, `../${MODULE}/pyproject.toml`);

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
const LLMS_TOKEN_BUDGET = 4000; // §2.4 — a pair's slice must fit an agent's context

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
  const uiKeyRe = new RegExp(`"(${I18N_PREFIX}\\.[a-z0-9_.]+)"`, "g");
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
  for (const [id, op] of Object.entries(m.operations)) {
    L.push(`- ${id}: ${op.method} ${op.path}`);
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

async function main() {
  const pkg = JSON.parse(await readFile(resolve(PKG_DIR, "package.json"), "utf8"));
  const schema = JSON.parse(await readFile(SCHEMA_PATH, "utf8"));
  const flows = JSON.parse(
    await readFile(resolve(PKG_DIR, "src/flows/generated/flows.json"), "utf8")
  );
  const errors = JSON.parse(
    await readFile(resolve(PKG_DIR, "src/i18n/generated/errors.json"), "utf8")
  );
  const indexSrc = await readFile(resolve(PKG_DIR, "src/index.ts"), "utf8");
  const uiKeysSrc = await readFile(resolve(PKG_DIR, "src/i18n/keys.ts"), "utf8");
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
    backend: { module: MODULE, contract: await backendContract() },
    layers: ["api", "model", "flows", "headless", "i18n"],
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

  const llms = renderLlms(manifest, factories, eventsJson, demosJson);
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
