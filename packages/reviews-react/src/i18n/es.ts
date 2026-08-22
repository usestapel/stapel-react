import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { reviewsErrorBundleEs } from "./generated/errors.es.gen.js";

export { reviewsErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for reviews-react — the `@stapel/reviews-react/i18n/es`
 * subpath (i18n-shipping.md §2), opt-in exactly like `./i18n/ru`.
 *
 * Same two sources, same reason (see `./ru.ts`): 42 cross-cutting keys come
 * from stapel-core's catalogue through the generated bundle, and the 9 keys
 * stapel-reviews owns are authored below until upstream ships
 * `translations/errors.es.json`.
 *
 * The UI copy is carried here too, not just the error keys: a review form is
 * a surface a buyer reads word by word, and half a translation is worse than
 * either language on its own (the chat-react precedent).
 */
export const reviewsI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts for every key core owns.
  ...reviewsErrorBundleEs,

  // Backend error codes stapel-reviews owns — authored here.
  "error.400.reviews_duplicate_review": "Ya has valorado esto",
  "error.400.reviews_invalid_moderation_action":
    "La acción de moderación debe ser una de: ocultar, publicar",
  "error.400.reviews_invalid_rating": "La valoración está fuera del rango permitido",
  "error.400.reviews_response_not_allowed":
    "Las respuestas están desactivadas para este tipo de objeto",
  "error.400.reviews_unknown_target_type": "Tipo de objeto de reseña desconocido",
  "error.403.reviews_cannot_moderate":
    "No puedes moderar las reseñas de este objeto",
  "error.403.reviews_cannot_review": "No puedes reseñar este objeto",
  "error.404.reviews_review_not_found": "Reseña no encontrada",
  "error.409.reviews_already_responded": "Esta reseña ya tiene una respuesta",

  // UI copy.
  "reviews.error.unknown": "Algo ha fallado con las reseñas",

  "reviews.list.heading": "Reseñas",
  "reviews.list.empty": "Todavía no hay reseñas",
  "reviews.list.load_more": "Ver más",
  "reviews.list.refresh": "Actualizar",
  "reviews.list.more.blocked.end": "Eso es todo",
  "reviews.list.more.blocked.pending": "Cargando…",

  "reviews.review.author_fallback": "Un cliente",
  "reviews.review.response_heading": "Respuesta del vendedor",

  "reviews.status.pending": "Pendiente de moderación",
  "reviews.status.hidden": "Oculta por moderación",
  "reviews.status.unknown": "Estado desconocido: {status}",

  "reviews.rating.none": "Todavía no hay reseñas",
  "reviews.rating.value": "{avg} de {max}",
  "reviews.rating.count": "{count} reseñas",
  "reviews.rating.star_label": "{index} de {max}",

  "reviews.form.heading": "Valora esto",
  "reviews.form.rating_label": "Tu valoración",
  "reviews.form.body_label": "Tu reseña",
  "reviews.form.body_placeholder": "¿Qué tal fue el trato? (opcional)",
  "reviews.form.submit": "Enviar",
  "reviews.form.sent.published": "Gracias — tu reseña está publicada",
  "reviews.form.sent.pending":
    "Gracias — tu reseña aparecerá cuando se haya revisado",
  "reviews.form.sent.hidden": "Tu reseña se ha guardado, pero no se muestra",
  "reviews.form.sent.unknown": "Tu reseña se ha guardado",
  "reviews.form.sign_in_required": "Inicia sesión para dejar una reseña",

  "reviews.submit.blocked.no_rating": "Elige primero una valoración",
  "reviews.submit.blocked.pending": "Enviando…",
  "reviews.submit.blocked.duplicate": "Ya has valorado esto",
  "reviews.submit.blocked.submitted": "Tu reseña se ha enviado",
  "reviews.submit.blocked.forbidden": "No puedes reseñar esto",
};

/** Register the Spanish bundle into a core i18n engine. */
export function registerReviewsI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, reviewsI18nBundleEs);
}
