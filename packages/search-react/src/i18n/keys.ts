import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { searchErrorBundleEn } from "./generated/errors.gen.js";

/**
 * search-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's
 * i18n engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for the 54 backend error codes (generated) plus the
 * pair's own UI keys. All UI keys live under the `search.` namespace.
 *
 * ── What is NOT an i18n key here ───────────────────────────────────────────
 *
 * A FACET VALUE is not one. `facets.py` returns `{value: count}` — index
 * terms, not keys. Their captions come from the category's feature schema
 * (`config.options[].label`, which IS a key when `translatable_options` is
 * on) and are resolved by `facetOptionLabel` through
 * `@stapel/attributes-react`, i.e. through the same formatter the card and
 * the spec table use. Nothing in this file names a catalogue value, because
 * a catalogue is a deployment's content, not a library's chrome.
 */
export const SEARCH_I18N_KEYS = {
  unknownError: "search.error.unknown",

  // ── results ──────────────────────────────────────────────────────────────
  resultsTitle: "search.results.title",
  resultsLoading: "search.results.loading",
  resultsLoadFailed: "search.results.load_failed",
  resultsEmpty: "search.results.empty",
  resultsRetry: "search.results.retry",
  /**
   * "About N results" — the sentence for an ESTIMATED count. A PLURAL
   * FAMILY: render with `tPlural`, never `t` (see SEARCH_I18N_PLURAL_KEYS).
   *
   * @deprecated stapel-search 0.2.0 stopped producing estimates: a count is
   * exact, a FLOOR (`resultsCountAtLeast`), or absent. Kept so a host that
   * translated it keeps a working key, and no longer rendered by the skin.
   */
  resultsCountApproximate: "search.results.count_approximate",
  /** "N+ results" — a LOWER BOUND: at least this many match, possibly more.
   * A PLURAL FAMILY. Never render a floor as a plain number. */
  resultsCountAtLeast: "search.results.count_at_least",
  /** "N results" — only when `exact_total` is true. A PLURAL FAMILY. */
  resultsCountExact: "search.results.count_exact",
  resultsTookMs: "search.results.took_ms",
  resultsNext: "search.results.next",
  resultsPrev: "search.results.prev",
  resultsBlockedAtEnd: "search.results.blocked.at_end",
  resultsBlockedAtStart: "search.results.blocked.at_start",
  /** The refusal that must NOT read as "nothing found". */
  resultsWindowExceeded: "search.results.window_exceeded",
  resultsPromoted: "search.results.promoted",
  resultsPromotedHint: "search.results.promoted_hint",
  resultsDistanceKm: "search.results.distance_km",
  resultsUntitled: "search.results.untitled",
  resultsOpen: "search.results.open",
  /** Alt text for the card photo — the card's own title, in a sentence. */
  resultsImageAlt: "search.results.image_alt",
  /** Alt text for one photo of a GALLERY: its place in the strip, and the
   * card's title. A row of ten photos all called "Photo of X" is ten
   * identical announcements. */
  resultsPhotoAlt: "search.results.photo_alt",
  /** The photo strip's accessible name. `SkinCarousel` takes its label from
   * the caller for exactly this reason: the token bridge owns no i18n. */
  resultsPhotos: "search.results.photos",
  /** The card stores a reference and nothing resolved it — a sentence gets
   * the wiring fixed; an empty grey box teaches nobody anything. */
  resultsPhotoUnavailable: "search.results.photo_unavailable",

  // ── the query box ────────────────────────────────────────────────────────
  boxLabel: "search.box.label",
  boxPlaceholder: "search.box.placeholder",
  boxSubmit: "search.box.submit",
  boxClear: "search.box.clear",
  /** Accessible name of the suggestion list under the box. */
  boxSuggestions: "search.box.suggestions",
  /**
   * The heading over the CATEGORY half of the type-ahead (stapel-search
   * 0.7.0). The rows under it are DESTINATIONS — a section of the catalogue —
   * and not, like everything else in the menu, another set of words to search
   * for; a group with no heading would read as more of the same.
   */
  boxCategories: "search.box.categories",
  /**
   * "1 240 listings" beside a category row — how many LIVE listings a buyer
   * would see there, the same number the SERP reports for it.
   *
   * A PLURAL FAMILY: render with `tPlural`, never `t`. It counts a noun in
   * words, so Russian needs its four endings and a single string would be
   * right only for 5-20 — the exact defect the results count already fixed.
   */
  boxCategoryCount: "search.box.category_count",

  // ── sort ─────────────────────────────────────────────────────────────────
  sortLabel: "search.sort.label",
  sortRelevance: "search.sort.relevance",
  sortNewest: "search.sort.newest",
  sortPriceAsc: "search.sort.price_asc",
  sortPriceDesc: "search.sort.price_desc",
  sortDistance: "search.sort.distance",
  sortServerChose: "search.sort.server_chose",

  // ── how the results are ARRANGED (see ViewSwitch) ────────────────────────
  /** The switch's own accessible name — a `Segmented` renders a radiogroup
   * with no `<label for>` to name it. */
  viewLabel: "search.view.label",
  viewList: "search.view.list",
  viewGrid: "search.view.grid",

  // ── facets ───────────────────────────────────────────────────────────────
  facetsTitle: "search.facets.title",
  facetsLoading: "search.facets.loading",
  facetsLoadFailed: "search.facets.load_failed",
  facetsEmpty: "search.facets.empty",
  facetsClear: "search.facets.clear",
  facetsClearAll: "search.facets.clear_all",
  facetsApproximate: "search.facets.approximate",
  facetsSkipped: "search.facets.skipped",
  /** Shown INSTEAD of a count for a slug the server did not count. */
  facetsNotCounted: "search.facets.not_counted",
  facetsDrillDownHint: "search.facets.drill_down_hint",
  facetsRangeFrom: "search.facets.range_from",
  facetsRangeTo: "search.facets.range_to",
  facetsRangeApply: "search.facets.range_apply",
  facetsRangeClear: "search.facets.range_clear",
  /** Accessible names: the visible "From"/"To" repeat on every row, so the
   * field's own name has to carry the feature it belongs to. */
  facetsRangeFromAria: "search.facets.range_from_aria",
  facetsRangeToAria: "search.facets.range_to_aria",
  /** The reason "Apply" is off: the range reads backwards. */
  facetsRangeInvalid: "search.facets.range_invalid",
  /** A CORE range axis has no FeatureDef and so no `name` to translate.
   * `search.range.<slug>`; `price` is the one stapel-search ships. */
  rangePrice: "search.range.price",
  /** The fold on a long facet group: "Show all (46)". The number is in
   * brackets and not a counted noun, so this is one message and not a plural
   * family — "(1)" never renders, because a group is only folded when the
   * tail is longer than one row. */
  facetsShowAll: "search.facets.show_all",
  facetsShowLess: "search.facets.show_less",

  // ── the filter panel as a whole (phone sheet + host slots) ───────────────
  filtersOpen: "search.filters.open",
  /** The sheet's commit button when the count is unknown. */
  filtersApply: "search.filters.apply",
  /** "Show N results" — an EXACT count on the sheet's commit button.
   * A PLURAL FAMILY. */
  filtersShowCount: "search.filters.show_count",
  /** "Show N+ results" — a FLOOR on the same button. A PLURAL FAMILY. */
  filtersShowCountAtLeast: "search.filters.show_count_at_least",
  filtersDismiss: "search.filters.dismiss",
  /** The accessible name of the phone chip ROW — a `role="group"` holding a
   * dozen buttons is announced as nothing at all without one. */
  filtersChipsLabel: "search.filters.chips_label",
  /** The leading, icon-only chip: the whole panel. Icon-only means the name
   * exists ONLY here, so this key is the control's entire accessibility. */
  filtersAll: "search.filters.all",
  /** The same door, named for a 390px row: the location line's trailing link
   * sits beside a place name and cannot spend six characters on "All". */
  filtersShort: "search.filters.short",
  /** A chip filtering on more than one value: "Bosch, +2". Not a plural
   * family — nothing is being counted in words. */
  filtersChipMore: "search.filters.chip_more",

  // ── the way OUT of a search that found nothing ───────────────────────────
  /** Caption above the exit buttons. Not a second "nothing found" — that
   * sentence has already been said; this one says what can be done next. */
  emptyExitsTitle: "search.empty.exits_title",
  /** Drop the last segment of the category path. Deliberately unnamed: the
   * pair holds a path of slugs or ids and cannot name the parent, and a
   * guessed name on a navigation control is worse than an honest direction. */
  emptyUpALevel: "search.empty.up_a_level",
  /** "Search within {km} km" — the widened radius, already multiplied. */
  emptyWidenRadius: "search.empty.widen_radius",
  /** Drop the location constraint. Distinct from `search.geo.clear`, which
   * labels the same action inside the location picker: here it is one exit
   * among several and has to name the constraint it removes. */
  emptyAnywhere: "search.empty.anywhere",
  /** "Without {name}" — one applied filter, named as its own chip names it. */
  emptyDropFilter: "search.empty.drop_filter",

  // ── category (a host slot, plus the control that removes it) ─────────────
  categoryTitle: "search.category.title",
  categoryClear: "search.category.clear",
  categoryCurrent: "search.category.current",

  // ── language of the query ────────────────────────────────────────────────
  languageLabel: "search.language.label",
  languageAny: "search.language.any",

  // ── page size ────────────────────────────────────────────────────────────
  limitLabel: "search.limit.label",
  limitOption: "search.limit.option",
  /** Said beside the control when the URL carries a size the ladder does not
   * offer — otherwise the story of "we kept your link's size" is invisible. */
  limitFromLink: "search.limit.from_link",

  // ── geo ──────────────────────────────────────────────────────────────────
  geoTitle: "search.geo.title",
  geoRadiusKm: "search.geo.radius_km",
  geoRadiusLabel: "search.geo.radius_label",
  geoClear: "search.geo.clear",
  /**
   * What `<LocationSummaryLine>` says when NO location is applied.
   *
   * Not `search.geo.clear` reused: that is the label on a BUTTON that widens
   * the search ("Anywhere"), and this is a STATEMENT about where the search is
   * currently looking. The two are the same word in English and diverge the
   * moment a translator treats one as an imperative — which is exactly the
   * class of bug a shared key produces and nobody sees in the source locale.
   */
  geoEverywhere: "search.geo.everywhere",
  geoBox: "search.geo.box",
  /**
   * What a location constraint is called when nobody has given it a NAME.
   *
   * It replaces `search.geo.center` ("Around {lat}, {lon}"), which printed the
   * two numbers the URL happens to store — `55.756, 37.617` — to a person who
   * chose a place. A coordinate is storage, not a description: it cannot be
   * checked by the one reader who could check an address, so a wrong point
   * reads as authoritative and a right one reads as machinery. Hosts that HAVE
   * the name (the geocoder that resolved it, the IP guess's city) pass
   * `geoLabel` and this sentence never appears.
   */
  geoChosenPlace: "search.geo.chosen_place",

  // ── the URL that could not be read ───────────────────────────────────────
  urlIssuesTitle: "search.url.issues_title",
  urlIssueNotANumber: "search.url.issue.not_a_number",
  urlIssueGeoIncomplete: "search.url.issue.geo_incomplete",
  urlIssueBboxMalformed: "search.url.issue.bbox_malformed",
  urlIssueRangeMalformed: "search.url.issue.range_malformed",

  // ── degradations (the envelope's `degraded[]`) ───────────────────────────
  degradedTitle: "search.degraded.title",
  degradedTypoTolerance: "search.degraded.typo_tolerance",
  degradedPhraseSynonyms: "search.degraded.phrase_synonyms",
  degradedExactTotal: "search.degraded.exact_total",
  degradedExactFacetCounts: "search.degraded.exact_facet_counts",
  degradedCategoryRollup: "search.degraded.category_rollup",
  degradedScorer: "search.degraded.scorer",
  degradedUnknown: "search.degraded.unknown",

  // ── ranking disclosure (P2B Art. 5) ──────────────────────────────────────
  rankingTitle: "search.ranking.title",
  rankingIntro: "search.ranking.intro",
  rankingLoading: "search.ranking.loading",
  rankingLoadFailed: "search.ranking.load_failed",
  rankingEmpty: "search.ranking.empty",
  rankingParameter: "search.ranking.parameter",
  rankingWeight: "search.ranking.weight",
  rankingAppliesTo: "search.ranking.applies_to",
  rankingInactive: "search.ranking.inactive",
  rankingNotes: "search.ranking.notes",
  rankingLink: "search.ranking.link",

  // ── nav (the destination's own name, not the page's heading) ─────────────
  /**
   * What the MENU calls the results screen.
   *
   * Separate from `search.results.title` on purpose. That key captions the
   * list of matches — a heading over rows, which is why it reads "Results" —
   * and a menu entry pointing at `/s` labelled "Results" tells a visitor
   * nothing about where they would be going: results of what? The destination
   * is the search itself. One key, one job; a translator asked to make
   * "Results" work as both a page heading and a menu label has to pick which
   * one to get wrong.
   */
  navResults: "search.nav.results",
  /** The menu name of the P2B disclosure PAGE — see {@link navResults} for
   * why it is not `search.ranking.title`, which is the page's own heading and
   * a whole sentence. */
  navRanking: "search.nav.ranking",
  /**
   * The compact form for a phone dock — see `NavEntry.shortLabelKey`. A
   * five-cell dock at 390px gives a destination roughly ten characters, and
   * "Ranking disclosure" ellipsizes to a fragment there.
   *
   * `search.nav.results` needs no short form: it is already one word in every
   * locale this pair ships, and declaring a short key identical to the long
   * one only gives a translator two strings to keep in sync.
   */
  navRankingShort: "search.nav.ranking.short",
} as const;

export type SearchI18nKey =
  (typeof SEARCH_I18N_KEYS)[keyof typeof SEARCH_I18N_KEYS];

/**
 * The keys above that are PLURAL FAMILIES rather than single messages.
 *
 * A family is catalogued as one flat key per CLDR category
 * (`<family>.one`, `…few`, `…many`, `…other`) and rendered with core's
 * `tPlural(family, { count })`, which asks `Intl.PluralRules` for the current
 * locale's category. Which categories a bundle carries is a fact about the
 * language — `en` needs two, `ru` needs four — so the pair's parity test asks
 * `Intl.PluralRules` which forms each locale can select and demands exactly
 * those, rather than checking a list somebody typed.
 *
 * The live defect this closes: the Russian estimate sentence was ONE string
 * doing the work of four, correct only for 5-20 and wrong for every 1, 2, 3
 * and 4 a result page actually shows.
 */
export const SEARCH_I18N_PLURAL_KEYS: readonly SearchI18nKey[] = [
  SEARCH_I18N_KEYS.resultsCountApproximate,
  SEARCH_I18N_KEYS.resultsCountAtLeast,
  SEARCH_I18N_KEYS.resultsCountExact,
  SEARCH_I18N_KEYS.filtersShowCount,
  SEARCH_I18N_KEYS.filtersShowCountAtLeast,
  SEARCH_I18N_KEYS.boxCategoryCount,
];

/**
 * English fallback bundle for search-react UI keys + backend error codes.
 * The generated backend texts are spread FIRST so coverage of the error
 * registry is by construction; the pair's own copy follows.
 */
export const searchI18nBundleEn: Record<string, string> = {
  ...searchErrorBundleEn,

  "search.error.unknown": "Something went wrong with the search",

  "search.results.title": "Results",
  "search.results.loading": "Searching…",
  "search.results.load_failed": "We could not run this search",
  "search.results.empty": "Nothing matches this search",
  "search.results.retry": "Try again",
  "search.results.count_approximate.one": "About {count} result",
  "search.results.count_approximate.other": "About {count} results",
  "search.results.count_at_least.one": "{count}+ result",
  "search.results.count_at_least.other": "{count}+ results",
  "search.results.count_exact.one": "{count} result",
  "search.results.count_exact.other": "{count} results",
  "search.results.took_ms": "{ms} ms",
  "search.results.next": "Next page",
  "search.results.prev": "Previous page",
  "search.results.blocked.at_end": "This is the last page",
  "search.results.blocked.at_start": "This is the first page",
  "search.results.window_exceeded":
    "This page is deeper than the search can go. Narrow the search instead of paging further.",
  "search.results.promoted": "Promoted",
  "search.results.promoted_hint":
    "This placement is paid for. It is marked because the law requires it, and it does not change what the other results are.",
  "search.results.distance_km": "{km} km away",
  "search.results.untitled": "Untitled",
  "search.results.open": "Open",
  "search.results.image_alt": "Photo of {title}",
  "search.results.photo_alt": "Photo {index} of {total}: {title}",
  "search.results.photos": "Photos",
  "search.results.photo_unavailable": "Photo unavailable",

  "search.box.label": "Search",
  "search.box.placeholder": "What are you looking for?",
  "search.box.submit": "Search",
  "search.box.clear": "Clear the search",
  "search.box.suggestions": "Suggestions",
  "search.box.categories": "Sections",
  "search.box.category_count.one": "{count} listing",
  "search.box.category_count.other": "{count} listings",

  "search.sort.label": "Sort",
  "search.sort.relevance": "Most relevant",
  "search.sort.newest": "Newest first",
  "search.sort.price_asc": "Price: low to high",
  "search.sort.price_desc": "Price: high to low",
  "search.sort.distance": "Nearest first",
  "search.sort.server_chose": "Sorted by {sort}",

  "search.view.label": "View",
  "search.view.list": "List",
  "search.view.grid": "Grid",

  "search.facets.title": "Filters",
  "search.facets.loading": "Loading filters…",
  "search.facets.load_failed": "We could not load the filters",
  "search.facets.empty": "This search offers no filters",
  "search.facets.clear": "Clear",
  "search.facets.clear_all": "Clear all filters ({count})",
  "search.facets.approximate":
    "Counts are approximate — there were too many candidates to count them all.",
  "search.facets.skipped":
    "These filters were not counted for this search: {slugs}",
  "search.facets.not_counted": "not counted",
  "search.facets.drill_down_hint":
    "Each count is what you would get by choosing that value instead of the one you have.",
  "search.range.price": "Price",
  "search.facets.range_from": "From",
  "search.facets.range_to": "To",
  "search.facets.range_apply": "Apply",
  "search.facets.range_clear": "Clear",
  "search.facets.range_from_aria": "{feature}, from",
  "search.facets.range_to_aria": "{feature}, up to",
  "search.facets.show_all": "Show all ({count})",
  "search.facets.show_less": "Show fewer",
  "search.facets.range_invalid":
    "“From” is larger than “to”, so nothing could match. Swap them to apply this range.",

  "search.filters.open": "Filters ({count})",
  "search.filters.apply": "Show results",
  "search.filters.show_count.one": "Show {count} result",
  "search.filters.show_count.other": "Show {count} results",
  "search.filters.show_count_at_least.one": "Show {count}+ result",
  "search.filters.show_count_at_least.other": "Show {count}+ results",
  "search.filters.dismiss": "Close the filters",
  "search.filters.chips_label": "Filters",
  "search.filters.all": "All filters",
  "search.filters.short": "Filters",
  "search.filters.chip_more": ", +{count}",

  "search.empty.exits_title": "Try widening the search",
  "search.empty.up_a_level": "Go up a level",
  "search.empty.widen_radius": "Search within {km} km",
  "search.empty.anywhere": "Search anywhere",
  "search.empty.drop_filter": "Without {name}",
  "search.category.title": "Category",
  "search.category.clear": "Search the whole catalogue",
  "search.category.current": "Searching inside {path}",

  "search.language.label": "Query language",
  "search.language.any": "Any language",

  "search.limit.label": "Per page",
  "search.limit.option": "{count} per page",
  "search.limit.from_link": "This link sets its own page size.",

  "search.geo.title": "Location",
  "search.geo.radius_km": "Within {km} km",
  "search.geo.radius_label": "Radius, km",
  "search.geo.clear": "Anywhere",
  "search.geo.everywhere": "Searching everywhere",
  "search.geo.box": "Inside the shown area",
  "search.geo.chosen_place": "A chosen place on the map",

  "search.url.issues_title": "Part of this link could not be read",
  "search.url.issue.not_a_number": "“{param}” in this link is not a number, so it was ignored",
  "search.url.issue.geo_incomplete":
    "the location in this link is only half there, so it was ignored",
  "search.url.issue.bbox_malformed":
    "the map area in this link is incomplete, so it was ignored",
  "search.url.issue.range_malformed":
    "the range “{param}” in this link needs two numbers, so it was ignored",

  "search.degraded.title": "What this search could not do",
  "search.degraded.typo_tolerance":
    "Typos were not corrected — the search engine in use cannot do it.",
  "search.degraded.phrase_synonyms":
    "Synonyms were not expanded — the search engine in use cannot do it.",
  "search.degraded.exact_total": "The number of results is an estimate.",
  "search.degraded.exact_facet_counts": "The filter counts are approximate.",
  "search.degraded.category_rollup":
    "Subcategories may be missing from these results — the category service did not answer.",
  "search.degraded.scorer":
    "The ranking parameter “{scorer}” was not applied — the search engine in use cannot evaluate it.",
  "search.degraded.unknown":
    "The search engine reported a limitation this page has no wording for: {raw}",

  "search.ranking.title": "How these results are ordered",
  "search.ranking.intro":
    "These are the parameters that determine the order of the results, with their relative weight.",
  "search.ranking.loading": "Loading the ranking disclosure…",
  "search.ranking.load_failed": "We could not load the ranking disclosure",
  "search.ranking.empty": "This deployment declares no ranking parameters",
  "search.ranking.parameter": "Parameter",
  "search.ranking.weight": "Weight",
  "search.ranking.applies_to": "Applies to",
  "search.ranking.inactive": "Not applied: {reason}",
  "search.ranking.notes": "Notes",
  "search.ranking.link": "How these results are ordered",

  "search.nav.results": "Search",
  "search.nav.ranking": "Ranking disclosure",
  "search.nav.ranking.short": "Ranking",
};

/**
 * Register the English bundle into a core i18n engine. Locale bundles ship as
 * opt-in subpaths (`@stapel/search-react/i18n/ru`, `…/es`) so a host that
 * needs only English never carries them.
 */
export function registerSearchI18n(i18n: I18nEngine): void {
  i18n.registerBundle("en", searchI18nBundleEn as I18nDictionary);
}
