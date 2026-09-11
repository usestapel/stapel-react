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
 * ONE SOURCE PER ERROR KEY, as of the 0.7.0 pin. The generated
 * `reviewsErrorBundleRu` covers all 54 registry codes: the 42 cross-cutting
 * ones stapel-core owns, merged UNDER the 12 stapel-reviews itself now ships
 * in `translations/errors.ru.json`. The bundle is a complete `Record` rather
 * than a `Partial`, and the eleven refusals this file used to author beside it
 * are DELETED, not kept: with both present the same key resolves twice and
 * nothing here could say which of the two a screen had shown.
 * `test/i18n.test.ts` gates that deletion over this FILE, because a key-set
 * check stays green with a duplicate back in place.
 *
 * PROVENANCE, stated rather than implied: both catalogues ship
 * `origin=seed:authored` and are UNREVIEWED, and so is the UI copy below.
 * None of it is a claim of review.
 */
export const reviewsI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for EVERY key in the registry:
  // core's 42 and, since the 0.7.0 pin, stapel-reviews' own 12. This pair
  // authors no error text at all any more (see the note above).
  ...reviewsErrorBundleRu,

  // UI copy.
  "reviews.error.unknown": "С отзывами что-то пошло не так",

  "reviews.list.heading": "Отзывы",
  "reviews.list.empty": "Отзывов пока нет",
  "reviews.list.empty_hint": "Расскажите первым, как всё прошло.",
  "reviews.list.empty_owner": "Здесь пока ничего не оценивали",
  "reviews.list.load_more": "Показать ещё",
  "reviews.list.refresh": "Обновить",
  "reviews.list.more.blocked.end": "Это все отзывы",
  "reviews.list.more.blocked.pending": "Загружаем…",
  "reviews.list.scope.narrowed": "Только опубликованные отзывы.",

  "reviews.review.author_fallback": "Покупатель",
  "reviews.review.response_heading": "Ответ продавца",

  "reviews.status.pending": "Ожидает модерации",
  "reviews.status.hidden": "Скрыт модерацией",
  "reviews.status.unknown": "Ещё не опубликован",

  "reviews.rating.none": "Оценок пока нет",
  "reviews.rating.value": "{avg} из {max}",
  // Russian has a paucal, so this family needs four forms where English and
  // Spanish need two. `few`/`many` existing here and not in `en`/`es` is a
  // fact about the language, not a key someone forgot — see `keys.ts`.
  "reviews.rating.count.one": "{count} отзыв",
  "reviews.rating.count.few": "{count} отзыва",
  "reviews.rating.count.many": "{count} отзывов",
  "reviews.rating.count.other": "{count} отзыва",
  "reviews.rating.star_label": "{index} из {max}",

  "reviews.form.heading": "Оцените",
  "reviews.form.rating_label": "Ваша оценка",
  "reviews.form.rating_hint": "Нажмите на звезду: {min} — плохо, {max} — отлично.",
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
  "reviews.submit.blocked.sign_in": "Войдите, чтобы оставить отзыв",
  "reviews.submit.blocked.mandate_unknown": "Проверяем вашу учётную запись…",

  "reviews.moderation.heading": "Модерация",
  "reviews.moderation.hint":
    "Всё, что написали об этом объекте, включая скрытое от публики. Что именно прислать, решает сервер.",
  "reviews.moderation.empty": "Модерировать нечего",
  "reviews.moderation.empty_hint": "Об этом объекте ещё никто не написал.",
  "reviews.moderation.empty_filtered":
    "В этой выборке ничего нет среди загруженных отзывов",
  "reviews.moderation.filter.label": "Какие отзывы показывать",
  "reviews.moderation.filter.all": "Все",
  "reviews.moderation.filter.pending": "Ожидают модерации",
  "reviews.moderation.filter.hidden": "Скрытые",
  "reviews.moderation.hide": "Скрыть",
  "reviews.moderation.publish": "Опубликовать",
  "reviews.moderation.reason_label": "Причина",
  "reviews.moderation.reason_placeholder": "Почему, своими словами",
  "reviews.moderation.reason_hint":
    "Остаётся в журнале модерации. Ни автор, ни публика её не увидят.",
  "reviews.moderation.confirm_hide": "Скрыть этот отзыв?",
  "reviews.moderation.confirm_hide_body":
    "Его перестанут видеть все, и он перестанет учитываться в рейтинге. Позже можно опубликовать обратно.",
  "reviews.moderation.done.hidden": "Скрыт",
  "reviews.moderation.done.published": "Опубликован",
  "reviews.moderation.done.unknown": "Сохранено",

  "reviews.moderate.blocked.not_moderator":
    "Скрывать и публиковать отзывы может только модератор этого объекта",
  "reviews.moderate.blocked.already_hidden": "Уже скрыт",
  "reviews.moderate.blocked.already_published": "Уже опубликован",
  "reviews.moderate.blocked.pending": "Выполняем…",
  "reviews.moderate.blocked.forbidden":
    "Сервер не признаёт вас модератором этого объекта",
  "reviews.moderate.blocked.gone": "Этого отзыва больше нет",
  "reviews.moderate.blocked.sign_in": "Войдите, чтобы модерировать",

  "reviews.response.compose_label": "Ваш ответ",
  "reviews.response.placeholder": "Ответьте покупателю публично",
  "reviews.response.submit": "Ответить",
  "reviews.response.sent": "Ваш ответ опубликован",
  "reviews.response.only_one":
    "На отзыв даётся один ответ, и потом его нельзя изменить.",

  "reviews.respond.blocked.not_owner":
    "Отвечать на отзывы может только владелец этого объекта",
  "reviews.respond.blocked.empty": "Сначала напишите ответ",
  "reviews.respond.blocked.pending": "Отправляем…",
  "reviews.respond.blocked.already": "На этот отзыв уже есть ответ",
  "reviews.respond.blocked.not_allowed":
    "Для объектов этого типа ответы отключены",
  "reviews.respond.blocked.forbidden":
    "Сервер не признаёт вас владельцем этого объекта",
  "reviews.respond.blocked.sign_in": "Войдите, чтобы ответить",
  "reviews.respond.blocked.gone": "Этого отзыва больше нет",
};

/** Register the Russian bundle into a core i18n engine. */
export function registerReviewsI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, reviewsI18nBundleRu);
}
