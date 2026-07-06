import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { notificationsErrorBundleEn } from "./generated/errors.gen.js";

/**
 * notifications-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. Add UI keys under the `notifications.` namespace as you build flows.
 */
export const NOTIFICATIONS_I18N_KEYS = {
  unknownError: "notifications.error.unknown",
  // Feed (NotificationFeed headless)
  feedEmpty: "notifications.feed.empty",
  feedLoading: "notifications.feed.loading",
  feedLoadMore: "notifications.feed.load_more",
  feedEnd: "notifications.feed.end",
  // Device registration (DeviceRegistration headless)
  deviceRegister: "notifications.device.register",
  deviceUnregister: "notifications.device.unregister",
  deviceRegistering: "notifications.device.registering",
  deviceRegistered: "notifications.device.registered",
} as const;

export type NotificationsI18nKey =
  (typeof NOTIFICATIONS_I18N_KEYS)[keyof typeof NOTIFICATIONS_I18N_KEYS];

/**
 * English fallback bundle for notifications-react UI keys + backend error codes.
 * The generated `notificationsErrorBundleEn` (from stapel-notifications's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 */
export const notificationsI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...notificationsErrorBundleEn,

  // notifications-react UI
  "notifications.error.unknown": "Something went wrong. Please try again.",
  "notifications.feed.empty": "No notifications yet.",
  "notifications.feed.loading": "Loading notifications…",
  "notifications.feed.load_more": "Load more",
  "notifications.feed.end": "You're all caught up.",
  "notifications.device.register": "Enable push notifications",
  "notifications.device.unregister": "Disable push notifications",
  "notifications.device.registering": "Enabling…",
  "notifications.device.registered": "Push notifications enabled.",
};

/**
 * Register notifications-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerNotificationsI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, notificationsI18nBundleEn);
}
