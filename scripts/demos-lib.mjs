// Pure library behind gen-demos.mjs (frontend-guardrails §4). One static source
// — `defineDemo({...})` call sites in a package's `demo/**/*.demo.tsx` — feeds
// four projections, all extracted via the TypeScript AST (no app code runs):
//
//   1. demos.json                the package's demo registry (drift-gated).
//   2. *.stories.tsx (CSF)       the community viewer (Ladle) renders these.
//   3. manifest.demos + llms.txt canonical, compiled, linted example snippets
//      (embedded by gen-manifest / gen-tokens — F8, §4.3).
//   4. the COMPLETENESS GATE     every exported headless component must be
//      covered by ≥1 demo, or CI is red (§4.2).
//
// The literal-only shape is what makes 1–4 possible; the `stapel/demo-literal-
// meta` lint keeps id/title/description literal and component/covers readable.
// Everything is deterministic and byte-stable for the drift gate.
import ts from "typescript";

// ── defineEvent-style literal extraction ────────────────────────────────────

function literalText(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function stringProp(obj, key) {
  const init = propInitializer(obj, key);
  return literalText(init);
}

function propInitializer(obj, key) {
  for (const p of obj.properties) {
    if (
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === key
    ) {
      return p.initializer;
    }
  }
  return null;
}

/** A string-array property (e.g. `covers`, `tokens`) → string[] (literals only). */
function stringArrayProp(obj, key) {
  const init = propInitializer(obj, key);
  if (!init || !ts.isArrayLiteralExpression(init)) return [];
  return init.elements.map(literalText).filter((v) => v !== null);
}

/** The `component`/`covers` reference names — an identifier's text. */
function identifierName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node)) return node.text;
  // e.g. `Foo.Bar` — record the property name.
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return null;
}

/**
 * Parse the `variants: { id: { description?, mock?, render } }` object into an
 * ordered list of variant projections. `render` is intentionally NOT read (it
 * is a closure); only the statically-meaningful meta travels to the registry.
 */
function parseVariants(obj) {
  const init = propInitializer(obj, "variants");
  const out = [];
  if (!init || !ts.isObjectLiteralExpression(init)) return out;
  for (const p of init.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const id =
      ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
    if (id === null) continue;
    const v = { id };
    if (ts.isObjectLiteralExpression(p.initializer)) {
      const description = stringProp(p.initializer, "description");
      const mock = stringProp(p.initializer, "mock");
      if (description !== null) v.description = description;
      if (mock !== null) v.mock = mock;
    }
    out.push(v);
  }
  return out;
}

/**
 * Extract every `defineDemo({ ... })` from one source file. Returns
 * [{ id, title, description, component, covers, flow?, tokens, variants,
 *    source:{file,line} }], sorted by id. `fileName` is recorded verbatim
 * (pass a repo-relative path for stable output).
 */
export function extractDemos(sourceText, fileName) {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const demos = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineDemo" &&
      node.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const arg = node.arguments[0];
      const id = stringProp(arg, "id");
      const title = stringProp(arg, "title");
      const description = stringProp(arg, "description");
      const component = identifierName(propInitializer(arg, "component"));
      if (id !== null && title !== null && description !== null && component) {
        const flow = stringProp(arg, "flow");
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        demos.push({
          id,
          title,
          description,
          component,
          covers: stringArrayProp(arg, "covers"),
          ...(flow !== null ? { flow } : {}),
          tokens: stringArrayProp(arg, "tokens"),
          variants: parseVariants(arg),
          source: { file: fileName, line: line + 1 },
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return demos.sort((a, b) => a.id.localeCompare(b.id));
}

// ── headless-export discovery (completeness gate input) ─────────────────────

/**
 * The runtime exports a pair re-exports from its `headless/` layer — the set the
 * completeness gate requires demos for. Data-driven off `src/index.ts`
 * re-export sources (`export { X } from "./headless/..."`), not a hand list, so
 * a new headless component is covered automatically. `export type { … }` is
 * ignored (types aren't demoable).
 */
export function headlessExports(indexSrc) {
  const names = new Set();
  const re = /export\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(indexSrc))) {
    const isType = Boolean(m[1]);
    const from = m[3];
    if (isType) continue;
    if (!/\/headless\//.test(from) && !/headless/.test(from)) continue;
    for (let name of m[2].split(",")) {
      name = name.trim();
      if (!name) continue;
      const asMatch = name.match(/\bas\s+(\w+)$/);
      const publicName = asMatch ? asMatch[1] : name.split(/\s+/)[0];
      if (/^[A-Z]\w*$/.test(publicName)) names.add(publicName);
    }
  }
  return [...names].sort();
}

/**
 * The completeness gate (§4.2): every headless export must be `component` or in
 * `covers` of some demo. Returns { missing, covered } — `missing` non-empty ⇒
 * CI red.
 */
export function completenessGate(headless, demos) {
  const covered = new Set();
  for (const d of demos) {
    covered.add(d.component);
    for (const c of d.covers ?? []) covered.add(c);
  }
  const missing = headless.filter((name) => !covered.has(name));
  return { missing, covered: [...covered].sort() };
}

// ── assembly + projections ──────────────────────────────────────────────────

export function buildDemosJson({ pkg, demos }) {
  return {
    $generated:
      "by scripts/gen-demos.mjs — do not edit; drift-gated (pnpm gen:demos:check)",
    package: pkg.name,
    version: pkg.version,
    demos,
  };
}

/** Compact `demos` section for a package's manifest.json (F8, §4.3). */
export function manifestDemos(demosJson) {
  return demosJson.demos.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    component: d.component,
    ...(d.covers && d.covers.length ? { covers: d.covers } : {}),
    ...(d.flow ? { flow: d.flow } : {}),
    ...(d.tokens && d.tokens.length ? { tokens: d.tokens } : {}),
    variants: d.variants.map((v) => v.id),
    source: d.source.file,
  }));
}

/**
 * llms.txt lines for the demo surface. Kept COMPACT on purpose: the full
 * default-variant source is the canonical example (§4.3), but embedding 13 of
 * them blows the per-pair token budget the CI check enforces (§2.4). So llms
 * carries the demo CATALOG (id · covered component · variants) plus a pointer to
 * the source file that IS the compiled/linted/rendered snippet — one Read away.
 */
export function renderLlmsDemos(demosJson) {
  const L = [];
  L.push("## Demos (defineDemo → manifest.demos; compiled, linted, rendered examples)");
  if (demosJson.demos.length === 0) {
    L.push("- (none yet)");
    return L;
  }
  for (const d of demosJson.demos) {
    const variants = d.variants.map((v) => v.id).join("|");
    L.push(`- ${d.id} → <${d.component}> [${variants}]  ${d.source.file}`);
  }
  L.push("Each source file is the canonical usage snippet (open the default variant).");
  return L;
}

// ── CSF (Ladle) story generation ────────────────────────────────────────────

/** PascalCase a variant id into a valid JS export name (e.g. "code-sent" → "CodeSent"). */
function exportName(variantId) {
  const pascal = variantId
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return /^[A-Za-z]/.test(pascal) ? pascal : `V${pascal}`;
}

/**
 * Generate the CSF story file for ONE demo file. `demoImport` is the specifier
 * the story uses to import the demo's default export (e.g. "../Foo.demo.js").
 * `groupPrefix` groups the demo under a package folder in the viewer sidebar.
 */
export function renderStory(demo, demoImport, groupPrefix) {
  const L = [];
  L.push(
    "// AUTO-GENERATED by scripts/gen-demos.mjs — do not edit. Drift gate: pnpm gen:demos:check"
  );
  L.push("// CSF story projected from a defineDemo() source (frontend-guardrails §4.1).");
  L.push('import type { ReactElement } from "react";');
  L.push('import { renderDemoVariant } from "@stapel/showcase";');
  L.push(`import demo from "${demoImport}";`);
  L.push("");
  L.push(`export default { title: ${JSON.stringify(`${groupPrefix} / ${demo.title}`)} };`);
  L.push("");
  const used = new Set();
  for (const v of demo.variants) {
    let name = exportName(v.id);
    while (used.has(name)) name += "_";
    used.add(name);
    L.push(
      `export const ${name} = (): ReactElement => renderDemoVariant(demo, ${JSON.stringify(v.id)});`
    );
    L.push(`${name}.storyName = ${JSON.stringify(v.id)};`);
  }
  return L.join("\n") + "\n";
}
