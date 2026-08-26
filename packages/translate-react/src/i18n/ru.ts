import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { translateI18nBundleEn } from "./keys.js";
import { translateErrorBundleRu } from "./generated/errors.ru.gen.js";
import { LANGUAGE_NAMES } from "./languages.js";

/**
 * Russian bundle for translate-react — shipped as the
 * `@stapel/translate-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale
 * is opt-in: a host that never registers it never carries these strings (the
 * main entry does not import this module).
 *
 * The backend error catalogue for this locale is generated
 * (`errors.ru.gen.ts`, from stapel-translate's `translations/errors.ru.json`)
 * and spread in FIRST, exactly as `keys.ts` spreads the en one, so every
 * backend code keeps coverage by construction. The twenty language endonyms
 * are the same table in every locale — see `i18n/languages.ts`.
 */
export const translateI18nBundleRu: I18nDictionary = {
  ...translateErrorBundleRu,
  ...LANGUAGE_NAMES,

  "translate.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

  "translate.switcher.label": "Язык",
  "translate.switcher.placeholder": "Выберите язык",
  "translate.switcher.switching": "Загружаем этот язык…",
  "translate.switcher.partial":
    "Часть текстов может остаться на английском — переводы не удалось загрузить.",
  "translate.switcher.open": "Сменить язык",

  "translate.status.loading": "Загружаем переводы…",
  "translate.status.revision": "Ревизия {revision} · {keys} текстов",
  "translate.status.offline":
    "Показываем тексты, сохранённые на этом устройстве — сервер недоступен.",
  "translate.status.fallback":
    "Показываем тексты, встроенные в приложение — переводы не загружены.",

  "translate.settings.heading": "Язык",
  "translate.settings.hint":
    "Меню, кнопки и сообщения показываются на выбранном здесь языке.",

  "translate.button.label": "Перевести",
  "translate.button.translating": "Переводим…",
  "translate.button.showOriginal": "Показать оригинал",
  "translate.button.showTranslation": "Показать перевод",
  "translate.button.translatedFrom": "Перевод с языка: {lang}",
  "translate.button.machine": "машинный перевод",
  "translate.button.cached": "сохранённый ответ",
  "translate.button.retry": "Повторить",
  "translate.button.failed": "Сервис перевода сейчас недоступен.",
  "translate.button.throttled":
    "Слишком много переводов подряд. Попробуйте через минуту.",
  "translate.button.signIn": "Войдите, чтобы перевести этот текст.",
  "translate.button.tooLong":
    "Этот текст длиннее {max_chars} символов, перевести его нельзя.",
  "translate.button.batchRefused":
    "За один раз отправлено слишком много текста. Попробуйте с меньшим объёмом.",
  "translate.button.unsupported":
    "Этот сайт не переводит на язык {language}.",
  "translate.button.sameLanguage": "Этот текст уже на вашем языке.",
  "translate.button.unavailable": "На этом сайте перевод текстов не подключён.",
  "translate.button.nothing": "Здесь нечего переводить.",

  "translate.dialog.dismiss": "Закрыть",
  "translate.dialog.target": "Перевести на",

  "translate.nav.language": "Язык",
};

/**
 * Register the Russian bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerTranslateI18nRu(
  engine: I18nEngine,
  locale = "ru"
): void {
  engine.registerBundle(locale, translateI18nBundleEn);
  engine.registerBundle(locale, translateI18nBundleRu);
}
