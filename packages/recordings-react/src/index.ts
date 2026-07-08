/**
 * `@stapel/recordings-react` — the headless React flow pair for stapel-recordings
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
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
export { createRecordingsApi } from "./api/recordingsApi.js";
export type { RecordingsApi } from "./api/recordingsApi.js";
export { uploadRecordingBlob, isUploadExpired } from "./api/extensions.js";
export type { UploadBlobOptions } from "./api/extensions.js";
export type {
  Schemas,
  Recording,
  CreateRecordingRequest,
  CreateRecordingResponse,
  UploadSession,
  FinalizeUploadRequest,
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
export { RECORDINGS_FLOWS, flowEndpoints } from "./flows/generated/flows.gen.js";
export type {
  RecordingsFlowId,
  RecordingsFlowSpec,
  FlowEndpoint,
} from "./flows/generated/flows.gen.js";

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
export { useRecordings, useRecording } from "./model/queries.js";
export { useCreateRecording, useFinalizeUpload } from "./model/mutations.js";
export type { FinalizeUploadVariables } from "./model/mutations.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { RecordingsProvider } from "./headless/RecordingsProvider.js";
export { RecordingList } from "./headless/RecordingList.js";
export type { RecordingListBag } from "./headless/RecordingList.js";
export { RecordingComposer } from "./headless/RecordingComposer.js";
export type { RecordingComposerBag } from "./headless/RecordingComposer.js";
export { UploadFinalizer } from "./headless/UploadFinalizer.js";
export type { UploadFinalizerBag } from "./headless/UploadFinalizer.js";

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
