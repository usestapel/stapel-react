/**
 * `@stapel/vocabularies-react` — the headless React flow pair for stapel-vocabularies
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createVocabulariesApi } from "./api/vocabulariesApi.js";
export type { VocabulariesApi } from "./api/vocabulariesApi.js";
export type { Schemas, Vocabulary, Level, Term, TermPage } from "./api/types.js";

// ── the seam (attributes-v2 §3.4) ────────────────────────────────────────────
// `createVocabularyClient` returns the two functions
// `@stapel/attributes-react` declares as `VocabularyClient` and hands to
// `<VocabularyClientProvider>`. The shape is satisfied STRUCTURALLY: neither
// package imports the other (test/clientShape.test.ts is the proof), so the
// two L2 pairs stay independently releasable.
export {
  createVocabularyClient,
  DEFAULT_TERM_LIMIT,
  RESOLVE_BATCH,
} from "./client.js";
export type {
  VocabularyClient,
  VocabularyTerm,
  VocabularyTermPage,
  VocabularyTermAnswer,
  CreateVocabularyClientOptions,
} from "./client.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { VOCABULARIES_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  VocabulariesFlowId,
  VocabulariesFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createVocabulariesRuntime } from "./model/runtime.js";
export type {
  VocabulariesRuntime,
  CreateVocabulariesRuntimeOptions,
} from "./model/runtime.js";
export {
  VocabulariesRuntimeContext,
  useVocabulariesRuntime,
  useVocabulariesApi,
  useVocabulariesAnalytics,
} from "./model/context.js";
export { vocabulariesQueryKeys } from "./model/queryKeys.js";
export { useTermSearch, TERM_SEARCH_DEBOUNCE_MS } from "./model/useTermSearch.js";
export type { TermSearchOptions, TermSearchState } from "./model/useTermSearch.js";
export { useTermLabels, termLabel } from "./model/useTermLabels.js";
export type { TermLabels, TermLabelsOptions } from "./model/useTermLabels.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { VocabulariesProvider } from "./headless/VocabulariesProvider.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  VOCABULARIES_I18N_KEYS,
  vocabulariesI18nBundleEn,
  registerVocabulariesI18n,
} from "./i18n/keys.js";
export type { VocabulariesI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  VOCABULARIES_ERRORS,
  VOCABULARIES_ERROR_CODES,
  vocabulariesErrorBundleEn,
  explainVocabulariesError,
} from "./i18n/errorsMap.js";
export type {
  VocabulariesErrorCode,
  VocabulariesErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
