import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { videoErrorBundleEn } from "./generated/errors.gen.js";

/**
 * video-react's own translation KEYS (frontend-standard §4.2): components
 * never render literal strings — hosts resolve these through core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English for both the backend's codes (generated) and the pair's own UI keys.
 */
export const VIDEO_I18N_KEYS = {
  unknownError: "video.error.unknown",

  // The usage screen
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

  // Columns
  usageColumnPerson: "video.usage.column.person",
  usageColumnTalkTime: "video.usage.column.talk_time",
  usageColumnCalls: "video.usage.column.calls",
  usageColumnConnections: "video.usage.column.connections",

  // Footer
  usageTotalLabel: "video.usage.total.label",
  usageTotalPeople: "video.usage.total.people",
  /** Named "attendances", not "calls": the column footer is a SUM of
   * per-person distinct-room counts, so three people in one meeting make 3.
   * There is no scope-wide distinct-call number on the wire. */
  usageTotalAttendances: "video.usage.total.attendances",
  usageAttendancesHint: "video.usage.total.attendances_hint",

  // Backend error keys the pair OWNS the localization of. stapel-video ships
  // English only (no `translations/` directory at all), so its 9 keys are
  // absent from the generated ru bundle and are authored in `./i18n/ru`
  // instead — the stapel-forms / stapel-reviews precedent. Listed here so
  // `i18n-key-exists` knows them and `test/i18n.test.ts` can prove both
  // locales carry them.
  errorInvalidAccessLevel: "error.400.video_invalid_access_level",
  errorInvalidUsagePeriod: "error.400.video_invalid_usage_period",
  errorInvalidWebhook: "error.400.video_invalid_webhook",
  errorJoinDenied: "error.403.video_join_denied",
  errorNotRoomHost: "error.403.video_not_room_host",
  errorNotRoomParticipant: "error.403.video_not_room_participant",
  errorParticipantNotFound: "error.404.video_participant_not_found",
  errorRoomNotFound: "error.404.video_room_not_found",
  errorScopeNotFound: "error.404.video_scope_not_found",
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
 * `error.404.video_scope_not_found` is one of those overrides, and it is the
 * most important string in this package. The registry's own text is "Scope not
 * found", which is true and useless: the same 404 is returned when the scope
 * does not exist, when it holds no calls, and when the reader holds no
 * `USAGE_MANDATE` in it — deliberately, so a 403 cannot confirm that a guessed
 * tenant id is real. One sentence has to cover all three without claiming to
 * know which, and without ever reading as "this workspace made no calls".
 */
export const videoI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...videoErrorBundleEn,

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

  "video.usage.column.person": "Person",
  "video.usage.column.talk_time": "Talk time",
  "video.usage.column.calls": "Calls",
  "video.usage.column.connections": "Connections",

  "video.usage.total.label": "Total",
  "video.usage.total.people": "{count} people",
  "video.usage.total.attendances": "{count} attendances",
  "video.usage.total.attendances_hint":
    "The sum of each person's calls — three people in one call count as three",
};

/**
 * Register video-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerVideoI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, videoI18nBundleEn);
}
