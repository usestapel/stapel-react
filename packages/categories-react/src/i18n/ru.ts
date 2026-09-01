import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { categoriesErrorBundleRu } from "./generated/errors.ru.gen.js";

export { categoriesErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for categories-react — the `@stapel/categories-react/i18n/ru`
 * subpath (i18n-shipping.md §2) so the locale is opt-in: hosts that do not
 * register it never carry these strings (the main entry does not import this
 * module — gated by size-limit + the bundle-purity test).
 *
 * This is the storefront's DEFAULT language (storefront spec verdict F1:
 * ru-first).
 *
 * ── What comes from where ──────────────────────────────────────────────────
 *
 * `stapel-categories` ships **no `translations/` directory at all**, so 20 of
 * the 62 registry codes can never come from an upstream catalogue. They split
 * by owner, and the split is the whole point:
 *
 *  - the 42 cross-cutting `stapel_core` codes are GENERATED, merged in from
 *    stapel-core's own catalogue by `pnpm gen:errors` (spread first below);
 *  - the **8 `stapel_categories` codes** are authored here — and when upstream
 *    ships a catalogue, eight lines are deleted and no key or text moves;
 *  - the **12 `stapel_attributes` codes** are NOT here. They belong to
 *    `@stapel/attributes-react`, which already translates them and which is a
 *    peer of this pair anyway. Two pairs must not give one refusal two
 *    sentences (§13.2 note 3). A host registers both bundles;
 *    `test/i18n.test.ts` proves the union covers the registry.
 *
 * PROVENANCE, stated rather than implied: the core catalogue ships
 * `origin=seed:authored` and is UNREVIEWED; the pair-authored strings below
 * are the same grade. Neither is a claim of review.
 *
 * And once more, because it is the fact this pair exists to be honest about:
 * **no category name is translated here.** Category and feature names arrive
 * as translation KEYS (`catalog/labels.ts`) and belong in the deployment's own
 * bundle, not in a library's.
 */
export const categoriesI18nBundleRu: I18nDictionary = {
  ...categoriesErrorBundleRu,

  // ── the 8 stapel_categories-owned codes, pair-authored ───────────────────
  "error.400.categories_config_required": "Требуется объект config.",
  "error.400.categories_database_error":
    "Ошибка базы данных при сохранении изменений.",
  "error.400.categories_duplicate_slug":
    "Характеристика со слагом «{slug}» уже существует.",
  "error.400.categories_expected_list": "Ожидался список объектов.",
  "error.400.categories_feature_editor_invalid":
    "Некорректный запрос редактора характеристик: {reason}",
  "error.400.categories_invalid_conversion":
    "Недопустимое преобразование типа (поддерживается только select ↔ string).",
  "error.400.categories_not_deleted": "Категория не удалена.",
  "error.409.categories_feature_editor_conflict":
    "Категорию изменил другой редактор (ожидалась ревизия {expected}, сейчас {actual}); перезагрузите страницу и повторите.",

  "categories.error.unknown": "Что-то пошло не так с каталогом.",

  "categories.catalog.title": "Каталог",
  "categories.catalog.loading": "Загружаем каталог…",
  "categories.catalog.load_failed": "Не удалось загрузить каталог.",
  "categories.catalog.empty": "В каталоге пока нет категорий.",
  "categories.catalog.retry": "Повторить",
  "categories.catalog.truncated":
    "Это часть каталога — остальные категории ещё загружаются.",
  "categories.catalog.refreshing": "Проверяем изменения в каталоге…",
  "categories.catalog.as_of": "Каталог на ревизию {revision}",

  "categories.category.title": "Категория",
  "categories.category.unknown_slug": "По этому адресу нет категории.",
  "categories.category.unknown_slug_hint":
    "Возможно, адрес устарел.",
  "categories.category.back_to_catalog": "Вернуться в каталог",
  "categories.category.subcategories": "Подкатегории",
  "categories.category.subcategories_count.one": "{count} подкатегория",
  "categories.category.subcategories_count.few": "{count} подкатегории",
  "categories.category.subcategories_count.many": "{count} подкатегорий",
  "categories.category.subcategories_count.other": "{count} подкатегории",
  "categories.category.no_subcategories": "У этой категории нет подкатегорий.",
  "categories.category.open": "Открыть",

  "categories.breadcrumbs.root": "Все категории",
  "categories.breadcrumbs.label": "Вы здесь",

  "categories.carousel.title": "Категории",
  "categories.carousel.loading": "Загружаем категории…",
  "categories.carousel.load_failed": "Не удалось загрузить категории.",
  "categories.carousel.empty": "Сейчас ни одна категория не вынесена на витрину.",

  "categories.tiles.all": "Все",

  "categories.search.hits_title": "Категории по запросу «{query}»",

  "categories.quick_search.cta": "Показать объявления",
  "categories.quick_search.cta_count.one": "Показать {count} объявление",
  "categories.quick_search.cta_count.few": "Показать {count} объявления",
  "categories.quick_search.cta_count.many": "Показать {count} объявлений",
  "categories.quick_search.cta_count.other": "Показать {count} объявления",
  "categories.quick_search.cta_count_at_least.one": "Показать {count}+ объявление",
  "categories.quick_search.cta_count_at_least.few": "Показать {count}+ объявления",
  "categories.quick_search.cta_count_at_least.many": "Показать {count}+ объявлений",
  "categories.quick_search.cta_count_at_least.other": "Показать {count}+ объявления",

  "categories.picker.title": "Категория",
  "categories.picker.search": "Поиск по категориям",
  "categories.picker.loading": "Загружаем категории…",
  "categories.picker.load_failed": "Не удалось загрузить категории.",
  "categories.picker.no_matches": "Ни одна категория не подходит.",
  "categories.picker.up": "На уровень выше",
  "categories.picker.selected": "Выбрано: {category}",
  "categories.picker.choose": "Выберите категорию",
  "categories.picker.done": "Готово",
  "categories.picker.blocked.nothing_selected": "Сначала выберите категорию.",
  "categories.picker.blocked.not_a_leaf":
    "Выберите категорию точнее — у этой есть подкатегории, а от них зависит, какие характеристики спросят.",

  "categories.cascade.choose": "Выберите",
  "categories.cascade.blocked.nothing_selected":
    "Уточняйте, пока не дойдёте до последнего уровня.",

  "categories.features.title": "Характеристики в этой категории",
  "categories.features.loading": "Загружаем характеристики…",
  "categories.features.load_failed": "Не удалось загрузить характеристики.",
  "categories.features.empty":
    "В этой категории не нужно заполнять дополнительные характеристики.",
  "categories.features.mandatory": "Обязательно",
  "categories.features.type.string": "Текст",
  "categories.features.type.int": "Целое число",
  "categories.features.type.float": "Число",
  "categories.features.type.bool": "Да или нет",
  "categories.features.type.select": "Выбор",
  "categories.features.type.date": "Дата",
  "categories.features.type.header": "Заголовок раздела",
  "categories.features.type.hex_color": "Цвет",
  "categories.features.type.hierarchical_select": "Вложенный выбор",
  "categories.features.type.convertible_unit": "Величина с единицей",
  "categories.features.type.other": "Другая характеристика",
  "categories.features.untyped":
    "У этой характеристики нет типа, показать её нельзя.",
};

/** Register the `ru` bundle. Call AFTER `registerCategoriesI18n` so it
 * overrides the English floor. */
export function registerCategoriesI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, categoriesI18nBundleRu);
}
