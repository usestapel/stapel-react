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

  "search.sort.label": "Сортировка",
  "search.sort.relevance": "По релевантности",
  "search.sort.newest": "Сначала новые",
  "search.sort.price_asc": "Сначала дешевле",
  "search.sort.price_desc": "Сначала дороже",
  "search.sort.distance": "Сначала ближние",
  "search.sort.server_chose": "Отсортировано: {sort}",

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
  "search.facets.not_counted": "не посчитано",
  "search.facets.drill_down_hint":
    "Рядом с каждым значением — сколько будет, если выбрать его вместо текущего.",
  "search.facets.range_from": "От",
  "search.facets.range_to": "До",
  "search.facets.range_apply": "Применить",

  "search.geo.title": "Где искать",
  "search.geo.radius_km": "В радиусе {km} км",
  "search.geo.clear": "Везде",
  "search.geo.box": "В показанной области",
  "search.geo.center": "Рядом с {lat}, {lon}",

  "search.url.issues_title": "Часть этой ссылки прочитать не удалось",
  "search.url.issue.not_a_number": "{param} — не число, параметр пропущен",
  "search.url.issue.geo_incomplete":
    "для точки нужны и lat, и lon — параметр пропущен",
  "search.url.issue.bbox_malformed":
    "для области нужны четыре числа (minLat,minLon,maxLat,maxLon) — параметр пропущен",
  "search.url.issue.range_malformed":
    "{param} — не диапазон вида from..to, параметр пропущен",

  "search.degraded.title": "Что этот поиск не смог сделать",
  "search.degraded.typo_tolerance":
    "Опечатки не исправлялись — используемый поисковый движок этого не умеет.",
  "search.degraded.phrase_synonyms":
    "Синонимы не подставлялись — используемый поисковый движок этого не умеет.",
  "search.degraded.exact_total": "Число результатов — оценка, а не точный счёт.",
  "search.degraded.exact_facet_counts": "Счётчики фильтров приблизительные.",
  "search.degraded.category_rollup":
    "В выдаче могут отсутствовать подкатегории — сервис категорий не ответил.",
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
};

/** Register the ru bundle. Call AFTER `registerSearchI18n` so it layers over
 * the en floor (merge priority = registration order). */
export function registerSearchI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", searchI18nBundleRu);
}
