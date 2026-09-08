import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { attributesErrorBundleRu } from "./generated/errors.ru.gen.js";

export { attributesErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle — the `@stapel/attributes-react/i18n/ru` subpath, opt-in
 * (i18n-shipping.md §2): the main entry does not import this module, so a
 * host that does not register it never carries these strings (gated by
 * size-limit).
 *
 * ── Where the error strings come from ──────────────────────────────────────
 *
 * From upstream, as of stapel-attributes 0.9.4. The thirteen
 * `error.400.feature_*` / `error.400.description_*` lines that used to be
 * authored HERE are deleted: this library shipped
 * `translations/errors.{ru,es}.json` from 0.9.3, and 0.9.4 added the
 * `docs/errors.json` registry that lets `pnpm gen:errors` read them — so the
 * spread below carries all thirteen, plus the forty-two cross-cutting
 * `stapel_core` keys merged in from core's own catalogue, and this file
 * authors none of them. One refusal, one sentence, one source, with a drift
 * gate (`pnpm gen:errors:check`) that owns it.
 *
 * The thirteen belong to THIS pair and to no other. `@stapel/listings-react`
 * and `@stapel/categories-react` both keep `stapel_attributes` in
 * `ERRORS_LOCALE_EXEMPT_OWNERS`, so neither emits them — which matters more
 * than it reads: `registerListingsI18nRu` calls `registerAttributesI18nRu`
 * and then registers its own bundle AFTER it, so a duplicate over there would
 * silently win and nothing on screen would say which of the two sentences a
 * seller had been shown.
 *
 * PROVENANCE, stated rather than implied: upstream's catalogue and core's
 * both ship `origin=seed:authored` and are UNREVIEWED; the UI copy below is
 * pair-authored and the same grade. None of it is a claim of review.
 */
export const attributesI18nBundleRu: I18nDictionary = {
  ...attributesErrorBundleRu,

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
  "attributes.picker.recommended": "Рекомендуемые",
  "attributes.picker.all_options": "Все варианты",
  "attributes.picker.refine": "Продолжайте вводить, чтобы сузить список.",
  "attributes.ref.parent_first": "Сначала выберите «{parent}».",
  "attributes.baked": "Определено выбранными параметрами.",
  "attributes.int.out_of_allowed": "Не вписывается в границы: допустимо от {min} до {max}.",
  "attributes.int.out_of_allowed_for": "Для этого сочетания ({parents}) допустимо от {min} до {max}.",
  "attributes.int.step_up": "Следующее допустимое значение",
  "attributes.int.step_down": "Предыдущее допустимое значение",
  "attributes.int.choose_value": "Выбрать из допустимых значений",
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
