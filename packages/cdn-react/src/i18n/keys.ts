import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { cdnErrorBundleEn } from "./generated/errors.gen.js";

/**
 * cdn-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these through core's
 * i18n engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English for both the backend's codes (generated) and the pair's own UI keys.
 */
export const CDN_I18N_KEYS = {
  unknownError: "cdn.error.unknown",

  // The picker
  pickImage: "cdn.pick.image",
  pickImages: "cdn.pick.images",
  pickReplace: "cdn.pick.replace",
  pickHint: "cdn.pick.hint",
  pickDropHint: "cdn.pick.drop_hint",

  // Phases. The upload reports which STEP is running, never a percentage —
  // see model/upload.ts for why there is no honest number to show.
  phaseHashing: "cdn.phase.hashing",
  phaseChecking: "cdn.phase.checking",
  phaseUploading: "cdn.phase.uploading",
  phaseProcessing: "cdn.phase.processing",
  phaseDone: "cdn.phase.done",
  phaseCanceled: "cdn.phase.canceled",
  phaseFailed: "cdn.phase.failed",
  phaseQueued: "cdn.phase.queued",

  // Outcomes worth saying out loud
  deduped: "cdn.outcome.deduped",
  variantsPending: "cdn.outcome.variants_pending",
  dedupSkippedNoCrypto: "cdn.outcome.dedup_skipped.no_crypto",
  dedupSkippedUnauthorized: "cdn.outcome.dedup_skipped.unauthorized",
  dedupSkippedCheckFailed: "cdn.outcome.dedup_skipped.check_failed",

  // Per-item controls
  itemCancel: "cdn.item.cancel",
  itemRetry: "cdn.item.retry",
  itemRemove: "cdn.item.remove",
  itemMoveEarlier: "cdn.item.move_earlier",
  itemMoveLater: "cdn.item.move_later",
  itemCover: "cdn.item.cover",
  itemAlt: "cdn.item.alt",

  // The gallery
  galleryCount: "cdn.gallery.count",
  galleryEmpty: "cdn.gallery.empty",

  // Blocked controls — every one of these is the `code` of an
  // ActionAvailability, so a switched-off button always has a sentence.
  blockedFull: "cdn.upload.blocked.full",
  blockedPending: "cdn.upload.blocked.pending",
  blockedFailed: "cdn.upload.blocked.failed",

  // Backend error keys the pair OWNS the localization of. stapel-cdn ships
  // English only (no `translations/` directory at all), so its 11 keys are
  // absent from the generated ru/es bundles and are authored in `./i18n/<lang>`
  // instead — the stapel-forms/stapel_attributes precedent, applied twice
  // before this (forms, chat). Listed here so `i18n-key-exists` knows them and
  // `test/i18n.test.ts` can prove all three locales carry them.
  errorFileHashRequired: "error.400.file_hash_required",
  errorFileTypeNotAllowed: "error.400.file_type_not_allowed",
  errorInvalidFormat: "error.400.invalid_format",
  errorInvalidHash: "error.400.invalid_hash",
  errorInvalidImageType: "error.400.invalid_image_type",
  errorMissingFields: "error.400.missing_fields",
  errorTooManyRefs: "error.400.too_many_refs",
  errorNoFile: "error.400.no_file",
  errorStorageQuotaExceeded: "error.403.storage_quota_exceeded",
  errorNoImages: "error.404.no_images",
  errorFileTooLarge: "error.413.file_too_large",
  errorImageDecoderUnavailable: "error.503.image_decoder_unavailable",
} as const;

/**
 * The English bundle: the generated backend fallbacks first, this pair's own
 * UI copy over them. English is INLINE (not a separate subpath) so a host that
 * registers nothing still renders sentences instead of raw keys.
 */
export const cdnI18nBundleEn: I18nDictionary = {
  ...cdnErrorBundleEn,

  "cdn.error.unknown": "Something went wrong with this upload",

  "cdn.pick.image": "Choose an image",
  "cdn.pick.images": "Add photos",
  "cdn.pick.replace": "Replace",
  "cdn.pick.hint": "{formats} · up to {maxMb} MB",
  "cdn.pick.drop_hint": "Drop files here, or click to choose",

  "cdn.phase.hashing": "Reading the file…",
  "cdn.phase.checking": "Checking whether we already have it…",
  "cdn.phase.uploading": "Uploading…",
  "cdn.phase.processing": "Preparing previews…",
  "cdn.phase.done": "Ready",
  "cdn.phase.canceled": "Canceled",
  "cdn.phase.failed": "Failed",
  "cdn.phase.queued": "Waiting its turn",

  "cdn.outcome.deduped": "Already uploaded — nothing was sent again",
  "cdn.outcome.variants_pending":
    "Previews are still being generated; the photo is saved",
  "cdn.outcome.dedup_skipped.no_crypto":
    "This page cannot hash files, so the duplicate check was skipped",
  "cdn.outcome.dedup_skipped.unauthorized":
    "The duplicate check needs a signed-in account; the upload went ahead",
  "cdn.outcome.dedup_skipped.check_failed":
    "The duplicate check did not answer; the upload went ahead",

  "cdn.item.cancel": "Cancel",
  "cdn.item.retry": "Try again",
  "cdn.item.remove": "Remove",
  "cdn.item.move_earlier": "Move earlier",
  "cdn.item.move_later": "Move later",
  "cdn.item.cover": "Cover photo",
  "cdn.item.alt": "Uploaded photo",

  "cdn.gallery.count": "{used} of {max} photos",
  "cdn.gallery.empty": "No photos yet",

  "cdn.upload.blocked.full": "This gallery holds at most {max} photos",
  "cdn.upload.blocked.pending": "Wait for the uploads to finish",
  "cdn.upload.blocked.failed": "Remove or retry the photos that failed",
};

/** Register the English bundle into a core i18n engine. */
export function registerCdnI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, cdnI18nBundleEn);
}
