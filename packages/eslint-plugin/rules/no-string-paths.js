// stapel/no-string-paths — frontend-guardrails §2.2 (failure mode F2).
// API URLs are reached through NAMED operations of the codegen client (layer 2),
// never a hand-written path string. `client.get("/me/")` (or a bare
// `"/auth/api/me/"` literal) bypasses the typed operation surface: the wrong
// verb, a stale path, or a renamed endpoint all pass silently. The recommended
// preset turns this OFF for the api layer of a pair (`api/`, `*client.ts`,
// generated) — the ONE legal home of path strings (the operation *definitions*),
// mirroring the no-raw-fetch carve-out.
//
// Two detectors, in the spirit of the other guardrails:
//   1. Syntactic — a call `<recv>.<verb>("/…")` on an http verb with a
//      leading-slash string/template path argument (the `client.get("/…")`
//      bypass shape). Fires with or without a catalog.
//   2. Data-driven — a string / template path that equals (or, for a
//      client-relative literal, ends with) a catalogued operation path from a
//      package manifest.json §operations. A missing catalog degrades detector 2
//      to a no-op; detector 1 still holds the syntactic line.
import { loadOperationCatalog, stapelSettings } from "../lib/data.js";

const DEFAULT_HTTP_VERBS = ["get", "post", "put", "patch", "delete", "request"];

const HINT =
  "Requests go through a NAMED operation of the codegen client, never a path string: const api = createAuthApi(client); await api.<operation>(...). Operations: <pkg>/manifest.json §operations. §2.3 stapel/no-string-paths";

/** A meaningful API path: leading "/" plus at least one segment char. */
function isPathLike(str) {
  return str.startsWith("/") && /[A-Za-z0-9]/.test(str);
}

/** A path-shaped string literal value ("/x/…"), else null. */
function stringLiteralPath(node) {
  if (node && node.type === "Literal" && typeof node.value === "string") {
    return isPathLike(node.value) ? node.value : null;
  }
  return null;
}

/** A template literal whose first quasi begins with "/" — its static prefix. */
function templatePathPrefix(node) {
  if (node && node.type === "TemplateLiteral" && node.quasis.length > 0) {
    const head = node.quasis[0].value.cooked ?? node.quasis[0].value.raw ?? "";
    return isPathLike(head) ? head : null;
  }
  return null;
}

/** Render a template literal back to a readable path with `${…}` placeholders. */
function templateText(node) {
  let out = "";
  node.quasis.forEach((q, i) => {
    out += q.value.cooked ?? q.value.raw ?? "";
    if (i < node.expressions.length) out += "${…}";
  });
  return out;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hand-written API path strings (client.<verb>(\"/…\") or a catalogued operation path) outside the codegen API layer.",
    },
    schema: [
      {
        type: "object",
        properties: {
          verbs: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      // Detector 1 — the client.<verb>("/…") bypass shape.
      clientPath: 'Hand-written API path "{{path}}" via .{{verb}}(). ' + HINT,
      // Detector 2 — a literal/template that IS a catalogued operation path.
      knownPath:
        'Hand-written API path "{{path}}" — this is the catalogued operation "{{operation}}" of {{pkg}}. ' +
        HINT,
      knownPathAnon:
        'Hand-written API path "{{path}}" — this is a catalogued operation. ' + HINT,
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const catalog = loadOperationCatalog(settings);
    const verbs = new Set(
      context.options[0]?.verbs ?? settings.httpVerbs ?? DEFAULT_HTTP_VERBS
    );

    // Nodes already reported by detector 1 (the http-verb call argument), so
    // detector 2 does not double-report the same string.
    const reported = new WeakSet();

    function reportKnown(node, path) {
      const hit = catalog.resolve(path);
      if (hit && hit.operation) {
        context.report({
          node,
          messageId: "knownPath",
          data: { path, operation: hit.operation, pkg: hit.pkg ?? "the pair" },
        });
      } else {
        context.report({ node, messageId: "knownPathAnon", data: { path } });
      }
      reported.add(node);
    }

    return {
      // Detector 1: `<recv>.<verb>(pathArg, …)` on an http verb.
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== "MemberExpression" ||
          callee.computed ||
          callee.property.type !== "Identifier" ||
          !verbs.has(callee.property.name)
        )
          return;
        const arg = node.arguments[0];
        if (!arg) return;
        const literal = stringLiteralPath(arg);
        const prefix = literal === null ? templatePathPrefix(arg) : null;
        if (literal === null && prefix === null) return;
        const path = literal ?? templateText(arg);
        context.report({
          node: arg,
          messageId: "clientPath",
          data: { path, verb: callee.property.name },
        });
        reported.add(arg);
      },

      // Detector 2: any literal / template path that IS a catalogued operation.
      Literal(node) {
        if (reported.has(node) || !catalog.loaded) return;
        // A path in object-KEY position is a route / mock-handler table, not a
        // request — the bypass this rule targets is passing a path to a client
        // call (detector 1, argument position). Skip keys to avoid flagging
        // legitimate `{ "/auth/api/me/": handler }` maps (e.g. demo MSW fixtures).
        if (
          node.parent &&
          node.parent.type === "Property" &&
          !node.parent.computed &&
          node.parent.key === node
        )
          return;
        const path = stringLiteralPath(node);
        if (path !== null && catalog.matches(path)) reportKnown(node, path);
      },
      TemplateLiteral(node) {
        if (reported.has(node) || !catalog.loaded) return;
        if (
          node.parent &&
          node.parent.type === "Property" &&
          node.parent.computed &&
          node.parent.key === node
        )
          return;
        const prefix = templatePathPrefix(node);
        // Only flag a template when its STATIC prefix alone is a full catalogued
        // path (interpolated segments make the rest unknowable — detector 1
        // already covers `client.get(\`/…/${id}/\`)`).
        if (prefix !== null && catalog.matches(prefix)) reportKnown(node, prefix);
      },
    };
  },
};
