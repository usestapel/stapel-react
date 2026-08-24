import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { gdprErrorBundleEn } from "./generated/errors.gen.js";

/**
 * gdpr-react's own translation KEYS (frontend-standard §4.2): components never
 * render literal strings — hosts resolve these through core's i18n engine
 * (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English for both the backend's codes (generated) and the pair's own UI keys.
 *
 * ── Every screen here is about something disappearing ─────────────────────
 *
 * That makes the copy load-bearing in a way a usage table's is not. Three
 * rules the strings below keep, and the i18n suite asserts:
 *
 * 1. A DATE, never a duration. "Your account will be deleted on 23 September"
 *    is checkable; "in 30 days" is a promise the reader has to compute and
 *    cannot verify against the row.
 * 2. Two clocks are two sentences. `due_at` is when WE are done; the module
 *    also carries `fully_erased_by`, which is when the last subprocessor's
 *    contractual window closes. Collapsing them would state the shorter one
 *    as if it were the whole truth.
 * 3. Nothing here says "deleted" about something merely queued. `state` is on
 *    the wire for exactly that reason.
 */
export const GDPR_I18N_KEYS = {
  unknownError: "gdpr.error.unknown",
  /** The one recovery affordance every failed READ on this surface offers. */
  retry: "gdpr.action.retry",
  /** Dismissal — the accessible name of a dialog's close button, and of the
   * grab handle the same dialog grows when it is a bottom sheet on a phone. */
  close: "gdpr.action.close",
  /** Every staff screen's refusal — the nav axis cannot say "staff". */
  staffOnly: "gdpr.admin.staff_only",

  // Section headings — also the nav labels (see `nav/manifest.ts`).
  privacyHeading: "gdpr.privacy.heading",
  adminHeading: "gdpr.admin.heading",

  // ── Account closure ──────────────────────────────────────────────────────
  closureHeading: "gdpr.closure.heading",
  closureExplain: "gdpr.closure.explain",
  closureLoading: "gdpr.closure.loading",
  /** The 404 arm, rendered as the state it actually is. */
  closureNone: "gdpr.closure.none",
  closureInitiate: "gdpr.closure.initiate",
  closureConfirmTitle: "gdpr.closure.confirm_title",
  closureConfirmBody: "gdpr.closure.confirm_body",
  closureConfirmOk: "gdpr.closure.confirm_ok",
  closureConfirmCancel: "gdpr.closure.confirm_cancel",
  /** The banner. Carries the DATE, never a countdown. */
  closureScheduled: "gdpr.closure.scheduled",
  closureCancel: "gdpr.closure.cancel",
  closureCancelled: "gdpr.closure.cancelled",
  /** Grace is over — the erasure is running and cannot be recalled. */
  closureDeleting: "gdpr.closure.deleting",
  closureDeleted: "gdpr.closure.deleted",

  // ── Pending deletions (the caller's own erasures) ────────────────────────
  deletionsHeading: "gdpr.deletions.heading",
  deletionsLoading: "gdpr.deletions.loading",
  deletionsEmpty: "gdpr.deletions.empty",
  deletionsColumnSubject: "gdpr.deletions.column.subject",
  deletionsColumnState: "gdpr.deletions.column.state",
  deletionsColumnDue: "gdpr.deletions.column.due",
  deletionsColumnFullyErased: "gdpr.deletions.column.fully_erased",
  /** The second clock, named as its own thing. */
  deletionsFullyErasedHint: "gdpr.deletions.fully_erased_hint",
  deletionsWaitingOn: "gdpr.deletions.waiting_on",
  deletionsStateQueued: "gdpr.deletions.state.queued",
  deletionsStateErasing: "gdpr.deletions.state.erasing",
  deletionsStateDeleted: "gdpr.deletions.state.deleted",
  /** An owner never answered. The person is told, not left with a green tick. */
  deletionsStateTimeout: "gdpr.deletions.state.timeout",
  deletionsTimeoutHint: "gdpr.deletions.timeout_hint",

  // Subject vocabulary. `SUBJECT_TYPES` is host-extensible, so an unknown
  // subject renders its own raw name rather than a wrong one.
  subjectAccount: "gdpr.subject.account",
  subjectWorkspace: "gdpr.subject.workspace",
  subjectMeeting: "gdpr.subject.meeting",
  subjectRecording: "gdpr.subject.recording",
  subjectDocument: "gdpr.subject.document",
  subjectFile: "gdpr.subject.file",

  // ── Data export ──────────────────────────────────────────────────────────
  exportHeading: "gdpr.export.heading",
  exportExplain: "gdpr.export.explain",
  exportLoading: "gdpr.export.loading",
  /** The other "404 that is a state": no export was ever requested. */
  exportNone: "gdpr.export.none",
  exportRequest: "gdpr.export.request",
  exportRequested: "gdpr.export.requested",
  /** Why the request button is off while an archive is already being built —
   * printed beside the control, because a disabled button has no tooltip. */
  exportInFlight: "gdpr.export.in_flight",
  exportProgress: "gdpr.export.progress",
  exportPartial: "gdpr.export.partial",
  exportExpires: "gdpr.export.expires",
  exportDownload: "gdpr.export.download",
  /** The archive link is emailed; the pair never invents a token. */
  exportTokenHint: "gdpr.export.token_hint",
  exportStatePending: "gdpr.export.state.pending",
  exportStateProcessing: "gdpr.export.state.processing",
  exportStateReady: "gdpr.export.state.ready",
  exportStateFailed: "gdpr.export.state.failed",
  exportStateExpired: "gdpr.export.state.expired",

  // ── DSAR intake ──────────────────────────────────────────────────────────
  dsarHeading: "gdpr.dsar.heading",
  dsarExplain: "gdpr.dsar.explain",
  dsarKindLabel: "gdpr.dsar.kind_label",
  dsarKindAccess: "gdpr.dsar.kind.access",
  dsarKindErasure: "gdpr.dsar.kind.erasure",
  dsarKindRectification: "gdpr.dsar.kind.rectification",
  dsarKindPortability: "gdpr.dsar.kind.portability",
  dsarEmailLabel: "gdpr.dsar.email_label",
  dsarEmailRequired: "gdpr.dsar.email_required",
  dsarNoteLabel: "gdpr.dsar.note_label",
  dsarSubmit: "gdpr.dsar.submit",
  /** The acknowledgement IS the answer to the three-business-day clock. */
  dsarSubmitted: "gdpr.dsar.submitted",
  dsarReference: "gdpr.dsar.reference",
  dsarAckBy: "gdpr.dsar.ack_by",
  dsarResolveBy: "gdpr.dsar.resolve_by",

  // ── Staff: the DSAR queue ────────────────────────────────────────────────
  queueHeading: "gdpr.queue.heading",
  queueLoading: "gdpr.queue.loading",
  queueEmpty: "gdpr.queue.empty",
  queueColumnReference: "gdpr.queue.column.reference",
  queueColumnKind: "gdpr.queue.column.kind",
  queueColumnChannel: "gdpr.queue.column.channel",
  queueColumnSubject: "gdpr.queue.column.subject",
  queueColumnState: "gdpr.queue.column.state",
  queueColumnAckDue: "gdpr.queue.column.ack_due",
  queueColumnResolveDue: "gdpr.queue.column.resolve_due",
  queueOverdue: "gdpr.queue.overdue",
  queueAckSent: "gdpr.queue.ack_sent",
  queueAckMissing: "gdpr.queue.ack_missing",
  /** The triage note's own save control — NOT the intake form's "Send
   * request", which is a different act by a different person. */
  queueSaveNote: "gdpr.queue.save_note",
  queueStateReceived: "gdpr.queue.state.received",
  queueStateAcknowledged: "gdpr.queue.state.acknowledged",
  queueStateInProgress: "gdpr.queue.state.in_progress",
  queueStateResolved: "gdpr.queue.state.resolved",
  queueStateRejected: "gdpr.queue.state.rejected",
  queueChannelApp: "gdpr.queue.channel.app",
  queueChannelForm: "gdpr.queue.channel.form",
  queueChannelEmail: "gdpr.queue.channel.email",

  // ── Staff: data-owner health ─────────────────────────────────────────────
  ownersHeading: "gdpr.owners.heading",
  ownersExplain: "gdpr.owners.explain",
  ownersLoading: "gdpr.owners.loading",
  /** No owner declared at all — a wiring gap, named as one. */
  ownersEmpty: "gdpr.owners.empty",
  ownersColumnOwner: "gdpr.owners.column.owner",
  ownersColumnState: "gdpr.owners.column.state",
  ownersColumnLastAlive: "gdpr.owners.column.last_alive",
  ownersColumnSubjects: "gdpr.owners.column.subjects",
  ownersAlive: "gdpr.owners.alive",
  /** A silent owner is a WARNING row, never an absent one. */
  ownersSilent: "gdpr.owners.silent",
  ownersNeverAnswered: "gdpr.owners.never_answered",
  ownersSilentCount: "gdpr.owners.silent_count",
  ownersSubjectMismatch: "gdpr.owners.subject_mismatch",

  // Backend error keys whose registry English is true but useless on a
  // screen. Listed here so `i18n-key-exists` knows them and the i18n suite
  // can prove BOTH locales carry them. stapel-gdpr ships
  // `translations/errors.{ru,es}.json` covering all 15 of its own keys, so —
  // unlike the video/chat/cdn precedent — nothing here is authored to cover a
  // gap; these three are deliberate OVERRIDES of a correct-but-terse text.
  errorNoActiveClosure: "error.404.gdpr.no_active_closure",
  errorExportNotFound: "error.404.gdpr.export_not_found",
  errorLegalHold: "error.409.gdpr.legal_hold",
  errorExportCooldown: "error.409.gdpr.export_cooldown",
} as const;

export type GdprI18nKey = (typeof GDPR_I18N_KEYS)[keyof typeof GDPR_I18N_KEYS];

/**
 * English fallback bundle for gdpr-react UI keys + backend error codes.
 * The generated `gdprErrorBundleEn` (from stapel-gdpr's error registry, `pnpm
 * gen:errors`) is spread FIRST so every backend `error.*` key has a fallback —
 * a `StapelApiError.code` never renders as a raw key. The hand-polished copy
 * below then OVERRIDES the generated English for the few keys that reach a
 * person's screen with a decision attached.
 *
 * `error.404.gdpr.no_active_closure` is the most important of those, and the
 * one the model layer is built around: the registry's "No pending account
 * closure found." is a correct sentence about a REQUEST that does not exist,
 * and a catastrophic sentence to show someone who just asked whether their
 * account is being deleted. `useAccountClosure` folds that 404 into `null` —
 * "nothing is being deleted" is an ANSWER — so this text is only ever seen by
 * a host that reads the raw error itself.
 */
export const gdprI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...gdprErrorBundleEn,

  "error.404.gdpr.no_active_closure": "Your account is not scheduled for deletion",
  "error.404.gdpr.export_not_found": "You have not requested a data export yet",
  "error.409.gdpr.legal_hold":
    "This data is under a legal hold and cannot be deleted yet. Support can explain why.",

  // gdpr-react UI
  "gdpr.error.unknown": "Something went wrong. Please try again.",
  "gdpr.action.retry": "Try again",
  "gdpr.action.close": "Close",
  "gdpr.admin.staff_only":
    "This screen is for staff. You are signed in with an account that does not have access to it.",

  "gdpr.privacy.heading": "Privacy and your data",
  "gdpr.admin.heading": "Privacy operations",

  "gdpr.closure.heading": "Delete your account",
  "gdpr.closure.explain":
    "Deleting your account starts a 30-day grace period. You are signed out everywhere immediately, and you can change your mind until the grace period ends.",
  "gdpr.closure.loading": "Checking your account…",
  "gdpr.closure.none": "Your account is not scheduled for deletion",
  "gdpr.closure.initiate": "Delete my account",
  "gdpr.closure.confirm_title": "Delete this account?",
  "gdpr.closure.confirm_body":
    "You will be signed out of every device now. Your data is erased when the grace period ends on {date}.",
  "gdpr.closure.confirm_ok": "Yes, start deletion",
  "gdpr.closure.confirm_cancel": "Not now",
  "gdpr.closure.scheduled": "Your account will be deleted on {date}",
  "gdpr.closure.cancel": "Keep my account",
  "gdpr.closure.cancelled": "Deletion cancelled — your account is active again",
  "gdpr.closure.deleting":
    "Your account is being erased. This can no longer be cancelled.",
  "gdpr.closure.deleted": "This account has been erased",

  "gdpr.deletions.heading": "Waiting to be deleted",
  "gdpr.deletions.loading": "Loading what is being deleted…",
  "gdpr.deletions.empty": "Nothing of yours is waiting to be deleted",
  "gdpr.deletions.column.subject": "Item",
  "gdpr.deletions.column.state": "State",
  "gdpr.deletions.column.due": "Erased from our systems by",
  "gdpr.deletions.column.fully_erased": "Erased everywhere by",
  "gdpr.deletions.fully_erased_hint":
    "Our own systems finish first; processors we use have their own contractual windows, and the later date is when the last of them closes.",
  "gdpr.deletions.waiting_on": "Waiting on: {owners}",
  "gdpr.deletions.state.queued": "Queued",
  "gdpr.deletions.state.erasing": "Being erased",
  "gdpr.deletions.state.deleted": "Erased",
  "gdpr.deletions.state.timeout": "Overdue",
  "gdpr.deletions.timeout_hint":
    "A system that holds part of this item has not confirmed. Support has been alerted; the item is not lost track of.",

  "gdpr.subject.account": "Account",
  "gdpr.subject.workspace": "Workspace",
  "gdpr.subject.meeting": "Meeting",
  "gdpr.subject.recording": "Recording",
  "gdpr.subject.document": "Document",
  "gdpr.subject.file": "File",

  "gdpr.export.heading": "Download your data",
  "gdpr.export.explain":
    "We build an archive of everything we hold about you. It is ready within 48 hours and can be requested once every 30 days.",
  "gdpr.export.loading": "Checking your export…",
  "gdpr.export.none": "You have not requested a data export yet",
  "gdpr.export.request": "Request my data",
  "gdpr.export.requested":
    "We are building your archive. We will email you when it is ready.",
  "gdpr.export.in_flight":
    "We are already building an archive for you. You can ask for another one once this is ready.",
  "gdpr.export.progress": "{done} of {total} sections ready",
  "gdpr.export.partial": "Some sections could not be included: {services}",
  "gdpr.export.expires": "The download link expires on {date}",
  "gdpr.export.download": "Download archive",
  "gdpr.export.token_hint":
    "The download link is in the email we sent you. It works once, and the archive is deleted the moment it is served.",
  "gdpr.export.state.pending": "Queued",
  "gdpr.export.state.processing": "Being prepared",
  "gdpr.export.state.ready": "Ready",
  "gdpr.export.state.failed": "Failed",
  "gdpr.export.state.expired": "Expired",

  "gdpr.dsar.heading": "Make a data-protection request",
  "gdpr.dsar.explain":
    "Ask for a copy of your data, a correction, or its deletion. We acknowledge every request within three business days and answer within 30 days.",
  "gdpr.dsar.kind_label": "What are you asking for?",
  "gdpr.dsar.kind.access": "A copy of my data",
  "gdpr.dsar.kind.erasure": "Deletion of my data",
  "gdpr.dsar.kind.rectification": "A correction",
  "gdpr.dsar.kind.portability": "My data in a portable format",
  "gdpr.dsar.email_label": "Your email address",
  "gdpr.dsar.email_required": "We need an email address to answer you",
  "gdpr.dsar.note_label": "Anything you want to add",
  "gdpr.dsar.submit": "Send request",
  "gdpr.dsar.submitted": "Request received. We have emailed your acknowledgement.",
  "gdpr.dsar.reference": "Your reference: {id}",
  "gdpr.dsar.ack_by": "Acknowledged by {date}",
  "gdpr.dsar.resolve_by": "Answered by {date}",

  "gdpr.queue.heading": "Data-protection requests",
  "gdpr.queue.loading": "Loading requests…",
  "gdpr.queue.empty": "No data-protection requests",
  "gdpr.queue.column.reference": "Ref",
  "gdpr.queue.column.kind": "Asking for",
  "gdpr.queue.column.channel": "Arrived via",
  "gdpr.queue.column.subject": "Subject",
  "gdpr.queue.column.state": "State",
  "gdpr.queue.column.ack_due": "Acknowledge by",
  "gdpr.queue.column.resolve_due": "Answer by",
  "gdpr.queue.overdue": "Overdue",
  "gdpr.queue.ack_sent": "Acknowledged {date}",
  "gdpr.queue.ack_missing": "Not acknowledged",
  "gdpr.queue.save_note": "Save note",
  "gdpr.queue.state.received": "Received",
  "gdpr.queue.state.acknowledged": "Acknowledged",
  "gdpr.queue.state.in_progress": "In progress",
  "gdpr.queue.state.resolved": "Resolved",
  "gdpr.queue.state.rejected": "Rejected",
  "gdpr.queue.channel.app": "In the app",
  "gdpr.queue.channel.form": "Public form",
  "gdpr.queue.channel.email": "Email",

  "gdpr.owners.heading": "Data owners",
  "gdpr.owners.explain":
    "Every system that holds personal data answers a daily probe from the same subscriber that erases. A system that stops answering is a system whose erasures nobody is confirming.",
  "gdpr.owners.loading": "Loading data owners…",
  "gdpr.owners.empty": "No data owners are declared — nothing would receive an erasure",
  "gdpr.owners.column.owner": "System",
  "gdpr.owners.column.state": "State",
  "gdpr.owners.column.last_alive": "Last answered",
  "gdpr.owners.column.subjects": "Holds",
  "gdpr.owners.alive": "Answering",
  "gdpr.owners.silent": "Silent",
  "gdpr.owners.never_answered": "Never answered",
  "gdpr.owners.silent_count": "{count} of {total} systems are not answering",
  "gdpr.owners.subject_mismatch":
    "Declared {declared}, answers for {answered}",
};

/**
 * Register gdpr-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerGdprI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, gdprI18nBundleEn);
}
