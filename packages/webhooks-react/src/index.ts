/**
 * `@stapel/webhooks-react` — the headless React flow pair for stapel-webhooks
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createWebhooksApi } from "./api/webhooksApi.js";
export type { WebhooksApi } from "./api/webhooksApi.js";
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
export { WEBHOOKS_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  WebhooksFlowId,
  WebhooksFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createWebhooksRuntime } from "./model/runtime.js";
export type {
  WebhooksRuntime,
  CreateWebhooksRuntimeOptions,
} from "./model/runtime.js";
export {
  WebhooksRuntimeContext,
  useWebhooksRuntime,
  useWebhooksApi,
  useWebhooksAnalytics,
} from "./model/context.js";
export { webhooksQueryKeys } from "./model/queryKeys.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { WebhooksProvider } from "./headless/WebhooksProvider.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  WEBHOOKS_I18N_KEYS,
  webhooksI18nBundleEn,
  registerWebhooksI18n,
} from "./i18n/keys.js";
export type { WebhooksI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  WEBHOOKS_ERRORS,
  WEBHOOKS_ERROR_CODES,
  webhooksErrorBundleEn,
  explainWebhooksError,
} from "./i18n/errorsMap.js";
export type {
  WebhooksErrorCode,
  WebhooksErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
