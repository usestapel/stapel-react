// stapel/no-direct-analytics-provider — frontend-guardrails §2.2 / §3.
// Analytics goes through the Stapel facade (the @stapel/core type seam,
// implemented by @stapel/analytics): consent gate, PII guard,
// offline queue, fan-out), NEVER straight into a vendor SDK. Importing a
// provider package anywhere but the facade's provider-adapter module bypasses
// consent and PII enforcement in one line — the cheapest F9 violation there
// is. The recommended preset turns this rule OFF for `analytics/providers.*`
// (the one legal adapter home) via file overrides; the rule itself always
// flags.
//
// Vendor list: known analytics SDK package prefixes. Extendable per host via
// options ({ providers: ["@acme/tracker"] }) or settings.stapel.providerModules.
import { stapelSettings } from "../lib/data.js";

const DEFAULT_PROVIDERS = [
  "posthog-js",
  "posthog-node",
  "mixpanel-browser",
  "mixpanel",
  "amplitude-js",
  "@amplitude/",
  "@segment/",
  "analytics-node",
  "@rudderstack/",
  "rudder-sdk-js",
  "@snowplow/",
  "react-ga",
  "react-ga4",
  "@google-analytics/",
  "@datadog/browser-rum",
  "@fullstory/",
  "heap-api",
];

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing analytics provider SDKs outside the core facade's provider adapters.",
    },
    schema: [
      {
        type: "object",
        properties: {
          providers: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      directProvider:
        'Direct analytics provider import "{{source}}". Emit through the Stapel analytics facade instead — analytics.track(event, props) / tracked(event, props, handler) — which owns consent, PII guarding, and the offline queue (§3). Provider SDKs are wired ONCE, in the facade\'s provider adapter (analytics/providers.ts — implementation: @stapel/analytics; type seam: @stapel/core).',
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const extra = context.options[0]?.providers ?? [];
    const prefixes = [
      ...DEFAULT_PROVIDERS,
      ...(settings.providerModules ?? []),
      ...extra,
    ];

    function isProvider(source) {
      return prefixes.some((p) =>
        p.endsWith("/") || p.endsWith("-")
          ? source.startsWith(p)
          : source === p || source.startsWith(`${p}/`)
      );
    }

    function check(node, source) {
      if (typeof source === "string" && isProvider(source)) {
        context.report({ node, messageId: "directProvider", data: { source } });
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
