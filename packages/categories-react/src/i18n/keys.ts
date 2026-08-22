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
  categorySubcategories: "categories.category.subcategories",
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

  // ── picker (the compose form's chooser) ──────────────────────────────────
  pickerTitle: "categories.picker.title",
  pickerSearch: "categories.picker.search",
  pickerLoading: "categories.picker.loading",
  pickerLoadFailed: "categories.picker.load_failed",
  pickerNoMatches: "categories.picker.no_matches",
  pickerUp: "categories.picker.up",
  pickerSelected: "categories.picker.selected",
  pickerBlockedNothingSelected: "categories.picker.blocked.nothing_selected",
  pickerBlockedNotALeaf: "categories.picker.blocked.not_a_leaf",

  // ── feature schema ───────────────────────────────────────────────────────
  featuresTitle: "categories.features.title",
  featuresLoading: "categories.features.loading",
  featuresLoadFailed: "categories.features.load_failed",
  featuresEmpty: "categories.features.empty",
  featuresMandatory: "categories.features.mandatory",
  featuresType: "categories.features.type",
  /** A feature whose `config` carries no `type` at all. */
  featuresUntyped: "categories.features.untyped",
} as const;

export type CategoriesI18nKey =
  (typeof CATEGORIES_I18N_KEYS)[keyof typeof CATEGORIES_I18N_KEYS];

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
  "categories.catalog.truncated":
    "Only part of the catalogue was loaded. A category missing here has not been read yet — it has not been removed.",
  "categories.catalog.refreshing": "Checking for catalogue changes…",
  "categories.catalog.as_of": "Catalogue as of revision {revision}",

  "categories.category.title": "Category",
  "categories.category.unknown_slug":
    "There is no category at this address",
  "categories.category.subcategories": "Subcategories",
  "categories.category.no_subcategories": "This category has no subcategories",
  "categories.category.open": "Open",

  "categories.breadcrumbs.root": "All categories",
  "categories.breadcrumbs.label": "You are here",

  "categories.carousel.title": "Browse by category",
  "categories.carousel.loading": "Loading categories…",
  "categories.carousel.load_failed": "We could not load the categories",
  "categories.carousel.empty": "No categories are featured right now",

  "categories.picker.title": "Category",
  "categories.picker.search": "Search categories",
  "categories.picker.loading": "Loading categories…",
  "categories.picker.load_failed": "We could not load the categories",
  "categories.picker.no_matches": "No category matches that",
  "categories.picker.up": "Up one level",
  "categories.picker.selected": "Selected: {category}",
  "categories.picker.blocked.nothing_selected": "Choose a category first",
  "categories.picker.blocked.not_a_leaf":
    "Choose a more specific category — this one has subcategories, and the details asked for depend on which",

  "categories.features.title": "Details in this category",
  "categories.features.loading": "Loading the details…",
  "categories.features.load_failed": "We could not load the details",
  "categories.features.empty": "This category asks for no extra details",
  "categories.features.mandatory": "Required",
  "categories.features.type": "{type}",
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
