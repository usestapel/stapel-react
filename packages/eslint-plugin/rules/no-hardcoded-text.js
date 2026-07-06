// stapel/no-hardcoded-text — frontend-guardrails §2.2 (failure mode F7).
// User-facing text belongs to an i18n key, never a literal. Catches JSX text
// nodes and the user-facing string attributes (alt/title/placeholder/aria-*).
// Heuristic, with a conservative false-positive policy: only strings that read
// as prose (a run of letters plus a space, or a ≥4-char word) fire — icons,
// punctuation, numbers, single technical tokens, and camelCase identifiers are
// left alone.
import { stapelSettings } from "../lib/data.js";

const USER_FACING_ATTRS = new Set([
  "alt",
  "title",
  "placeholder",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-valuetext",
  "aria-roledescription",
]);

// Prose = has a letter, and either contains whitespace between word chars or
// is a single word of length ≥ 4. Rejects "OK"? -> "OK" is 2 letters, no space
// → not flagged (conservative). "Sign in" → flagged. "px" → not flagged.
function looksLikeProse(raw) {
  const s = raw.trim();
  if (s.length < 3) return false;
  if (!/[A-Za-zÀ-ɏ]/.test(s)) return false; // no letters → skip
  if (/^[\d\s.,:;!?%$#@/\\|()[\]{}<>=+*~`^&-]+$/.test(s)) return false; // symbols/nums
  // camelCase / snake / kebab single identifier with no space → likely technical
  if (!/\s/.test(s) && /^[a-z][A-Za-z0-9]*$/.test(s) && s.length < 4) return false;
  if (!/\s/.test(s)) {
    // single token: require it to be a real-ish word (≥ 4 letters, mostly alpha)
    const letters = (s.match(/[A-Za-zÀ-ɏ]/g) || []).length;
    return letters >= 4 && letters / s.length > 0.6;
  }
  return true;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hardcoded user-facing text in JSX; use an i18n key.",
    },
    schema: [
      {
        type: "object",
        properties: {
          ignore: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      hardcoded:
        'Hardcoded user-facing text "{{text}}". Add an i18n key and render it via t("<key>") instead of a literal. Convention: @stapel/core/llms.txt §i18n.',
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const ignore = new Set([
      ...(settings.textIgnore ?? []),
      ...(context.options[0]?.ignore ?? []),
    ]);

    function maybeReport(node, raw) {
      const text = String(raw);
      if (ignore.has(text.trim())) return;
      if (!looksLikeProse(text)) return;
      context.report({
        node,
        messageId: "hardcoded",
        data: { text: text.trim().slice(0, 40) },
      });
    }

    return {
      JSXText(node) {
        maybeReport(node, node.value);
      },
      JSXAttribute(node) {
        const name = node.name && node.name.name;
        if (typeof name !== "string" || !USER_FACING_ATTRS.has(name)) return;
        const val = node.value;
        if (val && val.type === "Literal" && typeof val.value === "string") {
          maybeReport(val, val.value);
        } else if (
          val &&
          val.type === "JSXExpressionContainer" &&
          val.expression.type === "Literal" &&
          typeof val.expression.value === "string"
        ) {
          maybeReport(val.expression, val.expression.value);
        }
      },
    };
  },
};
