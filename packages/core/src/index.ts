// fetch + error envelope
export { createStapelClient } from "./client.js";
export type {
  StapelClient,
  StapelClientOptions,
  StapelRequestOptions,
  HttpMethod,
} from "./client.js";
export { StapelApiError, parseErrorEnvelope } from "./errors.js";
export type { StapelErrorEnvelope } from "./errors.js";

// verification-403 interception seam
export {
  extractVerificationChallenge,
  VERIFICATION_TOKEN_HEADER,
} from "./verification.js";
export type {
  VerificationChallenge,
  VerificationOutcome,
  VerificationChallengeHandler,
} from "./verification.js";

// config provider + client injection
export {
  StapelConfigProvider,
  useStapelConfig,
  useStapelClient,
} from "./config.js";
export type { StapelConfig } from "./config.js";

// query layer + persistence
export { createStapelQueryClient } from "./query.js";
export type {
  StapelQueryRuntime,
  StapelQueryClientOptions,
  PersistStorage,
} from "./query.js";

// i18n engine
export { createI18n, interpolate, I18nProvider, useI18n, useT } from "./i18n.js";
export type {
  I18nEngine,
  I18nDictionary,
  LocaleLoader,
  TranslateFn,
  CreateI18nOptions,
} from "./i18n.js";

// analytics TYPE seam + context plumbing (analytics-standard §2). The facade
// IMPLEMENTATION (createAnalytics, the console/Stapel-collector providers,
// defineEvent/prop, tracked/useTracked) lives in `@stapel/analytics`
// (slim-wave §21/S1): pairs thread the `Analytics` seam through context and
// depend only on core; hosts pick @stapel/analytics (the stapel-studio
// default) or bring their own provider behind the same seam.
export { trackFlowStep } from "./analytics/flow.js";
export type { FlowStepPhase } from "./analytics/flow.js";
export { AnalyticsContext, useAnalytics } from "./analytics/context.js";
export type {
  EventDef,
  EventDefInput,
  EventProps,
  AnyEventDef,
  PropSpec,
  PropsSchema,
  PropType,
  ResolveProps,
} from "./analytics/events.js";
export type {
  Analytics,
  AnalyticsEvent,
  AnalyticsEventKind,
  AnalyticsProvider,
  AnalyticsOptions,
  AnalyticsBatchOptions,
  ConsentState,
  PiiGuardMode,
} from "./analytics/types.js";

// persistence adapters — shared by the query layer and @stapel/analytics'
// offline queue (the impl package builds on these rather than re-implementing
// the IndexedDB → localStorage → memory ladder).
export {
  defaultPersistStorage,
  idbStorage,
  localStorageAdapter,
  memoryStorage,
} from "./storage.js";

// breakpoints
export { useBreakpoint } from "./useBreakpoint.js";
export type { Breakpoint } from "@stapel/tokens";

// flow-machine primitive (frontend-standard §2 — the shared state container
// every `@stapel/<module>-react` pair builds its machines on; lives here, not
// copied per pair — frontend-core-architecture §4b). `useFlow` ships from core
// today and relocates to `@stapel/react` on the framework-agnostic split (§3.1).
export { createFlowMachine } from "./flows/flowMachine.js";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
} from "./flows/flowMachine.js";
export { useFlow } from "./flows/useFlow.js";
export { toFlowError, isErrorCode } from "./flows/flowError.js";
export type { FlowError } from "./flows/flowError.js";

// NOTE: @stapel/core no longer exports a generated `paths`/`components`/
// `operations` surface. Under the §17 per-module contract pipeline every
// `@stapel/<module>-react` pair generates its OWN self-contained wire types
// (`src/api/generated/schema.ts`) from its backend's committed `docs/schema.json`
// — nothing consumed core's aggregate export (grep-confirmed), and stapel-core
// has no DRF endpoints of its own from which to emit a meaningful core slice
// (the shared `User`/`StapelError`/`TokenPairResponse` schemas only materialise
// via a module's endpoints). The hand-authored runtime error contract lives in
// `./errors.js` (`StapelApiError`, `StapelErrorEnvelope`), not the schema.
// This retired core as the last reader of the monolith aggregate (contract-pipeline.md §5).
