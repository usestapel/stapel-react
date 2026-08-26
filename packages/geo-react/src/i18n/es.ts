import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { geoErrorBundleEs } from "./generated/errors.es.gen.js";

export { geoErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for geo-react — shipped as the `@stapel/geo-react/i18n/es`
 * subpath (i18n-shipping.md §2) so the locale is opt-in: hosts that don't
 * register it never carry these strings (the main entry does not import this
 * module — gated by size-limit and the bundle-purity test).
 *
 * Same two sources as the `ru` bundle. The generated `geoErrorBundleEs` covers
 * the 42 cross-cutting codes stapel-core owns and localizes. The 8 codes
 * stapel-geo owns are NOT in it, and cannot be: the module ships no
 * `translations/` directory at all, so the generator emits a `Partial` bundle
 * and says so in its own header (`ERRORS_LOCALE_EXEMPT_OWNERS`, the
 * stapel-forms / stapel-reviews precedent). They are authored below, beside
 * the UI copy. When upstream ships `translations/errors.es.json`, those eight
 * lines are deleted and the generated bundle covers them — the keys and the
 * texts do not move.
 *
 * Two sentences here are load-bearing, exactly as in the English bundle.
 * `geo.geocoder.unauthorized` must not read as a breakage: the deployment's
 * default really is authenticated-only geocoding, so a signed-out visitor
 * seeing it is the system working. And `geo.picker.no_address` is the answer
 * to a SUCCESSFUL call — there is no address at that point — not to a failed
 * one.
 */
export const geoI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts for every key core owns.
  ...geoErrorBundleEs,

  // Backend error codes stapel-geo owns — authored here (see above).
  "error.400.geohash_required": "Se requiere un geohash",
  "error.400.invalid_bbox":
    "El área debe tener cuatro números dentro de los límites permitidos",
  "error.400.invalid_geojson": "El archivo GeoJSON no es válido",
  "error.400.invalid_import_status":
    "La importación no se puede reintentar en su estado actual",
  "error.400.invalid_params": "Alguno de los parámetros de la consulta no es válido",
  "error.400.lat_lon_required": "Se requieren una latitud y una longitud válidas",
  "error.400.uuid_required": "Se requiere el UUID de la ubicación",
  "error.502.geocoder_unavailable": "El servicio de direcciones no está disponible",

  // UI copy.
  "geo.error.unknown": "Algo ha salido mal. Inténtalo de nuevo.",

  "geo.picker.title": "Elige una ubicación",
  "geo.picker.open": "Elegir en el mapa",
  "geo.picker.search_label": "Dirección",
  "geo.picker.search_placeholder": "Calle, ciudad…",
  "geo.picker.use_my_position": "Usar mi ubicación",
  "geo.picker.locating": "Buscando dónde estás…",
  "geo.picker.confirm": "Usar esta ubicación",
  "geo.picker.close": "Cerrar",
  "geo.picker.map_label":
    "Mapa. Arrastra para mover el marcador; usa los botones de zoom o las flechas del teclado.",
  "geo.picker.zoom_in": "Acercar",
  "geo.picker.zoom_out": "Alejar",
  "geo.picker.pin_label": "El punto elegido está en el centro del mapa",
  "geo.picker.resolving": "Buscando este lugar…",
  "geo.picker.no_address":
    "Aquí no hay ninguna dirección. Las coordenadas se guardan igualmente.",
  "geo.picker.coordinates": "{lat}, {lon}",

  "geo.search.type_more": "Sigue escribiendo para buscar.",
  "geo.search.no_results":
    "No hay coincidencias. Prueba con menos palabras o coloca tú mismo el marcador.",
  "geo.search.retry": "Reintentar",

  "geo.geocoder.unauthorized":
    "Para buscar direcciones aquí tienes que iniciar sesión. El mapa sigue funcionando: puedes colocar el marcador tú mismo.",
  "geo.geocoder.throttled":
    "Demasiadas búsquedas seguidas. Mostramos los últimos resultados; inténtalo de nuevo en un momento.",
  "geo.geocoder.unavailable":
    "El servicio de direcciones no responde. El mapa sigue funcionando: coloca el marcador tú mismo y vuelve a intentarlo dentro de un rato.",
  "geo.geocoder.failed":
    "La búsqueda de direcciones no ha funcionado. El mapa sigue funcionando: puedes colocar el marcador tú mismo.",

  "geo.position.denied":
    "Este sitio no puede ver tu ubicación. Concédele permiso en los ajustes del navegador o busca la dirección.",
  "geo.position.unavailable":
    "Tu dispositivo no ha podido averiguar dónde está. Busca la dirección en su lugar.",
  "geo.position.timeout":
    "Se ha tardado demasiado en encontrar tu ubicación. Inténtalo de nuevo.",

  "geo.map.config_failed": "No se ha podido cargar el mapa.",
  "geo.map.retry": "Reintentar",
};

/** Register the Spanish bundle into a core i18n engine. */
export function registerGeoI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, geoI18nBundleEs);
}
