import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { registerAttributesI18nEs } from "@stapel/attributes-react/i18n/es";
import { listingsErrorBundleEs } from "./generated/errors.es.gen.js";

export { listingsErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for listings-react — the `@stapel/listings-react/i18n/es`
 * subpath (i18n-shipping.md §2), opt-in exactly like `./i18n/ru`.
 *
 * It carries the UI copy too, not only the nine module-owned error keys. The
 * composer and the owner's dashboard are the surfaces a seller works in for
 * minutes at a time; a half-translated form there is visible immediately, in
 * the way a half-translated settings pane is not. Same call chat-react made
 * for the buyer↔seller thread.
 *
 * Provenance and the owner split are as in `./ru.ts`: 42 cross-cutting codes
 * generated from stapel-core's catalogue, 9 `stapel_listings` codes authored
 * here until upstream ships `translations/`, and the 12 `stapel_attributes`
 * codes deliberately left to `@stapel/attributes-react`.
 */
export const listingsI18nBundleEs: I18nDictionary = {
  ...listingsErrorBundleEs,

  // ── the 10 stapel_listings-owned codes, pair-authored ────────────────────
  "error.400.category_required": "Hay que elegir una categoría",
  "error.400.image_required":
    "Para publicar el anuncio hace falta al menos una foto",
  "error.400.listing_feature_not_allowed":
    "El detalle «{feature}» no pertenece a esta categoría",
  "error.400.listing_invalid_status_filter":
    "Estado de anuncio desconocido: «{status}»",
  "error.400.publish_validation_failed":
    "El anuncio no pasó la revisión y no se publicó",
  "error.403.listing_anonymous_not_allowed":
    "Para publicar un anuncio, inicia sesión o crea una cuenta",
  "error.403.listing_not_owner": "Este anuncio no es tuyo",
  "error.404.listing_not_found": "No se encontró el anuncio",
  "error.409.already_favorited": "El anuncio ya está en favoritos",
  "error.409.invalid_listing_transition":
    "Desde su estado actual, el anuncio no se puede mover así",
  "error.409.listing_cannot_delete_active":
    "Archívalo primero — un anuncio a la venta no se puede borrar",

  "listings.error.unknown": "Algo salió mal con este anuncio",

  "listings.status.draft": "Borrador",
  "listings.status.pending": "En revisión",
  "listings.status.published": "Publicado",
  "listings.status.paused": "En pausa",
  "listings.status.expired": "Caducado",
  "listings.status.sold": "Vendido",
  "listings.status.rejected": "Rechazado",
  "listings.status.blocked": "Retirado",
  "listings.status.archived": "Archivado",

  "listings.moderation.first_review":
    "Enviado a revisión. Saldrá a la venta cuando un moderador lo apruebe.",
  "listings.moderation.live_edit_pending":
    "Tu anuncio sigue publicado mientras revisamos los cambios — la gente lo ve ahora mismo.",
  "listings.moderation.pending_offline":
    "Se pidió una revisión, pero este anuncio ya no está a la venta.",
  "listings.moderation.needs_review":
    "Un moderador lo está mirando a mano.",
  "listings.moderation.live_needs_review":
    "Publicado, y un moderador está mirando los cambios a mano.",
  "listings.moderation.rejected":
    "Un moderador rechazó este anuncio. Edítalo y vuelve a enviarlo.",
  "listings.moderation.rejected_still_live":
    "Un moderador rechazó este anuncio; sigue visible mientras se aplica.",

  "listings.card.no_photo": "Sin foto",
  "listings.card.photo_unavailable": "Foto no disponible",
  "listings.card.price_absent": "Precio no especificado",
  "listings.card.favorite_add": "Guardar en favoritos",
  "listings.card.favorite_remove": "Quitar de favoritos",
  "listings.card.untitled": "Anuncio sin título",
  "listings.card.sign_in": "Iniciar sesión",
  "listings.card.photos": "Fotos de este anuncio",
  "listings.card.price_was": "Antes",
  "listings.card.price_dropped": "El precio ha bajado",
  "listings.card.price_raised": "El precio ha subido",

  "listings.detail.loading": "Cargando el anuncio…",
  "listings.detail.load_failed": "No pudimos cargar este anuncio",
  "listings.detail.retry": "Reintentar",
  "listings.detail.not_found": "No hay ningún anuncio en esta dirección",
  "listings.detail.removed": "Este anuncio fue eliminado",
  "listings.detail.withdrawn": "Este anuncio ya no está publicado",
  "listings.detail.not_published":
    "Este anuncio no está a la venta ahora, así que lo que ves puede estar desactualizado",
  "listings.detail.owner_only_view":
    "Solo tú ves esto — todavía no está publicado",
  "listings.detail.description": "Descripción",
  "listings.detail.specs": "Detalles",
  "listings.detail.no_specs": "El vendedor no indicó más detalles",
  "listings.detail.unreadable_features":
    "Detalles que esta versión no pudo leer: {count}",
  "listings.detail.photos_unavailable":
    "Aquí no se pueden mostrar las fotos — la aplicación no sabe resolverlas",
  "listings.detail.photo_alt": "Foto {index} de {total}",
  "listings.detail.published_at": "Publicado el {date}",
  "listings.detail.expires_at": "A la venta hasta el {date}",
  "listings.detail.stock": "Disponibles",
  "listings.detail.views": "Visitas",
  "listings.detail.edit": "Editar el anuncio",
  "listings.detail.take_down": "Retirarlo",

  "listings.compose.new_title": "Anuncio nuevo",
  "listings.compose.edit_title": "Editar el anuncio",
  "listings.compose.category": "Categoría",
  "listings.compose.category_help":
    "La categoría decide qué detalles se le piden al vendedor",
  "listings.compose.category_required": "Elige una categoría primero",
  "listings.compose.category_changed_dropped":
    "Respuestas que no aplican a esta categoría y se han borrado: {count}",
  "listings.compose.title_label": "Título",
  "listings.compose.title_too_long":
    "El título debe tener como mucho {max_length} caracteres",
  "listings.compose.description_label": "Descripción",
  "listings.compose.price_label": "Precio",
  "listings.compose.price_invalid":
    "Escribe el precio como un número, con dos decimales como mucho",
  "listings.compose.currency_label": "Moneda",
  "listings.compose.location_label": "Dónde está",
  "listings.compose.location_help":
    "La gente busca por distancia — un anuncio sin lugar es un anuncio que no encontrarán",
  "listings.compose.geo_incomplete":
    "Una latitud necesita su longitud al lado — media coordenada no apunta a ningún sitio",
  "listings.compose.photos": "Fotos",
  "listings.compose.too_many_images":
    "Un anuncio admite como mucho {max} fotos",
  "listings.compose.details": "Detalles",
  "listings.compose.details_loading": "Cargando lo que pide esta categoría…",
  "listings.compose.details_no_category":
    "Elige primero una categoría: aquí aparecerá lo que pide.",
  "listings.compose.details_failed":
    "No pudimos cargar lo que pide esta categoría",
  "listings.compose.details_empty": "Esta categoría no pide más detalles",
  "listings.compose.countable": "Vendo un artículo contable",
  "listings.compose.stock": "Cuántas unidades",
  "listings.compose.auto_republish": "Volver a publicar cuando caduque",
  "listings.compose.save": "Guardar borrador",
  "listings.compose.save_live": "Apartar como borrador",
  "listings.compose.saved_live":
    "Cambios apartados como borrador — el anuncio publicado no cambió",
  "listings.compose.saving": "Guardando…",
  "listings.compose.saved": "Borrador guardado",
  "listings.compose.publish": "Publicar",
  "listings.compose.republish": "Guardar los cambios",
  "listings.compose.publishing": "Enviando…",
  "listings.compose.published_first":
    "Enviado a revisión. Saldrá a la venta cuando un moderador lo apruebe.",
  "listings.compose.published_live":
    "Cambios enviados. Tu anuncio sigue publicado mientras los revisamos.",
  "listings.compose.invalid_summary":
    "Antes de enviarlo, revisa estos detalles: {count}",

  "listings.compose.blocked.no_category":
    "Elige una categoría — el resto del formulario depende de ella",
  "listings.compose.blocked.unsupported_type":
    "Esta categoría pide un tipo de detalle que la aplicación todavía no sabe mostrar, así que el anuncio no se puede completar aquí",
  "listings.compose.blocked.photos_pending":
    "Espera a que terminen de subirse las fotos",
  "listings.compose.blocked.no_draft": "El borrador todavía no está creado",
  "listings.compose.blocked.busy":
    "Un momento — el último cambio se está guardando",
  "listings.compose.blocked.incomplete": "Faltan {count} datos obligatorios",
  "listings.compose.show_first_missing": "Ir al primer campo sin completar",
  "listings.compose.blocked.mirror": "Corrige primero los campos marcados",
  "listings.compose.blocked.details_unavailable":
    "No pudimos cargar lo que pide esta categoría, así que no podemos revisar el formulario",

  "listings.mine.title": "Mis anuncios",
  "listings.mine.tab.active": "Activos",
  "listings.mine.tab.drafts": "Borradores",
  "listings.mine.tab.archived": "Archivo",
  "listings.mine.loading": "Cargando tus anuncios…",
  "listings.mine.load_failed": "No pudimos cargar tus anuncios",
  "listings.mine.empty": "Aquí todavía no hay nada",
  "listings.mine.retry": "Reintentar",
  "listings.mine.counters_failed": "No pudimos contar tus anuncios",
  "listings.mine.empty.active": "No tienes nada publicado ni en revisión",
  "listings.mine.empty.drafts": "Sin borradores: lo que empieces aparecerá aquí",
  "listings.mine.empty.archived": "Nada archivado, pausado, caducado ni vendido todavía",
  "listings.mine.blocked.title":
    "Moderación retiró {count} de tus anuncios",
  "listings.mine.blocked.title.one": "Moderación retiró uno de tus anuncios",
  "listings.mine.blocked.title.other": "Moderación retiró {count} de tus anuncios",
  "listings.mine.blocked.load_failed":
    "No pudimos comprobar si alguno de tus anuncios fue retirado",
  "listings.mine.live_under_review": "Publicado, cambios en revisión",
  "listings.mine.edit": "Editar",
  "listings.mine.archive": "Archivar",
  "listings.mine.complete": "Marcar como vendido",
  "listings.mine.delete": "Borrar",
  "listings.mine.move.published": "Publicar de nuevo",
  "listings.mine.move.pending": "Enviar a revisión",
  "listings.mine.move.paused": "Pausar",
  "listings.mine.move.draft": "Volver a borradores",
  "listings.mine.move.renew": "Renovar",
  "listings.mine.view": "Ver",
  "listings.mine.delete_confirm_title": "¿Borrar este anuncio?",
  "listings.mine.delete_confirm_body":
    "Desaparece de tu panel y no se puede recuperar. Archivarlo lo conserva.",

  "listings.favorites.title": "Favoritos",
  "listings.favorites.loading": "Cargando tus favoritos…",
  "listings.favorites.load_failed": "No pudimos cargar tus favoritos",
  "listings.favorites.empty": "Todavía no has guardado nada",
  "listings.favorites.empty_hint":
    "Toca el corazón en cualquier anuncio y te estará esperando aquí.",
  "listings.favorites.sign_in_hint":
    "Los favoritos se guardan en tu cuenta, así que te siguen entre dispositivos.",

  // Las dos comprobaciones de publicación que llegaron con el contrato 0.17.
  "error.400.listing_location_required":
    "Indica dónde está el artículo antes de publicarlo",
  "error.400.listing_zero_price_not_allowed":
    "En esta categoría no se permite un precio de 0. Deja el precio vacío para «precio no indicado».",

  "error.400.listing_draft_meta_too_large":
    "El borrador es demasiado grande (máximo {max_bytes} bytes). Quita parte de los datos y guarda de nuevo.",

  "listings.blocked.sign_in": "Inicia sesión para hacer esto",
  "listings.blocked.guest":
    "Esta cuenta todavía no puede hacerlo — termina de configurarla primero",
  "listings.blocked.mandate_unknown":
    "No pudimos comprobar tu cuenta, así que no adivinamos si puedes hacerlo",
  "listings.blocked.transition":
    "Desde su estado actual, el anuncio no se puede mover así",
  "listings.blocked.delete_active":
    "Archívalo primero — un anuncio a la venta no se puede borrar",
  "listings.blocked.in_flight": "Un momento — eso ya está en marcha",
  "listings.blocked.no_editor":
    "Esta aplicación todavía no tiene una pantalla para editar un anuncio",

  "listings.page.prev": "Anterior",
  "listings.page.next": "Siguiente",
  "listings.page.indicator": "Página {page}",

  "listings.nav.detail": "Anuncio",
  "listings.nav.compose": "Poner un anuncio",
  "listings.nav.compose.short": "Poner",
  "listings.nav.mine": "Mis anuncios",
  "listings.nav.mine.short": "Míos",
  "listings.nav.favorites": "Favoritos",
};

/**
 * Register the Spanish bundle — and, exactly as in `./ru.ts`, the twelve
 * `stapel_attributes` sentences this pair does not author. The ownership split
 * is a rule about who WRITES a string, not an instruction to ship two thirds
 * of a locale and document the rest.
 */
export function registerListingsI18nEs(i18n: I18nEngine): void {
  registerAttributesI18nEs(i18n);
  i18n.registerBundle("es", listingsI18nBundleEs);
}
