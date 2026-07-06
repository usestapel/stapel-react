// stapel/i18n-key-exists — frontend-guardrails §2.2.
// A `t("...")` key must exist in the generated i18n registry (pair manifests +
// app keys). Data-driven: the key set comes from the manifests the codegen
// writes. False-positive policy (§2.2): only string-literal keys are checked,
// and only within a MANAGED namespace (a top-level segment some manifest owns)
// — an unknown key under an unmanaged namespace is assumed app-local, not a
// typo, so bespoke host keys never false-positive.
import { loadI18nRegistry, stapelSettings } from "../lib/data.js";

const DEFAULT_CALLEES = ["t", "translate"];

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow translation keys that are absent from the generated i18n registry.",
    },
    schema: [
      {
        type: "object",
        properties: {
          functionNames: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unknownKey:
        'Unknown i18n key "{{key}}". It is not in the generated registry for the "{{ns}}" namespace. Add it to the owning package\'s keys (e.g. i18n/keys.ts) or fix the typo. Convention: @stapel/core/llms.txt §i18n.',
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const registry = loadI18nRegistry(settings);
    if (!registry.loaded) return {}; // no catalog → no-op, never guess

    const names = new Set(
      context.options[0]?.functionNames ??
        settings.i18nFunctions ??
        DEFAULT_CALLEES
    );

    function keyArg(node) {
      const first = node.arguments[0];
      if (first && first.type === "Literal" && typeof first.value === "string")
        return first;
      return null;
    }

    function isTranslator(callee) {
      if (callee.type === "Identifier") return names.has(callee.name);
      // obj.t("...") — e.g. i18n.t, useT()-returned `t` is usually a bare id,
      // but support member form for `.t`/`.translate`.
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.property.type === "Identifier"
      )
        return names.has(callee.property.name);
      return false;
    }

    return {
      CallExpression(node) {
        if (!isTranslator(node.callee)) return;
        const arg = keyArg(node);
        if (!arg) return; // dynamic key → skip (FP policy)
        const key = arg.value;
        if (!registry.manages(key)) return; // unmanaged namespace → app-local
        if (registry.has(key)) return;
        const ns = key.slice(0, key.indexOf("."));
        context.report({ node: arg, messageId: "unknownKey", data: { key, ns } });
      },
    };
  },
};
