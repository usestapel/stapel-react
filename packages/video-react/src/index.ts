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
 * ── And the meeting, since 0.2.0 ──────────────────────────────────────────
 *
 * The other six browser-callable operations — open a room, read one, ask to
 * join, the host's two lobby verdicts, the participant list — are here too,
 * with the realtime lobby they belong to. The usage report was never the
 * product of a calls module; it is the report ABOUT the product.
 *
 * The line that is still drawn, and where: the MEDIA session (a WebRTC stack,
 * device permissions, tiles) is an optional peer that `/default`'s
 * `<CallStage>` loads with `import()` and a host may replace outright. What
 * this pair owns is the half a vendor SDK cannot produce — `JoinResponse.token`
 * is minted by stapel-video's provider out of the join grant, and the lobby is
 * a stapel concept the SDK has never heard of.
 *
 * The lobby's socket is NOT opened here: `@stapel/realtime` is the fleet's one
 * reconnect/resume runtime and the one place a 4401 or a 4403 close code is
 * given a meaning (§83.1). This pair contributes the stream key, the three
 * frame types and what each one means.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createVideoApi } from "./api/videoApi.js";
export type {
  VideoApi,
  ScopeUsageRequest,
  ParticipantPageRequest,
} from "./api/videoApi.js";
export type {
  ActiveCallResponse,
  CallCreateRequest,
  CallResponse,
  CallSessionRequest,
  CallTokenResponse,
  MediaTokenResponse,
  Schemas,
  ScopeUsageResponse,
  ScopeUsageMonth,
  ScopeUsageRow,
  RoomResponse,
  RoomCreateRequest,
  JoinRequest,
  JoinResponse,
  ParticipantResponse,
  ParticipantListResponse,
  LobbyActionRequest,
  AdmitResponse,
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
export {
  videoQueryKeys,
  usageQueryKeys,
  roomQueryKeys,
  callQueryKeys,
} from "./model/queryKeys.js";

// ── model (the usage read) ──────────────────────────────────────────────────
export { useScopeUsage } from "./model/queries.js";
export type { UseScopeUsageOptions, ScopeUsageBag } from "./model/queries.js";
export {
  DEFAULT_USAGE_MONTHS,
  MIN_USAGE_MONTHS,
  MAX_USAGE_MONTHS,
  DEFAULT_USAGE_TZ,
  normalizeScopeUsage,
  usageMonthLabels,
  usageMonth,
  usageTotals,
  formatPresence,
  isScopeUnavailable,
  isInvalidUsagePeriod,
  clampUsageMonths,
  isUsageMonthsOutOfRange,
} from "./model/usage.js";
export type {
  ScopeUsageAnswer,
  UsageMonth,
  UsageTotals,
} from "./model/usage.js";

// ── model (the meeting) ─────────────────────────────────────────────────────
export {
  JOIN_ADMITTED,
  JOIN_WAITING,
  JOIN_DENIED,
  PARTICIPANT_WAITING,
  PARTICIPANT_ADMITTED,
  PARTICIPANT_DENIED,
  PARTICIPANT_LEFT,
  joinOutcome,
  joinOutcomeFromError,
  isJoinDenied,
  isRoomNotFound,
  isNotRoomHost,
  isNotRoomParticipant,
  isParticipantNotFound,
  accessLevelKey,
  participantStatusKey,
  participantRoleKey,
  waitingParticipants,
  presentParticipants,
  isRoomHost,
  normalizeJoinCode,
} from "./model/meeting.js";
export type { JoinOutcome } from "./model/meeting.js";

export {
  useMeeting,
  useLobby,
  useRoom,
  staticLobbyBag,
  staticMeetingBag,
} from "./model/meetingQueries.js";
export type {
  MeetingBag,
  UseMeetingOptions,
  LobbyBag,
  UseLobbyOptions,
  WaitingPerson,
} from "./model/meetingQueries.js";

// ── model (1:1 calls) ───────────────────────────────────────────────────────
export {
  CALL_RINGING,
  CALL_ACCEPTED,
  CALL_DECLINED,
  CALL_MISSED,
  CALL_ENDED,
  CALL_FAILED,
  LIVE_CALL_STATES,
  isCallLive,
  isRinging,
  isRingExpired,
  ringRemainingMs,
  connectedSeconds,
  formatCallClock,
  callRole,
  otherPartyId,
  callStateKey,
  isAudioOnly,
  isCallNotFound,
  isCallBusy,
  isCallStateConflict,
  isCallNotAllowed,
  isInvalidCallee,
  isCallProviderUnavailable,
} from "./model/calls.js";

export { useActiveCall, useCallActions } from "./model/callQueries.js";
export type {
  ActiveCallBag,
  CallActionsBag,
  UseActiveCallOptions,
} from "./model/callQueries.js";

// ── model (the ring's realtime half — data only; no socket is opened here) ──
export {
  CALL_FRAME_INCOMING,
  CALL_FRAME_ACCEPTED,
  CALL_FRAME_DECLINED,
  CALL_FRAME_ENDED,
  CALL_FRAME_TYPES,
  CALL_INBOX_SOCKET_PATH,
  callInboxStreamKey,
  callInboxSocketUrl,
  decodeCallEvent,
  applyCallEvent,
} from "./model/callInbox.js";
export type {
  CallFrameLike,
  CallInboxEvent,
  IncomingCallEvent,
  CallAcceptedEvent,
  CallDeclinedEvent,
  CallEndedEvent,
} from "./model/callInbox.js";

export {
  CALL_TAB_CHANNEL,
  CALL_TAB_STORAGE_KEY,
  openCallTabBus,
} from "./model/callTabs.js";
export type { CallTabBus, CallTabMessage } from "./model/callTabs.js";

// ── model (the lobby's realtime half — data only; no socket is opened here) ──
export {
  LOBBY_FRAME_WAITING,
  LOBBY_FRAME_ADMITTED,
  LOBBY_FRAME_DENIED,
  LOBBY_FRAME_TYPES,
  lobbyStreamKey,
  lobbySocketPath,
  lobbySocketUrl,
  decodeLobbyEvent,
  lobbyLiveness,
} from "./model/lobby.js";
export type {
  LobbyEvent,
  LobbyWaitingEvent,
  LobbyAdmittedEvent,
  LobbyDeniedEvent,
  LobbyFrameLike,
  LobbyLiveness,
} from "./model/lobby.js";

// ── nav (the scripted-fullstack navigation contract) ────────────────────────
export { navEntries, ADMIN_ROOT_ID } from "./nav/manifest.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { VideoProvider } from "./headless/VideoProvider.js";
export {
  CallsProvider,
  useCalls,
  useIncomingCall,
} from "./headless/CallsProvider.js";
export type {
  CallsProviderProps,
  CallsApi,
  CallsState,
  CallGrant,
} from "./headless/CallsProvider.js";

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
