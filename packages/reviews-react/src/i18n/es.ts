import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { reviewsErrorBundleEs } from "./generated/errors.es.gen.js";

export { reviewsErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for reviews-react — the `@stapel/reviews-react/i18n/es`
 * subpath (i18n-shipping.md §2), opt-in exactly like `./i18n/ru`.
 *
 * One source per error key, same as `./ru.ts`: since the 0.7.0 pin the
 * generated bundle carries all 54 registry codes — core's 42 plus the 12
 * stapel-reviews ships in its own `translations/errors.es.json` — and the
 * eleven refusals this file used to author beside it are deleted rather than
 * kept, so no key resolves twice.
 *
 * The UI copy is carried here too, not just the error keys: a review form is
 * a surface a buyer reads word by word, and half a translation is worse than
 * either language on its own (the chat-react precedent).
 */
export const reviewsI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts for EVERY key in the registry:
  // core's 42 and, since the 0.7.0 pin, stapel-reviews' own 12. This pair
  // authors no error text at all any more.
  ...reviewsErrorBundleEs,

  // UI copy.
  "reviews.error.unknown": "Algo ha fallado con las reseñas",

  "reviews.list.heading": "Reseñas",
  "reviews.list.empty": "Todavía no hay reseñas",
  "reviews.list.empty_hint": "Cuenta tú el primero qué tal fue.",
  "reviews.list.empty_owner": "Aquí todavía no se ha reseñado nada",
  "reviews.list.load_more": "Ver más",
  "reviews.list.refresh": "Actualizar",
  "reviews.list.more.blocked.end": "Eso es todo",
  "reviews.list.more.blocked.pending": "Cargando…",
  "reviews.list.scope.narrowed": "Solo reseñas publicadas.",

  "reviews.review.author_fallback": "Un cliente",
  "reviews.review.response_heading": "Respuesta del vendedor",

  "reviews.status.pending": "Pendiente de moderación",
  "reviews.status.hidden": "Oculta por moderación",
  "reviews.status.unknown": "Todavía sin publicar",

  "reviews.rating.none": "Todavía no hay valoración",
  "reviews.rating.value": "{avg} de {max}",
  "reviews.rating.count.one": "{count} reseña",
  "reviews.rating.count.other": "{count} reseñas",
  "reviews.rating.star_label": "{index} de {max}",

  "reviews.form.heading": "Valora esto",
  "reviews.form.rating_label": "Tu valoración",
  "reviews.form.rating_hint": "Toca una estrella: {min} es malo, {max} es excelente.",
  "reviews.form.body_label": "Tu reseña",
  "reviews.form.body_placeholder": "¿Qué tal fue el trato? (opcional)",
  "reviews.form.submit": "Enviar",
  "reviews.form.sent.published": "Gracias — tu reseña está publicada",
  "reviews.form.sent.pending":
    "Gracias — tu reseña aparecerá cuando se haya revisado",
  "reviews.form.sent.hidden": "Tu reseña se ha guardado, pero no se muestra",
  "reviews.form.sent.unknown": "Tu reseña se ha guardado",
  "reviews.form.sign_in_required": "Inicia sesión para dejar una reseña",
  "reviews.form.sign_in": "Iniciar sesión",

  "reviews.submit.blocked.no_rating": "Elige primero una valoración",
  "reviews.submit.blocked.pending": "Enviando…",
  "reviews.submit.blocked.duplicate": "Ya has valorado esto",
  "reviews.submit.blocked.submitted": "Tu reseña se ha enviado",
  "reviews.submit.blocked.forbidden": "No puedes reseñar esto",
  "reviews.submit.blocked.sign_in": "Inicia sesión para dejar una reseña",
  "reviews.submit.blocked.mandate_unknown": "Comprobando tu cuenta…",

  "reviews.moderation.heading": "Moderación",
  "reviews.moderation.hint":
    "Todo lo escrito sobre este objeto, incluido lo que el público no ve. El servidor decide qué te envía.",
  "reviews.moderation.empty": "No hay nada que moderar",
  "reviews.moderation.empty_hint": "Todavía nadie ha escrito sobre esto.",
  "reviews.moderation.empty_filtered":
    "Nada en esta vista entre las reseñas cargadas",
  "reviews.moderation.filter.label": "Qué reseñas mostrar",
  "reviews.moderation.filter.all": "Todo",
  "reviews.moderation.filter.pending": "Pendientes de moderación",
  "reviews.moderation.filter.hidden": "Ocultas",
  "reviews.moderation.hide": "Ocultar",
  "reviews.moderation.publish": "Publicar",
  "reviews.moderation.reason_label": "Motivo",
  "reviews.moderation.reason_placeholder": "Por qué, con tus palabras",
  "reviews.moderation.reason_hint":
    "Queda en el registro de moderación. Ni el autor ni el público lo ven.",
  "reviews.moderation.confirm_hide": "¿Ocultar esta reseña?",
  "reviews.moderation.confirm_hide_body":
    "Deja de verse para todo el mundo y de contar para la valoración. Puedes volver a publicarla más tarde.",
  "reviews.moderation.done.hidden": "Oculta",
  "reviews.moderation.done.published": "Publicada",
  "reviews.moderation.done.unknown": "Guardado",

  "reviews.moderate.blocked.not_moderator":
    "Solo quien modera este objeto puede ocultar o publicar reseñas",
  "reviews.moderate.blocked.already_hidden": "Ya está oculta",
  "reviews.moderate.blocked.already_published": "Ya está publicada",
  "reviews.moderate.blocked.pending": "Trabajando…",
  "reviews.moderate.blocked.forbidden":
    "El servidor no te reconoce como moderador de este objeto",
  "reviews.moderate.blocked.gone": "Esta reseña ya no existe",
  "reviews.moderate.blocked.sign_in": "Inicia sesión para moderar",

  "reviews.response.compose_label": "Tu respuesta",
  "reviews.response.placeholder": "Responde al cliente, en público",
  "reviews.response.submit": "Responder",
  "reviews.response.sent": "Tu respuesta está publicada",
  "reviews.response.only_one":
    "Cada reseña admite una respuesta, y después no se puede cambiar.",

  "reviews.respond.blocked.not_owner":
    "Solo el propietario de este objeto puede responder a sus reseñas",
  "reviews.respond.blocked.empty": "Escribe primero la respuesta",
  "reviews.respond.blocked.pending": "Enviando…",
  "reviews.respond.blocked.already": "Esta reseña ya tiene una respuesta",
  "reviews.respond.blocked.not_allowed":
    "Las respuestas están desactivadas para este tipo de objeto",
  "reviews.respond.blocked.forbidden":
    "El servidor no te reconoce como propietario de este objeto",
  "reviews.respond.blocked.sign_in": "Inicia sesión para responder",
  "reviews.respond.blocked.gone": "Esta reseña ya no existe",
};

/** Register the Spanish bundle into a core i18n engine. */
export function registerReviewsI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, reviewsI18nBundleEs);
}
