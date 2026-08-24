// stapel/no-raw-dimensions — the px twin of no-raw-colors.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// `style={{ fontSize: 12 }}` is `color: "#8c8c8c"` with a different unit. Both
// are a design-system decision taken in a leaf component, where nothing can
// re-take it: a project that rescales its type (a denser storefront, a
// larger-text accessibility profile, a partner's brand) regenerates the token
// JSON and every `fontSize.xs` follows — while every literal `12` stays 12
// forever, in 40 files, discoverable only by grep.
//
// The scale is small and deliberate (spacing 0-8 → 0/4/8/12/16/24/32/48/64;
// radii none/sm/md/lg/xl/full; type xs…3xl). Hitting a value that is NOT on it
// is itself the finding: it means a number was picked by eye, and two numbers
// picked by eye a month apart do not line up.
//
// ── THE AUTOFIX, AND WHY IT IS SAFE ─────────────────────────────────────────
//
//   style={{ padding: 16 }}          →  style={{ padding: spacing[4] }}
//   style={{ borderRadius: 8 }}      →  style={{ borderRadius: radii.md }}
//   style={{ fontSize: 12 }}         →  style={{ fontSize: fontSize.xs.fontSize }}
//   <Space size={6}>                 →  (no fix: 6 is on no scale)
//
// Three properties make the fix mechanical rather than a guess:
//
//   1. It fires ONLY on an EXACT match against the live theme's scale (read
//      from `@stapel/tokens/theme.default.json` — the same JSON that generates
//      `spacing`/`radii`/`fontSize`, so the rule cannot drift from the values
//      it rewrites to). 15 is not "nearly 16"; it is reported without a fix.
//   2. The fix ALSO writes the import — extending an existing
//      `import { … } from "@stapel/tokens"` or inserting one. An autofix that
//      leaves an undefined identifier behind is worse than no autofix, because
//      it converts a lint warning into a build error and blames the wrong line.
//   3. It refuses to fix when the target name is already bound in the module
//      to something else (a local `const spacing = …`), where the rewrite
//      would silently mean something different.
//
// ── WHERE IT LOOKS ──────────────────────────────────────────────────────────
//
// Only inside a STYLE CONTEXT — a `style={{…}}` JSX attribute, a variable or
// property whose name ends in `Style`/`Styles`, or an object annotated
// `CSSProperties` — plus a short list of JSX props that are px by contract
// (`size`, `width`, `height`, `gap`, `minWidth`, `maxWidth`). Everything else
// keeps its numbers: `{ width: 96 }` in a media descriptor, `<Col span={12}>`
// (grid columns, not pixels), `level={4}` on a heading, a `rows={4}` textarea.
// The narrow surface is what keeps this rule from being switched off, which is
// the only way a lint rule ever actually fails.
//
// ZERO IS NEVER FLAGGED. `margin: 0` and `minWidth: 0` are resets — the
// absence of a dimension, not a dimension chosen badly — and `spacing[0]` says
// the same thing at four times the length.
//
// Scope: `src/default/**` (the skins), like its sibling skin-tier rules. The
// shared layer's own raw px (AppShell 5, PublicShell 7, skin.tsx 5) is real
// debt, but it lives outside a pair's `src/default/` and is tracked as G8.
import { isDefaultSkin, normalizedFilename } from "../lib/jsx.js";
import { loadScaleCatalog, stapelSettings } from "../lib/data.js";

/** Style keys whose numeric value is a LENGTH from the spacing scale. */
const SPACING_KEYS = new Set([
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "paddingBlock", "paddingBlockStart", "paddingBlockEnd",
  "paddingInline", "paddingInlineStart", "paddingInlineEnd",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "marginBlock", "marginBlockStart", "marginBlockEnd",
  "marginInline", "marginInlineStart", "marginInlineEnd",
  "gap", "rowGap", "columnGap",
  "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
  "flexBasis",
]);
/** Style keys whose numeric value is a CORNER from the radii scale. */
const RADIUS_KEYS = new Set([
  "borderRadius", "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomLeftRadius", "borderBottomRightRadius",
  "borderStartStartRadius", "borderStartEndRadius",
  "borderEndStartRadius", "borderEndEndRadius",
]);
/** Style keys whose numeric value is a TYPE STEP. */
const FONT_KEYS = new Set(["fontSize"]);

// `lineHeight` is deliberately absent from all three: in React a NUMBER there
// is a unitless multiplier (`lineHeight: 20` is twenty times the font size,
// not 20px), so it is neither a spacing value nor safely fixable.

/** JSX props that are pixels by component contract. */
const DEFAULT_PIXEL_PROPS = ["size", "width", "height", "gap", "minWidth", "maxWidth"];

const TOKENS_MODULE = "@stapel/tokens";

function scaleFor(key) {
  if (RADIUS_KEYS.has(key)) return "radii";
  if (FONT_KEYS.has(key)) return "fontSize";
  if (SPACING_KEYS.has(key)) return "spacing";
  return null;
}

/** The expression text a token step is written as, per scale. */
function tokenExpression(scale, step) {
  if (scale === "spacing") return `spacing[${step}]`;
  if (scale === "radii") return `radii.${step}`;
  // A type step is `{ fontSize, lineHeight }`; the length is the inner field.
  // A step name that is not a valid identifier (`2xl`) is subscripted.
  const access = /^[A-Za-z_$][\w$]*$/.test(step) ? `.${step}` : `["${step}"]`;
  return `fontSize${access}.fontSize`;
}

/** The @stapel/tokens binding a scale needs imported. */
function bindingFor(scale) {
  return scale;
}

/** Property key as a plain string, for `{ padding: 4 }` and `{ "padding": 4 }`. */
function propertyKeyName(prop) {
  if (prop.computed) return null;
  if (prop.key.type === "Identifier") return prop.key.name;
  if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
    return prop.key.value;
  }
  return null;
}

/** Numeric value of a literal (or of `-4`), else null. */
function numericValue(node) {
  if (node?.type === "Literal" && typeof node.value === "number") return node.value;
  if (
    node?.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument.type === "Literal" &&
    typeof node.argument.value === "number"
  ) {
    return -node.argument.value;
  }
  return null;
}

const STYLE_NAME_RE = /(?:^|[a-z])[Ss]tyles?$/;

/**
 * Is this ObjectExpression a CSS style object? Walks up through nesting
 * (`{ root: { padding: 4 } }`, `as const`, a `style={{…}}` container) and
 * answers on the first thing that names a style.
 */
function isStyleObject(node) {
  let current = node;
  for (let depth = 0; current && depth < 8; depth += 1) {
    const parent = current.parent;
    if (!parent) return false;
    switch (parent.type) {
      case "JSXExpressionContainer": {
        const attr = parent.parent;
        if (attr?.type === "JSXAttribute" && attr.name?.type === "JSXIdentifier") {
          return attr.name.name === "style" || STYLE_NAME_RE.test(attr.name.name);
        }
        return false;
      }
      case "VariableDeclarator": {
        if (parent.id?.type === "Identifier") {
          if (STYLE_NAME_RE.test(parent.id.name)) return true;
          const ann = parent.id.typeAnnotation?.typeAnnotation;
          const annName =
            ann?.type === "TSTypeReference" && ann.typeName?.type === "Identifier"
              ? ann.typeName.name
              : null;
          if (annName === "CSSProperties") return true;
        }
        return false;
      }
      case "Property": {
        const name = propertyKeyName(parent);
        if (name && STYLE_NAME_RE.test(name)) return true;
        break; // keep climbing: `{ root: { padding: 4 } }` inside `styles`
      }
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "ObjectExpression":
        break; // transparent wrappers — keep climbing
      default:
        return false;
    }
    current = parent;
  }
  return false;
}

export default {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "Disallow raw numeric dimensions (padding/margin/gap/width/fontSize/radius and px-valued JSX props) in default skins; take them from @stapel/tokens' spacing/radii/type scales.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** JSX props whose numeric value is pixels. */
          pixelProps: { type: "array", items: { type: "string" } },
          /** Report numbers that match no scale step at all (default true). */
          reportOffScale: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rawDimension:
        '`{{key}}: {{value}}` is a hardcoded dimension. It is the same decision as a hardcoded colour, taken where nothing can re-take it: rescale the design system and every `{{fix}}` follows, while every literal {{value}} stays {{value}} in forty files forever. Use `{{fix}}` from "@stapel/tokens" — this one is autofixable (the import is written too).',
      offScale:
        '`{{key}}: {{value}}` is a hardcoded dimension, and {{value}} is on NO {{scale}} step — it was picked by eye, which is why two numbers picked by eye a month apart never line up. Nearest steps: {{nearest}}. Move to one of them (`{{scale}}`, from "@stapel/tokens"), or, if this really is a one-off geometry (a QR code side, an avatar in a fixed row), lift it to a named exported constant so the next person changes it once.',
    },
  },
  create(context) {
    const path = normalizedFilename(context);
    if (!isDefaultSkin(path)) return {};

    const options = context.options[0] ?? {};
    const pixelProps = new Set(options.pixelProps ?? DEFAULT_PIXEL_PROPS);
    const reportOffScale = options.reportOffScale !== false;
    const scales = loadScaleCatalog(stapelSettings(context));
    if (!scales.loaded) return {}; // no catalog → no-op, never a crash (§2.1)

    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /** Module-scope names bound to something OTHER than a @stapel/tokens import. */
    let foreignBindings = null;
    /** The existing `import … from "@stapel/tokens"`, if any. */
    let tokensImport = null;
    let importsScanned = false;

    function scanProgram() {
      if (importsScanned) return;
      importsScanned = true;
      const program = sourceCode.ast;
      foreignBindings = new Set();
      for (const statement of program.body) {
        if (statement.type !== "ImportDeclaration") continue;
        // `importKind` is "value" on a normal import under the TS parser and
        // undefined under espree — only a `import type { … }` is excluded.
        if (statement.source.value === TOKENS_MODULE && statement.importKind !== "type") {
          tokensImport = statement;
        }
      }
      const scope = sourceCode.scopeManager?.globalScope?.childScopes?.[0];
      for (const variable of scope?.variables ?? []) {
        const fromTokens = variable.defs.some(
          (d) =>
            d.type === "ImportBinding" &&
            d.parent?.type === "ImportDeclaration" &&
            d.parent.source.value === TOKENS_MODULE
        );
        if (!fromTokens) foreignBindings.add(variable.name);
      }
    }

    /** Already imported from @stapel/tokens under its own name? */
    function alreadyImported(name) {
      return (tokensImport?.specifiers ?? []).some(
        (s) =>
          s.type === "ImportSpecifier" &&
          (s.imported.name ?? s.imported.value) === name &&
          s.local.name === name
      );
    }

    function importFix(fixer, name) {
      if (alreadyImported(name)) return [];
      if (tokensImport) {
        const specifiers = tokensImport.specifiers.filter(
          (s) => s.type === "ImportSpecifier"
        );
        const last = specifiers[specifiers.length - 1];
        if (last) return [fixer.insertTextAfter(last, `, ${name}`)];
        return []; // `import "@stapel/tokens"` / default-only — leave it alone
      }
      const first = sourceCode.ast.body[0];
      const line = `import { ${name} } from "${TOKENS_MODULE}";\n`;
      return first ? [fixer.insertTextBefore(first, line)] : [];
    }

    function nearestSteps(scale, value) {
      const entries = [...scales[scale].entries()].sort((a, b) => a[0] - b[0]);
      let below = null;
      let above = null;
      for (const [n, step] of entries) {
        if (n < value) below = `${tokenExpression(scale, step)} (${n})`;
        if (n > value && above === null) above = `${tokenExpression(scale, step)} (${n})`;
      }
      return [below, above].filter(Boolean).join(", ") || "none";
    }

    /**
     * Report one raw dimension. `valueNode` is what gets rewritten.
     */
    function report(node, valueNode, key, value, fallbackScale) {
      const scale = scaleFor(key) ?? fallbackScale;
      if (!scale) return;
      if (value === 0) return; // a reset, not a dimension
      const step = scales[scale].get(value);
      if (step === undefined) {
        if (reportOffScale) {
          context.report({
            node,
            messageId: "offScale",
            data: { key, value: String(value), scale, nearest: nearestSteps(scale, value) },
          });
        }
        return;
      }
      const expression = tokenExpression(scale, step);
      const binding = bindingFor(scale);
      scanProgram();
      const fixable = !foreignBindings.has(binding) || alreadyImported(binding);
      context.report({
        node,
        messageId: "rawDimension",
        data: { key, value: String(value), fix: expression },
        fix: fixable
          ? (fixer) => [
              fixer.replaceText(valueNode, expression),
              ...importFix(fixer, binding),
            ]
          : undefined,
      });
    }

    return {
      Property(node) {
        if (node.value == null) return;
        const key = propertyKeyName(node);
        if (!key || !scaleFor(key)) return;
        const value = numericValue(node.value);
        if (value === null) return;
        const object = node.parent;
        if (object?.type !== "ObjectExpression" || !isStyleObject(object)) return;
        report(node, node.value, key, value, null);
      },
      JSXAttribute(node) {
        if (node.name?.type !== "JSXIdentifier") return;
        const key = node.name.name;
        if (!pixelProps.has(key)) return;
        const container = node.value;
        if (container?.type !== "JSXExpressionContainer") return;
        const value = numericValue(container.expression);
        if (value === null) return;
        // A px-valued JSX prop with no style-key classification of its own
        // (`size`) is a LENGTH — the spacing scale.
        report(node, container.expression, key, value, "spacing");
      },
    };
  },
};
