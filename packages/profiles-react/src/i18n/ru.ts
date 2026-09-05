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
  "profiles.action.retry": "Попробовать ещё раз",
  "profiles.action.close": "Закрыть",
  "profiles.profile.loading": "Загрузка профиля…",
  "profiles.profile.save": "Сохранить изменения",
  "profiles.profile.saving": "Сохранение…",
  "profiles.profile.saved": "Профиль сохранён.",
  "profiles.profile.no_changes": "Сохранять нечего — это уже сохранённое значение.",
  "profiles.relationship.follow": "Подписаться",
  "profiles.relationship.follow_back": "Подписаться в ответ",
  "profiles.relationship.following": "Вы подписаны",
  "profiles.relationship.unfollow": "Отписаться",
  "profiles.relationship.block": "Заблокировать",
  "profiles.relationship.blocked": "Заблокирован",
  "profiles.relationship.unblock": "Разблокировать",
  "profiles.relationship.self": "Это вы",
  "profiles.relationship.confirm_block.title": "Заблокировать {name}?",
  "profiles.relationship.confirm_block.body":
    "Этот человек отпишется от вас и не сможет подписаться снова, пока вы его не разблокируете.",
  "profiles.relationship.confirm_unblock.title": "Разблокировать {name}?",
  "profiles.relationship.confirm_unblock.body":
    "Человек снова сможет на вас подписаться. Подписка автоматически не восстанавливается.",
  "profiles.relationship.blocked_notice": "Вы заблокировали этого человека.",
  "profiles.relationship.blocked.self": "Это ваш собственный профиль.",
  "profiles.relationship.blocked.blocked":
    "Разблокируйте этого человека, чтобы на него подписаться.",
  "profiles.relationship.blocked.unknown":
    "Не удалось узнать, в каких вы отношениях с этим человеком.",
  "profiles.list.followers": "Подписчики",
  "profiles.list.following": "Подписки",
  "profiles.list.blocked": "Заблокированные",
  "profiles.list.empty": "Здесь пока никого нет.",
  // Russian has four cardinal forms where English has two. The FAMILY key is
  // shared across locales; the categories under it are each language's own
  // (core's `pluralCategory`, via `Intl.PluralRules`).
  "profiles.list.count.followers.one": "{count} подписчик",
  "profiles.list.count.followers.few": "{count} подписчика",
  "profiles.list.count.followers.many": "{count} подписчиков",
  "profiles.list.count.followers.other": "{count} подписчиков",
  "profiles.list.count.following.one": "{count} подписка",
  "profiles.list.count.following.few": "{count} подписки",
  "profiles.list.count.following.many": "{count} подписок",
  "profiles.list.count.following.other": "{count} подписок",
  "profiles.list.count.blocked.one": "{count} заблокированный",
  "profiles.list.count.blocked.few": "{count} заблокированных",
  "profiles.list.count.blocked.many": "{count} заблокированных",
  "profiles.list.count.blocked.other": "{count} заблокированных",
  "profiles.list.empty.followers": "Подписчиков пока нет",
  "profiles.list.empty.followers_hint": "Когда на вас подпишутся, люди появятся здесь.",
  "profiles.list.empty.following": "Вы пока ни на кого не подписаны",
  "profiles.list.empty.following_hint":
    "Подпишитесь на кого-нибудь в его профиле, и он появится в этом списке.",
  "profiles.list.empty.blocked": "Вы никого не заблокировали",
  "profiles.list.empty.blocked_hint":
    "Заблокированный человек не может подписаться на вас и не видит ваш профиль.",
  "profiles.person.unnamed": "Без имени",
  "profiles.person.you": "Вы",
  "profiles.person.missing": "Профиль не заполнен",
  "profiles.connections.title": "Связи",
  "profiles.connections.subtitle":
    "Кто подписан на вас, на кого подписаны вы и кого вы заблокировали.",
  "profiles.connections.kind_label": "Какой список показать",
  "profiles.public.unwritten": "Этот человек ещё не заполнил профиль.",
  "profiles.public.location": "Местоположение",
  "profiles.public.seller_type": "Продавец",
  "profiles.public.count.following.one": "Подписан на {count} человека",
  "profiles.public.count.following.few": "Подписан на {count} человек",
  "profiles.public.count.following.many": "Подписан на {count} человек",
  "profiles.public.count.following.other": "Подписан на {count} человек",
  "profiles.seller_type.private": "Частное лицо",
  "profiles.seller_type.business": "Компания",
  "profiles.settings.title": "Профиль",
  "profiles.settings.subtitle": "Имя, аватар и общие настройки.",
  "profiles.settings.avatar.change": "Изменить аватар",
  "profiles.settings.avatar.uploading": "Загрузка…",
  "profiles.settings.avatar.upload_error": "Не удалось загрузить изображение. Попробуйте ещё раз.",
  "profiles.settings.field.display_name": "Отображаемое имя",
  "profiles.settings.field.edit": "Изменить: {field}",
  "profiles.settings.field.theme": "Тема",
  "profiles.settings.theme.light": "Светлая",
  "profiles.settings.theme.dark": "Тёмная",
  "profiles.settings.theme.system": "Системная",
  "profiles.initialSetup.title": "Добро пожаловать — настроим ваш профиль",
  "profiles.initialSetup.subtitle":
    "Расскажите немного о себе. Это можно изменить позже в настройках профиля.",
  "profiles.initialSetup.name_placeholder": "Ваше имя",
  "profiles.initialSetup.save": "Продолжить",
  "profiles.initialSetup.saving": "Сохранение…",
  "profiles.initialSetup.skip": "Позже",
  "profiles.initialSetup.blocked.name_required":
    "Введите отображаемое имя, чтобы продолжить.",
  "profiles.language.title": "Язык",
  "profiles.language.subtitle": "Выберите язык интерфейса приложения.",
  "profiles.language.field.app_language": "Язык интерфейса",
  "profiles.language.field.auto": "Авто",
  "profiles.language.field.understands": "Понимаемые языки",
  "profiles.language.catalogue_empty": "Нет языков для выбора.",
  "profiles.notif_prefs.title": "Уведомления",
  "profiles.notif_prefs.subtitle": "Выберите, какие уведомления и по каким каналам вы получаете.",
  "profiles.notif_prefs.category.messages": "Сообщения",
  "profiles.notif_prefs.category.system": "Системные",
  "profiles.notif_prefs.channel.email": "Email",
  "profiles.notif_prefs.channel.push": "Push",
  "profiles.notif_prefs.toggle_label": "Уведомления «{category}» по каналу {channel}",
  "profiles.nav.settings": "Настройки",
  "profiles.nav.language": "Язык",
  "profiles.nav.notifications": "Уведомления",
  "profiles.nav.connections": "Связи",
  "profiles.nav.public_profile": "Публичный профиль",
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
