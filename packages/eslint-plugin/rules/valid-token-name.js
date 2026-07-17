// stapel/valid-token-name — frontend-guardrails §68 (colour-token canon).
// A `cssVar("<name>")` call or a `var(--stapel-<name>)` CSS reference must
// name a ROLE that exists in the live token catalog
// (@stapel/tokens/manifest.json `tokens.core`/`tokens.component`). Both
// failure modes this catches resolve SILENTLY at runtime instead of failing
// loudly — an unset custom property just falls through to `initial`/inherit,
// so the wrong colour (or no colour) never shows up as an error:
//   - a RENAMED/REMOVED legacy role: the §68 neutral-dictionary migration
//     deleted `accent`, `background-*-subtle`, `upperground-*`, `icon-*`,
//     `text-invert`, `overlay`, and the whole L3 component tier
//     (`button-primary-bg`, `card-bg`, ...) with no compatibility alias.
//   - a plain typo in an otherwise-valid role name.
// Data-driven (§2.1): reads the SAME catalog no-raw-colors reads. No catalog
// → no-op, never guess (never crashes the lint run).
//
// Scoped to COLOUR roles only. `cssVar()`'s real type (`StapelVar`) also
// accepts a stable, unrelated set of scale suffixes this rule does not police
// — `font-family-*` / `font-size-*` / `font-weight-*` / `line-height-*` /
// `radius-*` / `space-*` / `breakpoint-*` / `elevation-*` — skipped by prefix
// so a legitimate `cssVar("radius-md")` never false-positives.
import { loadTokenCatalog, stapelSettings } from "../lib/data.js";

const LLMS = "@stapel/tokens/llms.txt §colors";

const DEFAULT_FUNCTIONS = ["cssVar"];

// Non-colour scale namespaces this rule never validates (see header).
const SCALE_PREFIXES = [
  "font-family-",
  "font-size-",
  "font-weight-",
  "line-height-",
  "radius-",
  "space-",
  "breakpoint-",
  "elevation-",
];

function isScaleName(name) {
  return SCALE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

// var(--stapel-<name>) or var(--stapel-<name>, <fallback>) — captures <name>.
const VAR_RE = /var\(\s*--stapel-([a-zA-Z0-9-]+)\s*(?:,[^)]*)?\)/g;

/** Plain Levenshtein edit distance — small inputs (token role names), O(mn) is fine. */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) dp.push([i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/** Nearest catalog name, or null when nothing is plausibly the same word. */
function closestName(name, names) {
  let best = null;
  let bestDist = Infinity;
  for (const candidate of names) {
    const d = levenshtein(name, candidate);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  const threshold = Math.max(3, Math.ceil(name.length / 2));
  return best !== null && bestDist <= threshold ? best : null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow cssVar()/var(--stapel-*) references to a colour-token role absent from the live @stapel/tokens catalog.",
    },
    schema: [
      {
        type: "object",
        properties: {
          functions: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unknownToken:
        'Unknown token role "{{name}}" ({{form}}). It is not in the live @stapel/tokens catalog{{suggestion}}. Legacy/renamed roles do not alias — reference a current role. Catalog: ' +
        LLMS,
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const catalog = loadTokenCatalog(settings);
    if (!catalog.loaded) return {}; // no manifest → no-op, never guess

    const functions = new Set(
      context.options[0]?.functions ?? settings.cssVarFunctions ?? DEFAULT_FUNCTIONS
    );
    const names = [...catalog.all];

    function reportIfUnknown(node, name, form) {
      if (isScaleName(name)) return;
      if (catalog.hasToken(name)) return;
      const suggestion = closestName(name, names);
      context.report({
        node,
        messageId: "unknownToken",
        data: {
          name,
          form,
          suggestion: suggestion ? ` — did you mean "${suggestion}"?` : "",
        },
      });
    }

    function scanForVarRefs(node, text) {
      VAR_RE.lastIndex = 0;
      let m;
      while ((m = VAR_RE.exec(text)) !== null) {
        reportIfUnknown(node, m[1], "var(--stapel-*)");
      }
    }

    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || !functions.has(node.callee.name))
          return;
        const arg = node.arguments[0];
        if (arg && arg.type === "Literal" && typeof arg.value === "string") {
          reportIfUnknown(arg, arg.value, "cssVar()");
        }
      },
      // Plain string literals: `"var(--stapel-accent)"` in a style object,
      // a plain assignment, a JSX attribute string, etc.
      Literal(node) {
        if (typeof node.value === "string") scanForVarRefs(node, node.value);
      },
      // Template literals (including CSS-in-JS tagged templates — ESLint
      // visits the TemplateLiteral itself regardless of the tag).
      TemplateLiteral(node) {
        for (const q of node.quasis) {
          scanForVarRefs(node, q.value.cooked ?? q.value.raw);
        }
      },
    };
  },
};
