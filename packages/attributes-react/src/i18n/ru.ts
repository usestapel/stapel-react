import type { I18nDictionary, I18nEngine } from "@stapel/core";

/**
 * Russian bundle — the `@stapel/attributes-react/i18n/ru` subpath, opt-in
 * (i18n-shipping.md §2): the main entry does not import this module, so a
 * host that does not register it never carries these strings (gated by
 * size-limit).
 *
 * PROVENANCE, stated rather than implied: stapel-attributes ships English
 * only (no `translations/` directory — which is why `gen:errors` runs with
 * `ERRORS_LOCALE_EXEMPT_OWNERS=stapel_attributes` for forms-react), so the
 * error copy below is pair-authored, not upstream, and unreviewed. Same grade
 * as forms-react's copy of the same twelve keys, and deliberately the same
 * WORDING — two pairs must not give one refusal two sentences.
 */
export const attributesI18nBundleRu: I18nDictionary = {
  "error.400.feature_below_minimum": "Значение меньше минимального для «{feature}»",
  "error.400.feature_above_maximum": "Значение больше максимального для «{feature}»",
  "error.400.feature_not_in_options":
    "Значение отсутствует среди допустимых вариантов для «{feature}»",
  "error.400.feature_invalid_type": "Неверный тип значения для «{feature}»",
  "error.400.feature_invalid_format": "Неверный формат значения для «{feature}»",
  "error.400.feature_mandatory_missing": "Поле «{feature}» обязательно для заполнения",
  "error.400.feature_unknown_type": "Неизвестный тип поля «{feature}»",
  "error.400.feature_not_allowed": "Поле «{feature}» здесь недопустимо",
  "error.400.feature_unknown": "Неизвестное поле «{feature}»",
  "error.400.feature_invalid_config": "Неверная конфигурация поля «{feature}»",
  "error.400.description_too_short": "Описание должно содержать не менее {min_length} символов",
  "error.400.description_too_long": "Описание должно содержать не более {max_length} символов",

  "attributes.unsupported_type":
    "В этой сборке нет редактора для типа характеристики «{type}», заполнить её здесь нельзя.",
  "attributes.submit.blocked.unsupported_type":
    "Часть характеристик нельзя заполнить на этой странице: {types}",
  "attributes.untyped_feature": "У характеристики не указан тип, редактировать её нельзя.",
  "attributes.value.not_set": "Не указано",
  "attributes.value.unreadable": "Значение типа «{type}» в этой сборке не отображается",
  "attributes.bool.yes": "Да",
  "attributes.bool.no": "Нет",
  "attributes.select.placeholder": "Выберите",
  "attributes.required": "Обязательно",
};

/** Register the `ru` bundle. Call AFTER `registerAttributesI18n` so it
 * overrides the English floor. */
export function registerAttributesI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, attributesI18nBundleRu);
}
