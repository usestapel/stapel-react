import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { listingsErrorBundleEn } from "./generated/errors.gen.js";

/**
 * listings-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's
 * i18n engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for the 63 backend error codes (generated) plus the
 * pair's own UI keys. All UI keys live under the `listings.` namespace.
 *
 * ── WHAT IS DELIBERATELY NOT IN THIS FILE ──────────────────────────────────
 *
 * **The twelve `error.400.feature_*` / `description_too_*` keys.** They are
 * owned by `stapel_attributes` and translated by `@stapel/attributes-react`
 * (`/i18n/ru`, `/i18n/es`) — the package that draws and mirrors those values.
 * Restating them here would give one refusal two sentences. A host registers
 * both bundles; `test/i18n.test.ts` proves the union covers the whole
 * registry in all three locales.
 *
 * **A category name, a feature name, an option label.** All three arrive from
 * the wire as translation keys; a deployment's catalogue copy belongs in the
 * HOST's bundle. Same rule `@stapel/categories-react` writes down at length.
 *
 * **`listings.compose.blocked.unsupported_type` is HERE and its twin is
 * not.** `@stapel/attributes-react` owns the FACT (`unsupportedTypes` /
 * `unsupportedTypeGate`) and its own key; this pair raises its own sentence
 * from the same fact rather than re-deriving the fact or borrowing the other
 * package's namespace (spec §13.2, note 3, which called for exactly this
 * split).
 */
export const LISTINGS_I18N_KEYS = {
  unknownError: "listings.error.unknown",

  // ── the lifecycle axis (nine states) ─────────────────────────────────────
  statusDraft: "listings.status.draft",
  statusPending: "listings.status.pending",
  statusPublished: "listings.status.published",
  statusPaused: "listings.status.paused",
  statusExpired: "listings.status.expired",
  statusSold: "listings.status.sold",
  statusRejected: "listings.status.rejected",
  statusBlocked: "listings.status.blocked",
  statusArchived: "listings.status.archived",

  // ── the moderation axis (what the owner is told, given BOTH fields) ──────
  /** First submission: nothing is public yet. */
  moderationFirstReview: "listings.moderation.first_review",
  /** THE 0.5.0 sentence: live to everyone, edit under re-screening. */
  moderationLiveEditPending: "listings.moderation.live_edit_pending",
  /** A pending verdict on a listing the lifecycle already took offline. */
  moderationPendingOffline: "listings.moderation.pending_offline",
  moderationNeedsReview: "listings.moderation.needs_review",
  moderationLiveNeedsReview: "listings.moderation.live_needs_review",
  moderationRejected: "listings.moderation.rejected",
  /** Refused by a moderator while the lifecycle has not moved yet. */
  moderationRejectedStillLive: "listings.moderation.rejected_still_live",

  // ── card ─────────────────────────────────────────────────────────────────
  cardNoPhoto: "listings.card.no_photo",
  cardPhotoUnavailable: "listings.card.photo_unavailable",
  cardPriceAbsent: "listings.card.price_absent",
  cardFavoriteAdd: "listings.card.favorite_add",
  cardFavoriteRemove: "listings.card.favorite_remove",
  cardOpen: "listings.card.open",
  /** The door beside a blocked favourite: the container supplies WHERE. */
  cardSignIn: "listings.card.sign_in",

  // ── detail ───────────────────────────────────────────────────────────────
  detailLoading: "listings.detail.loading",
  detailLoadFailed: "listings.detail.load_failed",
  detailRetry: "listings.detail.retry",
  detailNotFound: "listings.detail.not_found",
  /** Soft-deleted: the status probe answers where the detail 404s. */
  detailRemoved: "listings.detail.removed",
  /** Readable by id, but not on the shelf — and the reader is not the owner. */
  detailNotPublished: "listings.detail.not_published",
  detailOwnerOnlyView: "listings.detail.owner_only_view",
  detailDescription: "listings.detail.description",
  detailSpecs: "listings.detail.specs",
  detailNoSpecs: "listings.detail.no_specs",
  detailUnreadableFeatures: "listings.detail.unreadable_features",
  detailPhotosUnavailable: "listings.detail.photos_unavailable",
  detailPhotoAlt: "listings.detail.photo_alt",
  detailPublishedAt: "listings.detail.published_at",
  detailExpiresAt: "listings.detail.expires_at",
  /** The stock ROW'S LABEL. antd's `<Descriptions>` renders the colon and the
   * quantity in the value cell, so this key carries no `{count}` — it used to,
   * and the live page printed the placeholder. */
  detailStock: "listings.detail.stock",

  // ── composer ─────────────────────────────────────────────────────────────
  composeNewTitle: "listings.compose.new_title",
  composeEditTitle: "listings.compose.edit_title",
  composeCategory: "listings.compose.category",
  composeCategoryHelp: "listings.compose.category_help",
  composeCategoryRequired: "listings.compose.category_required",
  composeCategoryChangedDropped: "listings.compose.category_changed_dropped",
  composeTitleLabel: "listings.compose.title_label",
  composeTitleTooLong: "listings.compose.title_too_long",
  composeDescriptionLabel: "listings.compose.description_label",
  composePriceLabel: "listings.compose.price_label",
  composePriceInvalid: "listings.compose.price_invalid",
  composeCurrencyLabel: "listings.compose.currency_label",
  composeLocationLabel: "listings.compose.location_label",
  composeLatLabel: "listings.compose.lat_label",
  composeLonLabel: "listings.compose.lon_label",
  composeGeoIncomplete: "listings.compose.geo_incomplete",
  composePhotos: "listings.compose.photos",
  composeTooManyImages: "listings.compose.too_many_images",
  composeDetails: "listings.compose.details",
  composeDetailsLoading: "listings.compose.details_loading",
  composeDetailsFailed: "listings.compose.details_failed",
  composeDetailsEmpty: "listings.compose.details_empty",
  composeCountable: "listings.compose.countable",
  composeStock: "listings.compose.stock",
  composeAutoRepublish: "listings.compose.auto_republish",
  composeSave: "listings.compose.save",
  composeSaving: "listings.compose.saving",
  composeSaved: "listings.compose.saved",
  composePublish: "listings.compose.publish",
  composeRepublish: "listings.compose.republish",
  composePublishing: "listings.compose.publishing",
  composePublishedFirst: "listings.compose.published_first",
  composePublishedLive: "listings.compose.published_live",
  composeInvalidSummary: "listings.compose.invalid_summary",

  // ── composer: every switched-off control states its reason ───────────────
  composeBlockedNoCategory: "listings.compose.blocked.no_category",
  composeBlockedUnsupportedType: "listings.compose.blocked.unsupported_type",
  composeBlockedPhotosPending: "listings.compose.blocked.photos_pending",
  composeBlockedNoDraft: "listings.compose.blocked.no_draft",
  composeBlockedBusy: "listings.compose.blocked.busy",
  composeBlockedMirror: "listings.compose.blocked.mirror",
  composeBlockedDetailsUnavailable: "listings.compose.blocked.details_unavailable",

  // ── the owner's dashboard ────────────────────────────────────────────────
  mineTitle: "listings.mine.title",
  mineTabActive: "listings.mine.tab.active",
  mineTabDrafts: "listings.mine.tab.drafts",
  mineTabArchived: "listings.mine.tab.archived",
  mineLoading: "listings.mine.loading",
  mineLoadFailed: "listings.mine.load_failed",
  mineEmpty: "listings.mine.empty",
  mineRetry: "listings.mine.retry",
  mineCountersFailed: "listings.mine.counters_failed",
  /** The upstream gap, named on screen — see `headless/MyListings.tsx`. */
  mineSourceMissing: "listings.mine.source_missing",
  mineLiveUnderReview: "listings.mine.live_under_review",
  mineEdit: "listings.mine.edit",
  mineArchive: "listings.mine.archive",
  mineComplete: "listings.mine.complete",
  mineDelete: "listings.mine.delete",

  // ── favourites ───────────────────────────────────────────────────────────
  favoritesTitle: "listings.favorites.title",
  favoritesLoading: "listings.favorites.loading",
  favoritesLoadFailed: "listings.favorites.load_failed",
  favoritesEmpty: "listings.favorites.empty",

  // ── gates shared by every action a visitor cannot take ───────────────────
  blockedSignIn: "listings.blocked.sign_in",
  blockedGuest: "listings.blocked.guest",
  blockedMandateUnknown: "listings.blocked.mandate_unknown",
  /** A lifecycle move the server's whitelist does not allow, named with the
   * status it would be moving FROM. */
  blockedTransition: "listings.blocked.transition",
  blockedDeleteActive: "listings.blocked.delete_active",
  blockedInFlight: "listings.blocked.in_flight",

  // ── keyset pagination ────────────────────────────────────────────────────
  pagePrev: "listings.page.prev",
  pageNext: "listings.page.next",

  // ── nav labels ───────────────────────────────────────────────────────────
  navDetail: "listings.nav.detail",
  navCompose: "listings.nav.compose",
  navMine: "listings.nav.mine",
  navFavorites: "listings.nav.favorites",
} as const;

export type ListingsI18nKey =
  (typeof LISTINGS_I18N_KEYS)[keyof typeof LISTINGS_I18N_KEYS];

/**
 * English fallback bundle for listings-react UI keys + backend error codes.
 * The generated backend texts are spread FIRST so coverage of the error
 * registry is by construction; the pair's own copy follows.
 */
export const listingsI18nBundleEn: Record<string, string> = {
  ...listingsErrorBundleEn,

  "listings.error.unknown": "Something went wrong with this listing",

  "listings.status.draft": "Draft",
  "listings.status.pending": "Awaiting review",
  "listings.status.published": "Published",
  "listings.status.paused": "Paused",
  "listings.status.expired": "Expired",
  "listings.status.sold": "Sold",
  "listings.status.rejected": "Rejected",
  "listings.status.blocked": "Taken down",
  "listings.status.archived": "Archived",

  "listings.moderation.first_review":
    "Sent for review. It goes on sale once a moderator approves it.",
  "listings.moderation.live_edit_pending":
    "Your listing stays published while we review the changes — buyers can see it right now.",
  "listings.moderation.pending_offline":
    "A review was requested, but this listing is no longer on sale.",
  "listings.moderation.needs_review":
    "A moderator is looking at this one by hand.",
  "listings.moderation.live_needs_review":
    "Published, and a moderator is looking at the changes by hand.",
  "listings.moderation.rejected":
    "A moderator refused this listing. Edit it and send it again.",
  "listings.moderation.rejected_still_live":
    "A moderator refused this listing; it is still visible while that is applied.",

  "listings.card.no_photo": "No photo",
  "listings.card.photo_unavailable": "Photo unavailable",
  "listings.card.price_absent": "Price on request",
  "listings.card.favorite_add": "Save to favourites",
  "listings.card.favorite_remove": "Remove from favourites",
  "listings.card.open": "Open",
  "listings.card.sign_in": "Sign in",

  "listings.detail.loading": "Loading the listing…",
  "listings.detail.load_failed": "We could not load this listing",
  "listings.detail.retry": "Try again",
  "listings.detail.not_found": "There is no listing at this address",
  "listings.detail.removed": "This listing was removed",
  "listings.detail.not_published":
    "This listing is not on sale right now, so what you see may be out of date",
  "listings.detail.owner_only_view":
    "Only you can see this — it is not published yet",
  "listings.detail.description": "Description",
  "listings.detail.specs": "Details",
  "listings.detail.no_specs": "The seller listed no extra details",
  "listings.detail.unreadable_features":
    "{count} details of this listing could not be read by this version",
  "listings.detail.photos_unavailable":
    "Photos cannot be shown here — this app has no way to resolve them",
  "listings.detail.photo_alt": "Photo {index} of {total}",
  "listings.detail.published_at": "Published {date}",
  "listings.detail.expires_at": "Listed until {date}",
  "listings.detail.stock": "In stock",

  "listings.compose.new_title": "New listing",
  "listings.compose.edit_title": "Edit listing",
  "listings.compose.category": "Category",
  "listings.compose.category_help":
    "The category decides which details buyers are asked for",
  "listings.compose.category_required": "Choose a category first",
  "listings.compose.category_changed_dropped":
    "{count} answers do not apply to this category and were cleared",
  "listings.compose.title_label": "Title",
  "listings.compose.title_too_long":
    "The title must be at most {max_length} characters",
  "listings.compose.description_label": "Description",
  "listings.compose.price_label": "Price",
  "listings.compose.price_invalid":
    "Enter a price as a number, with at most two decimals",
  "listings.compose.currency_label": "Currency",
  "listings.compose.location_label": "Where it is",
  "listings.compose.lat_label": "Latitude",
  "listings.compose.lon_label": "Longitude",
  "listings.compose.geo_incomplete":
    "A latitude needs a longitude beside it — half a coordinate points nowhere",
  "listings.compose.photos": "Photos",
  "listings.compose.too_many_images":
    "A listing can carry at most {max} photos",
  "listings.compose.details": "Details",
  "listings.compose.details_loading": "Loading what this category asks for…",
  "listings.compose.details_failed":
    "We could not load what this category asks for",
  "listings.compose.details_empty": "This category asks for no extra details",
  "listings.compose.countable": "I am selling a countable item",
  "listings.compose.stock": "How many",
  "listings.compose.auto_republish": "Re-publish automatically when it expires",
  "listings.compose.save": "Save draft",
  "listings.compose.saving": "Saving…",
  "listings.compose.saved": "Draft saved",
  "listings.compose.publish": "Publish",
  "listings.compose.republish": "Send changes",
  "listings.compose.publishing": "Sending…",
  "listings.compose.published_first":
    "Sent for review. It goes on sale once a moderator approves it.",
  "listings.compose.published_live":
    "Changes sent. Your listing stays published while we review them.",
  "listings.compose.invalid_summary":
    "{count} details need your attention before this can go out",

  "listings.compose.blocked.no_category":
    "Choose a category — the rest of the form depends on it",
  "listings.compose.blocked.unsupported_type":
    "This category asks for a kind of detail this app cannot show yet ({types}), so it cannot fill it in for you",
  "listings.compose.blocked.photos_pending":
    "Wait for the photos to finish uploading",
  "listings.compose.blocked.no_draft": "The draft has not been created yet",
  "listings.compose.blocked.busy": "One moment — the last change is still saving",
  "listings.compose.blocked.mirror":
    "Fix the highlighted fields first",
  "listings.compose.blocked.details_unavailable":
    "We could not load what this category asks for, so we cannot check the form",

  "listings.mine.title": "My listings",
  "listings.mine.tab.active": "Active",
  "listings.mine.tab.drafts": "Drafts",
  "listings.mine.tab.archived": "Archived",
  "listings.mine.loading": "Loading your listings…",
  "listings.mine.load_failed": "We could not load your listings",
  "listings.mine.empty": "Nothing here yet",
  "listings.mine.retry": "Try again",
  "listings.mine.counters_failed": "We could not count your listings",
  "listings.mine.source_missing":
    "This app cannot list your own listings yet: the listings service has no owner-scoped list endpoint. Your counts below are real.",
  "listings.mine.live_under_review":
    "Published, changes under review",
  "listings.mine.edit": "Edit",
  "listings.mine.archive": "Archive",
  "listings.mine.complete": "Mark sold",
  "listings.mine.delete": "Delete",

  "listings.favorites.title": "Favourites",
  "listings.favorites.loading": "Loading your favourites…",
  "listings.favorites.load_failed": "We could not load your favourites",
  "listings.favorites.empty": "You have not saved anything yet",

  "listings.blocked.sign_in": "Sign in to do this",
  "listings.blocked.guest":
    "Your account cannot do this yet — finish setting it up first",
  "listings.blocked.mandate_unknown":
    "We could not check your account, so we are not guessing whether you may do this",
  "listings.blocked.transition":
    "A listing that is {from_status} cannot be moved that way",
  "listings.blocked.delete_active":
    "Archive it first — a listing that is on sale cannot be deleted",
  "listings.blocked.in_flight": "One moment — that is already under way",

  "listings.page.prev": "Previous",
  "listings.page.next": "Next",

  "listings.nav.detail": "Listing",
  "listings.nav.compose": "Post a listing",
  "listings.nav.mine": "My listings",
  "listings.nav.favorites": "Favourites",
};

/**
 * Register the English bundle into a core i18n engine. Locale bundles ship as
 * opt-in subpaths (`@stapel/listings-react/i18n/ru`, `…/es`) so a host that
 * needs only English never carries them.
 *
 * A host that renders a listing's details also registers
 * `@stapel/attributes-react`'s bundles — that package owns the twelve
 * `stapel_attributes` error keys in every locale, and the value editors that
 * raise them.
 */
export function registerListingsI18n(i18n: I18nEngine): void {
  i18n.registerBundle("en", listingsI18nBundleEn as I18nDictionary);
}
