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
  "error.400.feature_invalid_rules": "Неверные условия отображения поля «{feature}»",
  "error.400.feature_mandatory_missing": "Поле «{feature}» обязательно для заполнения",
  "error.400.feature_unknown_type": "Неизвестный тип поля «{feature}»",
  "error.400.feature_not_allowed": "Поле «{feature}» здесь недопустимо",
  "error.400.feature_unknown": "Неизвестное поле «{feature}»",
  "error.400.feature_invalid_config": "Неверная конфигурация поля «{feature}»",
  "error.400.description_too_short": "Описание должно содержать не менее {min_length} символов",
  "error.400.description_too_long": "Описание должно содержать не более {max_length} символов",

  "attributes.unsupported_type": "Эту характеристику здесь пока нельзя заполнить.",
  "attributes.submit.blocked.unsupported_type":
    "Часть характеристик нельзя заполнить на этой странице: {features}",
  "attributes.submit.blocked.invalid": "Проверьте отмеченные поля, прежде чем продолжить.",
  "attributes.untyped_feature": "Характеристика настроена неверно, заполнить её нельзя.",
  "attributes.value.not_set": "Не указано",
  "attributes.value.unreadable": "Это значение здесь не отображается",
  "attributes.value.provided": "Указано продавцом",
  "attributes.value.verified": "Проверено",
  "attributes.visibility.not_published": "Не публикуется",
  "attributes.visibility.owner":
    "Это поле видите вы и модераторы; покупателям оно не показывается.",
  "attributes.visibility.staff":
    "Это поле видят только модераторы — вам оно обратно тоже не показывается.",
  "attributes.bool.yes": "Да",
  "attributes.bool.no": "Нет",
  "attributes.select.placeholder": "Выберите",
  "attributes.locked": "Значение задано каталогом — изменить его здесь нельзя.",
  "attributes.select.min_selected": "Выберите не менее {count}.",
  "attributes.select.max_selected": "Выберите не более {count}.",
  "attributes.picker.done": "Готово",
  "attributes.picker.search": "Поиск",
  "attributes.picker.recent": "Недавние",
  "attributes.picker.refine": "Продолжайте вводить, чтобы сузить список.",
  "attributes.ref.parent_first": "Сначала выберите «{parent}».",
  "attributes.baked": "Определено выбранными параметрами.",
  "attributes.int.out_of_allowed": "Не вписывается в границы: допустимо от {min} до {max}.",
  "attributes.int.step_up": "Следующее допустимое значение",
  "attributes.int.step_down": "Предыдущее допустимое значение",
  "attributes.help.more": "Как заполнить",
  "attributes.hint.range": "От {min} до {max}.",
  "attributes.hint.min": "От {min}.",
  "attributes.hint.max": "До {max}.",
  "attributes.color.exact": "Точный оттенок",
  "attributes.unit": "Единица измерения",
  "attributes.vocabulary_unavailable": "Эту характеристику здесь пока нельзя заполнить.",
  "attributes.vocabulary.no_matches": "Ничего не найдено",
  "attributes.invalid_rules": "Характеристика настроена неверно, заполнить её нельзя.",
  "attributes.group.row": "Строка {index}",
  "attributes.group.add_row": "Добавить строку",
  "attributes.group.remove_row": "Удалить",
  "attributes.group.at_max_rows": "Больше {count} строк здесь добавить нельзя.",
};

/** Register the `ru` bundle. Call AFTER `registerAttributesI18n` so it
 * overrides the English floor. */
export function registerAttributesI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, attributesI18nBundleRu);
}
