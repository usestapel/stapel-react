// stapel/demo-literal-meta — frontend-guardrails §4.2. defineDemo() must be
// called with a LITERAL object so the static extractor (gen:demos, AST) can
// project it into demos.json / manifest.demos / CSF stories and evaluate the
// completeness gate. A dynamic definition is not "wrong" at runtime; it is
// INVISIBLE to those projections, so the demo silently vanishes from the
// catalog, the viewer, and the gate. This rule keeps the meta extractable: the
// argument is an object literal; `id`/`title`/`description` are string
// literals; `component` is a plain reference (identifier or member); and
// `variants` is an object literal with static keys. `render` closures and other
// values are intentionally free — only the statically-read meta is constrained.
const CATALOG =
  "gen:demos extracts demos.json/manifest.demos/CSF from these literals — keep the meta static or the demo never reaches the catalog, the viewer, or the completeness gate.";

const DEFINERS = new Set(["defineDemo"]);

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

function isReference(node) {
  return (
    node &&
    (node.type === "Identifier" ||
      (node.type === "MemberExpression" && !node.computed))
  );
}

function isDefiner(callee) {
  if (callee.type === "Identifier") return DEFINERS.has(callee.name);
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier"
  )
    return DEFINERS.has(callee.property.name);
  return false;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require defineDemo() to be called with a literal object (literal id/title/description, a component reference, an object-literal variants map) so the demo registry stays statically extractable.",
    },
    schema: [],
    messages: {
      notObject:
        "defineDemo() needs a literal object argument, got a dynamic value. " +
        CATALOG +
        " §4.2 stapel/demo-literal-meta",
      dynamicString:
        'defineDemo `{{key}}` must be a string literal — it is the catalog/viewer copy. ' +
        CATALOG +
        " §4.2 stapel/demo-literal-meta",
      dynamicComponent:
        "defineDemo `component` must be a component reference (e.g. `PasswordlessLogin`) so the completeness gate can read its name. " +
        CATALOG +
        " §4.2 stapel/demo-literal-meta",
      dynamicVariants:
        "defineDemo `variants` must be an object literal with static keys — each key becomes a viewer story and a smoke test. " +
        CATALOG +
        " §4.2 stapel/demo-literal-meta",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isDefiner(node.callee)) return;
        const arg = node.arguments[0];
        if (!arg || arg.type !== "ObjectExpression") {
          context.report({ node: arg ?? node, messageId: "notObject" });
          return;
        }

        for (const key of ["id", "title", "description"]) {
          const p = objProp(arg, key);
          if (p && !isStringLiteral(p.value)) {
            context.report({
              node: p.value,
              messageId: "dynamicString",
              data: { key },
            });
          }
        }

        const componentProp = objProp(arg, "component");
        if (componentProp && !isReference(componentProp.value)) {
          context.report({
            node: componentProp.value,
            messageId: "dynamicComponent",
          });
        }

        const variantsProp = objProp(arg, "variants");
        if (variantsProp) {
          const v = variantsProp.value;
          if (v.type !== "ObjectExpression") {
            context.report({ node: v, messageId: "dynamicVariants" });
          } else {
            for (const p of v.properties) {
              if (p.type !== "Property" || p.computed) {
                context.report({ node: p, messageId: "dynamicVariants" });
              }
            }
          }
        }
      },
    };
  },
};
