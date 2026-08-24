/**
 * `@stapel/recordings-react` — the React flow pair for stapel-recordings
 * (frontend-standard §2). This entry is business + state only, zero visual
 * opinion; the shipped screens live on the `./default` subpath (§54: headless
 * AND a default skin for every primitive) and never enter this bundle. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`, then generated §17-native — directly
 * from stapel-recordings' OWN per-module contract (docs/{schema,flows,errors}.json)
 * rather than the unified monolith schema. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (schema, flows registry, error map, manifest,
 * llms.txt) are produced by the monorepo `gen:*` drivers and stand under drift
 * gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createRecordingsApi, SHARE_UNLOCK_HEADER } from "./api/recordingsApi.js";
export type { RecordingsApi } from "./api/recordingsApi.js";
export {
  uploadRecordingBlob,
  isUploadExpired,
  isAcceptedMediaType,
  UploadPreflightError,
} from "./api/extensions.js";
export type {
  UploadBlobOptions,
  UploadProgress,
  UploadPreflightReason,
} from "./api/extensions.js";
export {
  RECORDING_STATUSES,
  PROCESSING_STATUSES,
  TERMINAL_STATUSES,
  SHARE_PERMISSIONS,
  isKnownRecordingStatus,
  isProcessingStatus,
  isTerminalStatus,
  shareGrants,
} from "./api/types.js";
export type {
  Schemas,
  Recording,
  RecordingStatus,
  RecordingListParams,
  CreateRecordingRequest,
  CreateRecordingResponse,
  UploadSession,
  FinalizeUploadRequest,
  MediaUrl,
  MediaUrlOptions,
  Job,
  TranscriptSegment,
  TranscriptPage,
  TranscriptParams,
  SharedRecording as SharedRecordingDto,
  SharePermission,
  ShareUnlock,
  ShareUnlockRequest,
  ShareAccessOptions,
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
export { toFlowError, hasErrorCode, isPaymentRequired } from "./flows/errors.js";
export { RECORDINGS_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  RecordingsFlowId,
  RecordingsFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createRecordingsRuntime } from "./model/runtime.js";
export type {
  RecordingsRuntime,
  CreateRecordingsRuntimeOptions,
} from "./model/runtime.js";
export {
  RecordingsRuntimeContext,
  useRecordingsRuntime,
  useRecordingsApi,
  useRecordingsAnalytics,
} from "./model/context.js";
export { recordingsQueryKeys } from "./model/queryKeys.js";
export {
  useRecordings,
  useRecording,
  useRecordingMedia,
  useTranscript,
  useSharedRecording,
  useSharedMedia,
} from "./model/queries.js";
export {
  useCreateRecording,
  useFinalizeUpload,
  useReprocess,
  useResummarize,
  useUnlockShare,
} from "./model/mutations.js";
export type {
  FinalizeUploadVariables,
  UnlockShareVariables,
} from "./model/mutations.js";
export { pollIntervalMs, mediaRefreshMs } from "./model/polling.js";
export type { PollHint } from "./model/polling.js";
export {
  formatDuration,
  formatTimecode,
  formatInstant,
  formatDate,
  formatCount,
  formatBytes,
  useRecordingsFormat,
} from "./model/format.js";
export type { RecordingsFormat } from "./model/format.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { RecordingsProvider } from "./headless/RecordingsProvider.js";
export { RecordingList } from "./headless/RecordingList.js";
export type { RecordingListBag } from "./headless/RecordingList.js";
export { RecordingComposer } from "./headless/RecordingComposer.js";
export type { RecordingComposerBag } from "./headless/RecordingComposer.js";
export { UploadFinalizer } from "./headless/UploadFinalizer.js";
export type { UploadFinalizerBag } from "./headless/UploadFinalizer.js";
export { RecordingDetail } from "./headless/RecordingDetail.js";
export type { RecordingDetailBag } from "./headless/RecordingDetail.js";
export { RecordingMedia, mediaGate } from "./headless/RecordingMedia.js";
export type { RecordingMediaBag } from "./headless/RecordingMedia.js";
export {
  Transcript,
  segmentIndexAt,
  speakerLabel,
} from "./headless/Transcript.js";
export type { TranscriptBag } from "./headless/Transcript.js";
export {
  RecordingUpload,
  uploadGate,
  uploadPreflightKey,
} from "./headless/RecordingUpload.js";
export type {
  RecordingUploadBag,
  RecordingDraft,
  UploadStep,
} from "./headless/RecordingUpload.js";
export {
  ResummarizeControl,
  resummarizeGate,
  isNoTranscript,
  isSummarizeUnavailable,
} from "./headless/ResummarizeControl.js";
export type { ResummarizeControlBag } from "./headless/ResummarizeControl.js";
export { ReprocessControl, reprocessGate } from "./headless/ReprocessControl.js";
export type { ReprocessControlBag } from "./headless/ReprocessControl.js";
export { SharedRecording } from "./headless/SharedRecording.js";
export type {
  SharedRecordingBag,
  SharedMediaBag,
} from "./headless/SharedRecording.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  RECORDINGS_I18N_KEYS,
  recordingsI18nBundleEn,
  registerRecordingsI18n,
} from "./i18n/keys.js";
export type { RecordingsI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  RECORDINGS_ERRORS,
  RECORDINGS_ERROR_CODES,
  recordingsErrorBundleEn,
  explainRecordingsError,
} from "./i18n/errorsMap.js";
export type {
  RecordingsErrorCode,
  RecordingsErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
