import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { videoErrorBundleRu } from "./generated/errors.ru.gen.js";

export { videoErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for video-react — shipped as the
 * `@stapel/video-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit and the
 * bundle-purity test).
 *
 * TWO SOURCES, ON PURPOSE. The generated `videoErrorBundleRu` covers the 42
 * cross-cutting keys stapel-core owns and localizes. The 9 keys stapel-video
 * owns are NOT in it, and cannot be: the module ships no `translations/`
 * directory at all, so the generator emits a `Partial` bundle and says so in
 * its own header (`ERRORS_LOCALE_EXEMPT_OWNERS`, the stapel-forms /
 * stapel-reviews precedent). They are authored below, beside the UI copy. When
 * upstream ships `translations/errors.ru.json`, these nine lines are deleted
 * and the generated bundle covers them — the keys and the texts do not move.
 */
export const videoI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for every key core owns.
  ...videoErrorBundleRu,

  // Backend error codes stapel-video owns — authored here (see above).
  "error.400.video_invalid_access_level":
    "Уровень доступа должен быть одним из: public, scope_trusted, restricted",
  "error.400.video_invalid_usage_period":
    "Месяц указывается как ГГГГ-ММ, число месяцев — положительное, часовой пояс — из базы IANA",
  "error.400.video_invalid_webhook":
    "Вебхук провайдера некорректен или не прошёл проверку подписи",
  "error.403.video_join_denied": "Вас не пустили в эту комнату",
  "error.403.video_not_room_host":
    "Это действие доступно только ведущему комнаты",
  "error.403.video_not_room_participant":
    "Это видно только участникам этой комнаты",
  "error.404.video_participant_not_found": "Ожидающий участник не найден",
  "error.404.video_room_not_found": "Комната не найдена",
  // The uniform 404 — see the en bundle's note. Says nothing about WHICH of
  // the three situations it is, and never reads as "there were no calls".
  "error.404.video_scope_not_found":
    "Статистика звонков для этого пространства недоступна",

  // UI copy.
  "video.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

  "video.usage.heading": "Время в звонках",
  "video.usage.month_label": "Месяц",
  "video.usage.refresh": "Обновить",
  "video.usage.loading": "Загружаем время в звонках…",
  "video.usage.unavailable":
    "Статистика звонков для этого пространства недоступна",
  "video.usage.empty": "В этом месяце никто не был в звонках",
  "video.usage.no_scope": "Пространство не выбрано — показывать нечего",

  "video.usage.column.person": "Участник",
  "video.usage.column.talk_time": "Время в звонках",
  "video.usage.column.calls": "Звонки",
  "video.usage.column.connections": "Подключения",

  "video.usage.total.label": "Итого",
  "video.usage.total.people": "Участников: {count}",
  "video.usage.total.attendances": "Участий: {count}",
  "video.usage.total.attendances_hint":
    "Сумма звонков по каждому участнику: трое в одном звонке дают три",
};

/** Register the Russian bundle into a core i18n engine. */
export function registerVideoI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, videoI18nBundleRu);
}
