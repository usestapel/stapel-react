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
 *
 * LOCALE PARITY IS A RULE, NOT AN ASPIRATION: every key here has hand-written
 * `ru` (`./ru.ts`) and `es` (`./es.ts`) copy, and `test/i18nRu.test.ts` /
 * `test/i18nEs.test.ts` fail on the first one that does not. A locale bundle
 * that ships only the generated backend error texts puts Spanish error
 * messages inside an English screen, which reads as a half-finished product
 * rather than a missing translation.
 */
export const NOTIFICATIONS_I18N_KEYS = {
  unknownError: "notifications.error.unknown",

  // ── Feed ──────────────────────────────────────────────────────────────────
  feedTitle: "notifications.feed.title",
  feedSubtitle: "notifications.feed.subtitle",
  feedEmpty: "notifications.feed.empty",
  feedEmptyHint: "notifications.feed.empty_hint",
  feedLoading: "notifications.feed.loading",
  feedLoadMore: "notifications.feed.load_more",
  feedEnd: "notifications.feed.end",
  feedOpen: "notifications.feed.open",

  // ── Read state (stapel-notifications 0.18.0) ──────────────────────────────
  feedUnread: "notifications.feed.unread",
  feedUnreadCount: "notifications.feed.unread_count",
  feedMarkRead: "notifications.feed.mark_read",
  feedMarkAllRead: "notifications.feed.mark_all_read",
  // A gate reason, not a label: `actionBlocked()` takes an i18n key, so the
  // sentence a switched-off "Mark all as read" shows is a translated string
  // like every other, never a hardcoded English fallback in a skin.
  feedMarkAllBlockedNone: "notifications.feed.mark_all_read.blocked.none",
  bellLabel: "notifications.bell.label",
  bellLabelUnread: "notifications.bell.label_unread",

  // ── Delivery mode (live socket vs the documented poll) ────────────────────
  liveOn: "notifications.live.on",
  liveConnecting: "notifications.live.connecting",
  liveReconnecting: "notifications.live.reconnecting",
  livePolling: "notifications.live.polling",
  liveStopped: "notifications.live.stopped",
  liveReconnect: "notifications.live.reconnect",
  liveRefusedSession: "notifications.live.refused_session",
  liveRefusedOrigin: "notifications.live.refused_origin",
  liveRefusedForbidden: "notifications.live.refused_forbidden",
  liveRefusedUnknown: "notifications.live.refused_unknown",
  liveRefusedRevoked: "notifications.live.refused_revoked",

  // ── Push toggle (this device) ─────────────────────────────────────────────
  pushSettingsTitle: "notifications.settings.push.title",
  pushSettingsSubtitle: "notifications.settings.push.subtitle",
  pushToggleLabel: "notifications.push.toggle_label",
  pushChecking: "notifications.push.checking",
  pushOn: "notifications.push.on",
  pushOff: "notifications.push.off",
  pushInactive: "notifications.push.inactive",
  pushInactiveHint: "notifications.push.inactive_hint",
  pushUnknown: "notifications.push.unknown",
  pushUnknownHint: "notifications.push.unknown_hint",
  pushDenied: "notifications.push.denied",
  pushDeniedHint: "notifications.push.denied_hint",
  pushUnsupported: "notifications.push.unsupported",
  pushUnsupportedHint: "notifications.push.unsupported_hint",
  pushTokenUnavailable: "notifications.push.token_unavailable",
  pushTokenUnavailableHint: "notifications.push.token_unavailable_hint",

  // ── Registered devices ────────────────────────────────────────────────────
  devicesTitle: "notifications.devices.title",
  devicesSubtitle: "notifications.devices.subtitle",
  devicesEmpty: "notifications.devices.empty",
  devicesEmptyHint: "notifications.devices.empty_hint",
  devicesThisDevice: "notifications.devices.this_device",
  devicesInactive: "notifications.devices.inactive",
  devicesPlatformOther: "notifications.devices.platform_other",
  devicesLastSeen: "notifications.devices.last_seen",
  devicesRemove: "notifications.devices.remove",
  devicesRemoveQuestion: "notifications.devices.remove_question",
  devicesRemoveBody: "notifications.devices.remove_body",
  platformIos: "notifications.platform.ios",
  platformAndroid: "notifications.platform.android",
  platformWeb: "notifications.platform.web",

  // Nav-manifest labels (`../nav/manifest.ts`) — read by a shell (e.g.
  // `@stapel/shell-react`'s `AppShell`) via `t(entry.labelKey)`.
  navFeed: "notifications.nav.feed",
  navPush: "notifications.nav.push",
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

  "notifications.feed.title": "Notifications",
  "notifications.feed.subtitle": "What we've sent you lately.",
  "notifications.feed.empty": "No notifications yet",
  "notifications.feed.empty_hint":
    "When something needs your attention, it will show up here.",
  "notifications.feed.loading": "Loading notifications…",
  "notifications.feed.load_more": "Load more",
  "notifications.feed.end": "That's the end of your notifications.",
  "notifications.feed.open": "Open",

  "notifications.feed.unread": "Unread",
  "notifications.feed.unread_count": "{count} unread",
  "notifications.feed.mark_read": "Mark as read",
  "notifications.feed.mark_all_read": "Mark all as read",
  "notifications.feed.mark_all_read.blocked.none":
    "Nothing to mark — everything here is read.",
  "notifications.bell.label": "Notifications",
  "notifications.bell.label_unread": "Notifications, {count} unread",

  "notifications.live.on": "Live",
  "notifications.live.connecting": "Connecting…",
  "notifications.live.reconnecting": "Reconnecting…",
  "notifications.live.polling": "Updates within a minute",
  "notifications.live.stopped": "Live updates stopped",
  "notifications.live.reconnect": "Reconnect",
  "notifications.live.refused_session":
    "Your session expired. Sign in again to resume live updates.",
  "notifications.live.refused_origin":
    "Instant updates are not available here. New notifications still arrive within a minute.",
  "notifications.live.refused_forbidden":
    "This account is not allowed to receive live updates.",
  "notifications.live.refused_unknown":
    "Live updates are unavailable on this server.",
  "notifications.live.refused_revoked": "The server ended live updates.",

  "notifications.settings.push.title": "Push notifications",
  "notifications.settings.push.subtitle":
    "Get notified on this device even when this site is closed.",
  "notifications.push.toggle_label": "Push notifications on this device",
  "notifications.push.checking": "Checking this device…",
  "notifications.push.on": "On for this device",
  "notifications.push.off": "Off for this device",
  "notifications.push.inactive": "Registered, but not receiving notifications",
  "notifications.push.inactive_hint":
    "The push service rejected this device's token. Turn push off and on again to re-register.",
  "notifications.push.unknown": "We can't tell whether push is on here",
  "notifications.push.unknown_hint":
    "This device has not given us its push token, so we can only show the devices registered to your account.",
  "notifications.push.denied": "Notifications are blocked in this browser",
  "notifications.push.denied_hint":
    "Allow notifications for this site in your browser settings, then try again.",
  "notifications.push.unsupported": "This browser can't receive push",
  "notifications.push.unsupported_hint":
    "Push needs a secure (https) connection and a browser that supports it.",
  "notifications.push.token_unavailable":
    "We couldn't get a push token from this browser",
  "notifications.push.token_unavailable_hint":
    "Reload the page and try again. If it keeps happening, remove this device below and register it fresh.",

  "notifications.devices.title": "Devices receiving push",
  "notifications.devices.subtitle":
    "Every device registered to your account. Remove one to stop sending to it.",
  "notifications.devices.empty": "No devices are registered",
  "notifications.devices.empty_hint": "Turn push on above to register this one.",
  "notifications.devices.this_device": "This device",
  "notifications.devices.inactive": "Delivery stopped",
  "notifications.devices.platform_other": "Other device",
  "notifications.devices.last_seen": "Last registered {when}",
  "notifications.devices.remove": "Remove",
  "notifications.devices.remove_question": "Remove this device?",
  "notifications.devices.remove_body":
    "It stops receiving push notifications until it registers again.",
  "notifications.platform.ios": "iPhone or iPad",
  "notifications.platform.android": "Android device",
  "notifications.platform.web": "Browser",

  "notifications.nav.feed": "Notifications",
  "notifications.nav.push": "Push notifications",
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
