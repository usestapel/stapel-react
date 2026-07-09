// @stapel/analytics — the analytics facade IMPLEMENTATION (analytics-standard
// §2), restratified out of @stapel/core (slim-wave §21/S1). The TYPE seam
// (`Analytics`, `AnalyticsProvider`, the event-def types) and the context
// plumbing (`AnalyticsContext`, `useAnalytics`, `trackFlowStep`) stay in
// @stapel/core — pairs thread the seam through context and never depend on
// this package. Dependency direction: @stapel/analytics → @stapel/core, only.

// facade
export { createAnalytics } from "./createAnalytics.js";
// provider adapters (the ONE legal home of vendor wiring — guardrails §3)
export { consoleProvider, stapelCollectorProvider } from "./providers.js";
export type { StapelCollectorOptions } from "./providers.js";
// typed events (frontend-guardrails §3): defineEvent + tracked over the facade
export { defineEvent, prop } from "./defineEvent.js";
export { createTracked } from "./tracked.js";
export type { TrackedApi } from "./tracked.js";
export { useTracked } from "./useTracked.js";

// The type seam, re-exported from @stapel/core so this package is
// self-sufficient for consumers (the impl's signatures are expressed in it).
export type {
  Analytics,
  AnalyticsEvent,
  AnalyticsEventKind,
  AnalyticsProvider,
  AnalyticsOptions,
  AnalyticsBatchOptions,
  ConsentState,
  PiiGuardMode,
  EventDef,
  EventDefInput,
  EventProps,
  AnyEventDef,
  PropSpec,
  PropsSchema,
  PropType,
} from "@stapel/core";
