---
"@stapel/core": minor
---

Analytics restratification (slim wave §21/S1). Core keeps the analytics **type
seam + context plumbing** — the `Analytics`/`AnalyticsProvider`/`AnalyticsEvent`
types, the `defineEvent` type layer (`EventDef`, `EventDefInput`, `EventProps`,
`AnyEventDef`, `PropSpec`, `PropsSchema`, `PropType`, `ResolveProps`),
`AnalyticsContext` + `useAnalytics`, and `trackFlowStep` (flow-machine
auto-instrumentation) — while the facade **implementation** moves to the new
`@stapel/analytics` package.

- **Removed exports** (now in `@stapel/analytics`): `createAnalytics`,
  `consoleProvider`, `stapelCollectorProvider`, `StapelCollectorOptions`,
  `defineEvent`, `prop`, `createTracked`, `TrackedApi`, `useTracked`.
- **New exports**: the persistence adapters `defaultPersistStorage`,
  `idbStorage`, `localStorageAdapter`, `memoryStorage` (shared by the query
  layer and `@stapel/analytics`' offline queue), and the `ResolveProps` type.

Rationale: mandatory analytics is a stapel-studio policy — scaffolded apps
always wire `@stapel/analytics`; OSS consumers may bring their own provider
behind the core type seam (pairs thread it through context; the
`stapel/no-direct-analytics-provider` rule still guards vendor SDK imports).
