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
export {
  FEED_LINK_KEYS,
  FEED_READ_MAX_IDS,
  feedItemLink,
  feedReadBody,
  isFeedItemUnread,
} from "./api/types.js";
export type {
  Schemas,
  DeviceListItem,
  DeviceTokenRequest,
  DeviceTokenResponse,
  FeedItem,
  FeedReadRequest,
  FeedReadResponse,
  FeedReadTarget,
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
export { NOTIFICATIONS_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  NotificationsFlowId,
  NotificationsFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

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
  useUnreadCount,
  useDevices,
} from "./model/queries.js";
export {
  useRegisterDevice,
  useUnregisterDevice,
  useUnregisterDeviceById,
  useMarkFeedRead,
} from "./model/mutations.js";
export type {
  RegisterDeviceVariables,
  MarkFeedReadContext,
} from "./model/mutations.js";

// The feed cache's transforms — one definition shared by the optimistic write,
// the `notification.read` frame and a host doing either by hand. Exported from
// the main entry (not only from `/live`) because marking a row read must not
// cost a polling deployment an import of `@stapel/realtime`.
export {
  mergeArrivedItem,
  markReadLocally,
  applyReadSignal,
  unreadCountOf,
} from "./model/feedCache.js";
export type { FeedCache, FeedReadSignal } from "./model/feedCache.js";

// how this tab learns that something arrived — a socket, or the documented
// poll — and the mode a skin must render. The socket ADAPTER lives in
// `@stapel/notifications-react/live`, so nothing here imports @stapel/realtime.
export {
  FeedDeliveryContext,
  FeedDeliveryProvider,
  useFeedDelivery,
  usePageVisible,
  feedPollInterval,
  FEED_POLL_INTERVAL_MS,
  FEED_POLL_MIN_INTERVAL_MS,
} from "./model/delivery.js";
export type {
  FeedDelivery,
  FeedDeliveryMode,
  FeedRefusalKind,
} from "./model/delivery.js";

// this device's identity in a registry that never echoes tokens
export { canFingerprint, tokenFingerprint } from "./model/fingerprint.js";
// formatters the pair owns until core grows them (see REQUESTS)
export { formatFeedTime, formatDateTime } from "./model/format.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { NotificationsProvider } from "./headless/NotificationsProvider.js";
export { NotificationFeed } from "./headless/NotificationFeed.js";
export type { NotificationFeedBag } from "./headless/NotificationFeed.js";
export { DeviceRegistration } from "./headless/DeviceRegistration.js";
export type {
  DeviceRegistrationBag,
  DeviceRegistrationProps,
  PushState,
  PushBlockedReason,
} from "./headless/DeviceRegistration.js";

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
