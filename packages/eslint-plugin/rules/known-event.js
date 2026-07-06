// stapel/known-event — frontend-guardrails §3 (failure mode F10: "string events
// with invented names"). A track()/tracked()/trackedSubmit() call whose event
// is not in the generated events.json is flagged as DRIFT — a warning, because
// it is legitimately transient: right after you add a defineEvent (or a flow),
// the registry is stale until `pnpm gen:events` runs. The message says so. Once
// the drift gate is green, an unknown name is a typo or a deleted event.
//
// Data-driven (§2.1): the known set is the `events` section of the package
// manifests — the same projection the report (G5) reads. A missing catalog
// degrades the rule to a no-op (never guesses). Resolution is conservative:
// a string-literal event name, or an in-file identifier that resolves to a
// defineEvent({ name: "…" }) — anything else is skipped, so this rule never
// false-positives on an event it cannot statically read.
import { loadEventsCatalog, stapelSettings } from "../lib/data.js";

const DEFAULT_EMITTERS = ["track", "tracked", "trackedSubmit"];
const DEFAULT_DEFINERS = ["defineEvent"];

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

function calleeName(callee) {
  if (callee.type === "Identifier") return callee.name;
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier"
  )
    return callee.property.name;
  return null;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when a tracked event name is absent from the generated events.json (registry drift — run gen:events).",
    },
    schema: [
      {
        type: "object",
        properties: {
          emitters: { type: "array", items: { type: "string" } },
          definers: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unknownEvent:
        'Event "{{name}}" is not in the generated events.json. If you just declared it, run `pnpm gen:events` to refresh the registry; otherwise it is a typo or a removed event. §3 stapel/known-event',
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const catalog = loadEventsCatalog(settings);
    if (!catalog.loaded) return {}; // no catalog → no-op, never guess

    const emitters = new Set(
      context.options[0]?.emitters ?? settings.eventEmitters ?? DEFAULT_EMITTERS
    );
    const definers = new Set(
      context.options[0]?.definers ?? settings.eventDefiners ?? DEFAULT_DEFINERS
    );

    // identifier → event name, filled from `const X = defineEvent({name})`.
    const localEvents = new Map();
    // Deferred checks — declarations may follow first use in source order.
    const pending = [];

    function definerName(callee) {
      const n = calleeName(callee);
      return n && definers.has(n);
    }

    return {
      VariableDeclarator(node) {
        if (
          node.id.type === "Identifier" &&
          node.init &&
          node.init.type === "CallExpression" &&
          definerName(node.init.callee)
        ) {
          const arg = node.init.arguments[0];
          if (arg && arg.type === "ObjectExpression") {
            const nameProp = objProp(arg, "name");
            if (nameProp && isStringLiteral(nameProp.value)) {
              localEvents.set(node.id.name, nameProp.value.value);
            }
          }
        }
      },

      CallExpression(node) {
        const name = calleeName(node.callee);
        if (!name || !emitters.has(name)) return;
        const evArg = node.arguments[0];
        if (!evArg) return;
        if (isStringLiteral(evArg)) {
          pending.push({ node: evArg, name: evArg.value });
        } else if (evArg.type === "Identifier") {
          pending.push({ node: evArg, ident: evArg.name });
        }
        // member/other event expressions → not statically resolvable → skip.
      },

      "Program:exit"() {
        for (const p of pending) {
          const name = p.name ?? localEvents.get(p.ident);
          if (name == null) continue; // unresolved identifier → skip
          if (!catalog.isKnown(name)) {
            context.report({ node: p.node, messageId: "unknownEvent", data: { name } });
          }
        }
      },
    };
  },
};
