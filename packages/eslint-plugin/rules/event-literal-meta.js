// stapel/event-literal-meta — frontend-guardrails §3.1. defineEvent() must be
// called with a LITERAL object so the static extractor (gen:events, ts-morph/
// AST) can project it into events.json — the single source the lint (G4) and
// the report (G5) read. A dynamic definition is not "wrong" at runtime; it is
// INVISIBLE to the registry and reports, so the whole typed-analytics layer
// silently loses that event. This rule keeps definitions statically
// extractable: the argument is an object literal, `name`/`description` are
// string literals, and every prop is built with a prop.* builder.
import { stapelSettings } from "../lib/data.js";

const DEFAULT_DEFINERS = ["defineEvent"];
const DEFAULT_PROP_BUILDER = "prop"; // prop.string/number/boolean/oneOf

const CATALOG =
  "gen:events extracts events.json from these literals — keep it static or the event never reaches the registry/reports.";

function isStringLiteral(node) {
  return node && node.type === "Literal" && typeof node.value === "string";
}

function objProp(objExpr, key) {
  for (const p of objExpr.properties) {
    if (
      p.type === "Property" &&
      !p.computed &&
      ((p.key.type === "Identifier" && p.key.name === key) ||
        (p.key.type === "Literal" && p.key.value === key))
    )
      return p;
  }
  return null;
}

/** True if `node` is a `prop.<builder>(...)` call. */
function isPropBuilderCall(node, builderName) {
  return (
    node &&
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === builderName &&
    node.callee.property.type === "Identifier"
  );
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require defineEvent() to be called with a literal object (literal name/description, prop.* builders) so the event registry stays statically extractable.",
    },
    schema: [
      {
        type: "object",
        properties: {
          definers: { type: "array", items: { type: "string" } },
          propBuilder: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      notObject:
        "defineEvent() needs a literal object argument, got a dynamic value. " +
        CATALOG +
        " §3.1 stapel/event-literal-meta",
      dynamicName:
        'defineEvent `name` must be a string literal (e.g. "pricing.plan.selected"), not a computed value. ' +
        CATALOG +
        " §3.1 stapel/event-literal-meta",
      missingDescription:
        "defineEvent `description` must be a string literal — it is the registry/report copy for this event. " +
        CATALOG +
        " §3.1 stapel/event-literal-meta",
      dynamicProps:
        "defineEvent `props` must be a literal object of prop.* builders. " +
        CATALOG +
        " §3.1 stapel/event-literal-meta",
      dynamicProp:
        'defineEvent prop "{{prop}}" must use a prop.* builder (e.g. prop.oneOf(["a","b"], "…")), not a dynamic value — otherwise the extractor cannot read its meta. ' +
        CATALOG +
        " §3.1 stapel/event-literal-meta",
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const definers = new Set(
      context.options[0]?.definers ?? settings.eventDefiners ?? DEFAULT_DEFINERS
    );
    const builder = context.options[0]?.propBuilder ?? DEFAULT_PROP_BUILDER;

    function isDefiner(callee) {
      if (callee.type === "Identifier") return definers.has(callee.name);
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.property.type === "Identifier"
      )
        return definers.has(callee.property.name);
      return false;
    }

    return {
      CallExpression(node) {
        if (!isDefiner(node.callee)) return;
        const arg = node.arguments[0];
        if (!arg || arg.type !== "ObjectExpression") {
          context.report({ node: arg ?? node, messageId: "notObject" });
          return;
        }

        const nameProp = objProp(arg, "name");
        if (nameProp && !isStringLiteral(nameProp.value)) {
          context.report({ node: nameProp.value, messageId: "dynamicName" });
        }

        const descProp = objProp(arg, "description");
        if (descProp && !isStringLiteral(descProp.value)) {
          context.report({ node: descProp.value, messageId: "missingDescription" });
        }

        const propsProp = objProp(arg, "props");
        if (propsProp) {
          const propsVal = propsProp.value;
          if (propsVal.type !== "ObjectExpression") {
            context.report({ node: propsVal, messageId: "dynamicProps" });
          } else {
            for (const p of propsVal.properties) {
              if (p.type !== "Property" || p.computed) {
                context.report({ node: p, messageId: "dynamicProps" });
                continue;
              }
              if (!isPropBuilderCall(p.value, builder)) {
                const key =
                  p.key.type === "Identifier"
                    ? p.key.name
                    : p.key.type === "Literal"
                      ? String(p.key.value)
                      : "?";
                context.report({
                  node: p.value,
                  messageId: "dynamicProp",
                  data: { prop: key },
                });
              }
            }
          }
        }
      },
    };
  },
};
