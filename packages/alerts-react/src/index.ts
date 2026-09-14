/**
 * `@stapel/alerts-react` — the headless React pair for stapel-alerts
 * (frontend-standard §2). Business + state only, zero visual opinion; the
 * shipped screens live behind the `./default` subpath so a host that brings
 * its own visuals never pulls antd.
 *
 * Layers: api → model → flows → headless → i18n. Generated surfaces (schema,
 * error map, manifest, llms.txt) are produced by the monorepo `gen:*` drivers
 * from stapel-alerts's own contract artifacts and stand under drift gates.
 *
 * **This pair reads and manages the tracker; it does not report to it.**
 * `POST /report` is authenticated by a service key that lives in every
 * container in the fleet, and the blast radius of one leaking must not include
 * a browser. Nothing here can reach that endpoint.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createAlertsApi } from "./api/alertsApi.js";
export type {
  AlertsApi,
  AlertsRawOptions,
  ConditionalRead,
  ConditionalReadOptions,
  IssueFilters,
} from "./api/alertsApi.js";
export {
  ISSUE_LEVELS,
  ISSUE_STATUSES,
  SETTABLE_ISSUE_STATUSES,
  OPEN_ISSUE_STATUSES,
  isSettableStatus,
  isOpenStatus,
} from "./api/types.js";
export type {
  Schemas,
  Issue,
  IssueDetail,
  IssuePage,
  ErrorEvent,
  IssuePatch,
  IssueFix,
  IssueLevel,
  IssueKind,
  IssueStatus,
  SettableIssueStatus,
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
export { ALERTS_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  AlertsFlowId,
  AlertsFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export {
  createAlertsRuntime,
  DEFAULT_ALERTS_BASE_URL,
  DEFAULT_ALERTS_POLL_INTERVAL_MS,
} from "./model/runtime.js";
export type {
  AlertsRuntime,
  CreateAlertsRuntimeOptions,
} from "./model/runtime.js";
export {
  AlertsRuntimeContext,
  useAlertsRuntime,
  useAlertsApi,
  useAlertsAnalytics,
} from "./model/context.js";
export { alertsQueryKeys } from "./model/queryKeys.js";

// ── model (the two reads) ───────────────────────────────────────────────────
export {
  useIssues,
  useIssue,
  issueFiltersKey,
  groupIssuesByService,
} from "./model/issues.js";
export type {
  IssuesBag,
  IssueBag,
  IssueFeedFilters,
  IssueGroup,
  IssuesSnapshot,
  IssueSnapshot,
} from "./model/issues.js";

// ── model (the writes) ──────────────────────────────────────────────────────
export { useIssueStatus } from "./model/status.js";
export type {
  IssueStatusBag,
  FixIssueInput,
  MuteIssueInput,
  ReopenIssueInput,
  AnnotateIssueInput,
} from "./model/status.js";

// ── model (named refusals) ──────────────────────────────────────────────────
export {
  toAlertsError,
  isAlertsUnauthorized,
  isAlertsStaffOnly,
  isIssueNotFound,
  isStatusNotSettable,
  ALERTS_ERROR_STATUS_NOT_SETTABLE,
  ALERTS_ERROR_UNAUTHORIZED,
  ALERTS_ERROR_FORBIDDEN,
  ALERTS_ERROR_ISSUE_NOT_FOUND,
} from "./model/refusals.js";

// ── analytics vocabulary (names only — the runtime is the host's seam) ──────
export { ALERTS_EVENTS } from "./analytics/events.js";
export type { AlertsEventName } from "./analytics/events.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { AlertsProvider } from "./headless/AlertsProvider.js";

// ── nav ─────────────────────────────────────────────────────────────────────
export { navEntries, ADMIN_ROOT_ID } from "./nav/manifest.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  ALERTS_I18N_KEYS,
  alertsI18nBundleEn,
  registerAlertsI18n,
} from "./i18n/keys.js";
export type { AlertsI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  ALERTS_ERRORS,
  ALERTS_ERROR_CODES,
  alertsErrorBundleEn,
  explainAlertsError,
} from "./i18n/errorsMap.js";
export type {
  AlertsErrorCode,
  AlertsErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
