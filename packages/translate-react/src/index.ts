/**
 * `@stapel/translate-react` — the headless React flow pair for stapel-translate
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createTranslateApi } from "./api/translateApi.js";
export type { TranslateApi } from "./api/translateApi.js";
export type { Schemas } from "./api/types.js";

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
export { TRANSLATE_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  TranslateFlowId,
  TranslateFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createTranslateRuntime } from "./model/runtime.js";
export type {
  TranslateRuntime,
  CreateTranslateRuntimeOptions,
} from "./model/runtime.js";
export {
  TranslateRuntimeContext,
  useTranslateRuntime,
  useTranslateApi,
  useTranslateAnalytics,
} from "./model/context.js";
export { translateQueryKeys } from "./model/queryKeys.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { TranslateProvider } from "./headless/TranslateProvider.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  TRANSLATE_I18N_KEYS,
  translateI18nBundleEn,
  registerTranslateI18n,
} from "./i18n/keys.js";
export type { TranslateI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  TRANSLATE_ERRORS,
  TRANSLATE_ERROR_CODES,
  translateErrorBundleEn,
  explainTranslateError,
} from "./i18n/errorsMap.js";
export type {
  TranslateErrorCode,
  TranslateErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
