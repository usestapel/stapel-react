---
"@stapel/eslint-plugin": minor
---

`stapel/no-direct-analytics-provider` (frontend-guardrails §2.2, the last rule
of the declared set that was still missing): importing an analytics vendor SDK
(posthog-js, mixpanel, `@amplitude/*`, `@segment/*`, rudderstack, snowplow,
GA, …) anywhere but the core facade's provider adapters
(`analytics/providers.*`) is an error — a direct provider import bypasses the
facade's consent gate, PII guard, and offline queue in one line. The vendor
list is extendable per host (`options.providers` /
`settings.stapel.providerModules`); the recommended preset carves out the one
legal adapter home via file overrides, same shape as the `no-raw-fetch`
api-layer carve-out.
