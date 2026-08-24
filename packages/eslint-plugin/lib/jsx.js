// Shared JSX/path helpers for the doctrine rules (the skin-tier guardrails:
// no-bare-dialog, no-tooltip-in-skin, icon-button-needs-label,
// no-hardcoded-theme-mode, no-local-skin-theme, no-raw-dimensions,
// no-silent-slot, no-boolean-disabled).
//
// These rules all share two questions — "what is this element called?" and
// "am I inside a default skin?" — and both were about to be answered eight
// slightly different ways. One answer, one file: a rule that disagrees with
// its siblings about what `src/default/` means is a rule that fires on files
// its own documentation says it does not cover.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Filename with `\` normalized to `/`, so every check reads the same on Windows. */
export function normalizedFilename(context) {
  const filename = context.filename ?? context.getFilename();
  return String(filename ?? "").replace(/\\/g, "/");
}

/**
 * The DEFAULT-SKIN scope shared by the skin-tier rules.
 *
 * Why this scope and not "everywhere": a host app's own chrome is the host's
 * business, and a pair's `headless/` layer renders no chrome at all. A rule
 * that fired on all three would be switched off in all three (see
 * no-bare-dialog's header for the long version of the same argument).
 */
export function isDefaultSkin(path) {
  return /\/src\/default\//.test(path);
}

/** True for a test / fixture path — the preset carves these out too, but the
 * rules that name test files in their own contract (no-adhoc-socket) must not
 * depend on preset wiring to be correct. */
export function isTestPath(path) {
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    /\/(?:test|tests|__tests__|__mocks__|fixtures)\//.test(path) ||
    /\.fixture\.[cm]?[jt]sx?$/.test(path)
  );
}

/** `<Foo>` → "Foo"; `<Foo.Bar>` → "Foo.Bar"; `<foo:bar>` → null. */
export function jsxElementName(openingElement) {
  const name = openingElement?.name;
  if (!name) return null;
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") {
    const object = jsxElementName({ name: name.object });
    if (!object) return null;
    return `${object}.${name.property.name}`;
  }
  return null;
}

/** The last segment of a possibly-qualified element name (`Typography.Text` → "Text"). */
export function jsxElementBaseName(openingElement) {
  const name = jsxElementName(openingElement);
  if (!name) return null;
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(dot + 1);
}

/** Attribute name as written, or null for a spread. */
export function attrName(attr) {
  return attr?.type === "JSXAttribute" && attr.name?.type === "JSXIdentifier"
    ? attr.name.name
    : null;
}

/** The named JSXAttribute on an opening element, or undefined. */
export function getAttr(openingElement, name) {
  return openingElement.attributes.find((a) => attrName(a) === name);
}

/** True when the element carries a spread — we cannot know what is in it. */
export function hasSpread(openingElement) {
  return openingElement.attributes.some((a) => a.type === "JSXSpreadAttribute");
}

/**
 * Static string value of an attribute: `x="a"` and `x={"a"}` → "a"; a boolean
 * shorthand → true; anything computed → undefined (NOT null — absent and
 * dynamic are different answers and callers branch on both).
 */
export function attrStringValue(attr) {
  if (!attr) return undefined;
  const v = attr.value;
  if (v == null) return true;
  if (v.type === "Literal") return v.value;
  if (v.type === "JSXExpressionContainer" && v.expression.type === "Literal") {
    return v.expression.value;
  }
  return undefined;
}

/** JSX children with insignificant whitespace/comment-only text removed. */
export function significantChildren(element) {
  const children = element?.children ?? [];
  return children.filter((child) => {
    if (child.type === "JSXText") return child.value.trim() !== "";
    if (child.type === "JSXExpressionContainer") {
      return child.expression.type !== "JSXEmptyExpression";
    }
    return true;
  });
}

// ── nearest package.json (cached) ───────────────────────────────────────────

const _pkgNameCache = new Map();

/**
 * Name of the npm package a file belongs to, by walking up to the nearest
 * package.json. `null` when there is none (a loose file, or RuleTester's
 * virtual paths) — callers must treat that as "unknown", never as "allowed".
 */
export function packageNameFor(path) {
  let dir = dirname(path);
  const seen = [];
  for (;;) {
    if (_pkgNameCache.has(dir)) {
      const hit = _pkgNameCache.get(dir);
      for (const d of seen) _pkgNameCache.set(d, hit);
      return hit;
    }
    seen.push(dir);
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) {
      let name = null;
      try {
        name = JSON.parse(readFileSync(candidate, "utf8")).name ?? null;
      } catch {
        name = null;
      }
      for (const d of seen) _pkgNameCache.set(d, name);
      return name;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      for (const d of seen) _pkgNameCache.set(d, null);
      return null;
    }
    dir = parent;
  }
}

/** Test-only: drop the package.json lookup cache. */
export function __resetJsxCaches() {
  _pkgNameCache.clear();
}
