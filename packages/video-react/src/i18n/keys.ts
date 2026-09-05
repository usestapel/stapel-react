import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { videoErrorBundleEn } from "./generated/errors.gen.js";

/**
 * video-react's own translation KEYS (frontend-standard §4.2): components
 * never render literal strings — hosts resolve these through core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English for both the backend's codes (generated) and the pair's own UI keys.
 *
 * Counted copy is a plural FAMILY, not a `{count} x` template: the constant
 * names the family (`video.lobby.waiting_count`) and each bundle catalogues
 * one entry per CLDR category its language has. `useTPlural` picks the
 * category; Russian's `few`/`many` exist only in the ru bundle, which is the
 * translation being right rather than a key being missing.
 */
export const VIDEO_I18N_KEYS = {
  unknownError: "video.error.unknown",

  // ── The usage screen ──────────────────────────────────────────────────────
  usageHeading: "video.usage.heading",
  usageMonthLabel: "video.usage.month_label",
  usageRefresh: "video.usage.refresh",
  usageLoading: "video.usage.loading",
  /** The 404 arm. ONE sentence for three situations — see below. */
  usageUnavailable: "video.usage.unavailable",
  /** A month that succeeded and holds nobody. Never shown for a 404. */
  usageEmpty: "video.usage.empty",
  /** No scope to ask about at all — a host wiring gap, named rather than
   * dressed up as an empty workspace. */
  usageNoScope: "video.usage.no_scope",
  /** The period the caller asked for is not one the read accepts. Refused
   * locally by `isInvalidUsagePeriod` / the `months` clamp before it can be
   * refused by the server as a generic 400. */
  usageInvalidPeriod: "video.usage.invalid_period",

  // Columns
  usageColumnPerson: "video.usage.column.person",
  usageColumnTalkTime: "video.usage.column.talk_time",
  usageColumnCalls: "video.usage.column.calls",
  usageColumnConnections: "video.usage.column.connections",

  // Footer
  usageTotalLabel: "video.usage.total.label",
  /** Plural family. */
  usageTotalPeople: "video.usage.total.people",
  /** Plural family. Named "attendances", not "calls": the footer is a SUM of
   * per-person distinct-room counts, so three people in one meeting make 3.
   * There is no scope-wide distinct-call number on the wire. */
  usageTotalAttendances: "video.usage.total.attendances",
  /** Visible secondary text beside the number — never a hover. */
  usageAttendancesHint: "video.usage.total.attendances_hint",

  // ── The meeting client: rooms ────────────────────────────────────────────
  roomsHeading: "video.rooms.heading",
  roomsIntro: "video.rooms.intro",
  /** stapel-video answers no room LIST — rooms are addressed by join code.
   * Said out loud rather than drawn as an empty list of rooms. */
  roomsNoDirectory: "video.rooms.no_directory",
  roomsStart: "video.rooms.start",
  roomsStartHint: "video.rooms.start_hint",
  roomsStartBlockedPending: "video.rooms.start.blocked.pending",
  roomsJoinHeading: "video.rooms.join_heading",
  roomsCodeLabel: "video.rooms.code_label",
  roomsCodePlaceholder: "video.rooms.code_placeholder",
  roomsJoin: "video.rooms.join",
  roomsJoinBlockedEmpty: "video.rooms.join.blocked.empty",
  roomsJoinBlockedPending: "video.rooms.join.blocked.pending",
  roomsLeave: "video.rooms.leave",

  // ── The meeting client: one room ─────────────────────────────────────────
  roomHeading: "video.room.heading",
  roomCodeLabel: "video.room.code_label",
  roomShareHint: "video.room.share_hint",
  roomAccessLabel: "video.room.access_label",
  roomAccessPublic: "video.room.access.public",
  roomAccessScopeTrusted: "video.room.access.scope_trusted",
  roomAccessRestricted: "video.room.access.restricted",
  roomAccessUnknown: "video.room.access.unknown",
  roomLobbyOn: "video.room.lobby_on",
  roomLobbyOff: "video.room.lobby_off",
  roomHostBadge: "video.room.host_badge",

  // ── The meeting client: the join grant ───────────────────────────────────
  joinAdmitted: "video.join.admitted",
  joinWaiting: "video.join.waiting",
  joinWaitingHint: "video.join.waiting_hint",
  joinDenied: "video.join.denied",
  joinDeniedHint: "video.join.denied_hint",

  // ── The meeting client: the lobby ────────────────────────────────────────
  lobbyHeading: "video.lobby.heading",
  lobbyEmpty: "video.lobby.empty",
  lobbyEmptyHint: "video.lobby.empty_hint",
  /** Plural family. */
  lobbyWaitingCount: "video.lobby.waiting_count",
  lobbyAdmit: "video.lobby.admit",
  lobbyDeny: "video.lobby.deny",
  lobbyDenyTitle: "video.lobby.deny_title",
  lobbyDenyBody: "video.lobby.deny_body",
  lobbyBlockedNotHost: "video.lobby.blocked.not_host",
  lobbyBlockedPending: "video.lobby.blocked.pending",
  lobbyRefresh: "video.lobby.refresh",

  // The lobby's live channel, stated rather than silently degraded.
  lobbyLive: "video.lobby.live",
  lobbyConnecting: "video.lobby.connecting",
  lobbyReconnecting: "video.lobby.reconnecting",
  lobbyOffline: "video.lobby.offline",
  lobbyOfflineHint: "video.lobby.offline_hint",
  lobbyRefusedSession: "video.lobby.refused.session",
  lobbyRefusedOrigin: "video.lobby.refused.origin",
  lobbyRefusedForbidden: "video.lobby.refused.forbidden",
  lobbyRefusedUnknown: "video.lobby.refused.unknown",
  lobbyReconnect: "video.lobby.reconnect",

  // ── The meeting client: participants ─────────────────────────────────────
  participantsHeading: "video.participants.heading",
  participantsEmpty: "video.participants.empty",
  participantsMore: "video.participants.more",
  participantStatusWaiting: "video.participant.status.waiting",
  participantStatusAdmitted: "video.participant.status.admitted",
  participantStatusDenied: "video.participant.status.denied",
  participantStatusLeft: "video.participant.status.left",
  participantStatusUnknown: "video.participant.status.unknown",
  participantRoleHost: "video.participant.role.host",
  participantRoleGuest: "video.participant.role.guest",

  // ── The meeting client: the call itself ──────────────────────────────────
  stageHeading: "video.stage.heading",
  stageConnecting: "video.stage.connecting",
  stageConnected: "video.stage.connected",
  stageFailed: "video.stage.failed",
  /** The optional peer is not installed. A designed refusal, not a crash. */
  stageNoPeer: "video.stage.no_peer",
  stageNoPeerHint: "video.stage.no_peer_hint",
  stageNoToken: "video.stage.no_token",
  stageNoTokenHint: "video.stage.no_token_hint",
  stageNoServer: "video.stage.no_server",
  stageLeave: "video.stage.leave",
  stageRetry: "video.stage.retry",

  // ── 1:1 calls: the ring ──────────────────────────────────────────────────
  /** The notification title, on a lock screen, in the reader's language. */
  callIncomingTitle: "video.call.incoming.title",
  callIncomingVideo: "video.call.incoming.video",
  callIncomingAudio: "video.call.incoming.audio",
  /** The caller's own "calling" state. */
  callOutgoing: "video.call.outgoing",
  callAccept: "video.call.accept",
  callDecline: "video.call.decline",
  callCancel: "video.call.cancel",
  /** A person whose name the host could not resolve. Never a blank: the wire
   * carries ids and never names, so "unknown" is an ordinary answer. */
  callPeerUnknown: "video.call.peer_unknown",

  /** How a FINISHED call reads — for a host that renders a call in a list or
   * a thread. Every arm has a sentence, including the one for a state this
   * version has never heard of: a backend that grows a seventh state must
   * leave an older client saying something true and vague, not blank. */
  callStateRinging: "video.call.state.ringing",
  callStateAccepted: "video.call.state.accepted",
  callStateDeclined: "video.call.state.declined",
  callStateMissed: "video.call.state.missed",
  callStateEnded: "video.call.state.ended",
  callStateFailed: "video.call.state.failed",
  callStateUnknown: "video.call.state.unknown",

  // ── 1:1 calls: the call itself ───────────────────────────────────────────
  callHangUp: "video.call.hang_up",
  callMute: "video.call.mute",
  callUnmute: "video.call.unmute",
  callCameraOn: "video.call.camera_on",
  callCameraOff: "video.call.camera_off",
  callFlipCamera: "video.call.flip_camera",
  callAudioOnly: "video.call.audio_only",
  callWaitingForVideo: "video.call.waiting_for_video",
  callReconnecting: "video.call.reconnecting",
  callConnectionLost: "video.call.connection_lost",
  callReconnect: "video.call.reconnect",
  /** What the phone's media-session tile says under the name. */
  callMediaSessionArtist: "video.call.media_session_artist",

  // Device refusals. A permission denial and an unavailable device are
  // different sentences because they have different remedies — one is the
  // browser's site settings, the other is closing whatever holds the device.
  callMicBlocked: "video.call.mic_blocked",
  callMicFailed: "video.call.mic_failed",
  callCameraBlocked: "video.call.camera_blocked",
  callCameraFailed: "video.call.camera_failed",
  callCameraSwitchFailed: "video.call.camera_switch_failed",

  /** A verb is in flight — the gate that stops a double tap placing two
   * calls or accepting twice. */
  callBlockedPending: "video.call.blocked.pending",

  // Backend error keys the pair OWNS the localization of. stapel-video ships
  // English only (no `translations/` directory at all), so its 9 keys are
  // absent from the generated ru/es bundles and are authored in every bundle
  // here — the stapel-forms / stapel-reviews precedent. Listed as constants so
  // `i18n-key-exists` knows them and the locale-parity gate can compare them.
  errorInvalidAccessLevel: "error.400.video_invalid_access_level",
  errorInvalidUsagePeriod: "error.400.video_invalid_usage_period",
  errorInvalidWebhook: "error.400.video_invalid_webhook",
  errorJoinDenied: "error.403.video_join_denied",
  errorNotRoomHost: "error.403.video_not_room_host",
  errorNotRoomParticipant: "error.403.video_not_room_participant",
  errorParticipantNotFound: "error.404.video_participant_not_found",
  errorRoomNotFound: "error.404.video_room_not_found",
  errorScopeNotFound: "error.404.video_scope_not_found",
  // 0.3.0 — the six the call surface added. Same arrangement as the nine
  // above: stapel-video ships no `translations/`, so every bundle authors
  // them and the locale-parity gate can compare keys all three spell out.
  errorCallNotFound: "error.404.video_call_not_found",
  errorCallInvalidCallee: "error.400.video_call_invalid_callee",
  errorCallNotAllowed: "error.403.video_call_not_allowed",
  errorCallBusy: "error.409.video_call_busy",
  errorCallState: "error.409.video_call_state",
  errorCallProviderUnavailable: "error.503.video_call_provider_unavailable",
} as const;

export type VideoI18nKey =
  (typeof VIDEO_I18N_KEYS)[keyof typeof VIDEO_I18N_KEYS];

/**
 * English fallback bundle for video-react UI keys + backend error codes.
 * The generated `videoErrorBundleEn` (from stapel-video's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 *
 * The nine `video_*` codes are written out here rather than left to the
 * generated spread: they are the sentences the meeting client shows a person
 * mid-flow, the ru/es bundles author them by hand (the module ships no locale
 * catalogue), and locale parity is only checkable over keys all three bundles
 * spell literally.
 *
 * `error.404.video_scope_not_found` is the most important string in this
 * package. The registry's own text is "Scope not found", which is true and
 * useless: the same 404 is returned when the scope does not exist, when it
 * holds no calls, and when the reader holds no `USAGE_MANDATE` in it —
 * deliberately, so a 403 cannot confirm that a guessed tenant id is real. One
 * sentence has to cover all three without claiming to know which, and without
 * ever reading as "this workspace made no calls".
 */
export const videoI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...videoErrorBundleEn,

  // Backend error codes stapel-video owns.
  "error.400.video_invalid_access_level":
    "Access level must be one of: public, scope_trusted, restricted",
  "error.400.video_invalid_usage_period":
    "The month must be YYYY-MM, the number of months between 1 and 36, and the time zone an IANA zone",
  "error.400.video_invalid_webhook":
    "The provider's webhook could not be verified",
  "error.403.video_join_denied": "The host did not let you into this room",
  "error.403.video_not_room_host": "Only the room's host can do this",
  "error.403.video_not_room_participant":
    "Only people in this room can see this",
  "error.404.video_participant_not_found":
    "That person is no longer waiting to be let in",
  "error.404.video_room_not_found": "No room has that code",
  "error.404.video_scope_not_found":
    "Call usage is not available for this workspace",

  // video-react UI
  "video.error.unknown": "Something went wrong. Please try again.",

  "video.usage.heading": "Call time",
  "video.usage.month_label": "Month",
  "video.usage.refresh": "Refresh",
  "video.usage.loading": "Loading call time…",
  "video.usage.unavailable": "Call usage is not available for this workspace",
  "video.usage.empty": "Nobody was in a call this month",
  "video.usage.no_scope": "No workspace selected, so there is nothing to report",
  "video.usage.invalid_period":
    "That reporting period cannot be asked for: months must be between 1 and 36",

  "video.usage.column.person": "Person",
  "video.usage.column.talk_time": "Talk time",
  "video.usage.column.calls": "Calls",
  "video.usage.column.connections": "Connections",

  "video.usage.total.label": "Total",
  "video.usage.total.people.one": "1 person",
  "video.usage.total.people.other": "{count} people",
  "video.usage.total.attendances.one": "1 attendance",
  "video.usage.total.attendances.other": "{count} attendances",
  "video.usage.total.attendances_hint":
    "The sum of each person's calls — three people in one call count as three",

  "video.rooms.heading": "Meetings",
  "video.rooms.intro":
    "Start a meeting and share its code, or join one somebody sent you.",
  "video.rooms.no_directory":
    "There is no list of rooms: a room is reached by its code, and this app is never told about rooms it did not open.",
  "video.rooms.start": "Start a meeting",
  "video.rooms.start_hint":
    "You become the host, and you decide who gets in if the lobby is on.",
  "video.rooms.start.blocked.pending": "Starting your meeting…",
  "video.rooms.join_heading": "Join a meeting",
  "video.rooms.code_label": "Meeting code",
  "video.rooms.code_placeholder": "abc-defg-hij",
  "video.rooms.join": "Join",
  "video.rooms.join.blocked.empty": "Enter the code you were sent first.",
  "video.rooms.join.blocked.pending": "Asking to join…",
  "video.rooms.leave": "Leave this meeting",

  "video.room.heading": "This meeting",
  "video.room.code_label": "Code",
  "video.room.share_hint": "Anyone with this code can ask to join.",
  "video.room.access_label": "Who can join",
  "video.room.access.public": "Anyone with the code",
  "video.room.access.scope_trusted": "People in this workspace",
  "video.room.access.restricted": "Only people the host lets in",
  "video.room.access.unknown": "Decided by the host's settings",
  "video.room.lobby_on": "Lobby on — the host lets people in one by one",
  "video.room.lobby_off": "Lobby off — people join straight away",
  "video.room.host_badge": "You are the host",

  "video.join.admitted": "You are in",
  "video.join.waiting": "Waiting for the host to let you in",
  "video.join.waiting_hint":
    "Keep this page open — you will be let in without asking again.",
  "video.join.denied": "The host did not let you in",
  "video.join.denied_hint":
    "This answer sticks for this room. Ask the host for a new invitation.",

  "video.lobby.heading": "Waiting to be let in",
  "video.lobby.empty": "Nobody is waiting",
  "video.lobby.empty_hint":
    "People who ask to join while the lobby is on appear here.",
  "video.lobby.waiting_count.one": "1 person waiting",
  "video.lobby.waiting_count.other": "{count} people waiting",
  "video.lobby.admit": "Let in",
  "video.lobby.deny": "Turn away",
  "video.lobby.deny_title": "Turn this person away?",
  "video.lobby.deny_body":
    "They cannot ask again with this code, and they are told they were not let in.",
  "video.lobby.blocked.not_host": "Only the room's host can answer the lobby.",
  "video.lobby.blocked.pending": "Sending your answer…",
  "video.lobby.refresh": "Check again",

  "video.lobby.live": "Live",
  "video.lobby.connecting": "Connecting…",
  "video.lobby.reconnecting": "Reconnecting…",
  "video.lobby.offline": "Not live",
  "video.lobby.offline_hint": "This list updates when you press Check again.",
  "video.lobby.refused.session":
    "Your session expired, so live updates stopped. Sign in again.",
  "video.lobby.refused.origin":
    "This deployment does not allow live updates from this address. An administrator has to allow it.",
  "video.lobby.refused.forbidden":
    "Live updates are not available to you in this room",
  "video.lobby.refused.unknown": "Live updates stopped",
  "video.lobby.reconnect": "Reconnect",

  "video.participants.heading": "In this meeting",
  "video.participants.empty": "Nobody has joined yet",
  "video.participants.more": "More people are in this room than are shown here",
  "video.participant.status.waiting": "Waiting",
  "video.participant.status.admitted": "In the call",
  "video.participant.status.denied": "Turned away",
  "video.participant.status.left": "Left",
  "video.participant.status.unknown": "Unknown",
  "video.participant.role.host": "Host",
  "video.participant.role.guest": "Guest",

  "video.stage.heading": "The call",
  "video.stage.connecting": "Connecting to the call…",
  "video.stage.connected": "You are connected",
  "video.stage.failed": "The call could not be connected",
  "video.stage.no_peer": "Video is not available on this device",
  "video.stage.no_peer_hint":
    "You are in the room and everyone can see you here, but the picture and sound cannot start. Open the room in another browser, or ask whoever runs this app to turn video on.",
  "video.stage.no_token": "No token for this call",
  "video.stage.no_token_hint":
    "A token is issued only once the host lets you in.",
  "video.stage.no_server": "No media server address is configured",
  "video.stage.leave": "Leave the call",
  "video.stage.retry": "Try connecting again",
  // ── 1:1 calls ─────────────────────────────────────────────────────────────
  //
  // "Call", never "conference": this is one person ringing one other person,
  // and every string here is read mid-interruption on a phone. Short wins.
  "video.call.incoming.title": "Incoming call",
  "video.call.incoming.video": "is calling you",
  "video.call.incoming.audio": "is calling you — audio only",
  "video.call.outgoing": "Calling…",
  "video.call.accept": "Answer",
  "video.call.decline": "Decline",
  "video.call.cancel": "Cancel",
  "video.call.peer_unknown": "Someone",

  "video.call.state.ringing": "Ringing",
  "video.call.state.accepted": "In progress",
  "video.call.state.declined": "Declined",
  "video.call.state.missed": "Missed",
  "video.call.state.ended": "Call",
  "video.call.state.failed": "Could not be connected",
  "video.call.state.unknown": "Call",

  "video.call.hang_up": "Hang up",
  "video.call.mute": "Mute",
  "video.call.unmute": "Unmute",
  "video.call.camera_on": "Turn the camera on",
  "video.call.camera_off": "Turn the camera off",
  "video.call.flip_camera": "Switch camera",
  "video.call.audio_only": "Audio call",
  "video.call.waiting_for_video": "Waiting for their video…",
  "video.call.reconnecting": "Reconnecting…",
  "video.call.connection_lost": "The connection dropped",
  "video.call.reconnect": "Reconnect",
  "video.call.media_session_artist": "Call",

  "video.call.mic_blocked":
    "This site cannot use your microphone. Allow it in your browser's settings for this site.",
  "video.call.mic_failed": "The microphone could not be turned on",
  "video.call.camera_blocked":
    "This site cannot use your camera. Allow it in your browser's settings for this site.",
  "video.call.camera_failed": "The camera could not be turned on",
  "video.call.camera_switch_failed": "That camera could not be used",
  "video.call.blocked.pending": "One moment…",

  // The six backend codes the call surface added. `video_call_not_found` is
  // the one that matters: it is UNIFORM over "no such call", "not your call"
  // and "already over", because a call id names two people and the
  // conversation they are having, so a 403 would confirm a guessed id. The
  // sentence has to be true of all three — "that call has ended" is not.
  "error.404.video_call_not_found": "That call is not available",
  "error.400.video_call_invalid_callee": "That is not someone you can call",
  "error.403.video_call_not_allowed": "You cannot call this person",
  "error.409.video_call_busy": "You are already on a call",
  "error.409.video_call_state": "This call has moved on — check it again",
  "error.503.video_call_provider_unavailable":
    "Calling is unavailable right now. Try again in a moment.",
};

/**
 * Register video-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerVideoI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, videoI18nBundleEn);
}
