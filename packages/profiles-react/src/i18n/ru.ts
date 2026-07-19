import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { profilesI18nBundleEn } from "./keys.js";
import { profilesErrorBundleRu } from "./generated/errors.ru.gen.js";

export { profilesErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for profiles-react — the pair's `ru` locale, shipped as the
 * `@stapel/profiles-react/i18n/ru` subpath (i18n-shipping.md §2) so the
 * locale is opt-in: hosts that don't register it never carry these strings
 * (the main entry does not import this module — gated by size-limit + the
 * bundle-purity test).
 *
 * Composition mirrors {@link profilesI18nBundleEn}: the GENERATED backend
 * error texts (from stapel-profiles's `translations/errors.ru.json` catalog,
 * seeded from the curated stapel-translate corpus — `pnpm gen:errors`) are
 * spread first for coverage by construction; the hand-written ru UI copy for
 * the pair-owned {@link PROFILES_I18N_KEYS} follows. Override any key by
 * registering a host bundle AFTER this one (merge-priority convention — see
 * keys.ts).
 */
export const profilesI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts (coverage by construction).
  ...profilesErrorBundleRu,

  // profiles-react UI (hand-written ru mirror of the en copy in keys.ts)
  "profiles.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "profiles.profile.loading": "Загрузка профиля…",
  "profiles.profile.save": "Сохранить изменения",
  "profiles.profile.saving": "Сохранение…",
  "profiles.profile.saved": "Профиль сохранён.",
  "profiles.relationship.follow": "Подписаться",
  "profiles.relationship.following": "Вы подписаны",
  "profiles.relationship.unfollow": "Отписаться",
  "profiles.relationship.block": "Заблокировать",
  "profiles.relationship.blocked": "Заблокирован",
  "profiles.relationship.unblock": "Разблокировать",
  "profiles.relationship.self": "Это вы",
  "profiles.list.followers": "Подписчики",
  "profiles.list.following": "Подписки",
  "profiles.list.blocked": "Заблокированные",
  "profiles.list.empty": "Здесь пока никого нет.",
  "profiles.settings.title": "Профиль",
  "profiles.settings.subtitle": "Имя, аватар и общие настройки.",
  "profiles.settings.avatar.change": "Изменить аватар",
  "profiles.settings.avatar.uploading": "Загрузка…",
  "profiles.settings.avatar.upload_error": "Не удалось загрузить изображение. Попробуйте ещё раз.",
  "profiles.language.title": "Язык",
  "profiles.language.subtitle": "Выберите язык интерфейса приложения.",
  "profiles.language.field.app_language": "Язык интерфейса",
  "profiles.language.field.auto": "Авто",
  "profiles.language.field.understands": "Понимаемые языки",
  "profiles.notif_prefs.title": "Уведомления",
  "profiles.notif_prefs.subtitle": "Выберите, какие уведомления и по каким каналам вы получаете.",
  "profiles.notif_prefs.category.messages": "Сообщения",
  "profiles.notif_prefs.category.system": "Системные",
  "profiles.notif_prefs.channel.email": "Email",
  "profiles.notif_prefs.channel.push": "Push",
  "profiles.nav.settings": "Настройки",
};

/**
 * Register the pair's `ru` locale into a core i18n engine (call once at
 * startup, after {@link registerProfilesI18n}). Layers per the
 * merge-priority convention (i18n-shipping.md §3): the en floor is registered
 * UNDER the ru texts inside the `ru` locale, so a key the ru bundle ever
 * misses degrades to its English text — never to a raw key. A host bundle
 * registered after this call overrides both.
 */
export function registerProfilesI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", profilesI18nBundleEn);
  engine.registerBundle("ru", profilesI18nBundleRu);
}
