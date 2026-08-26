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

  "notifications.feed.title": "Уведомления",
  "notifications.feed.subtitle": "Что мы вам недавно отправляли.",
  "notifications.feed.empty": "Уведомлений пока нет",
  "notifications.feed.empty_hint":
    "Когда появится что-то важное, оно окажется здесь.",
  "notifications.feed.loading": "Загрузка уведомлений…",
  "notifications.feed.load_more": "Загрузить ещё",
  "notifications.feed.end": "Это все ваши уведомления.",
  "notifications.feed.open": "Открыть",

  "notifications.live.on": "В реальном времени",
  "notifications.live.connecting": "Подключение…",
  "notifications.live.reconnecting": "Переподключение…",
  "notifications.live.polling": "Обновляется в течение минуты",
  "notifications.live.stopped": "Живые обновления остановлены",
  "notifications.live.reconnect": "Переподключиться",
  "notifications.live.refused_session":
    "Сессия истекла. Войдите снова, чтобы вернуть живые обновления.",
  "notifications.live.refused_origin":
    "Мгновенные обновления здесь недоступны. Новые уведомления всё равно приходят в течение минуты.",
  "notifications.live.refused_forbidden":
    "Этому аккаунту не разрешены живые обновления.",
  "notifications.live.refused_unknown":
    "Живые обновления недоступны на этом сервере.",
  "notifications.live.refused_revoked": "Сервер прекратил живые обновления.",

  "notifications.settings.push.title": "Push-уведомления",
  "notifications.settings.push.subtitle":
    "Получать уведомления на этом устройстве, даже когда сайт закрыт.",
  "notifications.push.toggle_label": "Push-уведомления на этом устройстве",
  "notifications.push.checking": "Проверяем это устройство…",
  "notifications.push.on": "Включены на этом устройстве",
  "notifications.push.off": "Выключены на этом устройстве",
  "notifications.push.inactive": "Зарегистрировано, но уведомления не приходят",
  "notifications.push.inactive_hint":
    "Push-сервис отклонил токен этого устройства. Выключите и включите push, чтобы зарегистрировать его заново.",
  "notifications.push.unknown": "Не можем определить, включён ли здесь push",
  "notifications.push.unknown_hint":
    "Это устройство не передало нам свой push-токен, поэтому мы показываем только устройства, привязанные к аккаунту.",
  "notifications.push.denied": "Уведомления заблокированы в этом браузере",
  "notifications.push.denied_hint":
    "Разрешите уведомления для этого сайта в настройках браузера и попробуйте снова.",
  "notifications.push.unsupported": "Этот браузер не принимает push",
  "notifications.push.unsupported_hint":
    "Для push нужны защищённое (https) соединение и браузер с поддержкой push.",
  "notifications.push.token_unavailable":
    "Не удалось получить push-токен от браузера",
  "notifications.push.token_unavailable_hint":
    "Перезагрузите страницу и попробуйте снова. Если повторяется — удалите это устройство ниже и зарегистрируйте заново.",

  "notifications.devices.title": "Устройства, получающие push",
  "notifications.devices.subtitle":
    "Все устройства, привязанные к вашему аккаунту. Удалите устройство, чтобы перестать слать на него.",
  "notifications.devices.empty": "Нет зарегистрированных устройств",
  "notifications.devices.empty_hint":
    "Включите push выше, чтобы зарегистрировать это устройство.",
  "notifications.devices.this_device": "Это устройство",
  "notifications.devices.inactive": "Доставка остановлена",
  "notifications.devices.platform_other": "Другое устройство",
  "notifications.devices.last_seen": "Последняя регистрация: {when}",
  "notifications.devices.remove": "Удалить",
  "notifications.devices.remove_question": "Удалить это устройство?",
  "notifications.devices.remove_body":
    "Оно перестанет получать push-уведомления, пока не зарегистрируется снова.",
  "notifications.platform.ios": "iPhone или iPad",
  "notifications.platform.android": "Устройство Android",
  "notifications.platform.web": "Браузер",

  "notifications.nav.feed": "Уведомления",
  "notifications.nav.push": "Push-уведомления",
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
