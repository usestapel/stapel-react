import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { recordingsErrorBundleEn } from "./generated/errors.gen.js";

/**
 * recordings-react's own translation KEYS (frontend-standard §4.2): components
 * never render literal strings — hosts resolve these via core's i18n engine
 * (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. All UI keys live under the `recordings.` namespace.
 *
 * Locale parity is a lint (`stapel/i18n-locale-parity`, anchored on this file):
 * every key here exists in `./ru.ts` and `./es.ts`, which ship on the
 * `@stapel/recordings-react/i18n/{ru,es}` subpaths.
 */
export const RECORDINGS_I18N_KEYS = {
  unknownError: "recordings.error.unknown",
  retry: "recordings.retry",

  // ── lifecycle vocabulary (RecordingStatus, stapel-recordings models.py) ────
  // One key per real value, plus a neutral fallback for a status this build
  // has never heard of — the wire type is deliberately open, so "unknown" is a
  // state the UI must be able to render without inventing a meaning for it.
  statusCreated: "recordings.status.created",
  statusUploading: "recordings.status.uploading",
  statusQueued: "recordings.status.queued",
  statusAnalyzing: "recordings.status.analyzing",
  statusNormalizing: "recordings.status.normalizing",
  statusTranscribing: "recordings.status.transcribing",
  statusDiarizing: "recordings.status.diarizing",
  statusMerging: "recordings.status.merging",
  statusCompleted: "recordings.status.completed",
  statusError: "recordings.status.error",
  statusDeleted: "recordings.status.deleted",
  statusUnknown: "recordings.status.unknown",
  statusProcessingLabel: "recordings.status.processing_label",

  // ── list ──────────────────────────────────────────────────────────────────
  listHeading: "recordings.list.heading",
  listLoading: "recordings.list.loading",
  listEmpty: "recordings.list.empty",
  listEmptyHint: "recordings.list.empty_hint",
  // The sentence whose absence let a total outage render as a first-run
  // screen. It is about US failing to load, never about the person having
  // uploaded nothing.
  listLoadFailed: "recordings.list.load_failed",
  listError: "recordings.list.error",
  listRetry: "recordings.list.retry",
  listOpen: "recordings.list.open",
  listWorkspaceNote: "recordings.list.workspace_note",

  // ── detail ────────────────────────────────────────────────────────────────
  detailHeading: "recordings.detail.heading",
  detailBack: "recordings.detail.back",
  detailCreated: "recordings.detail.created",
  detailDuration: "recordings.detail.duration",
  detailLanguage: "recordings.detail.language",
  detailProvider: "recordings.detail.provider",
  detailSegments: "recordings.detail.segments",
  detailSpeakers: "recordings.detail.speakers",
  detailWords: "recordings.detail.words",
  detailProcessing: "recordings.detail.processing",
  detailUnknownValue: "recordings.detail.unknown_value",

  // ── player ────────────────────────────────────────────────────────────────
  playerHeading: "recordings.player.heading",
  playerLabel: "recordings.player.label",
  playerPreparing: "recordings.player.preparing",
  playerNotStored: "recordings.player.not_stored",
  playerUnavailable: "recordings.player.unavailable",
  playerBlockedNotReady: "recordings.player.blocked_not_ready",
  playerBlockedDeleted: "recordings.player.blocked_deleted",
  playerRefresh: "recordings.player.refresh",

  // ── transcript ────────────────────────────────────────────────────────────
  transcriptHeading: "recordings.transcript.heading",
  transcriptEmpty: "recordings.transcript.empty",
  transcriptPending: "recordings.transcript.pending",
  transcriptLoadMore: "recordings.transcript.load_more",
  transcriptSpeakerFallback: "recordings.transcript.speaker_fallback",
  transcriptSeek: "recordings.transcript.seek",
  transcriptCurrent: "recordings.transcript.current",
  transcriptRegionLabel: "recordings.transcript.region_label",

  // ── summary ───────────────────────────────────────────────────────────────
  summaryHeading: "recordings.summary.heading",
  summaryEmpty: "recordings.summary.empty",

  // ── resummarize ───────────────────────────────────────────────────────────
  resummarizeAction: "recordings.resummarize.action",
  resummarizeRunning: "recordings.resummarize.running",
  resummarizeAccepted: "recordings.resummarize.accepted",
  resummarizeBlockedNoTranscript: "recordings.resummarize.blocked_no_transcript",
  resummarizeBlockedProcessing: "recordings.resummarize.blocked_processing",
  resummarizeBlockedInFlight: "recordings.resummarize.blocked_in_flight",

  // ── reprocess ─────────────────────────────────────────────────────────────
  reprocessAction: "recordings.reprocess.action",
  reprocessRunning: "recordings.reprocess.running",
  reprocessConfirmTitle: "recordings.reprocess.confirm_title",
  reprocessConfirmBody: "recordings.reprocess.confirm_body",
  reprocessConfirmOk: "recordings.reprocess.confirm_ok",
  reprocessBlockedNotCompleted: "recordings.reprocess.blocked_not_completed",
  reprocessQueued: "recordings.reprocess.queued",

  // ── metered refusal (402) ────────────────────────────────────────────────
  paymentTitle: "recordings.payment.title",
  paymentHint: "recordings.payment.hint",
  paymentAction: "recordings.payment.action",

  // ── uploader (create -> upload -> finalize, ONE surface) ─────────────────
  uploaderHeading: "recordings.uploader.heading",
  uploaderPick: "recordings.uploader.pick",
  uploaderPicked: "recordings.uploader.picked",
  uploaderTitleLabel: "recordings.uploader.title_label",
  uploaderTitlePlaceholder: "recordings.uploader.title_placeholder",
  uploaderSourceLabel: "recordings.uploader.source_label",
  uploaderLanguageLabel: "recordings.uploader.language_label",
  uploaderLanguageAuto: "recordings.uploader.language_auto",
  uploaderDiarizationLabel: "recordings.uploader.diarization_label",
  uploaderStart: "recordings.uploader.start",
  uploaderCancel: "recordings.uploader.cancel",
  uploaderStepCreating: "recordings.uploader.step_creating",
  uploaderStepUploading: "recordings.uploader.step_uploading",
  uploaderStepFinalizing: "recordings.uploader.step_finalizing",
  uploaderDone: "recordings.uploader.done",
  uploaderProgress: "recordings.uploader.progress",
  uploaderBlockedNoFile: "recordings.uploader.blocked_no_file",
  uploaderBlockedNoTitle: "recordings.uploader.blocked_no_title",
  uploaderBlockedNoWorkspace: "recordings.uploader.blocked_no_workspace",
  uploaderTooLarge: "recordings.uploader.too_large",
  uploaderUnsupportedType: "recordings.uploader.unsupported_type",
  uploaderSessionExpired: "recordings.uploader.session_expired",
  uploaderSourceMeet: "recordings.uploader.source_meet",
  uploaderSourceDictaphone: "recordings.uploader.source_dictaphone",
  uploaderSourceUpload: "recordings.uploader.source_upload",
  uploaderSourceOther: "recordings.uploader.source_other",

  // ── public share surface ─────────────────────────────────────────────────
  shareHeading: "recordings.share.heading",
  shareLockedTitle: "recordings.share.locked_title",
  shareLockedHint: "recordings.share.locked_hint",
  sharePasscodeLabel: "recordings.share.passcode_label",
  shareUnlock: "recordings.share.unlock",
  shareUnlocking: "recordings.share.unlocking",
  shareThrottled: "recordings.share.throttled",
  shareNotFound: "recordings.share.not_found",
  shareViewOnly: "recordings.share.view_only",
  shareMediaBlocked: "recordings.share.media_blocked",
  shareTranscriptBlocked: "recordings.share.transcript_blocked",
  shareFooter: "recordings.share.footer",

  // ── legacy headless copy (kept: hosts render these today) ────────────────
  composerCreate: "recordings.composer.create",
  composerCreating: "recordings.composer.creating",
  composerCreated: "recordings.composer.created",
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
  "recordings.retry": "Try again",

  "recordings.status.created": "Created",
  "recordings.status.uploading": "Uploading",
  "recordings.status.queued": "Queued",
  "recordings.status.analyzing": "Analyzing",
  "recordings.status.normalizing": "Normalizing audio",
  "recordings.status.transcribing": "Transcribing",
  "recordings.status.diarizing": "Identifying speakers",
  "recordings.status.merging": "Assembling transcript",
  "recordings.status.completed": "Ready",
  "recordings.status.error": "Failed",
  "recordings.status.deleted": "Deleted",
  "recordings.status.unknown": "Unknown state",
  "recordings.status.processing_label": "Processing",

  "recordings.list.heading": "Recordings",
  "recordings.list.loading": "Loading your recordings…",
  "recordings.list.empty": "No recordings yet.",
  "recordings.list.empty_hint": "Upload audio or video and we will transcribe it.",
  "recordings.list.load_failed":
    "We could not load your recordings. This is a problem on our side, not a sign that you have none.",
  "recordings.list.error": "Couldn't load your recordings.",
  "recordings.list.retry": "Try again",
  "recordings.list.open": "Open recording",
  "recordings.list.workspace_note":
    "Showing the recordings this workspace shares with you.",

  "recordings.detail.heading": "Recording",
  "recordings.detail.back": "Back to recordings",
  "recordings.detail.created": "Created",
  "recordings.detail.duration": "Length",
  "recordings.detail.language": "Language",
  "recordings.detail.provider": "Transcribed by",
  "recordings.detail.segments": "Segments",
  "recordings.detail.speakers": "Speakers",
  "recordings.detail.words": "Words",
  "recordings.detail.processing": "We are still working on this recording.",
  "recordings.detail.unknown_value": "Not known yet",

  "recordings.player.heading": "Playback",
  "recordings.player.label": "Recording audio",
  "recordings.player.preparing": "Preparing playback…",
  "recordings.player.not_stored": "This recording has no media file stored.",
  "recordings.player.unavailable":
    "Media delivery is unavailable right now. The recording is safe; playback is not.",
  "recordings.player.blocked_not_ready":
    "Playback opens once the upload has finished.",
  "recordings.player.blocked_deleted": "This recording was deleted.",
  "recordings.player.refresh": "Reload playback",

  "recordings.transcript.heading": "Transcript",
  "recordings.transcript.empty": "No transcript for this recording.",
  "recordings.transcript.pending":
    "The transcript appears here as it is written.",
  "recordings.transcript.load_more": "Load more of the transcript",
  "recordings.transcript.speaker_fallback": "Speaker {number}",
  "recordings.transcript.seek": "Play from {time}",
  "recordings.transcript.current": "Playing now",
  "recordings.transcript.region_label": "Transcript, follows playback",

  "recordings.summary.heading": "Summary",
  "recordings.summary.empty": "No summary for this recording yet.",

  "recordings.resummarize.action": "Rewrite summary",
  "recordings.resummarize.running": "Rewriting…",
  "recordings.resummarize.accepted":
    "Queued — the new summary replaces this one when it is ready.",
  "recordings.resummarize.blocked_no_transcript":
    "There is no transcript to summarize yet.",
  "recordings.resummarize.blocked_processing":
    "Wait for the transcript to finish first.",
  "recordings.resummarize.blocked_in_flight":
    "A rewrite is already running for this recording.",

  "recordings.reprocess.action": "Transcribe again",
  "recordings.reprocess.running": "Sending…",
  "recordings.reprocess.confirm_title": "Transcribe this recording again?",
  "recordings.reprocess.confirm_body":
    "The whole pipeline runs from the start: a second transcription, and a second charge. The current transcript and summary are replaced.",
  "recordings.reprocess.confirm_ok": "Transcribe again",
  "recordings.reprocess.blocked_not_completed":
    "Only a finished recording can be transcribed again.",
  "recordings.reprocess.queued": "Queued — transcription has started over.",

  "recordings.payment.title": "This needs available balance",
  "recordings.payment.hint":
    "Transcription and summaries are metered. Top up to run this again.",
  "recordings.payment.action": "Top up",

  "recordings.uploader.heading": "New recording",
  "recordings.uploader.pick": "Choose audio or video",
  "recordings.uploader.picked": "{name} · {size}",
  "recordings.uploader.title_label": "Title",
  "recordings.uploader.title_placeholder": "What is this recording?",
  "recordings.uploader.source_label": "Source",
  "recordings.uploader.language_label": "Spoken language",
  "recordings.uploader.language_auto": "Detect automatically",
  "recordings.uploader.diarization_label": "Tell speakers apart",
  "recordings.uploader.start": "Upload and transcribe",
  "recordings.uploader.cancel": "Cancel upload",
  "recordings.uploader.step_creating": "Opening the upload…",
  "recordings.uploader.step_uploading": "Uploading…",
  "recordings.uploader.step_finalizing": "Finishing up…",
  "recordings.uploader.done": "Uploaded — transcription queued.",
  "recordings.uploader.progress": "{done} of {total}",
  "recordings.uploader.blocked_no_file": "Choose a file first.",
  "recordings.uploader.blocked_no_title": "Give the recording a title.",
  "recordings.uploader.blocked_no_workspace":
    "Pick a workspace to put this recording in.",
  "recordings.uploader.too_large": "That file is larger than this upload allows.",
  "recordings.uploader.unsupported_type":
    "That file is not audio or video, so there is nothing to transcribe.",
  "recordings.uploader.session_expired":
    "The upload window closed. Start the upload again.",
  "recordings.uploader.source_meet": "Meeting",
  "recordings.uploader.source_dictaphone": "Dictaphone",
  "recordings.uploader.source_upload": "Upload",
  "recordings.uploader.source_other": "Other",

  "recordings.share.heading": "Shared recording",
  "recordings.share.locked_title": "This link is protected",
  "recordings.share.locked_hint":
    "Enter the passcode you were given to open the recording.",
  "recordings.share.passcode_label": "Passcode",
  "recordings.share.unlock": "Open recording",
  "recordings.share.unlocking": "Checking…",
  "recordings.share.throttled":
    "Too many attempts. Wait a moment before trying again.",
  "recordings.share.not_found":
    "This link does not open anything — it may have been revoked or expired.",
  "recordings.share.view_only":
    "This link shows the recording's details only.",
  "recordings.share.media_blocked": "This link does not include the audio.",
  "recordings.share.transcript_blocked":
    "This link does not include the transcript.",
  "recordings.share.footer": "Shared with you through a link.",

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
 * The `ru` / `es` bundles ship on their own subpaths
 * (`@stapel/recordings-react/i18n/ru`) and are registered the same way.
 */
export function registerRecordingsI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, recordingsI18nBundleEn);
}
