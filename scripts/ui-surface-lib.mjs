// A pair's UI surface as data, for `gen-manifest.mjs`: the fixed test ids in
// `src/testids.ts` and the browser flows in the pair's own `flows.json`
// (`stapel.flows/1`, the document Studio's preview walker executes). Both are
// optional and additive: a pair without them gets no `testids` / `uiFlows`
// key, so its manifest stays byte-identical. Pure functions, no I/O, proven
// by `ui-surface-lib.test.mjs`.

export const TESTID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const UI_FLOWS_SCHEMA = "stapel.flows/1";
const OPS = new Set(["goto", "click", "fill", "select", "submit", "expect", "api"]);
const SESSIONS = new Set(["any", "member"]);
const VAR = /\{([a-z_][a-z0-9_]*)\}/g;

/**
 * `{ key: "test-id" }` from the ONE `export const <NAME>_TESTIDS = { … }`
 * object literal of a pair's `src/testids.ts`. Throws when the file has no
 * such literal, a value breaks the kebab-case pattern, or two keys share a
 * value (two controls answering one id would make every check ambiguous).
 */
export function parseTestids(src, where = "src/testids.ts") {
  const block = src.match(/export const [A-Z][A-Z0-9_]*_TESTIDS\s*=\s*\{([\s\S]*?)\}\s*as const/);
  if (!block) {
    throw new Error(`gen:manifest: ${where} has no \`export const <NAME>_TESTIDS = { … } as const\``);
  }
  const body = block[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const out = {};
  const seen = new Map();
  for (const m of body.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"([^"]*)"/g)) {
    const [, key, value] = m;
    if (!TESTID_PATTERN.test(value)) {
      throw new Error(`gen:manifest: ${where} ${key}: "${value}" is not a kebab-case test id`);
    }
    if (seen.has(value)) {
      throw new Error(`gen:manifest: ${where} ${seen.get(value)} and ${key} share the test id "${value}"`);
    }
    seen.set(value, key);
    out[key] = value;
  }
  if (Object.keys(out).length === 0) {
    throw new Error(`gen:manifest: ${where} declares no test ids`);
  }
  return out;
}

/**
 * Validate a pair's `flows.json` against the runner's structural rules and
 * against the pair itself, and return its manifest projection
 * `{ <id>: { title, session, steps } }`. A pair's flows walk the pair's own
 * surface: every `testid` / `within` must be one of `testids`. Every `{var}`
 * a step uses must be listed in `needs` (the host supplies it) or defined in
 * `vars` — the runner raises on an unknown one mid-walk.
 */
export function validateUiFlows(doc, testids, where = "flows.json") {
  const fail = (msg) => {
    throw new Error(`gen:manifest: ${where} ${msg}`);
  };
  if (doc?.schema !== UI_FLOWS_SCHEMA) fail(`schema must be "${UI_FLOWS_SCHEMA}"`);
  if (!Array.isArray(doc.flows) || doc.flows.length === 0) fail("has no flows");
  const known = new Set(Object.values(testids ?? {}));
  const declared = new Set([...(doc.needs ?? []), ...Object.keys(doc.vars ?? {})]);
  const out = {};
  for (const flow of doc.flows) {
    const fid = flow?.id;
    if (typeof fid !== "string" || !/^[a-z][a-z0-9_-]*$/.test(fid)) fail(`flow id ${JSON.stringify(fid)} is not an id`);
    if (Object.hasOwn(out, fid)) fail(`flow "${fid}" is declared twice`);
    if (typeof flow.title !== "string" || flow.title.length === 0) fail(`${fid}: needs a title`);
    if (!SESSIONS.has(flow.session)) fail(`${fid}: session must be one of ${[...SESSIONS].join(", ")}`);
    if (!Array.isArray(flow.steps) || flow.steps.length === 0) fail(`${fid}: has no steps`);
    const flowVars = new Set([...declared, ...Object.keys(flow.vars ?? {})]);
    flow.steps.forEach((step, i) => {
      const at = `${fid}[${i}]`;
      if (!OPS.has(step?.op)) fail(`${at}: unknown op ${JSON.stringify(step?.op)}`);
      if ((step.op === "click" || step.op === "expect") && !step.testid) fail(`${at}: ${step.op} needs a testid`);
      if (["fill", "select", "submit"].includes(step.op) && !step.within) fail(`${at}: ${step.op} needs within`);
      if ((step.op === "goto" || step.op === "api") && !String(step.path ?? "").startsWith("/")) {
        fail(`${at}: ${step.op} needs an absolute path`);
      }
      for (const key of ["testid", "within"]) {
        if (step[key] !== undefined && !known.has(step[key])) {
          fail(`${at}: ${key} "${step[key]}" is not one of the pair's test ids (src/testids.ts)`);
        }
      }
      for (const m of JSON.stringify(step).matchAll(VAR)) {
        if (!flowVars.has(m[1])) fail(`${at}: {${m[1]}} is neither in needs nor in vars`);
      }
    });
    out[fid] = { title: flow.title, session: flow.session, steps: flow.steps.length };
  }
  return out;
}

/** A pair that ships `flows.json` must publish it: in `files` and exported
 * as `./flows.json`, or a consumer cannot read it from the installed pair. */
export function assertShipsUiFlows(pkg) {
  const problems = [];
  if (!(pkg.files ?? []).includes("flows.json")) problems.push('"files" does not list "flows.json"');
  if (!Object.hasOwn(pkg.exports ?? {}, "./flows.json")) problems.push('"exports" has no "./flows.json"');
  if (problems.length > 0) {
    throw new Error(
      `gen:manifest: ${pkg.name} has flows.json but does not publish it: ${problems.join("; ")}`
    );
  }
}

/** The llms.txt lines for both, empty when the pair has neither. */
export function renderLlmsUiSurface(testids, uiFlows) {
  const L = [];
  if (testids) {
    L.push("## Test ids (src/testids.ts — fixed by the pair, never props)");
    L.push(Object.values(testids).join(" · "));
    L.push("");
  }
  if (uiFlows) {
    L.push(`## Browser flows (flows.json, ${UI_FLOWS_SCHEMA}; a member flow needs a signed-in session first)`);
    for (const [id, f] of Object.entries(uiFlows)) L.push(`- ${id} (${f.session}): ${f.title}`);
    L.push("");
  }
  return L;
}
