/**
 * `@stapel/video-react` — the headless React flow pair for stapel-video
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * ── What this pair is for ─────────────────────────────────────────────────
 *
 * ONE read: `GET /video/api/v1/scopes/{scope_key}/usage/` — who, inside one
 * partition, talked how much, per calendar month. It exists because
 * stapel-video 0.7.0 gave the presence meter a tenant (`ParticipantSpan.
 * scope_key`, stamped from the join grant) and a rollup over the same union
 * arithmetic `presence.aggregate` already used. Before that, "how long did the
 * people in THIS workspace talk" could only be answered by a host joining the
 * span table to its own rooms and re-implementing that arithmetic beside the
 * table that owns it — a second answer to a billable number that nobody
 * reconciles until a customer disputes it.
 *
 * Two facts shape every line here, and both come from the contract:
 *
 * 1. The wire carries USER IDS AND NEVER NAMES. `ParticipantSpan` keeps no FK
 *    to a user by design, so erasure can pseudonymize the column. The display
 *    name is the host's — `nameFor` on the table, resolved from the roster the
 *    admin page already loaded.
 * 2. `error.404.video_scope_not_found` is UNIFORM over three situations: the
 *    scope does not exist, it holds no calls, and the reader holds no
 *    `USAGE_MANDATE` in it. A 403 would confirm that a guessed tenant id is
 *    real. So the pair renders it as an explained refusal — "not available for
 *    this workspace" — and never as an empty table, and never guesses which of
 *    the three it was.
 *
 * The meeting itself is not here: rooms, the lobby verdicts and the join grant
 * are a media-server client's job (see `api/videoApi.ts`).
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createVideoApi } from "./api/videoApi.js";
export type { VideoApi, ScopeUsageRequest } from "./api/videoApi.js";
export type {
  Schemas,
  ScopeUsageResponse,
  ScopeUsageMonth,
  ScopeUsageRow,
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
export { VIDEO_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  VideoFlowId,
  VideoFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createVideoRuntime } from "./model/runtime.js";
export type {
  VideoRuntime,
  CreateVideoRuntimeOptions,
} from "./model/runtime.js";
export {
  VideoRuntimeContext,
  useVideoRuntime,
  useVideoApi,
  useVideoAnalytics,
} from "./model/context.js";
export { videoQueryKeys, usageQueryKeys } from "./model/queryKeys.js";

// ── model (the usage read) ──────────────────────────────────────────────────
export { useScopeUsage } from "./model/queries.js";
export type { UseScopeUsageOptions, ScopeUsageBag } from "./model/queries.js";
export {
  DEFAULT_USAGE_MONTHS,
  MAX_USAGE_MONTHS,
  DEFAULT_USAGE_TZ,
  normalizeScopeUsage,
  usageMonthLabels,
  usageMonth,
  usageTotals,
  formatPresence,
  isScopeUnavailable,
  isInvalidUsagePeriod,
} from "./model/usage.js";
export type {
  ScopeUsageAnswer,
  UsageMonth,
  UsageTotals,
} from "./model/usage.js";

// ── nav (the scripted-fullstack navigation contract) ────────────────────────
export { navEntries, ADMIN_ROOT_ID } from "./nav/manifest.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { VideoProvider } from "./headless/VideoProvider.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  VIDEO_I18N_KEYS,
  videoI18nBundleEn,
  registerVideoI18n,
} from "./i18n/keys.js";
export type { VideoI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  VIDEO_ERRORS,
  VIDEO_ERROR_CODES,
  videoErrorBundleEn,
  explainVideoError,
} from "./i18n/errorsMap.js";
export type {
  VideoErrorCode,
  VideoErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
