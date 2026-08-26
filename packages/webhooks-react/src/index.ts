/**
 * `@stapel/webhooks-react` — the headless React flow pair for stapel-webhooks
 * (frontend-standard §2). Business + state only, zero visual opinion; the
 * shipped screens live behind the `./default` subpath so a host that brings
 * its own visuals never pulls antd.
 *
 * Layers: api → model → flows → headless → i18n. Generated surfaces (schema,
 * error map, manifest, llms.txt) are produced by the monorepo `gen:*` drivers
 * from stapel-webhooks's own contract triad and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createWebhooksApi, SUBSCRIPTION_LIST_LIMIT } from "./api/webhooksApi.js";
export type {
  WebhooksApi,
  SubscriptionFilters,
  DeliveryFilters,
  CreateSubscriptionBody,
} from "./api/webhooksApi.js";
export { DELIVERY_STATUSES, isDeliveryStatus } from "./api/types.js";
export type {
  Schemas,
  CatalogEvent,
  EventCatalog,
  Subscription,
  SubscriptionCreate,
  SubscriptionPatch,
  SubscriptionSecret,
  Delivery,
  DeliveryStatus,
  DeliveryTarget,
  ReplayResult,
} from "./api/types.js";

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
export {
  createWebhooksRuntime,
  DEFAULT_RETENTION,
  DEFAULT_WEBHOOKS_BASE_URL,
} from "./model/runtime.js";
export type {
  WebhooksRuntime,
  CreateWebhooksRuntimeOptions,
  RetentionWindow,
} from "./model/runtime.js";
export {
  WebhooksRuntimeContext,
  useWebhooksRuntime,
  useWebhooksApi,
  useWebhooksAnalytics,
} from "./model/context.js";
export { webhooksQueryKeys } from "./model/queryKeys.js";

// ── model (the delivery-type registry mirror + the filter grammar) ───────────
export {
  BUILTIN_DELIVERY_TYPES,
  DELIVERY_WEBHOOK,
  DELIVERY_NOTIFICATION,
  DELIVERY_WS,
  DELIVERY_CUSTOM,
  deliveryTypeSpec,
  isSignedDelivery,
  targetKeysFor,
  validateTarget,
} from "./model/deliveryTypes.js";
export type { DeliveryTypeSpec, TargetProblem } from "./model/deliveryTypes.js";
export {
  FILTER_FIELD_OPS,
  FILTER_GROUP_OPS,
  MAX_FILTER_DEPTH,
  validateFilterText,
  validateFilterValue,
} from "./model/filter.js";
export type {
  FilterMessageKeys,
  FilterProblem,
  FilterValidation,
} from "./model/filter.js";

// ── model (formatting) ───────────────────────────────────────────────────────
export {
  formatInstant,
  formatDate,
  formatOptionalInstant,
  formatJson,
  targetSummary,
  deliveryEnvelope,
  deliveryHeaders,
} from "./model/format.js";

// ── model (reads and writes) ────────────────────────────────────────────────
export { useEventCatalog } from "./model/catalog.js";
export type { CatalogGroup, EventCatalogBag } from "./model/catalog.js";
export {
  useSubscriptions,
  useSubscription,
  useCreateSubscription,
  useUpdateSubscription,
  useSecretRotation,
  subscriptionFiltersKey,
} from "./model/subscriptions.js";
export type {
  SubscriptionsBag,
  SecretRotationBag,
} from "./model/subscriptions.js";
export { useSubscriptionForm, FILTER_MESSAGE_KEYS } from "./model/subscriptionForm.js";
export type {
  SubscriptionFormBag,
  SubscriptionFormFields,
} from "./model/subscriptionForm.js";
export {
  useDeliveries,
  useDelivery,
  DELIVERY_POLL_INTERVAL_MS,
} from "./model/deliveries.js";
export type { DeliveriesBag } from "./model/deliveries.js";

// ── model (named refusals) ──────────────────────────────────────────────────
export {
  toWebhooksError,
  isUnknownEvent,
  isUnknownDelivery,
  isInvalidTarget,
  isInsecureTarget,
  isInvalidFilter,
  isNotSignedType,
  isSubscriptionCap,
  isWebhooksForbidden,
  isSubscriptionNotFound,
  isDeliveryNotFound,
  isNotReplayable,
  isMandateUnavailable,
  WEBHOOKS_ERROR_UNKNOWN_EVENT,
  WEBHOOKS_ERROR_UNKNOWN_DELIVERY,
  WEBHOOKS_ERROR_INVALID_TARGET,
  WEBHOOKS_ERROR_INSECURE_TARGET,
  WEBHOOKS_ERROR_INVALID_FILTER,
  WEBHOOKS_ERROR_NOT_SIGNED_TYPE,
  WEBHOOKS_ERROR_SUBSCRIPTION_CAP,
  WEBHOOKS_ERROR_FORBIDDEN,
  WEBHOOKS_ERROR_SUBSCRIPTION_NOT_FOUND,
  WEBHOOKS_ERROR_DELIVERY_NOT_FOUND,
  WEBHOOKS_ERROR_NOT_REPLAYABLE,
  WEBHOOKS_ERROR_MANDATE_UNAVAILABLE,
} from "./model/refusals.js";

// ── analytics vocabulary (names only — the runtime is the host's seam) ──────
export { WEBHOOKS_EVENTS } from "./analytics/events.js";
export type { WebhooksEventName } from "./analytics/events.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { WebhooksProvider } from "./headless/WebhooksProvider.js";

// ── nav ─────────────────────────────────────────────────────────────────────
export { navEntries } from "./nav/manifest.js";

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
