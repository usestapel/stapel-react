import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { categoriesErrorBundleEs } from "./generated/errors.es.gen.js";

export { categoriesErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for categories-react — the
 * `@stapel/categories-react/i18n/es` subpath (i18n-shipping.md §2), opt-in
 * exactly like `ru`.
 *
 * Same composition and the same three-way split by owner as `./ru`: the 42
 * cross-cutting `stapel_core` codes are generated from core's catalogue, the 8
 * `stapel_categories` codes are pair-authored here until upstream ships a
 * `translations/` directory, and the 12 `stapel_attributes` codes stay with
 * `@stapel/attributes-react`, which owns them.
 *
 * `es` carries the full UI copy, not just the refusals: the catalogue is the
 * first thing a visitor sees, and a half-translated menu above a translated
 * search is worse than either.
 *
 * PROVENANCE: unreviewed, seed-grade, like every other authored catalogue in
 * this wave.
 */
export const categoriesI18nBundleEs: I18nDictionary = {
  ...categoriesErrorBundleEs,

  // ── the 8 stapel_categories-owned codes, pair-authored ───────────────────
  "error.400.categories_config_required": "Se requiere un objeto config.",
  "error.400.categories_database_error":
    "Error de base de datos al aplicar los cambios.",
  "error.400.categories_duplicate_slug":
    "Ya existe una característica con el slug «{slug}».",
  "error.400.categories_expected_list": "Se esperaba una lista de objetos.",
  "error.400.categories_feature_editor_invalid":
    "Solicitud del editor de características no válida: {reason}",
  "error.400.categories_invalid_conversion":
    "Conversión de tipo no válida (solo se admite select ↔ string).",
  "error.400.categories_not_deleted": "La categoría no está eliminada.",
  "error.409.categories_feature_editor_conflict":
    "Otro editor modificó la categoría (se esperaba la revisión {expected}, ahora {actual}); recarga y vuelve a intentarlo.",

  "categories.error.unknown": "Algo salió mal con el catálogo.",

  "categories.catalog.title": "Catálogo",
  "categories.catalog.loading": "Cargando el catálogo…",
  "categories.catalog.load_failed": "No pudimos cargar el catálogo.",
  "categories.catalog.empty": "Este catálogo todavía no tiene categorías.",
  "categories.catalog.retry": "Reintentar",
  "categories.catalog.truncated":
    "Esto es parte del catálogo: aún faltan categorías por llegar.",
  "categories.catalog.refreshing": "Comprobando cambios en el catálogo…",
  "categories.catalog.as_of": "Catálogo a la revisión {revision}",

  "categories.category.title": "Categoría",
  "categories.category.unknown_slug": "No hay ninguna categoría en esta dirección.",
  "categories.category.unknown_slug_hint":
    "Puede que la dirección esté desactualizada.",
  "categories.category.back_to_catalog": "Volver al catálogo",
  "categories.category.subcategories": "Subcategorías",
  "categories.category.subcategories_count.one": "{count} subcategoría",
  "categories.category.subcategories_count.other": "{count} subcategorías",
  "categories.category.no_subcategories": "Esta categoría no tiene subcategorías.",
  "categories.category.open": "Abrir",

  "categories.breadcrumbs.root": "Todas las categorías",
  "categories.breadcrumbs.label": "Estás aquí",

  "categories.carousel.title": "Explorar por categoría",
  "categories.carousel.loading": "Cargando categorías…",
  "categories.carousel.load_failed": "No pudimos cargar las categorías.",
  "categories.carousel.empty": "Ahora mismo no hay categorías destacadas.",

  "categories.tiles.all": "Todo",

  "categories.search.hits_title": "Categorías que coinciden con «{query}»",

  "categories.quick_search.cta": "Ver anuncios",
  "categories.quick_search.cta_count.one": "Ver {count} anuncio",
  "categories.quick_search.cta_count.other": "Ver {count} anuncios",
  "categories.quick_search.cta_count_at_least.one": "Ver {count}+ anuncio",
  "categories.quick_search.cta_count_at_least.other": "Ver {count}+ anuncios",

  "categories.picker.title": "Categoría",
  "categories.picker.search": "Buscar categorías",
  "categories.picker.loading": "Cargando categorías…",
  "categories.picker.load_failed": "No pudimos cargar las categorías.",
  "categories.picker.no_matches": "Ninguna categoría coincide.",
  "categories.picker.up": "Subir un nivel",
  "categories.picker.selected": "Seleccionada: {category}",
  "categories.picker.choose": "Elige una categoría",
  "categories.picker.done": "Listo",
  "categories.picker.blocked.nothing_selected": "Elige primero una categoría.",
  "categories.picker.blocked.not_a_leaf":
    "Elige una categoría más concreta: esta tiene subcategorías, y de ellas dependen los datos que se piden.",

  "categories.cascade.choose": "Elige",
  "categories.cascade.blocked.nothing_selected":
    "Sigue concretando hasta llegar al último nivel.",

  "categories.features.title": "Datos de esta categoría",
  "categories.features.loading": "Cargando los datos…",
  "categories.features.load_failed": "No pudimos cargar los datos.",
  "categories.features.empty": "Esta categoría no pide datos adicionales.",
  "categories.features.mandatory": "Obligatorio",
  "categories.features.type.string": "Texto",
  "categories.features.type.int": "Número entero",
  "categories.features.type.float": "Número",
  "categories.features.type.bool": "Sí o no",
  "categories.features.type.select": "Opción",
  "categories.features.type.date": "Fecha",
  "categories.features.type.header": "Título de sección",
  "categories.features.type.hex_color": "Color",
  "categories.features.type.hierarchical_select": "Opción anidada",
  "categories.features.type.convertible_unit": "Medida con unidad",
  "categories.features.type.other": "Otro tipo de dato",
  "categories.features.untyped": "Este dato no tiene tipo y no se puede mostrar.",
};

/** Register the `es` bundle. Call AFTER `registerCategoriesI18n` so it
 * overrides the English floor. */
export function registerCategoriesI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, categoriesI18nBundleEs);
}
