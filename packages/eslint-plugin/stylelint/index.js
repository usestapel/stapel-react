// @stapel/eslint-plugin/stylelint — the CSS half of the guardrails
// (frontend-guardrails §2.2 / §4 declaration-strict-value). A self-contained
// stylelint plugin (no third-party strict-value dependency) enforcing:
//   • colour properties may ONLY be `var(--stapel-*)` (or CSS-wide keywords) —
//     the strict-value discipline, scoped to colour;
//   • no hex / rgb() / hsl() literal anywhere in a declaration value.
// Both messages teach the one right way and point at the token catalog.
import stylelint from "stylelint";
import {
  HEX_RE,
  COLOR_FUNC_RE,
  isColorProperty,
} from "../lib/colors.js";

const { createPlugin, utils } = stylelint;

const RULE_NAME = "stapel/color-tokens-only";
const CATALOG = "@stapel/tokens/llms.txt §colors";

const messages = utils.ruleMessages(RULE_NAME, {
  rawColor: (value) =>
    `Raw colour "${value}" in CSS. Use a token: var(--stapel-color-<name>). Hex is born only in ramps. Catalog: ${CATALOG}`,
  notAToken: (prop, value) =>
    `Colour property "${prop}" must be a token, got "${value}". Use var(--stapel-color-<name>) (or var(--stapel-<component>)). Catalog: ${CATALOG}`,
});

// CSS-wide keywords + `transparent`/`currentColor` are allowed on colour props.
const ALLOWED_KEYWORDS = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "transparent",
  "currentcolor",
  "none",
]);

const HEX_G = new RegExp(HEX_RE.source, "gi");
const FUNC_G = new RegExp(COLOR_FUNC_RE.source, "gi");

function isStapelVarOnly(value) {
  // Accept a value composed solely of var(--stapel-*) references (+ keywords).
  const vars = value.match(/var\(\s*--[\w-]+/g) || [];
  if (vars.length === 0) return false;
  return vars.every((v) => /var\(\s*--stapel-/.test(v));
}

const ruleFunction = (primary) => (root, result) => {
  const validOptions = utils.validateOptions(result, RULE_NAME, {
    actual: primary,
    possible: [true, false],
  });
  if (!validOptions || !primary) return;

  root.walkDecls((decl) => {
    const value = decl.value;
    const prop = decl.prop;

    // 1) No raw hex / colour-function literal anywhere in a value.
    if (HEX_G.test(value) || FUNC_G.test(value)) {
      HEX_G.lastIndex = 0;
      FUNC_G.lastIndex = 0;
      utils.report({
        result,
        ruleName: RULE_NAME,
        node: decl,
        message: messages.rawColor(value),
      });
      return;
    }

    // 2) Colour properties must resolve to a stapel token var.
    if (isColorProperty(prop)) {
      const v = value.trim().toLowerCase();
      if (ALLOWED_KEYWORDS.has(v)) return;
      if (v.startsWith("var(") && isStapelVarOnly(value)) return;
      // A non-stapel var, a named colour, or any other literal on a colour prop.
      utils.report({
        result,
        ruleName: RULE_NAME,
        node: decl,
        message: messages.notAToken(prop, value),
      });
    }
  });
};

ruleFunction.ruleName = RULE_NAME;
ruleFunction.messages = messages;

export default createPlugin(RULE_NAME, ruleFunction);
export { RULE_NAME, messages };
