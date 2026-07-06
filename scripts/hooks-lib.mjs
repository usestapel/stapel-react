// Pure library behind gen-manifest's `hooks` section (frontend-core-architecture
// §2.4 — the manifest promises a query-hook catalog). A pair's model layer
// exports use*-hooks over the typed operations; this projects each one STATICALLY
// (TypeScript AST, no app code runs) into { kind, operation(s), queryKey } so an
// agent finds "the hook to read this resource" without reading the source, and
// the review can confirm the SDK's hooks were used, not a hand-rolled useQuery.
//
// Two inputs, both static:
//   1. the query-key factory file (`authQueryKeys = { … }`) → a method→key map,
//      so a hook's `queryKey: authQueryKeys.sessions()` resolves to the literal
//      key array the manifest documents (arch §2.4 shows the resolved array).
//   2. the model source files → each exported `use*` function: `useQuery` ⇒
//      query, `useMutation` ⇒ mutation; the `api.*`/`session.*` call(s) in its
//      body are the operation(s); queries carry their resolved queryKey,
//      mutations the keys they invalidate.
//
// Deterministic and byte-stable for the drift gate.
import ts from "typescript";

const RECEIVERS = ["api", "session"]; // operation-bearing receivers in a hook body

function sourceFile(text, fileName) {
  return ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function propName(name) {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
}

// ── query-key factory → method → resolved key array ──────────────────────────
//
// Resolves `authQueryKeys = { capabilities: () => [ROOT, "capabilities"], … }`
// against top-level `const ROOT = "auth"` bindings. Array elements: string
// literal → the string; identifier bound to a string const → its value;
// arrow parameter (or any other identifier) → `{name}` placeholder (the key
// shape, with the dynamic segment named).

/** Unwrap `x as const` / `(x)` / `x satisfies T` to the inner expression. */
function unwrap(node) {
  let n = node;
  while (
    n &&
    (ts.isAsExpression(n) ||
      ts.isSatisfiesExpression(n) ||
      ts.isParenthesizedExpression(n) ||
      ts.isTypeAssertionExpression?.(n))
  ) {
    n = n.expression;
  }
  return n;
}

function collectStringConsts(sf) {
  const consts = new Map();
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const init = unwrap(decl.initializer); // `const ROOT = "auth" as const`
      if (init && ts.isStringLiteralLike(init)) {
        consts.set(decl.name.text, init.text);
      }
    }
  }
  return consts;
}

function keyArrayFrom(arrayNode, consts, params) {
  return arrayNode.elements.map((el) => {
    if (ts.isStringLiteralLike(el)) return el.text;
    if (ts.isNumericLiteral(el)) return Number(el.text);
    if (ts.isIdentifier(el)) {
      if (consts.has(el.text)) return consts.get(el.text);
      return `{${el.text}}`; // parameter / dynamic segment
    }
    return "{…}";
  });
}

/** Find the object literal assigned to the `factoryName` const, else null. */
function findFactoryObject(sf, factoryName) {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (
        ts.isIdentifier(decl.name) &&
        decl.name.text === factoryName &&
        decl.initializer &&
        ts.isObjectLiteralExpression(decl.initializer)
      ) {
        return decl.initializer;
      }
    }
  }
  return null;
}

/** Build method-name → resolved key array from the factory source. */
export function parseKeyFactory(factorySource, fileName, factoryName) {
  const map = new Map();
  if (!factorySource) return map;
  const sf = sourceFile(factorySource, fileName);
  const consts = collectStringConsts(sf);
  const obj = findFactoryObject(sf, factoryName);
  if (!obj) return map;
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const name = propName(p.name);
    if (name === null) continue;
    const init = p.initializer;
    // `all: [ROOT]`
    if (ts.isArrayLiteralExpression(init)) {
      map.set(name, keyArrayFrom(init, consts, []));
      continue;
    }
    // `capabilities: () => [ROOT, "capabilities"]` / `audit: (page) => [ROOT, "audit", page]`
    if (ts.isArrowFunction(init) && ts.isArrayLiteralExpression(init.body)) {
      map.set(name, keyArrayFrom(init.body, consts, []));
    }
  }
  return map;
}

// ── model hook extraction ────────────────────────────────────────────────────

/** Every `<recv>.<method>(…)` where recv ∈ RECEIVERS, in AST order. */
function callsOnReceivers(node, out) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    RECEIVERS.includes(node.expression.expression.text)
  ) {
    out.push(node.expression.name.text);
  }
  ts.forEachChild(node, (c) => callsOnReceivers(c, out));
}

/** Every `<factory>.<method>(…)` or `<factory>.<prop>` reference in `node`. */
function factoryRefs(node, factoryName, out) {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === factoryName
  ) {
    out.push(node.name.text);
  }
  ts.forEachChild(node, (c) => factoryRefs(c, factoryName, out));
}

function containsCallTo(node, calleeName) {
  let found = false;
  const walk = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === calleeName
    ) {
      found = true;
    }
    if (!found) ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

/** The `queryKey` property initializer inside a hook body, if it is a factory ref. */
function queryKeyFactoryMethod(fnNode, factoryName) {
  let method = null;
  const walk = (n) => {
    if (
      method === null &&
      ts.isPropertyAssignment(n) &&
      propName(n.name) === "queryKey"
    ) {
      const v = n.initializer;
      // authQueryKeys.capabilities()  |  authQueryKeys.all
      const access = ts.isCallExpression(v) ? v.expression : v;
      if (
        ts.isPropertyAccessExpression(access) &&
        ts.isIdentifier(access.expression) &&
        access.expression.text === factoryName
      ) {
        method = access.name.text;
      }
    }
    if (method === null) ts.forEachChild(n, walk);
  };
  walk(fnNode);
  return method;
}

/**
 * Extract exported `use*` hooks from one model source file. Returns
 * [{ name, kind, operations, queryKeyMethod?, invalidateMethods? }], where
 * queryKeyMethod / invalidateMethods are factory method names to be resolved
 * by the caller against `parseKeyFactory`.
 */
export function extractHooks(source, fileName, factoryName) {
  const sf = sourceFile(source, fileName);
  const hooks = [];
  for (const stmt of sf.statements) {
    if (
      !ts.isFunctionDeclaration(stmt) ||
      !stmt.name ||
      !stmt.name.text.startsWith("use") ||
      !stmt.body
    )
      continue;
    // Exported? (`export function useX`)
    const exported = (ts.getCombinedModifierFlags(stmt) & ts.ModifierFlags.Export) !== 0;
    if (!exported) continue;

    const isQuery = containsCallTo(stmt.body, "useQuery");
    const isMutation = containsCallTo(stmt.body, "useMutation");
    if (!isQuery && !isMutation) continue;

    const ops = [];
    callsOnReceivers(stmt.body, ops);
    const operations = [...new Set(ops)].sort();

    const hook = {
      name: stmt.name.text,
      kind: isMutation ? "mutation" : "query",
      operations,
    };

    if (isMutation) {
      const refs = [];
      factoryRefs(stmt.body, factoryName, refs);
      const invalidateMethods = [...new Set(refs)].sort();
      if (invalidateMethods.length > 0) hook.invalidateMethods = invalidateMethods;
    } else {
      const m = queryKeyFactoryMethod(stmt.body, factoryName);
      if (m) hook.queryKeyMethod = m;
    }
    hooks.push(hook);
  }
  return hooks;
}

// ── assembly + projections ───────────────────────────────────────────────────

/**
 * Build the manifest `hooks` section from extracted hooks + the resolved key
 * factory. Shape per frontend-core-architecture §2.4:
 *   "useCapabilities": { kind: "query", operation: "capabilities",
 *                        queryKey: ["auth","capabilities"] }
 * Mutations carry `invalidates` (the key arrays they touch) instead of queryKey.
 */
export function buildHooks(allHooks, keyFactory) {
  const out = {};
  for (const h of allHooks.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    const entry = { kind: h.kind };
    if (h.operations.length === 1) entry.operation = h.operations[0];
    else if (h.operations.length > 1) entry.operations = h.operations;
    if (h.kind === "query" && h.queryKeyMethod) {
      const key = keyFactory.get(h.queryKeyMethod);
      if (key) entry.queryKey = key;
    }
    if (h.kind === "mutation" && h.invalidateMethods) {
      const keys = h.invalidateMethods
        .map((m) => keyFactory.get(m))
        .filter(Boolean);
      if (keys.length > 0) entry.invalidates = keys;
    }
    out[h.name] = entry;
  }
  return out;
}

/** Compact llms.txt lines for the hooks surface. */
export function renderLlmsHooks(hooks) {
  const names = Object.keys(hooks);
  const L = [];
  if (names.length === 0) return L;
  L.push("## Query hooks (server state; keys come only from the key factory)");
  for (const name of names) {
    const h = hooks[name];
    const op = h.operation ?? (h.operations ? h.operations.join("+") : "—");
    L.push(`- ${name} (${h.kind}) → ${op}`);
  }
  return L;
}
