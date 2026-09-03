import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { searchErrorBundleEs } from "./generated/errors.es.gen.js";

export { searchErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for search-react — the `@stapel/search-react/i18n/es`
 * subpath, opt-in exactly like `ru`.
 *
 * PROVENANCE: the backend catalogue is `origin=seed:authored` and unreviewed;
 * the pair-authored copy below is the same grade.
 */
export const searchI18nBundleEs: I18nDictionary = {
  ...searchErrorBundleEs,

  "search.error.unknown": "Algo falló en la búsqueda.",

  "search.results.title": "Resultados",
  "search.results.loading": "Buscando…",
  "search.results.load_failed": "No pudimos ejecutar esta búsqueda.",
  "search.results.empty": "No hay nada que coincida con esta búsqueda.",
  "search.results.retry": "Reintentar",
  "search.results.count_approximate.one": "Aproximadamente {count} resultado",
  "search.results.count_approximate.other": "Unos {count} resultados",
  "search.results.count_at_least.one": "{count}+ resultado",
  "search.results.count_at_least.other": "{count}+ resultados",
  "search.results.count_exact.one": "{count} resultado",
  "search.results.count_exact.other": "{count} resultados",
  "search.results.took_ms": "{ms} ms",
  "search.results.next": "Página siguiente",
  "search.results.prev": "Página anterior",
  "search.results.blocked.at_end": "Esta es la última página",
  "search.results.blocked.at_start": "Esta es la primera página",
  "search.results.window_exceeded":
    "Esta página está más allá de lo que la búsqueda puede recorrer. Acota la búsqueda en lugar de seguir paginando.",
  "search.results.promoted": "Promocionado",
  "search.results.promoted_hint":
    "Esta posición está pagada. Se marca porque la ley lo exige y no cambia lo que son los demás resultados.",
  "search.results.distance_km": "a {km} km",
  "search.results.untitled": "Sin título",
  "search.results.open": "Abrir",
  "search.results.image_alt": "Foto de {title}",
  "search.results.photo_alt": "Foto {index} de {total}: {title}",
  "search.results.photos": "Fotos",
  "search.results.photo_unavailable": "Foto no disponible",

  "search.box.label": "Buscar",
  "search.box.placeholder": "¿Qué estás buscando?",
  "search.box.submit": "Buscar",
  "search.box.clear": "Borrar la búsqueda",
  "search.box.suggestions": "Sugerencias",
  "search.box.categories": "Secciones",
  "search.box.category_count.one": "{count} anuncio",
  "search.box.category_count.other": "{count} anuncios",

  "search.sort.label": "Orden",
  "search.sort.relevance": "Más relevantes",
  "search.sort.newest": "Más recientes",
  "search.sort.price_asc": "Precio: de menor a mayor",
  "search.sort.price_desc": "Precio: de mayor a menor",
  "search.sort.distance": "Más cercanos",
  "search.sort.server_chose": "Ordenado por {sort}",

  "search.view.label": "Vista",
  "search.view.list": "Lista",
  "search.view.grid": "Cuadrícula",

  "search.facets.title": "Filtros",
  "search.facets.loading": "Cargando filtros…",
  "search.facets.load_failed": "No pudimos cargar los filtros.",
  "search.facets.empty": "Esta búsqueda no ofrece filtros.",
  "search.facets.clear": "Quitar",
  "search.facets.clear_all": "Quitar todos los filtros ({count})",
  "search.facets.approximate":
    "Los recuentos son aproximados: había demasiados candidatos para contarlos todos.",
  "search.facets.skipped":
    "Estos filtros no se contaron para esta búsqueda: {slugs}",
  "search.facets.withheld.one":
    "{count} filtro se aplica a muy pocos de estos resultados",
  "search.facets.withheld.other":
    "{count} filtros se aplican a muy pocos de estos resultados",
  "search.facets.not_counted": "sin contar",
  "search.facets.drill_down_hint":
    "Cada recuento es lo que obtendrías eligiendo ese valor en lugar del actual.",
  "search.range.price": "Precio",
  "search.facets.range_from": "Desde",
  "search.facets.range_to": "Hasta",
  "search.facets.range_apply": "Aplicar",
  "search.facets.range_clear": "Quitar",
  "search.facets.range_from_aria": "{feature}, desde",
  "search.facets.range_to_aria": "{feature}, hasta",
  "search.facets.show_all": "Ver todos ({count})",
  "search.facets.show_less": "Ver menos",
  "search.facets.search": "Buscar un filtro",
  "search.facets.search_empty": "Ningún filtro coincide con esto",
  "search.facets.match_count.one": "{count} anuncio coincide",
  "search.facets.match_count.other": "{count} anuncios coinciden",
  "search.facets.range_invalid":
    "«Desde» es mayor que «hasta», así que nada podría coincidir. Intercámbialos para aplicar el rango.",

  "search.filters.open": "Filtros ({count})",
  "search.filters.apply": "Ver resultados",
  "search.filters.show_count.one": "Ver {count} resultado",
  "search.filters.show_count.other": "Ver {count} resultados",
  "search.filters.show_count_at_least.one": "Ver {count}+ resultado",
  "search.filters.show_count_at_least.other": "Ver {count}+ resultados",
  "search.filters.dismiss": "Cerrar los filtros",
  "search.filters.chips_label": "Filtros",
  "search.filters.all": "Todos los filtros",
  "search.filters.short": "Filtros",
  "search.filters.chip_more": ", +{count}",
  "search.filters.chips_overflow": "Más · {count}",

  "search.empty.exits_title": "Prueba a ampliar la búsqueda",
  "search.empty.up_a_level": "Subir un nivel",
  "search.empty.widen_radius": "Buscar en un radio de {km} km",
  "search.empty.anywhere": "Buscar en todas partes",
  "search.empty.drop_filter": "Sin «{name}»",
  "search.category.title": "Categoría",
  "search.category.clear": "Buscar en todo el catálogo",
  "search.category.current": "Buscando dentro de {path}",

  "search.language.label": "Idioma de la consulta",
  "search.language.any": "Cualquier idioma",

  "search.limit.label": "Por página",
  "search.limit.option": "{count} por página",
  "search.limit.from_link": "Este enlace fija su propio tamaño de página.",

  "search.geo.title": "Ubicación",
  "search.geo.radius_km": "A menos de {km} km",
  "search.geo.radius_km_short": "{km} km",
  "search.geo.radius_label": "Radio, km",
  "search.geo.clear": "En cualquier lugar",
  "search.geo.near_me": "Cerca de mí",
  "search.geo.everywhere": "Buscando en todas partes",
  "search.geo.box": "Dentro del área mostrada",
  "search.geo.chosen_place": "Un lugar elegido en el mapa",
  "search.geo.near_you": "Cerca de ti",

  "search.url.issues_title": "Parte de este enlace no se pudo leer",
  "search.url.issue.not_a_number":
    "«{param}» en este enlace no es un número, así que se ignoró",
  "search.url.issue.geo_incomplete":
    "la ubicación de este enlace está incompleta, así que se ignoró",
  "search.url.issue.bbox_malformed":
    "el área del mapa de este enlace está incompleta, así que se ignoró",
  "search.url.issue.range_malformed":
    "al rango «{param}» de este enlace le faltan números, así que se ignoró",
  "search.url.issue.radius_without_place":
    "este enlace pide un radio pero no nombra ningún lugar, así que aún no se acota nada — elige un lugar y se aplicará ese mismo radio",

  "search.degraded.title": "Lo que esta búsqueda no pudo hacer",
  "search.degraded.typo_tolerance":
    "No se corrigieron erratas: el motor de búsqueda configurado no puede hacerlo.",
  "search.degraded.phrase_synonyms":
    "No se ampliaron sinónimos: el motor de búsqueda configurado no puede hacerlo.",
  "search.degraded.exact_total": "El número de resultados es una estimación.",
  "search.degraded.exact_facet_counts": "Los recuentos de filtros son aproximados.",
  "search.degraded.category_rollup":
    "Pueden faltar subcategorías en estos resultados: el servicio de categorías no respondió.",
  "search.degraded.facet_plan_evidence":
    "No pudimos determinar qué filtros encajan con estos resultados, así que puede haber más de los que muestra el panel.",
  "search.degraded.scorer":
    "El parámetro de ranking «{scorer}» no se aplicó: el motor configurado no puede evaluarlo.",
  "search.degraded.unknown":
    "La búsqueda informó de una limitación para la que esta página no tiene texto: {raw}",

  "search.ranking.title": "Cómo se ordenan estos resultados",
  "search.ranking.intro":
    "Estos son los parámetros que determinan el orden de los resultados, con su peso relativo.",
  "search.ranking.loading": "Cargando la información de ranking…",
  "search.ranking.load_failed": "No pudimos cargar la información de ranking.",
  "search.ranking.empty": "Esta instalación no declara parámetros de ranking.",
  "search.ranking.parameter": "Parámetro",
  "search.ranking.weight": "Peso",
  "search.ranking.applies_to": "Se aplica a",
  "search.ranking.inactive": "No aplicado: {reason}",
  "search.ranking.notes": "Notas",
  "search.ranking.link": "Cómo se ordenan estos resultados",

  "search.nav.results": "Buscar",
  "search.nav.ranking": "Orden de resultados",
  "search.nav.ranking.short": "Orden",
};

/** Register the es bundle. Call AFTER `registerSearchI18n`. */
export function registerSearchI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", searchI18nBundleEs);
}
