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
  // Default skin — PushNotificationToggle / NotificationFeedList
  pushSettingsTitle: "notifications.settings.push.title",
  pushSettingsSubtitle: "notifications.settings.push.subtitle",
  feedSettingsTitle: "notifications.settings.feed.title",
  feedSettingsSubtitle: "notifications.settings.feed.subtitle",
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
  "notifications.settings.push.title": "Push notifications",
  "notifications.settings.push.subtitle": "Enable push notifications on this device.",
  "notifications.settings.feed.title": "Recent notifications",
  "notifications.settings.feed.subtitle": "What we've sent you lately.",
};

/**
 * Register notifications-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`); a later
 * `loadLocale` from stapel-translate can layer localized overrides.
 *
 * MERGE-PRIORITY CONVENTION (pair checklist rule; i18n-shipping.md §3 — every
 * `@stapel/*-react` pair follows it): registration order IS override
 * priority, later wins per key. Within a locale, layers register bottom-up:
 *
 *   1. generated en floor  (`NotificationsErrorBundleEn` — coverage by construction),
 *   2. the pair's polish / UI copy (this bundle spreads 1 then overrides),
 *   3. the pair's locale bundle from the `./i18n/<locale>` subpath
 *      (e.g. `registerNotificationsI18nRu` — registers the en floor UNDER the
 *      locale texts so a missing key degrades to English, never a raw key),
 *   4. the HOST's own bundle — always registered LAST, so a host overrides any
 *      pair text without a fork.
 *
 * Dynamic overrides (stapel-translate `loadLocale`) layer on top at runtime.
 */
export function registerNotificationsI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, notificationsI18nBundleEn);
}
