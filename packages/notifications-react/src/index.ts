/**
 * `@stapel/notifications-react` — the headless React flow pair for stapel-notifications
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createNotificationsApi } from "./api/notificationsApi.js";
export type { NotificationsApi } from "./api/notificationsApi.js";
export type {
  Schemas,
  DeviceTokenRequest,
  DeviceTokenResponse,
  FeedItem,
  NotificationFeedPage,
  NotificationFeedParams,
  Platform,
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
export { NOTIFICATIONS_FLOWS, flowEndpoints } from "./flows/generated/flows.gen.js";
export type {
  NotificationsFlowId,
  NotificationsFlowSpec,
  FlowEndpoint,
} from "./flows/generated/flows.gen.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createNotificationsRuntime } from "./model/runtime.js";
export type {
  NotificationsRuntime,
  CreateNotificationsRuntimeOptions,
} from "./model/runtime.js";
export {
  NotificationsRuntimeContext,
  useNotificationsRuntime,
  useNotificationsApi,
  useNotificationsAnalytics,
} from "./model/context.js";
export { notificationsQueryKeys } from "./model/queryKeys.js";
export {
  useNotificationFeed,
  useInfiniteNotificationFeed,
} from "./model/queries.js";
export {
  useRegisterDevice,
  useUnregisterDevice,
} from "./model/mutations.js";
export type { RegisterDeviceVariables } from "./model/mutations.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { NotificationsProvider } from "./headless/NotificationsProvider.js";
export { NotificationFeed } from "./headless/NotificationFeed.js";
export type { NotificationFeedBag } from "./headless/NotificationFeed.js";
export { DeviceRegistration } from "./headless/DeviceRegistration.js";
export type { DeviceRegistrationBag } from "./headless/DeviceRegistration.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  NOTIFICATIONS_I18N_KEYS,
  notificationsI18nBundleEn,
  registerNotificationsI18n,
} from "./i18n/keys.js";
export type { NotificationsI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  NOTIFICATIONS_ERRORS,
  NOTIFICATIONS_ERROR_CODES,
  notificationsErrorBundleEn,
  explainNotificationsError,
} from "./i18n/errorsMap.js";
export type {
  NotificationsErrorCode,
  NotificationsErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
