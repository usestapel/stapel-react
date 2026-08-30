import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { vocabulariesErrorBundleRu } from "./generated/errors.ru.gen.js";
import { vocabulariesI18nBundleEn } from "./keys.js";

export { vocabulariesErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for vocabularies-react — shipped as the
 * `@stapel/vocabularies-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: a host that never registers it never carries these strings (the main
 * entry does not import this module).
 *
 * TWO SOURCES, ON PURPOSE. The generated `vocabulariesErrorBundleRu` covers the
 * 42 cross-cutting codes stapel-core owns and localizes. The 3 codes
 * stapel-vocabularies owns are NOT in it and cannot be: the module ships no
 * `translations/` directory at all, so the generator emits a `Partial` bundle
 * and says so in its own header (`ERRORS_LOCALE_EXEMPT_OWNERS`, the
 * stapel-geo / stapel-reviews precedent). They are authored below, beside the
 * UI copy. When upstream ships `translations/errors.ru.json`, those three
 * lines are deleted and the generated bundle covers them — the keys and the
 * texts do not move.
 */
export const vocabulariesI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for every key core owns.
  ...vocabulariesErrorBundleRu,

  // Backend error codes stapel-vocabularies owns — authored here (see above).
  "error.400.vocabularies_bad_parent":
    "На родительском уровне «{level}» нет термина «{parent}»",
  "error.404.vocabularies_level_not_found":
    "В справочнике «{vocabulary}» нет уровня «{level}»",
  "error.404.vocabularies_vocabulary_not_found": "Справочник не найден",

  // vocabularies-react UI
  "vocabularies.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "vocabularies.termSelect.placeholder": "Начните вводить для поиска…",
  "vocabularies.termSelect.noMatches": "Ничего не найдено.",
  "vocabularies.termSelect.unavailable.title": "Список не удалось загрузить",
  "vocabularies.termSelect.unavailable":
    "Значения для этого поля берутся из справочника, который здесь не подключён, и выбирать не из чего. Ответить на этот вопрос невозможно — сообщите, пожалуйста, об этом.",
};

/**
 * Register the Russian bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerVocabulariesI18nRu(
  engine: I18nEngine,
  locale = "ru"
): void {
  engine.registerBundle(locale, vocabulariesI18nBundleEn);
  engine.registerBundle(locale, vocabulariesI18nBundleRu);
}
