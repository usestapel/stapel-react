/**
 * `@stapel/moderation-react` — the headless React flow pair for stapel-moderation
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createModerationApi } from "./api/moderationApi.js";
export type {
  ModerationApi,
  AppealQueueFilters,
  CaseFilters,
  IssueSanctionBody,
  KeysetPage,
  RequestExtras,
  ResolveAppealBody,
  SanctionFilters,
  SubmitAppealBody,
  SubmitReportBody,
  VerdictBody,
  VerdictSanction,
} from "./api/moderationApi.js";
export { nextBefore, NEXT_BEFORE_HEADER } from "./api/extensions.js";
export type { KeysetRow } from "./api/extensions.js";
export type {
  Schemas,
  Appeal,
  Case,
  CaseDetail,
  CaseEvent,
  Content,
  PolicyAutomatedMeans,
  PolicyDisclosure,
  PolicyHumanReview,
  PolicyReason,
  PolicyRule,
  Report,
  ReportResult,
  RescanResult,
  Sanction,
  Stats,
  Verdict,
} from "./api/types.js";

// ── vocabularies (hand-mirrored from models.py, pinned by test/enums.test.ts)
export {
  APPEAL_OUTCOMES,
  APPEAL_STATES,
  BUILTIN_REASON_CODES,
  CASE_EVENT_KINDS,
  CASE_ORIGINS,
  CASE_STATES,
  CONTENT_UNAVAILABLE_REASONS,
  DECISIONS,
  SANCTION_KINDS,
  SANCTION_STATES,
  SYSTEM_REASON_CODES,
  TERMINAL_DECISIONS,
  VERDICT_SOURCES,
  isMember,
} from "./api/enums.js";
export type {
  AppealOutcome,
  AppealState,
  BuiltinReasonCode,
  CaseEventKind,
  CaseOrigin,
  CaseState,
  ContentUnavailableReason,
  Decision,
  SanctionKind,
  SanctionState,
  SystemReasonCode,
  VerdictSource,
} from "./api/enums.js";

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
export {
  createReportFlow,
  reasonStep,
  reportRefused,
  REPORT_FLOW_ID,
} from "./flows/reportFlow.js";
export type { ReportFlowState, ReportFlowOptions } from "./flows/reportFlow.js";
export {
  createAppealFlow,
  appealRefused,
  APPEAL_FLOW_ID,
} from "./flows/appealFlow.js";
export type { AppealFlowState, AppealFlowOptions } from "./flows/appealFlow.js";
export {
  createTriageFlow,
  leaseStatus,
  triageRefused,
  TRIAGE_FLOW_ID,
  RESCAN_POLL_INTERVAL_MS,
  RESCAN_POLL_TIMEOUT_MS,
} from "./flows/triageFlow.js";
export type {
  TriageFlowState,
  TriageFlowOptions,
  LeaseStatus,
} from "./flows/triageFlow.js";
export { MODERATION_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  ModerationFlowId,
  ModerationFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createModerationRuntime, DEFAULT_APPEAL_HREF } from "./model/runtime.js";
export type {
  ModerationRuntime,
  CreateModerationRuntimeOptions,
  ModerationHostSeams,
} from "./model/runtime.js";
export {
  ModerationRuntimeContext,
  useModerationRuntime,
  useModerationApi,
  useModerationAnalytics,
} from "./model/context.js";
export { moderationQueryKeys, filtersKey } from "./model/queryKeys.js";
export type { FiltersKey } from "./model/queryKeys.js";

// ── model (server state: one hook per read, one per write) ───────────────────
export {
  PAGE_SIZE,
  loadOf,
  usePolicy,
  useMyReportsQuery,
  useMyAppealsQuery,
  useCasesQuery,
  useCaseDetailQuery,
  useCaseEventsQuery,
  useStatsQuery,
  useSanctionsQuery,
  useAppealQueueQuery,
  useSubmitReport,
  useSubmitAppeal,
  useClaimCase,
  useReleaseCase,
  useRescanCase,
  useSubmitVerdict,
  useIssueSanction,
  useLiftSanction,
  useResolveAppeal,
} from "./model/queries.js";
export type {
  PagedRows,
  VerdictVariables,
  LiftSanctionVariables,
  ResolveAppealVariables,
} from "./model/queries.js";

// ── model (refusals — read by CODE, never by status) ─────────────────────────
export * from "./model/refusals.js";
export {
  formatInstant,
  formatDate,
  formatDuration,
  remainingMinutes,
  shortId,
} from "./model/format.js";

// ── headless (renderless components + the screen bags) ───────────────────────
// Every bag hands out `ActionAvailability` gates rather than booleans: a host
// building its own skin inherits the reason beside every switched-off control,
// not just the fact that it is off.
export { ModerationProvider } from "./headless/ModerationProvider.js";
export { useReport, useReportPolicy } from "./headless/useReport.js";
export type {
  ReportBag,
  ReportPolicyBag,
  UseReportOptions,
} from "./headless/useReport.js";
export { useAppeal } from "./headless/useAppeal.js";
export type { AppealBag, UseAppealOptions } from "./headless/useAppeal.js";
export { useModerationQueue } from "./headless/useModerationQueue.js";
export type {
  ModerationQueueBag,
  QueueAccess,
  QueueFilters,
} from "./headless/useModerationQueue.js";
export { useCase } from "./headless/useCase.js";
export type {
  CaseBag,
  SanctionDurationMode,
  UseCaseOptions,
  VerdictDraft,
} from "./headless/useCase.js";
export { useAppealsQueue } from "./headless/useAppealsQueue.js";
export type { AppealsQueueBag } from "./headless/useAppealsQueue.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  MODERATION_I18N_KEYS,
  moderationI18nBundleEn,
  registerModerationI18n,
  dataResolvedKeys,
  reasonLabelKey,
  reasonDescriptionKey,
  ruleDescriptionKey,
  caseStateKey,
  caseOriginKey,
  contentUnavailableKey,
  decisionKey,
  decisionHintKey,
  verdictSourceKey,
  sanctionKindKey,
  sanctionStateKey,
  appealStateKey,
  appealOutcomeKey,
  appealOutcomeHintKey,
} from "./i18n/keys.js";
export type { ModerationI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  MODERATION_ERRORS,
  MODERATION_ERROR_CODES,
  moderationErrorBundleEn,
  explainModerationError,
} from "./i18n/errorsMap.js";
export type {
  ModerationErrorCode,
  ModerationErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
