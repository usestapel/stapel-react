import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { reviewsErrorBundleRu } from "./generated/errors.ru.gen.js";

export { reviewsErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for reviews-react — shipped as the
 * `@stapel/reviews-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale
 * is opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit and the
 * bundle-purity test).
 *
 * TWO SOURCES, ON PURPOSE. The generated `reviewsErrorBundleRu` covers the 42
 * cross-cutting keys stapel-core owns and localizes. The 9 keys stapel-reviews
 * owns are NOT in it, and cannot be: the module ships no `translations/`
 * directory at all, so the generator emits a `Partial` bundle and says so in
 * its own header (`ERRORS_LOCALE_EXEMPT_OWNERS`, the stapel-forms precedent).
 * They are authored below, beside the UI copy. When upstream ships
 * `translations/errors.ru.json`, these nine lines are deleted and the
 * generated bundle covers them — the keys and the texts do not move.
 */
export const reviewsI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for every key core owns.
  ...reviewsErrorBundleRu,

  // Backend error codes stapel-reviews owns — authored here (see the note
  // above).
  "error.400.reviews_duplicate_review": "Вы уже оценили это",
  "error.400.reviews_invalid_moderation_action":
    "Действие модерации должно быть одним из: скрыть, опубликовать",
  "error.400.reviews_invalid_rating": "Оценка вне допустимого диапазона",
  "error.400.reviews_response_not_allowed":
    "Для этого типа объекта ответы отключены",
  "error.400.reviews_unknown_target_type": "Неизвестный тип объекта отзыва",
  "error.403.reviews_cannot_moderate":
    "Вы не можете модерировать отзывы об этом объекте",
  "error.403.reviews_cannot_review": "Вы не можете оставить отзыв об этом объекте",
  "error.404.reviews_review_not_found": "Отзыв не найден",
  "error.409.reviews_already_responded": "На этот отзыв уже есть ответ",

  // UI copy.
  "reviews.error.unknown": "С отзывами что-то пошло не так",

  "reviews.list.heading": "Отзывы",
  "reviews.list.empty": "Отзывов пока нет",
  "reviews.list.load_more": "Показать ещё",
  "reviews.list.refresh": "Обновить",
  "reviews.list.more.blocked.end": "Это все отзывы",
  "reviews.list.more.blocked.pending": "Загружаем…",

  "reviews.review.author_fallback": "Покупатель",
  "reviews.review.response_heading": "Ответ продавца",

  "reviews.status.pending": "Ожидает модерации",
  "reviews.status.hidden": "Скрыт модерацией",
  "reviews.status.unknown": "Неизвестное состояние: {status}",

  "reviews.rating.none": "Отзывов пока нет",
  "reviews.rating.value": "{avg} из {max}",
  "reviews.rating.count": "Отзывов: {count}",
  "reviews.rating.star_label": "{index} из {max}",

  "reviews.form.heading": "Оцените",
  "reviews.form.rating_label": "Ваша оценка",
  "reviews.form.body_label": "Ваш отзыв",
  "reviews.form.body_placeholder": "Как прошла сделка? (необязательно)",
  "reviews.form.submit": "Отправить",
  "reviews.form.sent.published": "Спасибо — ваш отзыв опубликован",
  "reviews.form.sent.pending":
    "Спасибо — отзыв появится после проверки модератором",
  "reviews.form.sent.hidden": "Отзыв сохранён, но не показывается",
  "reviews.form.sent.unknown": "Отзыв сохранён",
  "reviews.form.sign_in_required": "Войдите, чтобы оставить отзыв",
  "reviews.form.sign_in": "Войти",

  "reviews.submit.blocked.no_rating": "Сначала выберите оценку",
  "reviews.submit.blocked.pending": "Отправляем…",
  "reviews.submit.blocked.duplicate": "Вы уже оценили это",
  "reviews.submit.blocked.submitted": "Ваш отзыв отправлен",
  "reviews.submit.blocked.forbidden": "Вы не можете оставить здесь отзыв",
};

/** Register the Russian bundle into a core i18n engine. */
export function registerReviewsI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, reviewsI18nBundleRu);
}
