// stapel/no-skin-color-literal — a colour written down in a skin is a colour
// one of the two themes will get wrong.
//
// ── THE DEFECT ──────────────────────────────────────────────────────────────
//
// `@stapel/video-react` 0.3.6 drew the in-call screen on a white sheet under
// the dark theme's light text: 1.09:1 on every line — the call title, the
// peer's name, the connection status, the caller's name on the ring. Measured
// on the stand, headless, `data-theme="dark"`, at 1440 and at 390. A person on
// a dark page answering a call got a white rectangle with invisible writing on
// it.
//
// The fix (0.3.7) shipped a gate with it — `video-react/test/darkSkin.test.tsx`
// — whose FIRST half is a line-by-line grep of `src/default/**` for a colour
// literal. That grep is a good gate and it protects exactly one package. This
// rule is the same gate for the other twenty-eight.
//
// ── WHAT THIS RULE DOES *NOT* CLAIM ─────────────────────────────────────────
//
// Read this before believing a green run. The 0.3.6 defect was NOT a literal.
// The source said:
//
//     const { token } = theme.useToken();          // ← ABOVE its own <SkinTheme>
//     <div style={{ background: token.colorBgContainer }}>
//
// `token.colorBgContainer` read above the component's own `<SkinTheme>` is
// whatever theme the HOST happens to have around it, and in a storefront that
// themes through `data-theme` alone that is antd's ambient default — white,
// whatever the page is. There is no `#ffffff` anywhere in that file, and this
// rule would have stayed silent on it. `stapel/no-hardcoded-theme-mode` and
// `stapel/no-local-skin-theme` cover the theme-owner half of the same seam;
// the render-time half is the SECOND gate in `darkSkin.test.tsx`, which
// renders under both modes and asserts the fills MOVE. Neither is replaceable
// by lint, and neither is replaced by this.
//
// What this rule closes is the OTHER door into the same room, and the one the
// fleet walks through more often: somebody hardcodes the colour, it looks
// right in the theme they had open, and the other theme gets it wrong.
//
// ── THE DETECTION BOUNDARY ──────────────────────────────────────────────────
//
// Scope: files under `src/default/**` (the skin layer — `lib/jsx.js`'s
// `isDefaultSkin`, shared with every other skin-tier rule so they cannot
// disagree about what "the skin" means), never test or fixture paths. A host
// app's own chrome is the host's business and a `headless/` layer paints
// nothing.
//
// Four surfaces, each its own message:
//
//   `styleColorLiteral`  — a colour literal as the value of a property in a
//                          STYLE OBJECT: the expression of `style={…}`, of any
//                          `*Style`/`styles` attribute or property, or an
//                          object literal annotated `CSSProperties` /
//                          `CSSObject`. Resolved through one hop of a
//                          same-file `const`, so moving the hex into a tidy
//                          constant does not launder it.
//   `cssTemplateColorLiteral` — a colour literal in a `styled.x`/`css`/
//                          `createGlobalStyle`/`keyframes` tagged template.
//   `cssStringColorLiteral`  — a colour literal in a string or template that
//                          IS css: it carries `prop: value` declaration
//                          syntax. This is a surface `stapel/no-raw-colors`
//                          cannot see, and two of the fleet's live hits are
//                          there (`cardGallery.ts` and `detailGallery.ts`
//                          build their stylesheets by concatenation, not
//                          through a `css` tag).
//   `jsxColorPropLiteral`  — a colour literal handed to a colour-named JSX
//                          attribute (`color`, `bgColor`, `fill`, `stroke`,
//                          anything ending `Color`). The other surface
//                          `no-raw-colors` cannot see: `QrCanvas.tsx`'s
//                          `color="#000000" bgColor="#ffffff"` sat there
//                          through a rule already at `error`, because that
//                          rule reads style objects, classNames and css tags
//                          and nothing else.
//
// A NAMED colour (`white`, `black`, `gray`, …) is reported only when it is the
// WHOLE value of a colour-bearing property — `background: "white"`, `color:
// red;`, `fill="black"`. Never as a substring, never as a bare identifier:
// `red` is a variable name, a status, an i18n key and a CSS keyword, and a
// rule that could not tell them apart would be switched off within a week.
//
// Inside a style object the key does NOT gate hex and `rgb()`. That is the one
// place this rule is deliberately broader than `stapel/no-raw-colors`, which
// grades only colour-NAMED properties fleet-wide: `filter: "drop-shadow(0 0
// 2px #000)"`, `backgroundImage: "linear-gradient(#fff,#000)"` and `maskImage`
// all carry a colour under a key that is not a colour property. In a style
// object a hex is a colour whatever the key says. The key still gates NAMED
// colours, where it is the only thing separating `background: "white"` from
// `variant: "white"`.
//
// WHAT IT PROVABLY CANNOT CATCH:
//
//   * a colour that is not a literal — `token.colorBgContainer` read in the
//     wrong place (the defect above), a colour arriving as a prop, a colour
//     computed from a `hue` read out of a vocabulary (`search-react`'s
//     swatches are data and must stay silent);
//   * a colour literal in ANOTHER module, imported — resolution is one hop and
//     in-file only, because a cross-module resolver would need type
//     information and would still miss a re-export;
//   * a colour const declared BELOW its use — the one-hop table is filled as
//     the traversal walks, which is the order the fleet writes anyway
//     (constants at the top of the module);
//   * a colour in a `.css`/`.scss` file — that is the stylelint half of this
//     plugin (`@stapel/eslint-plugin/stylelint`), not ESLint's;
//   * a colour inside an `<svg>` served as an asset, or inside a base64 data
//     URI;
//   * a colour that is WRONG but tokenised — a token used for the wrong role
//     reads exactly like a token used for the right one.
//
// ── THE ESCAPE, AND WHY THERE IS ONE ────────────────────────────────────────
//
// Some colours are genuinely not theme decisions: a QR code's pure black on
// pure white is a camera-contrast requirement; a scrim over an arbitrary
// PHOTOGRAPH is neither light nor dark; the eighteen shades of
// `attributes-react`'s colour swatch ARE the engine's vocabulary
// (`types/hex_color/constants.py`), the data being drawn rather than chrome
// around it.
//
// Those get a marker on the enclosing statement:
//
//     // stapel-color-literal: a QR code's camera contrast is functional,
//     // not decorative, and must not follow dark mode.
//     const quietZone = { background: "#ffffff", … };
//
// A marker covers every colour inside the statement it is attached to — one
// tag for a twenty-line CSS template — and it must carry a reason of at least
// `MIN_REASON` characters; a bare `// stapel-color-literal:` silences nothing
// and is reported in its own right. A single line may instead use the
// plugin's ordinary `eslint-disable-next-line stapel/no-skin-color-literal --
// <reason>`, whose reason `stapel/require-disable-description` already
// enforces.
//
// The marker exists because the alternative is worse, and the fleet has
// already shown what the alternative looks like: `attributes-react` split a
// gradient into a `MULTICOLOR_STOPS` constant purely so a key named
// `multicolor` would stop reading as a colour property to
// `stapel/no-raw-colors`. A rule with no honest escape gets routed around, and
// the route is invisible.
import {
  COLOR_FUNC_RE,
  HEX_RE,
  isColorProperty,
  isNamedColorValue,
} from "../lib/colors.js";
import { isDefaultSkin, isTestPath, normalizedFilename } from "../lib/jsx.js";

/** Global twins of the shared single-match regexes, for scanning. */
const HEX_G = new RegExp(HEX_RE.source, "g");
const COLOR_FUNC_G = new RegExp(COLOR_FUNC_RE.source, "gi");

/**
 * Values allowed to be written down: each names a RELATIONSHIP to the
 * surrounding theme rather than a colour, so none of them can be right in one
 * mode and wrong in the other.
 */
const ALLOWED_VALUES = new Set([
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "none",
  "auto",
]);

/** Tagged templates whose contents are CSS. Mirrors `no-raw-colors`. */
const CSS_TAGS = new Set([
  "css",
  "styled",
  "createGlobalStyle",
  "keyframes",
  "injectGlobal",
]);

/** Type annotations that make an object literal a style object. */
const STYLE_TYPES = new Set([
  "CSSProperties",
  "CSSObject",
  "CSSPropertiesWithMultiValues",
  "StyleObject",
]);

/** Attribute / property names whose value is a style object. */
const STYLE_KEY_RE = /^(?:style|styles|[a-z][A-Za-z]*Style)$/;

/** Attribute names whose value is a colour. */
const COLOR_ATTR_RE = /^(?:color|colour|bgColor|bgcolor|fill|stroke)$|Color$/;

/**
 * antd's PRESET palette keys. `<Tag color="green">` is not a raw CSS green: it
 * names a preset antd generates from the active theme's seed, so it moves with
 * the mode exactly as a token does. Six of the fleet's first-sweep hits were
 * these, on `<Tag>`s whose meaning is a status — and a rule that tells a pair
 * to "tokenise" something already theme-derived is a rule they switch off.
 *
 * Exempt on JSX COLOUR PROPS ONLY. In a style object `background: "green"` is
 * raw CSS with no antd in the path, and stays reported. The keys antd does NOT
 * have — `white`, `black`, `gray`, `grey`, `silver`, `beige`, … — stay
 * reported everywhere, and those are the family the dark theme actually gets
 * wrong.
 */
const ANTD_PRESET_COLORS = new Set([
  "blue",
  "purple",
  "cyan",
  "green",
  "magenta",
  "pink",
  "red",
  "orange",
  "yellow",
  "volcano",
  "geekblue",
  "lime",
  "gold",
]);

/** The marker that records a deliberate, theme-independent colour. */
const MARKER_RE = /stapel-color-literal\s*:\s*([\s\S]*)$/;

/** A reason shorter than this is not a reason. */
const MIN_REASON = 8;

/** A string that IS css: it carries at least one `prop: value` declaration. */
const CSS_DECL_RE = /(?:^|[;{])\s*-{0,2}[a-zA-Z][\w-]*\s*:/;

const LLMS = "@stapel/tokens/llms.txt §colors";

/**
 * The EARLIEST hex / rgb() / hsl() token in a string with its offset, or null.
 * Earliest rather than "hex first": the report points at a line, and pointing
 * at the second colour in a declaration block while the first one sits above it
 * reads as a rule that cannot see the obvious.
 */
function firstColorTokenAt(text) {
  HEX_G.lastIndex = 0;
  const hex = HEX_G.exec(text);
  COLOR_FUNC_G.lastIndex = 0;
  const func = COLOR_FUNC_G.exec(text);
  if (func === null) return hex === null ? null : { value: hex[0], index: hex.index };
  if (hex !== null && hex.index < func.index) return { value: hex[0], index: hex.index };
  // Report the whole call, not the bare `rgba(` the regex matches — "rgba("
  // alone in a message says nothing about WHICH one.
  const from = text.slice(func.index);
  const close = from.indexOf(")");
  return {
    value: close === -1 ? from.slice(0, 40) : from.slice(0, close + 1),
    index: func.index,
  };
}

/** The first hex / rgb() / hsl() token in a string, or null. */
function firstColorToken(text) {
  return firstColorTokenAt(text)?.value ?? null;
}

/**
 * A NAMED colour standing as the whole value of a colour declaration in a CSS
 * source (`color: red;`), or null. Hex and `rgb()` are found separately and
 * per-piece, so that a hundred-line stylesheet reports on the offending line
 * rather than on its first one.
 */
function cssNamedColorIn(text) {
  for (const declaration of text.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim().replace(/^.*[{\s]/, "");
    const value = declaration
      .slice(colon + 1)
      .replace(/[}][\s\S]*$/, "")
      .trim();
    if (!isColorProperty(property)) continue;
    if (ALLOWED_VALUES.has(value.toLowerCase())) continue;
    if (isNamedColorValue(value)) return value;
  }
  return null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw colour literals in a default skin's sources; a skin's colours come from theme tokens.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /**
           * Path fragments that define the skin layer. Default: the shared
           * `src/default/` convention. A consumer whose skins live elsewhere
           * states it here rather than switching the rule off.
           */
          include: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      styleColorLiteral:
        'Raw colour "{{value}}" in a skin style object ({{property}}). A skin\'s colours come from the theme — read a token UNDER the skin\'s own <SkinTheme> (cssVar("surface"), token.colorBgContainer) so the dark theme gets a dark one. Deliberate and theme-independent? Mark the statement: `// stapel-color-literal: <why>`. Catalog: ' +
        LLMS,
      cssTemplateColorLiteral:
        'Raw colour "{{value}}" in a skin CSS template. Interpolate a token (var(--stapel-surface), cssVar("text")) instead. Deliberate and theme-independent? Mark the statement: `// stapel-color-literal: <why>`. Catalog: ' +
        LLMS,
      cssStringColorLiteral:
        'Raw colour "{{value}}" in a skin CSS string. A stylesheet built by concatenation is still a stylesheet — interpolate a token (var(--stapel-surface)). Deliberate and theme-independent? Mark the statement: `// stapel-color-literal: <why>`. Catalog: ' +
        LLMS,
      jsxColorPropLiteral:
        'Raw colour "{{value}}" passed to `{{property}}`. Hand it a token read under the skin\'s theme, not a literal one mode will get wrong. Deliberate and theme-independent? Mark the statement: `// stapel-color-literal: <why>`. Catalog: ' +
        LLMS,
      emptyMarker:
        "`stapel-color-literal:` with no reason silences nothing. Say why this colour cannot come from the theme (a QR code's camera contrast, a scrim over an arbitrary photograph, a swatch that IS the data) in at least " +
        String(MIN_REASON) +
        " characters.",
    },
  },
  create(context) {
    const filename = normalizedFilename(context);
    const options = context.options[0] ?? {};
    const include = options.include ?? null;
    const inScope =
      include === null
        ? isDefaultSkin(filename)
        : include.some((fragment) => filename.includes(fragment));
    if (!inScope || isTestPath(filename)) return {};

    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /** Same-file `const NAME = "…"` string bindings, for the one hop. */
    const stringConstants = new Map();
    /** Nodes already reported, so a constant used twice is reported once. */
    const reported = new Set();
    /** Markers already graded, so one bad marker is one report. */
    const gradedMarkers = new Set();

    // ── the marker ───────────────────────────────────────────────────────────

    /**
     * Is this node covered by a marker? Walks from the node up to (not
     * including) the Program, asking each ancestor for the comments before and
     * after it — so one marker above a statement covers every colour inside
     * it, and a trailing `// stapel-color-literal: …` on the same line works
     * too. Program is excluded deliberately: a marker at the top of a file
     * would silence the file, which is what a blanket disable already does and
     * what this mechanism exists to avoid.
     */
    function markerCovers(node) {
      for (let current = node; current && current.type !== "Program"; current = current.parent) {
        const comments = [
          ...sourceCode.getCommentsBefore(current),
          ...sourceCode.getCommentsAfter(current),
        ];
        for (const comment of comments) {
          const match = MARKER_RE.exec(comment.value);
          if (match === null) continue;
          const reason = (match[1] ?? "")
            .replace(/\*+\/?\s*$/, "")
            .replace(/^[\s*]+/, "")
            .trim();
          if (reason.length >= MIN_REASON) return true;
          if (!gradedMarkers.has(comment)) {
            gradedMarkers.add(comment);
            context.report({ loc: comment.loc, messageId: "emptyMarker" });
          }
          // A reasonless marker does NOT cover: the colour is reported too, so
          // the author sees both halves of what they have to do.
          return false;
        }
      }
      return false;
    }

    function report(node, messageId, value, property, loc) {
      if (reported.has(node)) return;
      reported.add(node);
      if (markerCovers(node)) return;
      context.report({
        ...(loc === undefined ? { node } : { loc }),
        messageId,
        data: {
          value: String(value).slice(0, 40),
          property: property ?? "a colour prop",
        },
      });
    }

    /** A source position for an offset inside a literal / quasi, or undefined. */
    function locAt(base, offset) {
      try {
        return sourceCode.getLocFromIndex(base + offset);
      } catch {
        return undefined;
      }
    }

    // ── resolution ───────────────────────────────────────────────────────────

    /** A variable by name, walking outward from a scope. */
    function findVariable(scope, name) {
      for (let current = scope; current; current = current.upper) {
        const hit = current.variables.find((variable) => variable.name === name);
        if (hit) return hit;
      }
      return null;
    }

    /**
     * The static text of a template literal, with each `${…}` hole replaced by
     * the string constant behind it when there is one and by a SPACE when
     * there is not. A space is the one separator that cannot invent a token:
     * gluing the sides together would let `color:${x}fff` read as a hex that
     * is in neither half.
     */
    function templateText(node) {
      let out = "";
      node.quasis.forEach((quasi, index) => {
        out += quasi.value.cooked ?? quasi.value.raw;
        const hole = node.expressions[index];
        if (hole === undefined) return;
        const bound =
          hole.type === "Identifier" ? stringConstants.get(hole.name) : undefined;
        out += bound === undefined ? " " : bound;
      });
      return out;
    }

    /** The `const`-resolved string behind an expression, or null. */
    function stringValueOf(expression) {
      if (!expression) return null;
      if (expression.type === "Literal" && typeof expression.value === "string") {
        return expression.value;
      }
      if (expression.type === "TemplateLiteral") return templateText(expression);
      if (expression.type === "Identifier") {
        return stringConstants.get(expression.name) ?? null;
      }
      return null;
    }

    /** `CSSProperties` / `React.CSSProperties` / `Readonly<CSSProperties>`. */
    function typeNameOf(annotation) {
      if (!annotation || annotation.type !== "TSTypeReference") return null;
      const name = annotation.typeName;
      const base =
        name.type === "Identifier"
          ? name.name
          : name.type === "TSQualifiedName"
            ? name.right.name
            : null;
      if (base !== null && STYLE_TYPES.has(base)) return base;
      const params =
        annotation.typeArguments?.params ?? annotation.typeParameters?.params ?? [];
      for (const argument of params) {
        const inner = typeNameOf(argument);
        if (inner !== null) return inner;
      }
      return base;
    }

    /** `const x: CSSProperties = {…}` / `= {…} satisfies CSSProperties`. */
    function isStyleAnnotated(declarator) {
      const annotation = declarator.id?.typeAnnotation?.typeAnnotation;
      const declared = typeNameOf(annotation);
      if (declared !== null && STYLE_TYPES.has(declared)) return true;
      const init = declarator.init;
      if (init?.type === "TSSatisfiesExpression" || init?.type === "TSAsExpression") {
        const asserted = typeNameOf(init.typeAnnotation);
        if (asserted !== null && STYLE_TYPES.has(asserted)) return true;
      }
      return false;
    }

    // ── style objects ────────────────────────────────────────────────────────

    function checkStyleProperty(property) {
      if (property.type !== "Property" || property.computed) return;
      const key =
        property.key.type === "Identifier"
          ? property.key.name
          : property.key.type === "Literal"
            ? String(property.key.value)
            : null;
      const value = property.value;
      const text = stringValueOf(value);
      if (text === null) return;
      if (ALLOWED_VALUES.has(text.trim().toLowerCase())) return;
      const token = firstColorToken(text);
      if (token !== null) {
        report(value, "styleColorLiteral", token, key ?? "a style property");
        return;
      }
      if (isColorProperty(key) && isNamedColorValue(text)) {
        report(value, "styleColorLiteral", text.trim(), key);
      }
    }

    function checkStyleObject(node, seen) {
      if (!node || node.type !== "ObjectExpression" || seen.has(node)) return;
      seen.add(node);
      for (const property of node.properties) {
        if (property.type === "SpreadElement") continue;
        checkStyleProperty(property);
        // `{ "&:hover": { color: "#fff" } }` — an emotion / antd nested block
        // is still a style object.
        if (property.type === "Property" && property.value.type === "ObjectExpression") {
          checkStyleObject(property.value, seen);
        }
      }
    }

    /** Grade whatever style object an expression resolves to, through one hop. */
    function checkStyleExpression(expression, seen = new Set()) {
      if (!expression) return;
      switch (expression.type) {
        case "ObjectExpression":
          checkStyleObject(expression, seen);
          return;
        case "TSAsExpression":
        case "TSSatisfiesExpression":
          checkStyleExpression(expression.expression, seen);
          return;
        case "ConditionalExpression":
          checkStyleExpression(expression.consequent, seen);
          checkStyleExpression(expression.alternate, seen);
          return;
        case "LogicalExpression":
          checkStyleExpression(expression.right, seen);
          return;
        case "ArrayExpression":
          // `style={[base, override]}` — react-native's shape, and emotion's.
          for (const element of expression.elements) {
            if (element && element.type !== "SpreadElement") {
              checkStyleExpression(element, seen);
            }
          }
          return;
        case "Identifier": {
          const scope = sourceCode.getScope
            ? sourceCode.getScope(expression)
            : context.getScope();
          const declarator = findVariable(scope, expression.name)?.defs?.[0]?.node;
          if (declarator?.type === "VariableDeclarator" && declarator.init) {
            checkStyleExpression(declarator.init, seen);
          }
          return;
        }
        default:
          // A string handed to `style` is not React's shape, but it is CSS,
          // and a skin that writes one still writes a colour.
          checkCssText(expression);
      }
    }

    /**
     * The literal pieces of a string / template, each with the source offset
     * its text starts at (past the opening quote or backtick). A hundred-line
     * stylesheet is graded piece by piece so the report lands on the line the
     * colour is written on, not on the line the template opens.
     */
    function cssPieces(node) {
      if (node.type === "Literal" && typeof node.value === "string") {
        return [{ text: node.value, base: node.range[0] + 1 }];
      }
      if (node.type === "TemplateLiteral") {
        return node.quasis.map((quasi) => ({
          text: quasi.value.cooked ?? quasi.value.raw,
          base: quasi.range[0] + 1,
        }));
      }
      return [];
    }

    /** Grade a string / template that may be a stylesheet. */
    function checkCssText(node) {
      const pieces = cssPieces(node);
      if (pieces.length === 0) return;
      const joined = node.type === "TemplateLiteral" ? templateText(node) : pieces[0].text;
      if (!CSS_DECL_RE.test(joined)) return;
      for (const piece of pieces) {
        const hit = firstColorTokenAt(piece.text);
        if (hit !== null) {
          report(
            node,
            "cssStringColorLiteral",
            hit.value,
            undefined,
            locAt(piece.base, hit.index),
          );
          return;
        }
      }
      const named = cssNamedColorIn(joined);
      if (named !== null) report(node, "cssStringColorLiteral", named);
    }

    function isCssTag(tag) {
      if (!tag) return false;
      if (tag.type === "Identifier") return CSS_TAGS.has(tag.name);
      if (tag.type === "MemberExpression" && tag.object?.name === "styled") return true;
      if (tag.type === "CallExpression" && tag.callee?.name === "styled") return true;
      return false;
    }

    /** The JSX attribute a node sits in, or null. */
    function owningAttributeName(node) {
      const container = node.parent;
      if (container?.type === "JSXAttribute") return container.name?.name ?? null;
      if (
        container?.type === "JSXExpressionContainer" &&
        container.parent?.type === "JSXAttribute"
      ) {
        return container.parent.name?.name ?? null;
      }
      return null;
    }

    // ── the visitors ─────────────────────────────────────────────────────────

    return {
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier" || !node.init) return;
        const init = node.init;
        if (init.type === "Literal" && typeof init.value === "string") {
          stringConstants.set(node.id.name, init.value);
        } else if (init.type === "TemplateLiteral") {
          stringConstants.set(node.id.name, templateText(init));
        }
        if (isStyleAnnotated(node)) checkStyleExpression(node.init);
      },

      JSXAttribute(node) {
        const name = node.name?.type === "JSXIdentifier" ? node.name.name : null;
        if (name === null || !node.value) return;
        const value = node.value;
        const expression =
          value.type === "JSXExpressionContainer" ? value.expression : value;
        if (!expression || expression.type === "JSXEmptyExpression") return;

        if (STYLE_KEY_RE.test(name)) {
          checkStyleExpression(expression);
          return;
        }
        if (!COLOR_ATTR_RE.test(name)) return;
        const text = stringValueOf(expression);
        if (text === null) return;
        if (ALLOWED_VALUES.has(text.trim().toLowerCase())) return;
        const token = firstColorToken(text);
        if (token !== null) {
          report(expression, "jsxColorPropLiteral", token, name);
          return;
        }
        const named = text.trim();
        if (isNamedColorValue(named) && !ANTD_PRESET_COLORS.has(named.toLowerCase())) {
          report(expression, "jsxColorPropLiteral", named, name);
        }
      },

      // A style object reached as a plain property: antd's `styles={{ body:
      // {…} }}`, a route descriptor, a `{ style: {…} }` options bag.
      Property(node) {
        if (node.computed) return;
        const key =
          node.key.type === "Identifier"
            ? node.key.name
            : node.key.type === "Literal"
              ? String(node.key.value)
              : null;
        if (key === null || !STYLE_KEY_RE.test(key)) return;
        checkStyleExpression(node.value);
      },

      TaggedTemplateExpression(node) {
        if (!isCssTag(node.tag)) return;
        for (const piece of cssPieces(node.quasi)) {
          const hit = firstColorTokenAt(piece.text);
          if (hit !== null) {
            report(
              node.quasi,
              "cssTemplateColorLiteral",
              hit.value,
              undefined,
              locAt(piece.base, hit.index),
            );
            return;
          }
        }
        const named = cssNamedColorIn(templateText(node.quasi));
        if (named !== null) report(node.quasi, "cssTemplateColorLiteral", named);
      },

      // A stylesheet built by concatenation rather than through a `css` tag.
      // Gated on DECLARATION SYNTAX, so an href, an id, a tracker number or a
      // regex source is never touched.
      Literal(node) {
        if (typeof node.value !== "string") return;
        const attribute = owningAttributeName(node);
        if (attribute !== null && COLOR_ATTR_RE.test(attribute)) return; // graded above
        checkCssText(node);
      },

      TemplateLiteral(node) {
        if (node.parent?.type === "TaggedTemplateExpression") return; // graded above
        const attribute = owningAttributeName(node);
        if (attribute !== null && COLOR_ATTR_RE.test(attribute)) return;
        checkCssText(node);
      },
    };
  },
};
