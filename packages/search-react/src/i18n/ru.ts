import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { searchErrorBundleRu } from "./generated/errors.ru.gen.js";

export { searchErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for search-react — the pair's `ru` locale, shipped as the
 * `@stapel/search-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale
 * is opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the bundle-purity
 * test).
 *
 * This is the storefront's DEFAULT language (storefront spec verdict F1:
 * ru-first), which is why it is the fullest of the three bundles and why the
 * wording is checked against what a marketplace visitor is actually being
 * told — "counts are approximate" has to sound like an explanation, not an
 * apology.
 *
 * Composition mirrors `searchI18nBundleEn`: the GENERATED backend error texts
 * (stapel-search's `translations/errors.ru.json` merged under stapel-core's
 * cross-cutting catalogue — `pnpm gen:errors`) are spread first for coverage
 * by construction; the ru UI copy follows.
 *
 * PROVENANCE, stated rather than implied: the backend catalogues ship
 * `origin=seed:authored` and are UNREVIEWED; the pair-authored strings below
 * are the same grade. Neither is a claim of review.
 */
export const searchI18nBundleRu: I18nDictionary = {
  ...searchErrorBundleRu,

  "search.error.unknown": "Что-то пошло не так при поиске.",

  "search.results.title": "Результаты",
  "search.results.loading": "Ищем…",
  "search.results.load_failed": "Не удалось выполнить поиск.",
  "search.results.empty": "По этому запросу ничего не нашлось.",
  "search.results.retry": "Повторить",
  // Four forms, because Russian has four (1 / 2-4 / 5-20 / fractions). One
  // string here is wrong on most pages the storefront serves.
  "search.results.count_approximate.one": "Примерно {count} объявление",
  "search.results.count_approximate.few": "Примерно {count} объявления",
  "search.results.count_approximate.many": "Примерно {count} объявлений",
  "search.results.count_approximate.other": "Примерно {count} объявления",
  "search.results.count_at_least.one": "{count}+ объявление",
  "search.results.count_at_least.few": "{count}+ объявления",
  "search.results.count_at_least.many": "{count}+ объявлений",
  "search.results.count_at_least.other": "{count}+ объявления",
  "search.results.count_exact.one": "{count} объявление",
  "search.results.count_exact.few": "{count} объявления",
  "search.results.count_exact.many": "{count} объявлений",
  "search.results.count_exact.other": "{count} объявления",
  "search.results.took_ms": "{ms} мс",
  "search.results.next": "Следующая страница",
  "search.results.prev": "Предыдущая страница",
  "search.results.blocked.at_end": "Это последняя страница",
  "search.results.blocked.at_start": "Это первая страница",
  "search.results.window_exceeded":
    "Эта страница глубже, чем поиск умеет выдавать. Уточните запрос вместо перелистывания.",
  "search.results.promoted": "Продвигается",
  "search.results.promoted_hint":
    "Это платное размещение. Мы помечаем его, потому что так требует закон; на остальные результаты это не влияет.",
  "search.results.distance_km": "{km} км от вас",
  "search.results.untitled": "Без названия",
  "search.results.open": "Открыть",
  "search.results.image_alt": "Фото: {title}",
  "search.results.photo_alt": "Фото {index} из {total}: {title}",
  "search.results.photos": "Фотографии",
  "search.results.photo_unavailable": "Фото недоступно",

  "search.box.label": "Поиск",
  "search.box.placeholder": "Что ищете?",
  "search.box.submit": "Найти",
  "search.box.clear": "Очистить запрос",
  "search.box.suggestions": "Подсказки",
  "search.box.categories": "Разделы",
  "search.box.category_count.one": "{count} объявление",
  "search.box.category_count.few": "{count} объявления",
  "search.box.category_count.many": "{count} объявлений",
  "search.box.category_count.other": "{count} объявления",

  "search.sort.label": "Сортировка",
  "search.sort.relevance": "По релевантности",
  "search.sort.newest": "Сначала новые",
  "search.sort.price_asc": "Сначала дешевле",
  "search.sort.price_desc": "Сначала дороже",
  "search.sort.distance": "Сначала ближние",
  "search.sort.server_chose": "Отсортировано: {sort}",

  "search.view.label": "Вид",
  "search.view.list": "Списком",
  "search.view.grid": "Плиткой",

  "search.facets.title": "Фильтры",
  "search.facets.loading": "Загружаем фильтры…",
  "search.facets.load_failed": "Не удалось загрузить фильтры.",
  "search.facets.empty": "Для этого поиска фильтров нет.",
  "search.facets.clear": "Сбросить",
  "search.facets.clear_all": "Сбросить все фильтры ({count})",
  "search.facets.approximate":
    "Счётчики приблизительные — подходящих объявлений слишком много, чтобы пересчитать все.",
  "search.facets.skipped":
    "Эти фильтры для текущего поиска не посчитаны: {slugs}",
  "search.facets.withheld.one":
    "Ещё {count} фильтр подходит слишком малой части результатов",
  "search.facets.withheld.few":
    "Ещё {count} фильтра подходят слишком малой части результатов",
  "search.facets.withheld.many":
    "Ещё {count} фильтров подходят слишком малой части результатов",
  "search.facets.withheld.other":
    "Ещё {count} фильтра подходят слишком малой части результатов",
  "search.facets.not_counted": "не посчитано",
  "search.facets.drill_down_hint":
    "Рядом с каждым значением — сколько будет, если выбрать его вместо текущего.",
  "search.range.price": "Цена",
  "search.facets.range_from": "От",
  "search.facets.range_to": "До",
  "search.facets.range_apply": "Применить",
  "search.facets.range_clear": "Сбросить",
  "search.facets.range_from_aria": "{feature}, от",
  "search.facets.range_to_aria": "{feature}, до",
  "search.facets.show_all": "Показать все ({count})",
  "search.facets.show_less": "Свернуть",
  "search.facets.search": "Найти фильтр",
  "search.facets.search_empty": "Среди фильтров такого нет",
  "search.facets.dictionary_search": "Найти значение",
  "search.facets.dictionary_empty": "Такого значения здесь нет",
  "search.facets.dictionary_chosen": "Выбрано",
  "search.facets.dictionary_any": "Любая",
  "search.facets.all_filters": "Все фильтры ({count})",
  "search.facets.range_bounds": "от {min} до {max}",
  "search.facets.popular_all": "Все",
  "search.partition.all": "Все",
  "search.partition.label": "Раздел",
  "search.facets.match_count.one": "Найдено {count} объявление",
  "search.facets.match_count.few": "Найдено {count} объявления",
  "search.facets.match_count.many": "Найдено {count} объявлений",
  "search.facets.match_count.other": "Найдено {count} объявления",
  "search.facets.range_invalid":
    "«От» больше, чем «до», — под такой диапазон ничего не подойдёт. Поменяйте значения местами.",

  "search.filters.open": "Фильтры ({count})",
  "search.filters.apply": "Показать результаты",
  "search.filters.show_count.one": "Показать {count} объявление",
  "search.filters.show_count.few": "Показать {count} объявления",
  "search.filters.show_count.many": "Показать {count} объявлений",
  "search.filters.show_count.other": "Показать {count} объявления",
  "search.filters.show_count_at_least.one": "Показать {count}+ объявление",
  "search.filters.show_count_at_least.few": "Показать {count}+ объявления",
  "search.filters.show_count_at_least.many": "Показать {count}+ объявлений",
  "search.filters.show_count_at_least.other": "Показать {count}+ объявления",
  "search.filters.dismiss": "Закрыть фильтры",
  "search.filters.chips_label": "Фильтры",
  "search.filters.all": "Все фильтры",
  "search.filters.short": "Фильтры",
  "search.filters.chip_more": ", +{count}",
  "search.filters.chips_overflow": "Ещё {count}",

  "search.empty.exits_title": "Попробуйте расширить поиск",
  "search.empty.up_a_level": "Подняться на уровень выше",
  "search.empty.widen_radius": "Искать в радиусе {km} км",
  "search.empty.anywhere": "Искать везде",
  "search.empty.drop_filter": "Без «{name}»",
  "search.category.title": "Категория",
  "search.category.clear": "Искать по всему каталогу",
  "search.category.current": "Ищем внутри {path}",

  "search.language.label": "Язык запроса",
  "search.language.any": "Любой язык",

  "search.limit.label": "На странице",
  "search.limit.option": "{count} на странице",
  "search.limit.from_link": "Размер страницы задан этой ссылкой.",

  "search.geo.title": "Где искать",
  "search.geo.radius_km": "В радиусе {km} км",
  "search.geo.radius_km_short": "{km} км",
  "search.geo.radius_label": "Радиус, км",
  "search.geo.clear": "Везде",
  "search.geo.near_me": "Рядом со мной",
  "search.geo.everywhere": "Ищем везде",
  "search.geo.box": "В показанной области",
  "search.geo.chosen_place": "Выбранное место на карте",
  "search.geo.near_you": "Рядом с вами",

  "search.url.issues_title": "Часть этой ссылки прочитать не удалось",
  "search.url.issue.not_a_number":
    "«{param}» в этой ссылке — не число, поэтому параметр пропущен",
  "search.url.issue.geo_incomplete":
    "точка в этой ссылке указана наполовину, поэтому она пропущена",
  "search.url.issue.bbox_malformed":
    "область на карте в этой ссылке указана не полностью, поэтому она пропущена",
  "search.url.issue.range_malformed":
    "диапазону «{param}» в этой ссылке не хватает чисел, поэтому он пропущен",
  "search.url.issue.radius_without_place":
    "в ссылке задан радиус, но не задано место, поэтому пока ничего не сузилось — выберите место, и применится именно этот радиус",

  "search.degraded.title": "Что этот поиск не смог сделать",
  "search.degraded.typo_tolerance":
    "Опечатки не исправлялись — используемый поисковый движок этого не умеет.",
  "search.degraded.phrase_synonyms":
    "Синонимы не подставлялись — используемый поисковый движок этого не умеет.",
  "search.degraded.exact_total": "Число результатов — оценка, а не точный счёт.",
  "search.degraded.exact_facet_counts": "Счётчики фильтров приблизительные.",
  "search.degraded.category_rollup":
    "В выдаче могут отсутствовать подкатегории — сервис категорий не ответил.",
  "search.degraded.facet_plan_evidence":
    "Не удалось определить, какие фильтры подходят этим результатам, — их может быть больше, чем показано.",
  "search.degraded.scorer":
    "Параметр ранжирования «{scorer}» не применялся — используемый движок не умеет его считать.",
  "search.degraded.unknown":
    "Поиск сообщил об ограничении, для которого у этой страницы нет формулировки: {raw}",

  "search.ranking.title": "Как упорядочены результаты",
  "search.ranking.intro":
    "Ниже — параметры, которые определяют порядок выдачи, и их относительный вес.",
  "search.ranking.loading": "Загружаем раскрытие ранжирования…",
  "search.ranking.load_failed": "Не удалось загрузить раскрытие ранжирования.",
  "search.ranking.empty": "В этой установке параметры ранжирования не объявлены.",
  "search.ranking.parameter": "Параметр",
  "search.ranking.weight": "Вес",
  "search.ranking.applies_to": "Применяется к",
  "search.ranking.inactive": "Не применяется: {reason}",
  "search.ranking.notes": "Примечания",
  "search.ranking.link": "Как упорядочены результаты",

  "search.nav.results": "Поиск",
  "search.nav.ranking": "Порядок результатов",
  "search.nav.ranking.short": "Порядок",
};

/** Register the ru bundle. Call AFTER `registerSearchI18n` so it layers over
 * the en floor (merge priority = registration order). */
export function registerSearchI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", searchI18nBundleRu);
}
