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

// analytics facade (analytics-standard §2)
export { createAnalytics } from "./analytics/createAnalytics.js";
export {
  consoleProvider,
  stapelCollectorProvider,
} from "./analytics/providers.js";
export type { StapelCollectorOptions } from "./analytics/providers.js";
export { trackFlowStep } from "./analytics/flow.js";
export type { FlowStepPhase } from "./analytics/flow.js";
export { AnalyticsContext, useAnalytics } from "./analytics/context.js";
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

// generated typed API surface — openapi-typescript from the unified Stapel
// OpenAPI (all-modules codegen source). Types only, zero runtime.
// Regenerate: `pnpm gen:api` at the monorepo root (docs/flow-system.md §0.1).
export type {
  paths,
  components,
  operations,
} from "./generated/schema.js";
