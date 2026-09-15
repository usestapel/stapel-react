// stapel/no-inert-typography-override — a CSS rule that cannot win is a rule
// that did not ship.
//
// ── THE DEFECT ──────────────────────────────────────────────────────────────
//
// A pair hoists a static stylesheet, puts its class on the element, and the
// declaration never applies. Not "applies wrongly" — never applies. The rule
// is in the sheet, the class is on the node, and the computed style is antd's.
// Four instances in one wave, two sub-shapes:
//
// LOSING ON ORDER. `@stapel/listings-react` 0.36.0's `cardTargetCss()` wrote
//
//     .stapel-listing-card-price{font-size:var(--stapel-font-size-md)}
//
// — a single class, (0,1,0). antd generates a per-theme class for Typography
// (`.css-wgezi7`) carrying its OWN font-size, and injects it into <head> at
// RUNTIME — after the package's static sheet — at the same (0,1,0). Equal
// specificity, so order decides, and the sheet that arrives second is antd's.
// Measured on a live stand: the class WAS on the element, the card's container
// WAS 1062px, the `@container` rule WAS in the sheet, and the computed size
// was still antd's 16px. Fixed in 0.36.1 by doubling the class —
// `.stapel-listing-card-price.stapel-listing-card-price`, (0,2,0).
//
// The same shape again in 0.30.5's title clamp: `[data-testid="listings-card-
// title"]` (0,1,0) in the pair's sheet against the HOST's `storefront.css`
// setting `display:block` on the same testids and loading second. 60 titles
// carried the class, `-webkit-line-clamp: 2` was in the computed style, and
// the clamp did nothing — `line-clamp` is inert without `display:-webkit-box`,
// and the host had replaced it.
//
// LOSING ON SPECIFICITY. The storefront's category H1:
// `[data-testid="categories-category-title"]` is (0,1,0) and antd's own
// `h1:where(.css-x).ant-typography` is (0,1,1), so antd wins outright, on
// every load order, forever. Fixed by doubling the attribute selector.
//
// `@container` and `@media` wrappers add NO specificity of their own. That is
// a large part of why this is easy to get wrong: the rule LOOKS more specific
// than it is, and the author reads the sheet rather than the cascade.
//
// ── WHY THIS IS A LINT RULE AND NOT A PER-PACKAGE TEST ──────────────────────
//
// It was a per-package test, twice, and that is the fourth lesson. The test
// asserted the literal template that BUILDS a doubled selector. A later
// refactor parameterised the builder — `clampRule(lines)` with
// `const self = \`.${clampClass(lines)}.${clampClass(lines)}\`` — changed no
// emitted byte, and the assertion broke anyway. Worse, the guard only ever
// covered the one selector it named: the next person writes a NEW rule in the
// same sheet, and the test that "guards the sheet" says nothing about it.
//
// So this rule asserts the SELECTOR SHAPE THAT SHIPS and never how it is
// constructed. `.${clampClass(lines)}.${clampClass(lines)}` is read as two
// class compounds — (0,2,0) — without knowing, or caring, what `clampClass`
// returns. Rewrite the builder any way you like; the rule grades the selector
// the builder emits.
//
// ── THE LADDER ──────────────────────────────────────────────────────────────
//
//   (0,0,1)  h1                     loses to everything antd emits
//   (0,1,0)  .price / [data-x]      TIES antd's generated class → order wins,
//                                   and antd's is injected later
//   (0,1,1)  .card h1               TIES antd's Title rule → same coin flip
//   (0,2,0)  .price.price           WINS both, whatever the load order  ← bar
//
// The bar is therefore "at least two class-level components" (classes,
// attribute selectors, pseudo-classes), or an id. Doubling the last compound
// is the cheapest way there and is what both fixes did; a parent-scoped
// selector (`.stapel-listing-card-main .price`) gets there too.
//
// `!important` on the declaration also wins, and a declaration carrying it is
// NOT reported — it is a different answer to the same question, not a defect.
//
// ── THE DETECTION BOUNDARY ──────────────────────────────────────────────────
//
// This rule reads stylesheets that are assembled in TypeScript — template
// literals and `+` concatenations returned from functions like
// `cardTargetCss()` — because that is where this fleet's sheets actually live
// (`find packages -name '*.css'` finds three generated token emissions and a
// ladle theme; every pair's sheet is a string). A stylelint rule, the obvious
// home for a specificity check, would have no file to open.
//
// It grades only TYPOGRAPHY-BEARING declarations (the font ladder, and the
// clamp), because those are the ones antd's Typography also writes. A
// `.frame{display:flex}` at (0,1,0) competes with nobody and is silent; see
// `docs/rules/no-inert-typography-override.md` for the full table of what this
// cannot see — starting with "which element the class lands on", which is why
// the property list is the discriminator and not the tag name.
import { isTestPath, normalizedFilename } from "../lib/jsx.js";

/**
 * One interpolation whose value could not be resolved, as a character that can
 * appear inside a CSS name. `U+0001` cannot occur in source text, so a name
 * containing it is unambiguously "a name with a hole in it" — which is all the
 * specificity calculator needs: `.${X}` is one class whatever `X` says.
 */
const HOLE = "\u0001";

/** Is this text a stylesheet at all? Same gate as `no-skin-color-literal`. */
const CSS_DECL_RE = /(?:^|[;{])\s*-{0,2}[a-zA-Z][\w-]*\s*:/;

/** A CSS property name, once holes and whitespace are out of the way. */
const PROPERTY_RE = /^-{0,2}[a-z][\w-]*$/;

/** At-rules whose body contains RULES rather than declarations. */
const NESTING_AT_RULES = new Set([
  "media",
  "container",
  "supports",
  "layer",
  "scope",
  "starting-style",
  "document",
]);

/**
 * The typography ladder — the declarations antd's Typography writes for
 * itself, and therefore the ones a pair's own sheet has to out-rank.
 *
 * `color` and `text-decoration` are deliberately ABSENT. antd does set both,
 * but the fleet's overwhelmingly common (0,1,0) use of them is a link wrapper
 * saying `color:inherit;text-decoration:none` — correct code competing with
 * nothing but a browser's UA sheet, which is (0,0,1). Listing them would have
 * reported `cardTargetCss()`'s own target rule on the very commit that fixed
 * the defect, and a rule whose flagship file is a false positive gets turned
 * off. A pair that DOES fight antd for a colour adds them with `properties`.
 *
 * `display` is likewise absent on its own and present through the clamp: the
 * 0.30.5 defect was `display:-webkit-box` being replaced, but no sheet writes
 * that without `-webkit-line-clamp` beside it, and `display` alone would drag
 * in every layout rule in the fleet.
 */
const TYPOGRAPHY_PROPS = new Set([
  "font",
  "font-family",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "font-feature-settings",
  "font-variation-settings",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-transform",
  "-webkit-line-clamp",
  "line-clamp",
  "-webkit-box-orient",
  "text-overflow",
]);

const LLMS = "docs/rules/no-inert-typography-override.md";

// ── a very small CSS reader ─────────────────────────────────────────────────
//
// Not postcss: this package ships one dependency and the shapes it has to read
// are a hoisted sheet's worth of rules, at-rules and declarations. Anything it
// cannot read — unbalanced braces from a sheet split across array elements,
// native nesting, a hole where a whole selector should be — is SKIPPED rather
// than guessed at.

/** Index just past a quoted string starting at `i`. */
function skipString(text, i) {
  const quote = text[i];
  let j = i + 1;
  while (j < text.length) {
    if (text[j] === "\\") {
      j += 2;
      continue;
    }
    if (text[j] === quote) return j + 1;
    j += 1;
  }
  return text.length;
}

/** Index just past a balanced `(…)` starting at `i`. */
function skipParens(text, i) {
  let depth = 0;
  let j = i;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '"' || ch === "'") {
      j = skipString(text, j);
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return j + 1;
    }
    j += 1;
  }
  return text.length;
}

/** Index just past a balanced `[…]` starting at `i`. */
function skipBracket(text, i) {
  let j = i + 1;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '"' || ch === "'") {
      j = skipString(text, j);
      continue;
    }
    if (ch === "]") return j + 1;
    j += 1;
  }
  return text.length;
}

/** Index just past a comment starting at `i`, or `i` if there is none. */
function skipComment(text, i) {
  if (text[i] !== "/" || text[i + 1] !== "*") return i;
  const end = text.indexOf("*/", i + 2);
  return end === -1 ? text.length : end + 2;
}

/** Name characters, holes included — `.${CLASS}` is one class. */
function isNameChar(ch) {
  return /[\w\-\\|]/.test(ch) || ch === HOLE || ch.charCodeAt(0) > 0x7f;
}

/** Index just past a run of name characters starting at `i`. */
function skipName(text, i) {
  let j = i;
  while (j < text.length && isNameChar(text[j])) j += 1;
  return j;
}

/** Index of the matching `}` for the `{` at `i`, or -1. */
function matchBrace(text, i) {
  let depth = 0;
  let j = i;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '"' || ch === "'") {
      j = skipString(text, j);
      continue;
    }
    if (ch === "/" && text[j + 1] === "*") {
      j = skipComment(text, j);
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return j;
    }
    j += 1;
  }
  return -1;
}

/** Split on a top-level separator, ignoring strings, parens and brackets. */
function splitTopLevel(text, separator) {
  const parts = [];
  let start = 0;
  let j = 0;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '"' || ch === "'") {
      j = skipString(text, j);
      continue;
    }
    if (ch === "(") {
      j = skipParens(text, j);
      continue;
    }
    if (ch === "[") {
      j = skipBracket(text, j);
      continue;
    }
    if (ch === "/" && text[j + 1] === "*") {
      j = skipComment(text, j);
      continue;
    }
    if (ch === separator) {
      parts.push({ text: text.slice(start, j), start });
      start = j + 1;
    }
    j += 1;
  }
  parts.push({ text: text.slice(start), start });
  return parts;
}

/**
 * Every style RULE in a stylesheet, at-rule bodies flattened into the same
 * list — because a `@container`/`@media` wrapper adds no specificity and the
 * rule inside it is graded exactly as if it were at the top level.
 *
 * Returns null when the text is not readable as CSS (unbalanced braces, native
 * nesting), so the caller stays silent rather than guessing.
 */
function readRules(text, offset = 0, out = []) {
  let i = 0;
  let preludeStart = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      i = skipString(text, i);
      continue;
    }
    if (ch === "(") {
      i = skipParens(text, i);
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      i = skipComment(text, i);
      continue;
    }
    if (ch === ";") {
      preludeStart = i + 1;
      i += 1;
      continue;
    }
    if (ch === "}") return null; // a closing brace with nothing open
    if (ch === "{") {
      const end = matchBrace(text, i);
      if (end === -1) return null;
      const prelude = text.slice(preludeStart, i);
      const body = text.slice(i + 1, end);
      const trimmed = prelude.trim();
      if (trimmed.startsWith("@")) {
        const name = /^@([\w-]+)/.exec(trimmed)?.[1]?.toLowerCase() ?? "";
        if (NESTING_AT_RULES.has(name)) {
          if (readRules(body, offset + i + 1, out) === null) return null;
        }
        // @keyframes / @font-face / @property own their bodies; nothing in
        // them competes with antd on specificity.
      } else if (trimmed.length > 0) {
        out.push({ prelude, preludeStart: offset + preludeStart, body });
      }
      i = end + 1;
      preludeStart = i;
      continue;
    }
    i += 1;
  }
  return out;
}

/** The declarations of a rule body, or null when the body is not readable. */
function readDeclarations(body) {
  const declarations = [];
  for (const part of splitTopLevel(body, ";")) {
    if (part.text.includes("{")) return null; // native nesting — not read
    const colonIndex = splitTopLevel(part.text, ":");
    if (colonIndex.length < 2) continue;
    const property = colonIndex[0].text.trim().toLowerCase();
    if (!PROPERTY_RE.test(property)) continue;
    const value = part.text.slice(colonIndex[0].text.length + 1);
    declarations.push({ property, important: /!\s*important\b/i.test(value) });
  }
  return declarations;
}

// ── specificity ─────────────────────────────────────────────────────────────

function zero() {
  return { a: 0, b: 0, c: 0, unknown: false };
}

function add(left, right) {
  return {
    a: left.a + right.a,
    b: left.b + right.b,
    c: left.c + right.c,
    unknown: left.unknown || right.unknown,
  };
}

function compare(left, right) {
  if (left.a !== right.a) return left.a - right.a;
  if (left.b !== right.b) return left.b - right.b;
  return left.c - right.c;
}

/**
 * The specificity of one selector — a compound, or a sequence of compounds
 * joined by combinators. `:where()` contributes nothing (that is its job),
 * `:is()`/`:not()`/`:has()` contribute their most specific argument, and a
 * pseudo-ELEMENT is an element rather than a class.
 *
 * `unknown` means a component's kind could not be read: a bare `${sel}` hole
 * standing where a compound should be could be anything from `.x` to
 * `#a .b .c`. The caller never reports an unknown selector — an over-strict
 * guess here is a false positive on every sheet that keeps its selectors in
 * constants.
 */
function specificityOf(selector) {
  let total = zero();
  let i = 0;
  while (i < selector.length) {
    const ch = selector[i];
    if (/\s/.test(ch) || ch === ">" || ch === "+" || ch === "~" || ch === ",") {
      i += 1;
      continue;
    }
    if (ch === "/" && selector[i + 1] === "*") {
      i = skipComment(selector, i);
      continue;
    }
    if (ch === "#") {
      i = skipName(selector, i + 1);
      total.a += 1;
      continue;
    }
    if (ch === ".") {
      i = skipName(selector, i + 1);
      total.b += 1;
      continue;
    }
    if (ch === "[") {
      i = skipBracket(selector, i);
      total.b += 1;
      continue;
    }
    if (ch === ":") {
      let j = i + 1;
      const isElement = selector[j] === ":";
      if (isElement) j += 1;
      const nameEnd = skipName(selector, j);
      const name = selector.slice(j, nameEnd).toLowerCase();
      let next = nameEnd;
      let args = null;
      if (selector[next] === "(") {
        const end = skipParens(selector, next);
        args = selector.slice(next + 1, end - 1);
        next = end;
      }
      if (isElement) total.c += 1;
      else if (name === "where") {
        // zero by definition
      } else if (args !== null && (name === "is" || name === "not" || name === "has" || name === "matches")) {
        let best = zero();
        for (const argument of splitTopLevel(args, ",")) {
          const inner = specificityOf(argument.text);
          if (inner.unknown) best.unknown = true;
          if (compare(inner, best) > 0) best = { ...inner, unknown: best.unknown || inner.unknown };
        }
        total = add(total, best);
      } else if (name.includes(HOLE)) {
        total.unknown = true;
      } else {
        total.b += 1;
      }
      i = next;
      continue;
    }
    if (ch === "*") {
      i += 1;
      continue;
    }
    if (ch === "&") {
      total.unknown = true; // native nesting: the parent is not visible here
      i += 1;
      continue;
    }
    const end = skipName(selector, i);
    if (end === i) {
      total.unknown = true; // a character this reader does not know
      i += 1;
      continue;
    }
    const word = selector.slice(i, end);
    if (word.includes(HOLE)) total.unknown = true;
    else total.c += 1;
    i = end;
  }
  return total;
}

/** `(0,1,0)`, for a message a reader can check by eye. */
function formatSpecificity(score) {
  return `(${String(score.a)},${String(score.b)},${String(score.c)})`;
}

/** A selector with its holes shown as `${…}`, trimmed for a message. */
function displaySelector(selector) {
  const shown = selector.replace(/\s+/g, " ").trim().replaceAll(HOLE, "${…}");
  return shown.length > 60 ? `${shown.slice(0, 57)}…` : shown;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a typography declaration in a package's own stylesheet at a specificity antd's runtime-injected classes beat; the rule ships present but inert.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Property names to ADD to the typography ladder. */
          properties: { type: "array", items: { type: "string" } },
          /** Property names to REPLACE it with outright. */
          propertiesOverride: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      inertTypographyOverride:
        "`{{selector}}` sets `{{property}}` at {{score}} — it will not apply. antd generates a per-theme class for Typography (`.css-wgezi7`) carrying its own font ladder and injects it into <head> at RUNTIME, AFTER this static sheet: at equal specificity the later sheet wins, so antd does. On a heading it is worse — antd's `h1:where(.css-x).ant-typography` is (0,1,1) and wins outright, whatever the order. A `@container`/`@media` wrapper adds NO specificity. Double the last compound (`.price.price`, `[data-testid=\"x\"][data-testid=\"x\"]`) for (0,2,0), or scope it under a parent class. `!important` is not reported. Details: " +
        LLMS,
      inertTypographyElementSelector:
        "`{{selector}}` sets `{{property}}` at {{score}} — a type selector has no class component at all, so antd's generated `.css-wgezi7` (0,1,0) outranks it outright and this declaration never applies. Give the element a class and write the rule against it, doubled (`.title.title`) if antd styles the same element. Details: " +
        LLMS,
    },
  },

  create(context) {
    const filename = normalizedFilename(context);
    // Tests and fixtures legitimately BUILD the losing selector — this rule's
    // own suite is a sheet of them — and the preset carves them out too; the
    // rule carries the scope itself so a consumer who never spreads the preset
    // still gets the right answer.
    if (isTestPath(filename)) return {};

    const options = context.options[0] ?? {};
    const graded =
      options.propertiesOverride !== undefined
        ? new Set(options.propertiesOverride.map((name) => name.toLowerCase()))
        : new Set([
            ...TYPOGRAPHY_PROPS,
            ...(options.properties ?? []).map((name) => name.toLowerCase()),
          ]);

    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /** Same-file `const NAME = <string>` initialisers, resolved on demand. */
    const constInits = new Map();
    /** name → resolved text (holes included), memoised. */
    const constText = new Map();
    /** Roots to grade, collected first so every constant is known. */
    const roots = [];
    /**
     * `selector|property` pairs already reported in this file. A sheet whose
     * selector lives in a `const` is assembled twice — once where the constant
     * is written, once where it is interpolated — and one inert rule is one
     * finding, not two.
     */
    const reported = new Set();

    /**
     * The text behind an expression, with `${…}` holes it cannot resolve
     * written as HOLE. Returns null for an expression that is not string-like
     * at all.
     */
    function resolveText(node, seen) {
      if (!node) return null;
      switch (node.type) {
        case "Literal":
          return typeof node.value === "string" ? node.value : null;
        case "TemplateLiteral": {
          let out = "";
          node.quasis.forEach((quasi, index) => {
            out += quasi.value.cooked ?? quasi.value.raw;
            const hole = node.expressions[index];
            if (hole === undefined) return;
            out += resolveText(hole, seen) ?? HOLE;
          });
          return out;
        }
        case "BinaryExpression": {
          if (node.operator !== "+") return null;
          const left = resolveText(node.left, seen);
          const right = resolveText(node.right, seen);
          if (left === null || right === null) return null;
          return left + right;
        }
        case "TSAsExpression":
        case "TSSatisfiesExpression":
        case "TSNonNullExpression":
          return resolveText(node.expression, seen);
        case "Identifier": {
          if (seen.has(node.name)) return null;
          const init = constInits.get(node.name);
          if (init === undefined) return null;
          if (constText.has(node.name)) return constText.get(node.name);
          seen.add(node.name);
          const text = resolveText(init, seen);
          seen.delete(node.name);
          constText.set(node.name, text);
          return text;
        }
        default:
          return null;
      }
    }

    /**
     * The assembled CSS text of a string-ish expression, plus a map from an
     * index in that text back to a source position — so the report lands on
     * the selector that loses rather than on the line the template opens.
     */
    function assemble(node) {
      const segments = [];
      let text = "";

      function pushText(value, sourceStart) {
        segments.push({ from: text.length, to: text.length + value.length, sourceStart });
        text += value;
      }

      function pushHole(value, holeNode) {
        segments.push({ from: text.length, to: text.length + value.length, node: holeNode });
        text += value;
      }

      function walk(current) {
        switch (current.type) {
          case "Literal":
            if (typeof current.value === "string") {
              pushText(current.value, current.range[0] + 1);
            }
            return;
          case "TemplateLiteral":
            current.quasis.forEach((quasi, index) => {
              pushText(quasi.value.cooked ?? quasi.value.raw, quasi.range[0] + 1);
              const hole = current.expressions[index];
              if (hole === undefined) return;
              pushHole(resolveText(hole, new Set()) ?? HOLE, hole);
            });
            return;
          case "BinaryExpression":
            walk(current.left);
            walk(current.right);
            return;
          case "TSAsExpression":
          case "TSSatisfiesExpression":
          case "TSNonNullExpression":
            walk(current.expression);
            return;
          default:
            pushHole(HOLE, current);
        }
      }

      walk(node);
      return { text, segments };
    }

    /** A source location for an index into the assembled text. */
    function locFor(assembled, index, fallback) {
      const segment = assembled.segments.find(
        (candidate) => index >= candidate.from && index < candidate.to,
      );
      if (segment === undefined) return fallback.loc;
      if (segment.node !== undefined) return segment.node.loc;
      try {
        const start = sourceCode.getLocFromIndex(segment.sourceStart + (index - segment.from));
        return { start, end: start };
      } catch {
        return fallback.loc;
      }
    }

    function grade(node) {
      const assembled = assemble(node);
      const text = assembled.text;
      if (!text.includes("{") || !CSS_DECL_RE.test(text)) return;
      const rules = readRules(text);
      if (rules === null) return;

      for (const rule of rules) {
        const declarations = readDeclarations(rule.body);
        if (declarations === null) continue;
        const hit = declarations.find(
          (declaration) => graded.has(declaration.property) && !declaration.important,
        );
        if (hit === undefined) continue;

        for (const part of splitTopLevel(rule.prelude, ",")) {
          const selector = part.text;
          if (selector.trim().length === 0) continue;
          const score = specificityOf(selector);
          if (score.unknown) continue; // not readable — see specificityOf
          if (score.a > 0 || score.b >= 2) continue; // outranks antd on its own
          const shown = displaySelector(selector);
          const key = `${shown}|${hit.property}`;
          if (reported.has(key)) continue;
          reported.add(key);
          const leading = selector.length - selector.trimStart().length;
          context.report({
            loc: locFor(assembled, rule.preludeStart + part.start + leading, node),
            messageId:
              score.b === 0 ? "inertTypographyElementSelector" : "inertTypographyOverride",
            data: {
              selector: shown,
              property: hit.property,
              score: formatSpecificity(score),
            },
          });
        }
      }
    }

    /** A string expression nobody else is going to grade as part of a larger one. */
    function isRoot(node) {
      const parent = node.parent;
      if (parent?.type === "BinaryExpression" && parent.operator === "+") return false;
      // A `${…}` hole: the enclosing template inlines this text already.
      if (parent?.type === "TemplateLiteral") return false;
      if (
        parent?.type === "TSAsExpression" ||
        parent?.type === "TSSatisfiesExpression" ||
        parent?.type === "TSNonNullExpression"
      ) {
        return false;
      }
      return true;
    }

    return {
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier" || !node.init) return;
        constInits.set(node.id.name, node.init);
      },

      Literal(node) {
        // A plain string is a whole sheet or nothing — there is no hole to
        // resolve — so the cheap gate can run here rather than after assembly.
        if (typeof node.value !== "string" || !node.value.includes("{")) return;
        if (!isRoot(node)) return;
        roots.push(node);
      },

      TemplateLiteral(node) {
        if (!isRoot(node)) return;
        roots.push(node);
      },

      BinaryExpression(node) {
        if (node.operator !== "+" || !isRoot(node)) return;
        roots.push(node);
      },

      "Program:exit"() {
        for (const root of roots) grade(root);
      },
    };
  },
};
