/**
 * `@stapel/gdpr-react` — the headless React pair for stapel-gdpr
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * ── What this pair is for ─────────────────────────────────────────────────
 *
 * The deletion lifecycle, made visible to the person it is about. stapel-gdpr
 * 0.5.0 generalized erasure from "the account" to any SUBJECT a host removes
 * (a recording, a workspace, a document), put a receipt slot behind every data
 * owner that claims that subject, and added the two edges a product needs to
 * be honest: a DSAR intake with statutory clocks, and an owner-health table
 * that makes a silent system visible instead of leaving it in a log line. None
 * of it had a face. This pair is that face.
 *
 * ── The rule every hook here is built on ──────────────────────────────────
 *
 * **A refusal is read by CODE, never by status.** The module answers three
 * different 404s, two different 409s and two different 410s, and in two of
 * those cases the 404 is not a failure at all:
 *
 * - `GET /user/account/close/status` → 404 `gdpr.no_active_closure` means
 *   *your account is not being deleted* — the state almost every account is
 *   in. `useAccountClosure` folds it to `null`, so the screen a person opens
 *   to ask "is my account being deleted?" can never answer "something went
 *   wrong".
 * - `GET /user/data-export/status` → 404 `gdpr.export_not_found` means *you
 *   have never asked for an archive*. Same fold, in `useDataExport`.
 * - The two 410s on the download are opposite advice at the same status: the
 *   token was already SPENT (look in your downloads) versus the link EXPIRED
 *   (it was never taken).
 * - The two 409s on closure are a no-op (`closure_already_pending`) and a
 *   legal refusal a person is entitled to have explained (`legal_hold`).
 *
 * ── Two clocks, and both are the server's ─────────────────────────────────
 *
 * `due_at` is when OUR systems are done; `fully_erased_by` stretches that to
 * the last subprocessor's contractual window. Nothing here derives, counts
 * down or re-computes either: the date a person reads is the date the sweep
 * task will act on.
 *
 * `useRequestErasure` is the seam a host wires into its own delete button —
 * called AFTER its own delete succeeds, because the clock it starts is a purge
 * SLA for something already off the screen, not a grace period.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createGdprApi } from "./api/gdprApi.js";
export type {
  GdprApi,
  GdprApiOptions,
  RequestErasureBody,
  DsarSubmission,
  DsarPatch,
} from "./api/gdprApi.js";
export { downloadExportArchive } from "./api/download.js";
export type { ExportArchive, GdprRawTransport } from "./api/download.js";
export type {
  Schemas,
  AccountClosure,
  ErasureStatus,
  ErasurePart,
  SubprocessorObligation,
  ExportRequest,
  ExportStatus,
  DsarStatus,
  DsarKind,
  DsarState,
  DataOwnerHealth,
} from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { GDPR_FLOWS, flowEndpoints } from "./flows/registry.js";
export type { GdprFlowId, GdprFlowSpec, FlowEndpoint } from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createGdprRuntime } from "./model/runtime.js";
export type { GdprRuntime, CreateGdprRuntimeOptions } from "./model/runtime.js";
export {
  GdprRuntimeContext,
  useGdprRuntime,
  useGdprApi,
  useGdprAnalytics,
} from "./model/context.js";
export { gdprQueryKeys } from "./model/queryKeys.js";

// ── model (the reads and the writes) ────────────────────────────────────────
export { useAccountClosure } from "./model/closure.js";
export type { AccountClosureBag } from "./model/closure.js";
export { useMyErasures, useErasure, useRequestErasure } from "./model/erasures.js";
export type { MyErasuresBag } from "./model/erasures.js";
export { useDataExport, EXPORT_POLL_INTERVAL_MS } from "./model/dataExport.js";
export type { DataExportBag } from "./model/dataExport.js";
export { useDsar, useDsarQueue, useUpdateDsar } from "./model/dsar.js";
export type {
  DsarBag,
  DsarQueueBag,
  UpdateDsarVariables,
} from "./model/dsar.js";
export { useOwnersHealth } from "./model/owners.js";
export type { OwnersHealthBag } from "./model/owners.js";

// ── model (refusals — read by CODE, never by status) ────────────────────────
export {
  GDPR_ERROR_NO_ACTIVE_CLOSURE,
  GDPR_ERROR_CLOSURE_ALREADY_PENDING,
  GDPR_ERROR_LEGAL_HOLD,
  GDPR_ERROR_CLOSURE_UNAVAILABLE,
  GDPR_ERROR_ACCOUNT_CLOSED,
  GDPR_ERROR_EXPORT_NOT_FOUND,
  GDPR_ERROR_EXPORT_COOLDOWN,
  GDPR_ERROR_EXPORT_NOT_READY,
  GDPR_ERROR_DOWNLOAD_CONSUMED,
  GDPR_ERROR_DOWNLOAD_EXPIRED,
  GDPR_ERROR_UNKNOWN_SUBJECT_TYPE,
  GDPR_ERROR_ERASURE_FORBIDDEN,
  GDPR_ERROR_ERASURE_NOT_FOUND,
  GDPR_ERROR_UNKNOWN_DSAR_KIND,
  GDPR_ERROR_DSAR_NOT_FOUND,
  GDPR_ERROR_FORBIDDEN,
  GDPR_ERROR_CAPTCHA_REQUIRED,
  GDPR_ERROR_CAPTCHA_INVALID,
  toGdprError,
  isNoActiveClosure,
  isClosureAlreadyPending,
  isLegalHold,
  isClosureUnavailable,
  isAccountClosed,
  isExportNotFound,
  isExportCooldown,
  isExportNotReady,
  isDownloadConsumed,
  isDownloadExpired,
  isUnknownSubjectType,
  isErasureForbidden,
  isErasureNotFound,
  isUnknownDsarKind,
  isDsarNotFound,
  isStaffOnly,
  isCaptchaRefusal,
} from "./model/refusals.js";

// ── model (formatting a server-computed instant — never computing one) ──────
export { formatDeletionDate, formatInstant } from "./model/dates.js";

// ── nav (the scripted-fullstack navigation contract) ────────────────────────
export { navEntries, ACCOUNT_ROOT_ID, ADMIN_ROOT_ID } from "./nav/manifest.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { GdprProvider } from "./headless/GdprProvider.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  GDPR_I18N_KEYS,
  gdprI18nBundleEn,
  registerGdprI18n,
} from "./i18n/keys.js";
export type { GdprI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  GDPR_ERRORS,
  GDPR_ERROR_CODES,
  gdprErrorBundleEn,
  explainGdprError,
} from "./i18n/errorsMap.js";
export type {
  GdprErrorCode,
  GdprErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
