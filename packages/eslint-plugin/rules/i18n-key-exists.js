// stapel/i18n-key-exists — frontend-guardrails §2.2.
// A `t("...")` key must exist in the generated i18n registry (pair manifests +
// app keys). Data-driven: the key set comes from the manifests the codegen
// writes. False-positive policy (§2.2): only within a MANAGED namespace (a
// top-level segment some manifest owns) — an unknown key under an unmanaged
// namespace is assumed app-local, not a typo, so bespoke host keys never
// false-positive.
//
// ── What a key ARGUMENT can be, and what this rule says about each ────────
//
// (ironmemo 2026-08-14: `app.settings.tab-security` shipped to a stand as the
// literal string "app.settings.tab-security". Every other i18n gate in that
// repo compares catalogues against each other; nothing checked that a key a
// call USES exists. This rule did — and was a no-op there, because no registry
// was configured. Both halves of that are addressed here: the argument forms
// below, and `requireRegistry` for the silence.)
//
//   t("a.b.c")               EXACT. The key must exist.
//   t(cond ? "a.b" : "a.c")  BOTH BRANCHES are literals → both are checked.
//                            (Also nested ternaries, all of whose leaves are
//                            literals.)
//   t(`a.b.${x}`)            PREFIX. One key cannot be named, but the static
//                            head can be demanded: at least one catalogued key
//                            must start with it. This is what still catches
//                            the realistic drift for a computed key — a family
//                            renamed or deleted out from under it — instead of
//                            waving the whole call through.
//   t(key) / t(m[x])         OPAQUE. Nothing static can be said; the value is
//                            known only at runtime.
//
// OPAQUE KEYS ARE A DECISION, NOT AN OVERSIGHT. By default they are ignored:
// reporting them would be a guess, and a rule that fires on the undecidable
// gets switched off wholesale, taking the decidable cases with it. A project
// that wants them surfaced sets `dynamicKeys: "report"` and gets a distinct
// message (`dynamicKey`) it can filter, downgrade or disable per line — never
// merged into the typo finding, because they are different claims. Either way
// the RUNTIME backstop is what covers this residue: a translator that records
// unresolved keys where an operator can read them.
import { loadI18nRegistry, stapelSettings } from "../lib/data.js";

const DEFAULT_CALLEES = ["t", "translate"];
/** Plural helpers select a CLDR form; the catalogued key is the family. */
const DEFAULT_PLURAL_CALLEES = ["tPlural"];
/**
 * The form every CLDR locale defines. A plural family is catalogued as
 * `<key>.<category>`, and which categories exist is a fact about the language
 * — so `other` is the only one a static check may demand.
 */
const PLURAL_FLOOR = "other";

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
          pluralFunctionNames: { type: "array", items: { type: "string" } },
          /** What to do with a key this rule cannot resolve statically. */
          dynamicKeys: { enum: ["ignore", "report"] },
          /**
           * Fail loudly instead of silently doing nothing when no registry is
           * configured. Off by default (a package with no manifests must stay
           * lintable); worth turning on in an app, where an empty catalogue
           * means the gate is not running at all.
           */
          requireRegistry: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unknownKey:
        'Unknown i18n key "{{key}}". It is not in the generated registry for the "{{ns}}" namespace. Add it to the owning package\'s keys (e.g. i18n/keys.ts) or fix the typo. Convention: @stapel/core/llms.txt §i18n.',
      unknownPluralKey:
        'Unknown i18n plural family "{{key}}". No "{{key}}.{{floor}}" in the registry for the "{{ns}}" namespace — a plural message is catalogued as one entry per CLDR category, and every locale defines "{{floor}}".',
      unknownPrefix:
        'No i18n key begins with "{{key}}". This call builds its key at runtime, so the family it draws from is all that can be checked — and nothing in the registry is under it, which is what a renamed or deleted family looks like.',
      dynamicKey:
        "i18n key is built at runtime and cannot be checked here. Nothing verifies this call against a catalogue; the runtime gap trace is the only thing that will report it.",
      noRegistry:
        "stapel/i18n-key-exists is configured but has no key registry, so it checks nothing. Point `settings.stapel.i18nKeys` (or `i18nManifests`) at the catalogue, or turn the rule off — a gate that cannot fail reads exactly like one that passes.",
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const registry = loadI18nRegistry(settings);
    const options = context.options[0] ?? {};

    if (!registry.loaded) {
      if (!options.requireRegistry) return {}; // no catalog → no-op, never guess
      // One finding per file, on the program node: the configuration is wrong,
      // not the code.
      return {
        Program(node) {
          context.report({ node, messageId: "noRegistry" });
        },
      };
    }

    const names = new Set(
      options.functionNames ?? settings.i18nFunctions ?? DEFAULT_CALLEES
    );
    const pluralNames = new Set(
      options.pluralFunctionNames ??
        settings.i18nPluralFunctions ??
        DEFAULT_PLURAL_CALLEES
    );
    const reportDynamic = options.dynamicKeys === "report";

    /** Namespace of a key, for the message. */
    function namespaceOf(key) {
      const dot = key.indexOf(".");
      return dot > 0 ? key.slice(0, dot) : key;
    }

    /**
     * Every literal key an expression can evaluate to, as `{ node, key }`
     * pairs (the node is what a finding is reported on), or null if any leaf
     * is not a literal. Handles nested ternaries — the shape a two-way label
     * (`dark ? "…dark" : "…light"`) actually takes.
     */
    function literalKeys(node) {
      if (!node) return null;
      if (node.type === "Literal" && typeof node.value === "string") {
        return [{ node, key: node.value }];
      }
      if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
        return [{ node, key: node.quasis[0].value.cooked }];
      }
      if (node.type === "ConditionalExpression") {
        const a = literalKeys(node.consequent);
        const b = literalKeys(node.alternate);
        return a && b ? [...a, ...b] : null;
      }
      return null;
    }

    /** The static head of a template key (`app.x.` in `` `app.x.${y}` ``). */
    function staticPrefix(node) {
      if (node && node.type === "TemplateLiteral" && node.expressions.length > 0) {
        const head = node.quasis[0]?.value?.cooked ?? "";
        return head.length > 0 ? head : null;
      }
      return null;
    }

    function isTranslator(callee, set) {
      if (callee.type === "Identifier") return set.has(callee.name);
      // obj.t("...") — e.g. i18n.t; a `useT()`-returned `t` is a bare id.
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.property.type === "Identifier"
      ) {
        return set.has(callee.property.name);
      }
      return false;
    }

    return {
      CallExpression(node) {
        const plural = isTranslator(node.callee, pluralNames);
        if (!plural && !isTranslator(node.callee, names)) return;

        const arg = node.arguments[0];
        const literals = literalKeys(arg);

        if (literals) {
          for (const { node: literal, key } of literals) {
            if (!registry.manages(key)) continue; // unmanaged → app-local
            const wanted = plural ? `${key}.${PLURAL_FLOOR}` : key;
            if (registry.has(wanted)) continue;
            context.report({
              node: literal,
              messageId: plural ? "unknownPluralKey" : "unknownKey",
              data: { key, ns: namespaceOf(key), floor: PLURAL_FLOOR },
            });
          }
          return;
        }

        const prefix = staticPrefix(arg);
        if (prefix !== null) {
          // Same false-positive policy as an exact key: only inside a
          // namespace some manifest owns.
          if (!registry.manages(prefix)) return;
          for (const key of registry.keys) {
            if (key.startsWith(prefix)) return;
          }
          context.report({
            node: arg,
            messageId: "unknownPrefix",
            data: { key: prefix },
          });
          return;
        }

        if (reportDynamic && arg) {
          context.report({ node: arg, messageId: "dynamicKey" });
        }
      },
    };
  },
};
