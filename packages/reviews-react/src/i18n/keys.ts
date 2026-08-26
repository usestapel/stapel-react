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
  listEmptyHint: "reviews.list.empty_hint",
  listLoadMore: "reviews.list.load_more",
  listRefresh: "reviews.list.refresh",
  moreBlockedEnd: "reviews.list.more.blocked.end",
  moreBlockedPending: "reviews.list.more.blocked.pending",
  /**
   * `include=all` was asked for and nothing on screen proves it was granted.
   * The view narrows a non-moderator's request to published-only SILENTLY —
   * no error, no flag in the body — so the only honest thing a client can do
   * is say what it asked for and what it can vouch for.
   */
  listScopeNarrowed: "reviews.list.scope.narrowed",

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
  ratingStarLabel: "reviews.rating.star_label",

  // The form. `formSignInRequired` is the ONLY sign-in key left: since
  // stapel-reviews 0.3.0 both reads are anonymous and only the POST refuses a
  // guest, so "sign in" is copy for the write and never a wall in front of
  // the content.
  formHeading: "reviews.form.heading",
  formRatingLabel: "reviews.form.rating_label",
  /** The scale, said out loud: a row of stars alone does not say what the
   * ends mean, and on a 1-10 scale it does not even say how many there are. */
  formRatingHint: "reviews.form.rating_hint",
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

  // ── The moderation queue ──────────────────────────────────────────────────
  // `POST {id}/moderate`, reachable at last. The pane is state-gated on a
  // capability the HOST declares and the SERVER decides: every control is
  // rendered switched off with its reason rather than omitted, because a
  // moderator whose callback was mis-wired needs to see that the verdict
  // exists and is refused, not an empty pane.
  moderationHeading: "reviews.moderation.heading",
  moderationHint: "reviews.moderation.hint",
  moderationEmpty: "reviews.moderation.empty",
  moderationEmptyHint: "reviews.moderation.empty_hint",
  moderationEmptyFiltered: "reviews.moderation.empty_filtered",
  moderationFilterLabel: "reviews.moderation.filter.label",
  moderationFilterAll: "reviews.moderation.filter.all",
  moderationFilterPending: "reviews.moderation.filter.pending",
  moderationFilterHidden: "reviews.moderation.filter.hidden",
  moderationHide: "reviews.moderation.hide",
  moderationPublish: "reviews.moderation.publish",
  moderationReasonLabel: "reviews.moderation.reason_label",
  moderationReasonPlaceholder: "reviews.moderation.reason_placeholder",
  moderationReasonHint: "reviews.moderation.reason_hint",
  moderationConfirmHide: "reviews.moderation.confirm_hide",
  moderationConfirmHideBody: "reviews.moderation.confirm_hide_body",
  moderationDoneHidden: "reviews.moderation.done.hidden",
  moderationDonePublished: "reviews.moderation.done.published",
  moderationDoneUnknown: "reviews.moderation.done.unknown",

  moderateBlockedNotModerator: "reviews.moderate.blocked.not_moderator",
  moderateBlockedAlreadyHidden: "reviews.moderate.blocked.already_hidden",
  moderateBlockedAlreadyPublished: "reviews.moderate.blocked.already_published",
  moderateBlockedPending: "reviews.moderate.blocked.pending",
  moderateBlockedForbidden: "reviews.moderate.blocked.forbidden",
  moderateBlockedGone: "reviews.moderate.blocked.gone",
  moderateBlockedSignIn: "reviews.moderate.blocked.sign_in",

  // ── The seller's reply ────────────────────────────────────────────────────
  // `POST {id}/response`. One per review, forever — the module's only 409 —
  // so the composer states that BEFORE it is spent, not after.
  responseComposeLabel: "reviews.response.compose_label",
  responsePlaceholder: "reviews.response.placeholder",
  responseSubmit: "reviews.response.submit",
  responseSent: "reviews.response.sent",
  responseOnlyOne: "reviews.response.only_one",

  respondBlockedNotOwner: "reviews.respond.blocked.not_owner",
  respondBlockedEmpty: "reviews.respond.blocked.empty",
  respondBlockedPending: "reviews.respond.blocked.pending",
  respondBlockedAlready: "reviews.respond.blocked.already",
  respondBlockedNotAllowed: "reviews.respond.blocked.not_allowed",
  respondBlockedForbidden: "reviews.respond.blocked.forbidden",
  respondBlockedSignIn: "reviews.respond.blocked.sign_in",
  respondBlockedGone: "reviews.respond.blocked.gone",

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
 * Plural FAMILIES — rendered through core's `tPlural`, never `t`.
 *
 * They are a separate map because they are a different kind of key: a family
 * has no value of its own, only `<family>.<CLDR category>` children, and which
 * children exist is a fact about the LANGUAGE (English catalogues `one` and
 * `other`; Russian also needs `few` and `many`). Reaching one through `t`
 * would render the family name on the page, which is why `i18n-key-exists`
 * demands `<family>.other` for a `tPlural` call and the verbatim key for a `t`
 * call — one mechanism, spelled the same way in the runtime and in the lint.
 *
 * "12 reviews" was one flat string here until this release, so English said
 * "1 reviews" and Russian dodged the problem by putting the numeral last.
 */
export const REVIEWS_I18N_PLURALS = {
  ratingCount: "reviews.rating.count",
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
  "reviews.list.empty_hint": "Be the first to say how it went.",
  "reviews.list.load_more": "Show more",
  "reviews.list.refresh": "Refresh",
  "reviews.list.more.blocked.end": "That is all of them",
  "reviews.list.more.blocked.pending": "Loading…",
  "reviews.list.scope.narrowed": "Published reviews only.",

  "reviews.review.author_fallback": "A customer",
  "reviews.review.response_heading": "Reply from the seller",

  "reviews.status.pending": "Awaiting moderation",
  "reviews.status.hidden": "Hidden by moderation",
  // The raw status (`quarantined`) is the server's vocabulary and a
  // moderator can do nothing with it; the machine name stays on the element.
  "reviews.status.unknown": "Not yet published",

  "reviews.rating.none": "No rating yet",
  "reviews.rating.value": "{avg} out of {max}",
  "reviews.rating.count.one": "{count} review",
  "reviews.rating.count.other": "{count} reviews",
  "reviews.rating.star_label": "{index} out of {max}",

  "reviews.form.heading": "Rate this",
  "reviews.form.rating_label": "Your rating",
  "reviews.form.rating_hint": "Tap a star: {min} is poor, {max} is excellent.",
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

  "reviews.moderation.heading": "Moderation",
  "reviews.moderation.hint":
    "Everything written about this item, including what the public cannot see. The server decides what it sends you.",
  "reviews.moderation.empty": "Nothing to moderate",
  "reviews.moderation.empty_hint": "No reviews have been written about this yet.",
  "reviews.moderation.empty_filtered":
    "Nothing in this view among the reviews loaded so far",
  "reviews.moderation.filter.label": "Which reviews to show",
  "reviews.moderation.filter.all": "Everything",
  "reviews.moderation.filter.pending": "Awaiting moderation",
  "reviews.moderation.filter.hidden": "Hidden",
  "reviews.moderation.hide": "Hide",
  "reviews.moderation.publish": "Publish",
  "reviews.moderation.reason_label": "Reason",
  "reviews.moderation.reason_placeholder": "Why, in your own words",
  "reviews.moderation.reason_hint":
    "Kept in the moderation record. Neither the author nor the public sees it.",
  "reviews.moderation.confirm_hide": "Hide this review?",
  "reviews.moderation.confirm_hide_body":
    "It stops being visible to everyone and stops counting towards the rating. You can publish it again later.",
  "reviews.moderation.done.hidden": "Hidden",
  "reviews.moderation.done.published": "Published",
  "reviews.moderation.done.unknown": "Saved",

  "reviews.moderate.blocked.not_moderator":
    "Only a moderator of this item can hide or publish reviews",
  "reviews.moderate.blocked.already_hidden": "Already hidden",
  "reviews.moderate.blocked.already_published": "Already published",
  "reviews.moderate.blocked.pending": "Working…",
  "reviews.moderate.blocked.forbidden":
    "The server does not accept you as a moderator of this item",
  "reviews.moderate.blocked.gone": "This review no longer exists",
  "reviews.moderate.blocked.sign_in": "Sign in to moderate",

  "reviews.response.compose_label": "Your reply",
  "reviews.response.placeholder": "Answer the customer, publicly",
  "reviews.response.submit": "Reply",
  "reviews.response.sent": "Your reply is published",
  "reviews.response.only_one":
    "A review takes one reply, and it cannot be changed afterwards.",

  "reviews.respond.blocked.not_owner":
    "Only the owner of this item can reply to its reviews",
  "reviews.respond.blocked.empty": "Write the reply first",
  "reviews.respond.blocked.pending": "Sending…",
  "reviews.respond.blocked.already": "This review already has a reply",
  "reviews.respond.blocked.not_allowed":
    "Replies are switched off for this kind of item",
  "reviews.respond.blocked.forbidden":
    "The server does not accept you as the owner of this item",
  "reviews.respond.blocked.sign_in": "Sign in to reply",
  "reviews.respond.blocked.gone": "This review no longer exists",
};

/** Register the English bundle into a core i18n engine. */
export function registerReviewsI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, reviewsI18nBundleEn);
}
