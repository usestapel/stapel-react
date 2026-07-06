// stapel/no-raw-token-import — frontend-guardrails §2.2.
// `@stapel/tokens/raw` is the ONLY legal door to the L1 ramps, and only the
// theme-config + the showcase may open it. Everywhere else raw ramps must not
// be reachable (components reference tokens, not hex). The recommended preset
// turns this rule OFF for theme-config/showcase/scripts via file overrides
// (§2.2: "overrides-исключения"); the rule itself always flags.
import { stapelSettings } from "../lib/data.js";

const RAW = "@stapel/tokens/raw";

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing @stapel/tokens/raw outside theme-config and the showcase.",
    },
    schema: [
      {
        type: "object",
        properties: { modules: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      rawImport:
        'Import from "{{source}}" is raw-ramp access (L1 hex). Only the theme config and the design-system showcase may import it — component code references tokens: cssVar("color-…") / var(--stapel-color-…). See @stapel/tokens/llms.txt §Never.',
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const extra = context.options[0]?.modules ?? [];
    const banned = new Set([RAW, ...(settings.rawModules ?? []), ...extra]);

    function check(node, source) {
      if (typeof source === "string" && banned.has(source)) {
        context.report({ node, messageId: "rawImport", data: { source } });
      }
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node, node.source.value);
      },
      ExportAllDeclaration(node) {
        if (node.source) check(node, node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === "Literal") check(node, node.source.value);
      },
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments[0]?.type === "Literal"
        ) {
          check(node, node.arguments[0].value);
        }
      },
    };
  },
};
