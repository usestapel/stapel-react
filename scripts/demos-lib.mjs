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
      const viewport = stringProp(p.initializer, "viewport");
      const step = stringProp(p.initializer, "step");
      if (description !== null) v.description = description;
      if (mock !== null) v.mock = mock;
      if (viewport !== null) v.viewport = viewport;
      if (step !== null) v.step = step;
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

// ── default-skin coverage gate (§54, machine form) ──────────────────────────
//
// The headless gate above proves a pair's LOGIC is demoed. It says nothing
// about the product: the visual pass found 17/21 auth stories, 23/24 account
// stories, 8/8 forms and 3/3 video stories rendering `demo/_harness.tsx`'s
// debug card — a component class name, a `state.step` chip and a row of naked
// buttons — while the antd skins on disk had never been photographed at all.
// A demo that renders the harness is therefore NOT skin coverage, and the only
// honest way to tell the two apart statically is where the demo's component
// came FROM: a skin demo imports it out of `src/default/`.

/**
 * Local names a demo file imports from the package's `src/default/**` — the
 * evidence that a demo renders the SKIN and not the headless harness. Reads
 * import declarations only (the TS AST), so an aliased import is recorded under
 * the local name the `component:` reference actually uses.
 */
export function defaultSkinImportNames(sourceText, fileName = "demo.tsx") {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const names = new Set();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (stmt.importClause?.isTypeOnly) continue;
    const spec = literalText(stmt.moduleSpecifier);
    // `../src/default/Foo.js`, `../src/default/admin/Bar.js`, `../src/default/index.js`
    if (!spec || !/(^|\/)src\/default(\/|$)/.test(spec)) continue;
    const bindings = stmt.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) {
        if (el.isTypeOnly) continue;
        names.add(el.name.text);
      }
    }
    if (stmt.importClause?.name) names.add(stmt.importClause.name.text);
  }
  return names;
}

/**
 * Runtime component exports of one `src/default/**\/index.ts` barrel — the set
 * §54 says must be renderable. `export type { … }` is skipped (not demoable)
 * and so is anything that is not PascalCase.
 */
export function defaultSkinExports(indexSrc) {
  const names = new Set();
  const re = /export\s+(type\s+)?\{([^}]*)\}\s+from\s+["'][^"']+["']/g;
  let m;
  while ((m = re.exec(indexSrc))) {
    if (m[1]) continue;
    for (let name of m[2].split(",")) {
      name = name.trim();
      if (!name) continue;
      if (/^type\s/.test(name)) continue;
      const asMatch = name.match(/\bas\s+(\w+)$/);
      const publicName = asMatch ? asMatch[1] : name.split(/\s+/)[0];
      // PascalCase only: a SCREAMING_CASE export is a constant table
      // (DEFAULT_CHANNEL_PRIORITY, REGISTRATION_ANCHORS), not a component, and
      // demanding a demo of it would be noise the gate gets ignored for.
      if (/^[A-Z][A-Za-z0-9]*$/.test(publicName) && /[a-z]/.test(publicName)) {
        names.add(publicName);
      }
    }
  }
  return [...names].sort();
}

/**
 * The default-skin gate. `required` is the union of every `src/default/**`
 * barrel export and every `component.export` the pair's nav manifest names (a
 * screen the scaffold builds a ROUTE to and which has never been drawn is the
 * worst case of all). `files` is `[{ demos, defaultImports }]`.
 *
 * A name is covered when some demo REFERENCES it (`component` or `covers`) from
 * a file that imports that same name out of `src/default` — a harness demo
 * covering the headless twin of the same name does not count. Covered names
 * additionally need one variant declared `viewport: "phone"`: mobile-first is a
 * rule with teeth only when something reads it.
 *
 * Returns `{ missing, noPhone, covered, unseeded }` — `unseeded` is the static
 * half of the C-SAMESHOT guard: a multi-variant demo where no variant declares
 * the `step` it is seeded at (the runtime half is @stapel/showcase's
 * `assertVariantsRenderDistinctly`, which needs a renderer).
 */
export function defaultSkinGate(required, files, allow = {}) {
  const cover = new Map();
  const unseeded = [];
  for (const { demos, defaultImports } of files) {
    for (const d of demos) {
      const refs = [d.component, ...(d.covers ?? [])].filter(Boolean);
      const skinRefs = refs.filter((n) => defaultImports.has(n));
      const phone = d.variants.some((v) => v.viewport === "phone");
      if (
        skinRefs.length > 0 &&
        d.variants.length > 1 &&
        !d.variants.some((v) => typeof v.step === "string")
      ) {
        unseeded.push(d.id);
      }
      for (const n of skinRefs) {
        const entry = cover.get(n) ?? { demos: [], phone: false };
        entry.demos.push(d.id);
        entry.phone = entry.phone || phone;
        cover.set(n, entry);
      }
    }
  }
  const missing = [];
  const noPhone = [];
  for (const name of required) {
    if (Object.prototype.hasOwnProperty.call(allow, name)) continue;
    const entry = cover.get(name);
    if (!entry) missing.push(name);
    else if (!entry.phone) noPhone.push(name);
  }
  return {
    missing: missing.sort(),
    noPhone: noPhone.sort(),
    covered: [...cover.keys()].sort(),
    unseeded: unseeded.sort(),
  };
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
  // Ladle turns the title into a JavaScript identifier for its virtual story
  // list; a non-ASCII character in it ("create → upload") breaks the viewer
  // BUILD while the stale bundle keeps serving — 1,200 screenshots of "Story
  // not found" on 2026-08-26. Refuse here, where the author can see it.
  if (/[^\x20-\x7e]/.test(demo.title)) {
    throw new Error(
      `demo "${demo.id}" (${demo.source.file}): title ${JSON.stringify(demo.title)} contains a non-ASCII ` +
        `character — Ladle derives an identifier from it and the showcase build fails. Use ASCII punctuation.`
    );
  }
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
    // Declared width / seeded step travel to the viewer and the shot runner, so
    // a "phone" variant is photographed at 390 and a seeded state is asserted
    // to be the one on screen. Emitted only when declared, so a demo that
    // declares neither produces the exact story file it produced before.
    const params = {
      ...(v.viewport ? { viewport: v.viewport } : {}),
      ...(v.step ? { step: v.step } : {}),
    };
    if (Object.keys(params).length > 0) {
      L.push(`${name}.parameters = { stapel: ${JSON.stringify(params)} };`);
    }
  }
  return L.join("\n") + "\n";
}
