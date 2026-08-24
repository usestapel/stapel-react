import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { reviewsErrorBundleEn } from "./generated/errors.gen.js";

/**
 * reviews-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these through core's
 * i18n engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English for both the backend's codes (generated) and the pair's own UI keys.
 */
export const REVIEWS_I18N_KEYS = {
  unknownError: "reviews.error.unknown",

  // The list
  listHeading: "reviews.list.heading",
  listEmpty: "reviews.list.empty",
  listLoadMore: "reviews.list.load_more",
  listRefresh: "reviews.list.refresh",
  moreBlockedEnd: "reviews.list.more.blocked.end",
  moreBlockedPending: "reviews.list.more.blocked.pending",

  // One row. The wire carries `author_id` and NOTHING else about the person —
  // no name, no avatar — so the skin renders this unless the host passes a
  // `renderAuthor` slot. Printing the raw id would be both useless and a
  // gratuitous disclosure.
  authorFallback: "reviews.review.author_fallback",
  responseHeading: "reviews.review.response_heading",

  // Visibility, said out loud. A row that is not published is only ever on
  // screen because a moderator asked for `include=all`, and it must not look
  // like an ordinary review.
  statusPending: "reviews.status.pending",
  statusHidden: "reviews.status.hidden",
  statusUnknown: "reviews.status.unknown",

  // The rating
  ratingNone: "reviews.rating.none",
  ratingValue: "reviews.rating.value",
  ratingCount: "reviews.rating.count",
  ratingStarLabel: "reviews.rating.star_label",

  // The form. `formSignInRequired` is the ONLY sign-in key left: since
  // stapel-reviews 0.3.0 both reads are anonymous and only the POST refuses a
  // guest, so "sign in" is copy for the write and never a wall in front of
  // the content.
  formHeading: "reviews.form.heading",
  formRatingLabel: "reviews.form.rating_label",
  formBodyLabel: "reviews.form.body_label",
  formBodyPlaceholder: "reviews.form.body_placeholder",
  formSubmit: "reviews.form.submit",
  formSentPublished: "reviews.form.sent.published",
  formSentPending: "reviews.form.sent.pending",
  formSentHidden: "reviews.form.sent.hidden",
  formSentUnknown: "reviews.form.sent.unknown",
  formSignInRequired: "reviews.form.sign_in_required",
  /** The door beside that sentence — the container supplies WHERE it leads. */
  formSignIn: "reviews.form.sign_in",

  // Blocked controls — every one of these is the `code` of an
  // ActionAvailability, so a switched-off button always has a sentence.
  submitBlockedNoRating: "reviews.submit.blocked.no_rating",
  submitBlockedPending: "reviews.submit.blocked.pending",
  submitBlockedDuplicate: "reviews.submit.blocked.duplicate",
  submitBlockedSubmitted: "reviews.submit.blocked.submitted",
  submitBlockedForbidden: "reviews.submit.blocked.forbidden",

  // Backend error keys the pair OWNS the localization of. stapel-reviews ships
  // English only (no `translations/` directory at all), so its 9 keys are
  // absent from the generated ru/es bundles and are authored in `./i18n/<lang>`
  // instead — the stapel-forms/`stapel_attributes` precedent, applied before
  // this by forms, chat, cdn and categories. Listed here so `i18n-key-exists`
  // knows them and `test/i18n.test.ts` can prove all three locales carry them.
  errorDuplicateReview: "error.400.reviews_duplicate_review",
  errorInvalidModerationAction: "error.400.reviews_invalid_moderation_action",
  errorInvalidRating: "error.400.reviews_invalid_rating",
  errorResponseNotAllowed: "error.400.reviews_response_not_allowed",
  errorUnknownTargetType: "error.400.reviews_unknown_target_type",
  errorCannotModerate: "error.403.reviews_cannot_moderate",
  errorCannotReview: "error.403.reviews_cannot_review",
  errorReviewNotFound: "error.404.reviews_review_not_found",
  errorAlreadyResponded: "error.409.reviews_already_responded",
} as const;

/**
 * The English bundle: the generated backend fallbacks first, this pair's own
 * UI copy over them. English is INLINE (not a separate subpath) so a host that
 * registers nothing still renders sentences instead of raw keys.
 */
export const reviewsI18nBundleEn: I18nDictionary = {
  ...reviewsErrorBundleEn,

  "reviews.error.unknown": "Something went wrong with the reviews",

  "reviews.list.heading": "Reviews",
  "reviews.list.empty": "No reviews yet",
  "reviews.list.load_more": "Show more",
  "reviews.list.refresh": "Refresh",
  "reviews.list.more.blocked.end": "That is all of them",
  "reviews.list.more.blocked.pending": "Loading…",

  "reviews.review.author_fallback": "A customer",
  "reviews.review.response_heading": "Reply from the seller",

  "reviews.status.pending": "Awaiting moderation",
  "reviews.status.hidden": "Hidden by moderation",
  "reviews.status.unknown": "Unknown state: {status}",

  "reviews.rating.none": "No rating yet",
  "reviews.rating.value": "{avg} out of {max}",
  "reviews.rating.count": "{count} reviews",
  "reviews.rating.star_label": "{index} out of {max}",

  "reviews.form.heading": "Rate this",
  "reviews.form.rating_label": "Your rating",
  "reviews.form.body_label": "Your review",
  "reviews.form.body_placeholder": "What was the deal like? (optional)",
  "reviews.form.submit": "Send",
  "reviews.form.sent.published": "Thank you — your review is published",
  "reviews.form.sent.pending":
    "Thank you — your review will appear once it has been checked",
  "reviews.form.sent.hidden": "Your review was saved but is not shown",
  "reviews.form.sent.unknown": "Your review was saved",
  "reviews.form.sign_in_required": "Sign in to leave a review",
  "reviews.form.sign_in": "Sign in",

  "reviews.submit.blocked.no_rating": "Choose a rating first",
  "reviews.submit.blocked.pending": "Sending…",
  "reviews.submit.blocked.duplicate": "You have already rated this",
  "reviews.submit.blocked.submitted": "Your review has been sent",
  "reviews.submit.blocked.forbidden": "You cannot review this",
};

/** Register the English bundle into a core i18n engine. */
export function registerReviewsI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, reviewsI18nBundleEn);
}
