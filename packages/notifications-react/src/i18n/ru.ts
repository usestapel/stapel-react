import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { notificationsI18nBundleEn } from "./keys.js";
import { notificationsErrorBundleRu } from "./generated/errors.ru.gen.js";

export { notificationsErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for notifications-react — the pair's `ru` locale, shipped as
 * the `@stapel/notifications-react/i18n/ru` subpath (i18n-shipping.md §2) so
 * the locale is opt-in: hosts that don't register it never carry these
 * strings (the main entry does not import this module — gated by size-limit
 * + the bundle-purity test).
 *
 * Composition mirrors {@link notificationsI18nBundleEn}: the GENERATED backend
 * error texts (from stapel-notifications's `translations/errors.ru.json`
 * catalog, seeded from the curated stapel-translate corpus — `pnpm
 * gen:errors`) are spread first for coverage by construction; the
 * hand-written ru UI copy for the pair-owned {@link NOTIFICATIONS_I18N_KEYS}
 * follows. Override any key by registering a host bundle AFTER this one
 * (merge-priority convention — see keys.ts).
 */
export const notificationsI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts (coverage by construction).
  ...notificationsErrorBundleRu,

  // notifications-react UI (hand-written ru mirror of the en copy in keys.ts)
  "notifications.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "notifications.feed.empty": "Пока нет уведомлений.",
  "notifications.feed.loading": "Загрузка уведомлений…",
  "notifications.feed.load_more": "Загрузить ещё",
  "notifications.feed.end": "Вы всё просмотрели.",
  "notifications.device.register": "Включить push-уведомления",
  "notifications.device.unregister": "Отключить push-уведомления",
  "notifications.device.registering": "Включение…",
  "notifications.device.registered": "Push-уведомления включены.",
};

/**
 * Register the pair's `ru` locale into a core i18n engine (call once at
 * startup, after {@link registerNotificationsI18n}). Layers per the
 * merge-priority convention (i18n-shipping.md §3): the en floor is registered
 * UNDER the ru texts inside the `ru` locale, so a key the ru bundle ever
 * misses degrades to its English text — never to a raw key. A host bundle
 * registered after this call overrides both.
 */
export function registerNotificationsI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", notificationsI18nBundleEn);
  engine.registerBundle("ru", notificationsI18nBundleRu);
}
