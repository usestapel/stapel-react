import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { categoriesErrorBundleEn } from "./generated/errors.gen.js";

/**
 * categories-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's
 * i18n engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for the 62 backend error codes (generated) plus the pair's
 * own UI keys. All UI keys live under the `categories.` namespace.
 *
 * ── WHAT IS DELIBERATELY NOT IN THIS FILE ──────────────────────────────────
 *
 * **A category name.** `category.electronics` is a key, and it is a key this
 * library must never carry a text for: the catalogue is a deployment's
 * content, not a library's chrome, and no two marketplaces have the same tree.
 * `catalog/labels.ts` explains the mechanism in full — names arrive as keys
 * because no serializer runs the module's `DISPLAY_TRANSLATOR` seam — and the
 * pair's answer is to hand the key to the HOST's engine, whose bundle is where
 * a deployment's catalogue copy belongs. When the key does not resolve the key
 * is shown, on purpose: a visible `category.electronics` gets fixed, while a
 * prettified "Electronics" ships for a year in the wrong language.
 *
 * The same goes for a feature's name and its option labels.
 *
 * **The twelve `error.400.feature_*` / `description_too_*` keys.** They are
 * owned by `stapel_attributes` and translated by `@stapel/attributes-react`
 * (`/i18n/ru`, `/i18n/es`) — the package that also draws and validates those
 * values. Restating them here would give one refusal two sentences, which is
 * the exact thing §13.2's note 3 closed. A host registers both bundles; the
 * suite proves the union covers the whole registry.
 */
export const CATEGORIES_I18N_KEYS = {
  unknownError: "categories.error.unknown",

  // ── catalog / tree ───────────────────────────────────────────────────────
  catalogTitle: "categories.catalog.title",
  catalogLoading: "categories.catalog.loading",
  catalogLoadFailed: "categories.catalog.load_failed",
  catalogEmpty: "categories.catalog.empty",
  catalogRetry: "categories.catalog.retry",
  /** The sync walk hit its page budget — the tree on screen is incomplete. */
  catalogTruncated: "categories.catalog.truncated",
  catalogRefreshing: "categories.catalog.refreshing",
  catalogAsOf: "categories.catalog.as_of",

  // ── one category ─────────────────────────────────────────────────────────
  categoryTitle: "categories.category.title",
  categoryUnknownSlug: "categories.category.unknown_slug",
  /** What to do about an address that resolves to nothing. */
  categoryUnknownSlugHint: "categories.category.unknown_slug_hint",
  /** The way OUT of a dead address — the link the hint promises. */
  categoryBackToCatalog: "categories.category.back_to_catalog",
  categorySubcategories: "categories.category.subcategories",
  /**
   * "N subcategories" beside a tree row. A PLURAL FAMILY: render with
   * `tPlural`, never `t` (see {@link CATEGORIES_I18N_PLURAL_KEYS}). It
   * replaces a hover `title=` on the count badge — a number whose meaning was
   * available only to a mouse.
   */
  categorySubcategoriesCount: "categories.category.subcategories_count",
  /** A leaf: no sub-categories, and that is not an error. */
  categoryNoSubcategories: "categories.category.no_subcategories",
  categoryOpen: "categories.category.open",

  // ── breadcrumbs ──────────────────────────────────────────────────────────
  breadcrumbsRoot: "categories.breadcrumbs.root",
  breadcrumbsLabel: "categories.breadcrumbs.label",

  // ── carousel ─────────────────────────────────────────────────────────────
  carouselTitle: "categories.carousel.title",
  carouselLoading: "categories.carousel.loading",
  carouselLoadFailed: "categories.carousel.load_failed",
  carouselEmpty: "categories.carousel.empty",

  // ── tile grid (the phone landing's two scrolling rows) ───────────────────
  /** The leading tile, which links the catalogue root rather than a category. */
  tilesAll: "categories.tiles.all",

  // ── category hits for a free-text query ──────────────────────────────────
  /**
   * The heading over the categories a search query reached. Carries `{query}`,
   * because a list of category links above somebody else's results has to say
   * WHY it is there — without the typed words it reads as a second menu that
   * appeared on its own.
   */
  searchHitsTitle: "categories.search.hits_title",

  // ── quick search (the category landing's panel) ──────────────────────────
  /** The button when the count is absent, in flight, refused, or a number the
   * engine declined to give — the sentence that is true under every arm. */
  quickSearchCta: "categories.quick_search.cta",
  /**
   * "Show {count} listings" — an EXACT total. A PLURAL FAMILY: render with
   * `tPlural`, never `t` (see {@link CATEGORIES_I18N_PLURAL_KEYS}).
   */
  quickSearchCtaCount: "categories.quick_search.cta_count",
  /** "Show {count}+ listings" — a LOWER BOUND, never spelled as a total.
   * A PLURAL FAMILY. */
  quickSearchCtaAtLeast: "categories.quick_search.cta_count_at_least",

  // ── picker (the compose form's chooser) ──────────────────────────────────
  pickerTitle: "categories.picker.title",
  pickerSearch: "categories.picker.search",
  pickerLoading: "categories.picker.loading",
  pickerLoadFailed: "categories.picker.load_failed",
  pickerNoMatches: "categories.picker.no_matches",
  pickerUp: "categories.picker.up",
  pickerSelected: "categories.picker.selected",
  /** The phone trigger that opens the drill-down as a bottom sheet. */
  pickerChoose: "categories.picker.choose",
  /** Close the sheet, keeping whatever is chosen. */
  pickerDone: "categories.picker.done",
  pickerBlockedNothingSelected: "categories.picker.blocked.nothing_selected",
  pickerBlockedNotALeaf: "categories.picker.blocked.not_a_leaf",

  // ── feature schema ───────────────────────────────────────────────────────
  featuresTitle: "categories.features.title",
  featuresLoading: "categories.features.loading",
  featuresLoadFailed: "categories.features.load_failed",
  featuresEmpty: "categories.features.empty",
  featuresMandatory: "categories.features.mandatory",
  /** A feature's value TYPE as a word. `int`, `bool` and a host's own
   * `holo_signature` are this build's vocabulary, and they were reaching a
   * public category page as the badge's copy. Every known type has a word;
   * anything else says "another kind of detail" rather than its identifier. */
  featuresTypeString: "categories.features.type.string",
  featuresTypeInt: "categories.features.type.int",
  featuresTypeFloat: "categories.features.type.float",
  featuresTypeBool: "categories.features.type.bool",
  featuresTypeSelect: "categories.features.type.select",
  featuresTypeDate: "categories.features.type.date",
  featuresTypeHeader: "categories.features.type.header",
  featuresTypeColor: "categories.features.type.hex_color",
  featuresTypeNestedSelect: "categories.features.type.hierarchical_select",
  featuresTypeMeasurement: "categories.features.type.convertible_unit",
  featuresTypeOther: "categories.features.type.other",
  /** A feature whose `config` carries no `type` at all. */
  featuresUntyped: "categories.features.untyped",
} as const;

/**
 * Value type (as `config.type` spells it) → the key for its human word.
 * A type absent from this table is not a bug and not copy: it is a build the
 * catalogue is ahead of, and it renders {@link CATEGORIES_I18N_KEYS.featuresTypeOther}.
 */
export const FEATURE_TYPE_LABEL_KEYS: Readonly<Record<string, string>> = {
  string: CATEGORIES_I18N_KEYS.featuresTypeString,
  int: CATEGORIES_I18N_KEYS.featuresTypeInt,
  float: CATEGORIES_I18N_KEYS.featuresTypeFloat,
  bool: CATEGORIES_I18N_KEYS.featuresTypeBool,
  select: CATEGORIES_I18N_KEYS.featuresTypeSelect,
  date: CATEGORIES_I18N_KEYS.featuresTypeDate,
  header: CATEGORIES_I18N_KEYS.featuresTypeHeader,
  hex_color: CATEGORIES_I18N_KEYS.featuresTypeColor,
  hierarchical_select: CATEGORIES_I18N_KEYS.featuresTypeNestedSelect,
  convertible_unit: CATEGORIES_I18N_KEYS.featuresTypeMeasurement,
};

export type CategoriesI18nKey =
  (typeof CATEGORIES_I18N_KEYS)[keyof typeof CATEGORIES_I18N_KEYS];

/**
 * The keys above that are PLURAL FAMILIES rather than single messages.
 *
 * A family is catalogued as one flat key per CLDR category
 * (`<family>.one`, `…few`, `…many`, `…other`) and rendered with core's
 * `tPlural(family, { count })`, which asks `Intl.PluralRules` for the current
 * locale's category. Which categories a bundle carries is a fact about the
 * language — `en` needs two, `ru` needs four — so `test/i18n.test.ts` asks
 * `Intl.PluralRules` which forms each locale can select and demands exactly
 * those, rather than checking a list somebody typed.
 */
export const CATEGORIES_I18N_PLURAL_KEYS: readonly CategoriesI18nKey[] = [
  CATEGORIES_I18N_KEYS.categorySubcategoriesCount,
  CATEGORIES_I18N_KEYS.quickSearchCtaCount,
  CATEGORIES_I18N_KEYS.quickSearchCtaAtLeast,
];

/**
 * English fallback bundle for categories-react UI keys + backend error codes.
 * The generated backend texts are spread FIRST so coverage of the error
 * registry is by construction; the pair's own copy follows.
 */
export const categoriesI18nBundleEn: Record<string, string> = {
  ...categoriesErrorBundleEn,

  "categories.error.unknown": "Something went wrong with the catalogue",

  "categories.catalog.title": "Catalogue",
  "categories.catalog.loading": "Loading the catalogue…",
  "categories.catalog.load_failed": "We could not load the catalogue",
  "categories.catalog.empty": "This catalogue has no categories yet",
  "categories.catalog.retry": "Try again",
  // Cache semantics are ours, not a shopper's. What they can act on is that
  // the list is short and that more arrives, not that a walk hit a budget.
  "categories.catalog.truncated":
    "This is part of the catalogue — more categories are still on the way.",
  "categories.catalog.refreshing": "Checking for catalogue changes…",
  "categories.catalog.as_of": "Catalogue as of revision {revision}",

  "categories.category.title": "Category",
  "categories.category.unknown_slug":
    "There is no category at this address",
  "categories.category.unknown_slug_hint":
    "The address may be out of date.",
  "categories.category.back_to_catalog": "Back to the catalogue",
  "categories.category.subcategories": "Subcategories",
  "categories.category.subcategories_count.one": "{count} subcategory",
  "categories.category.subcategories_count.other": "{count} subcategories",
  "categories.category.no_subcategories": "This category has no subcategories",
  "categories.category.open": "Open",

  "categories.breadcrumbs.root": "All categories",
  "categories.breadcrumbs.label": "You are here",

  "categories.carousel.title": "Browse by category",
  "categories.carousel.loading": "Loading categories…",
  "categories.carousel.load_failed": "We could not load the categories",
  "categories.carousel.empty": "No categories are featured right now",

  "categories.tiles.all": "All",

  "categories.search.hits_title": "Categories matching “{query}”",

  "categories.quick_search.cta": "Show listings",
  "categories.quick_search.cta_count.one": "Show {count} listing",
  "categories.quick_search.cta_count.other": "Show {count} listings",
  "categories.quick_search.cta_count_at_least.one": "Show {count}+ listing",
  "categories.quick_search.cta_count_at_least.other": "Show {count}+ listings",

  "categories.picker.title": "Category",
  "categories.picker.search": "Search categories",
  "categories.picker.loading": "Loading categories…",
  "categories.picker.load_failed": "We could not load the categories",
  "categories.picker.no_matches": "No category matches that",
  "categories.picker.up": "Up one level",
  "categories.picker.selected": "Selected: {category}",
  "categories.picker.choose": "Choose a category",
  "categories.picker.done": "Done",
  "categories.picker.blocked.nothing_selected": "Choose a category first",
  "categories.picker.blocked.not_a_leaf":
    "Choose a more specific category — this one has subcategories, and the details asked for depend on which",

  "categories.features.title": "Details in this category",
  "categories.features.loading": "Loading the details…",
  "categories.features.load_failed": "We could not load the details",
  "categories.features.empty": "This category asks for no extra details",
  "categories.features.mandatory": "Required",
  "categories.features.type.string": "Text",
  "categories.features.type.int": "Whole number",
  "categories.features.type.float": "Number",
  "categories.features.type.bool": "Yes or no",
  "categories.features.type.select": "Choice",
  "categories.features.type.date": "Date",
  "categories.features.type.header": "Section heading",
  "categories.features.type.hex_color": "Colour",
  "categories.features.type.hierarchical_select": "Nested choice",
  "categories.features.type.convertible_unit": "Measurement",
  "categories.features.type.other": "Another kind of detail",
  "categories.features.untyped": "This detail has no type and cannot be shown",
};

/**
 * Register the English bundle into a core i18n engine. Locale bundles ship as
 * opt-in subpaths (`@stapel/categories-react/i18n/ru`, `…/es`) so a host that
 * needs only English never carries them.
 *
 * A host that renders a category's feature schema also registers
 * `@stapel/attributes-react`'s bundles — that package owns the twelve
 * `stapel_attributes` error keys in every locale.
 */
export function registerCategoriesI18n(i18n: I18nEngine): void {
  i18n.registerBundle("en", categoriesI18nBundleEn as I18nDictionary);
}
