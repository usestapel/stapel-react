// stapel/no-reserved-backend-route — path-collision guardrail between the SPA
// router and the backend's reserved namespace (§57 nginx canon:
// stapel-tools' _compose_templates.NGINX_CONF / NGINX_LOCAL_CONF_TEMPLATE —
// "a frontend app must never define a client route starting with
// /staticfiles/, /media/ or /<backend-slug>/api|swagger…").
//
// Canon (owner directive): a BARE module root (`/calendar`) is legitimate —
// roots belong to the frontend. Only a route that falls INTO a reserved
// SUB-path (`/calendar/api/…`, `/calendar/swagger…`, and the project-wide
// `/admin`, `/staticfiles`, `/media`) collides with the backend. The reserved
// list itself is data-driven — read from `reserved-paths.json` (the same
// projection stapel-tools' generator emits), never hand-maintained here, so
// the rule tracks a project's actual module set (§2.1). A missing catalog
// degrades the rule to a no-op (never a crash) — same policy as every other
// data-driven rule in this plugin.
//
// Two detector shapes, in the spirit of the other route/path guardrails
// (no-string-paths):
//   1. JSX — <Route path="…"> (react-router).
//   2. Object route configs — a `path` property on an object that reads as a
//      RouteObject (has an `element`/`Component`/`children`/`index`/
//      `errorElement`/`loader`/`action`/`lazy` sibling), OR sits inside the
//      array literal passed straight to `createBrowserRouter`/
//      `createHashRouter`/`createMemoryRouter` — covers `useRoutes([...])`
//      configs and router-factory calls alike.
// Only string literals and the static prefix of a template literal are
// checked (dynamic segments are unknowable — false-positive policy, same as
// no-string-paths).
import { loadReservedPathCatalog, stapelSettings } from "../lib/data.js";

const ROUTER_FACTORIES = new Set([
  "createBrowserRouter",
  "createHashRouter",
  "createMemoryRouter",
  "createStaticRouter",
]);

const ROUTE_SHAPE_KEYS = new Set([
  "element",
  "Component",
  "children",
  "index",
  "errorElement",
  "loader",
  "action",
  "lazy",
]);

// Prefixes with more than one path segment (e.g. "/calendar/api") are a
// module's own sub-path reservation — the bare root one segment up
// ("/calendar") is the frontend's by canon, worth saying explicitly. A
// single-segment prefix ("/admin", "/staticfiles", "/media") is a
// project-wide infra reservation with no such carve-out.
const SUBPATH_HINT =
  "Reserved for the backend (nginx §57 canon). A bare module root (\"/{{mod}}\") stays the frontend's — only this sub-path collides. Route somewhere else, or drop the reservation from reserved-paths.json if this module no longer owns it.";
const GLOBAL_HINT =
  "Reserved project-wide for the backend/infra (nginx §57 canon: /admin, /staticfiles, /media) — there is no frontend carve-out for this prefix. Route somewhere else.";

/** A meaningful path: leading "/" plus at least one segment char. */
function isPathLike(str) {
  return typeof str === "string" && str.startsWith("/") && /[A-Za-z0-9]/.test(str);
}

function jsxAttr(node, name) {
  return node.attributes.find(
    (a) =>
      a.type === "JSXAttribute" &&
      a.name &&
      a.name.type === "JSXIdentifier" &&
      a.name.name === name
  );
}

/** The literal/template node behind a JSX attribute's value, or null. */
function jsxAttrValueNode(attr) {
  if (!attr || attr.value == null) return null;
  const v = attr.value;
  if (v.type === "Literal") return v;
  if (v.type === "JSXExpressionContainer") return v.expression;
  return null;
}

/** String literal value, or a template literal's static-prefix, else null. */
function literalOrTemplatePrefix(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") {
    return isPathLike(node.value) ? node.value : null;
  }
  if (node.type === "TemplateLiteral" && node.quasis.length > 0) {
    const head = node.quasis[0].value.cooked ?? node.quasis[0].value.raw ?? "";
    return isPathLike(head) ? head : null;
  }
  return null;
}

function hasRouteShapeSibling(objExpr) {
  return objExpr.properties.some(
    (p) =>
      p.type === "Property" &&
      !p.computed &&
      p.key.type === "Identifier" &&
      ROUTE_SHAPE_KEYS.has(p.key.name)
  );
}

/**
 * True if `objExpr` sits (through any nesting of `children` arrays / plain
 * arrays) inside the argument list of a `createBrowserRouter`-family call.
 */
function isInRouterFactoryCall(objExpr) {
  let cur = objExpr;
  let parent = objExpr.parent;
  while (parent) {
    if (parent.type === "ArrayExpression") {
      cur = parent;
      parent = parent.parent;
      continue;
    }
    if (
      parent.type === "Property" &&
      parent.value === cur &&
      !parent.computed &&
      parent.key.type === "Identifier" &&
      parent.key.name === "children"
    ) {
      cur = parent.parent; // the enclosing ObjectExpression
      parent = cur.parent;
      continue;
    }
    if (parent.type === "CallExpression") {
      return (
        parent.arguments.includes(cur) &&
        parent.callee.type === "Identifier" &&
        ROUTER_FACTORIES.has(parent.callee.name)
      );
    }
    return false;
  }
  return false;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow an SPA route path that falls into a reserved backend sub-path (/<mod>/api/…, /<mod>/swagger…, /admin, /staticfiles, /media). A bare module root is legitimate.",
    },
    schema: [
      {
        type: "object",
        properties: {
          reservedPathPrefixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      reservedSubPath:
        'Route path "{{path}}" collides with the reserved backend prefix "{{prefix}}". ' +
        SUBPATH_HINT,
      reservedGlobal:
        'Route path "{{path}}" collides with the reserved backend prefix "{{prefix}}". ' +
        GLOBAL_HINT,
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const catalog = loadReservedPathCatalog(
      context.options[0]?.reservedPathPrefixes
        ? { reservedPaths: context.options[0].reservedPathPrefixes }
        : settings
    );
    if (!catalog.loaded) return {}; // no reserved-paths.json → no-op, never guess

    function check(node, path) {
      const prefix = catalog.matches(path);
      if (!prefix) return;
      const segments = prefix.split("/").filter(Boolean);
      const isSubPath = segments.length > 1;
      const mod = segments[0];
      context.report({
        node,
        messageId: isSubPath ? "reservedSubPath" : "reservedGlobal",
        data: { path, prefix, mod },
      });
    }

    return {
      // Detector 1: <Route path="…">.
      JSXOpeningElement(node) {
        if (!(node.name.type === "JSXIdentifier" && node.name.name === "Route")) return;
        const attr = jsxAttr(node, "path");
        const valueNode = jsxAttrValueNode(attr);
        const path = literalOrTemplatePrefix(valueNode);
        if (path) check(valueNode, path);
      },
      // Detector 2: object route configs (RouteObject shape or a
      // createBrowserRouter-family array literal).
      Property(node) {
        if (
          node.computed ||
          node.key.type !== "Identifier" ||
          node.key.name !== "path" ||
          node.parent.type !== "ObjectExpression"
        )
          return;
        const path = literalOrTemplatePrefix(node.value);
        if (!path) return;
        const objExpr = node.parent;
        if (!hasRouteShapeSibling(objExpr) && !isInRouterFactoryCall(objExpr)) return;
        check(node.value, path);
      },
    };
  },
};
