import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { recordingsErrorBundleEn } from "./generated/errors.gen.js";

/**
 * recordings-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. All UI keys live under the `recordings.` namespace.
 */
export const RECORDINGS_I18N_KEYS = {
  unknownError: "recordings.error.unknown",
  // Recording list (RecordingList headless)
  listLoading: "recordings.list.loading",
  listEmpty: "recordings.list.empty",
  listError: "recordings.list.error",
  listRetry: "recordings.list.retry",
  // Composer (RecordingComposer headless)
  composerCreate: "recordings.composer.create",
  composerCreating: "recordings.composer.creating",
  composerCreated: "recordings.composer.created",
  // Upload + finalize (UploadFinalizer headless)
  uploadUploading: "recordings.upload.uploading",
  finalizeSubmit: "recordings.finalize.submit",
  finalizeFinalizing: "recordings.finalize.finalizing",
  finalizeDone: "recordings.finalize.done",
} as const;

export type RecordingsI18nKey =
  (typeof RECORDINGS_I18N_KEYS)[keyof typeof RECORDINGS_I18N_KEYS];

/**
 * English fallback bundle for recordings-react UI keys + backend error codes.
 * The generated `recordingsErrorBundleEn` (from stapel-recordings's error
 * registry, `pnpm gen:errors`) is spread FIRST so every backend `error.*` key
 * has a fallback — a `StapelApiError.code` never renders as a raw key.
 * Hand-polished copy below then OVERRIDES the generated English for the keys
 * users see most.
 */
export const recordingsI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...recordingsErrorBundleEn,

  // recordings-react UI
  "recordings.error.unknown": "Something went wrong. Please try again.",
  "recordings.list.loading": "Loading your recordings…",
  "recordings.list.empty": "No recordings yet.",
  "recordings.list.error": "Couldn't load your recordings.",
  "recordings.list.retry": "Try again",
  "recordings.composer.create": "New recording",
  "recordings.composer.creating": "Creating…",
  "recordings.composer.created": "Recording created — upload your media.",
  "recordings.upload.uploading": "Uploading…",
  "recordings.finalize.submit": "Finish upload",
  "recordings.finalize.finalizing": "Finalizing…",
  "recordings.finalize.done": "Upload finalized — transcription queued.",
};

/**
 * Register recordings-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`); a later
 * `loadLocale` from stapel-translate can layer localized overrides on top.
 *
 * MERGE-PRIORITY CONVENTION (i18n-shipping.md §3): registration order is
 * override priority — later wins per key. The generated en floor is registered
 * UNDER the pair's polish copy here (coverage by construction), and a HOST
 * bundle registered AFTER this call overrides any pair text without a fork.
 * stapel-recordings ships no locale catalogs yet, so this pair is en-only; a
 * `./i18n/<locale>` subpath follows the notifications etalon once it does.
 */
export function registerRecordingsI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, recordingsI18nBundleEn);
}
