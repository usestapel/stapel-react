// stapel/require-disable-description — frontend-guardrails §2.4.
// An eslint-disable is a documented decision, not a hole: it must carry a
// `-- reason`. Self-contained equivalent of
// @eslint-community/eslint-comments/require-description, so the preset stays
// dependency-light and the escape-hatch policy is enforced for every rule
// (including future analytics rules). Disables stay greppable and can flow into
// the analytics/guardrail reports as "explicitly disabled".
const DIRECTIVES = [
  "eslint-disable",
  "eslint-disable-line",
  "eslint-disable-next-line",
  "eslint-enable",
];

// Matches `<directive> <rules...> -- description`
function parse(text) {
  const trimmed = text.trim();
  const directive = DIRECTIVES.find(
    (d) => trimmed === d || trimmed.startsWith(d + " ") || trimmed.startsWith(d + "\t")
  );
  if (!directive) return null;
  const rest = trimmed.slice(directive.length);
  const sep = rest.indexOf("--");
  const description = sep === -1 ? "" : rest.slice(sep + 2).trim();
  return { directive, description };
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require a `-- reason` description on every eslint-disable directive.",
    },
    schema: [],
    messages: {
      missing:
        "`{{directive}}` needs a reason: add `-- why` after the rule (§2.4 escape-hatch policy). Example: // eslint-disable-next-line stapel/no-raw-colors -- brand chrome, pending token.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          const parsed = parse(comment.value);
          if (!parsed) continue;
          if (parsed.directive === "eslint-enable") continue;
          if (parsed.description.length === 0) {
            context.report({
              loc: comment.loc,
              messageId: "missing",
              data: { directive: parsed.directive },
            });
          }
        }
      },
    };
  },
};
