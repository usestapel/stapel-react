import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { alertsErrorBundleEn } from "./generated/errors.gen.js";

/**
 * alerts-react's own translation KEYS (frontend-standard §4.2): components
 * never render literal strings — hosts resolve these through core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys.
 *
 * ── Every enum has an `unknown` arm, and it carries the wire value ────────
 *
 * `level`, `kind` and `status` are closed enums TODAY. A backend minor can add
 * `critical` or `silenced`, and a `switch` with no default would then print a
 * raw wire token at an operator — or, worse, fall into the wrong colour. The
 * `*.unknown` keys interpolate `{level}` / `{kind}` / `{status}` so the screen
 * stays honest and still tells somebody exactly what the server said.
 *
 * ── The copy states what the STORE does, not what the screen does ─────────
 *
 * "Muted" and "Fixed" are operator claims; "Regressed" is the store's verdict
 * on evidence and is never offered as a control. The strings for it therefore
 * read as a report ("came back after the fix"), not as an instruction — the
 * one place a person could otherwise think they were meant to set it.
 */
export const ALERTS_I18N_KEYS = {
  unknownError: "alerts.error.unknown",
  navFeed: "alerts.nav.feed",
  navIssue: "alerts.nav.issue",
  none: "alerts.value.none",
  dismiss: "alerts.dialog.dismiss",
  cancel: "alerts.dialog.cancel",

  // ── the feed ─────────────────────────────────────────────────────────────
  feedTitle: "alerts.feed.title",
  feedIntro: "alerts.feed.intro",
  feedLoading: "alerts.feed.loading",
  feedFailed: "alerts.feed.failed",
  feedEmpty: "alerts.feed.empty",
  feedEmptyHint: "alerts.feed.emptyHint",
  feedEmptyFiltered: "alerts.feed.emptyFiltered",
  feedEmptyFilteredHint: "alerts.feed.emptyFilteredHint",
  feedStaffOnly: "alerts.feed.staffOnly",
  feedStaffOnlyHint: "alerts.feed.staffOnlyHint",
  feedSignedOut: "alerts.feed.signedOut",
  feedSignedOutHint: "alerts.feed.signedOutHint",
  feedRefresh: "alerts.feed.refresh",
  feedChecking: "alerts.feed.checking",
  feedUpToDate: "alerts.feed.upToDate",
  feedRange: "alerts.feed.range",
  feedPrevious: "alerts.feed.previous",
  feedNext: "alerts.feed.next",
  feedGroupSummary: "alerts.feed.groupSummary",

  // ── a row ────────────────────────────────────────────────────────────────
  colIssue: "alerts.col.issue",
  colLevel: "alerts.col.level",
  colCount: "alerts.col.count",
  colFirstSeen: "alerts.col.firstSeen",
  colLastSeen: "alerts.col.lastSeen",
  colStatus: "alerts.col.status",
  rowOpen: "alerts.row.open",
  rowSinceFix: "alerts.row.sinceFix",
  rowSeenRange: "alerts.row.seenRange",

  // ── levels ───────────────────────────────────────────────────────────────
  levelDebug: "alerts.level.debug",
  levelInfo: "alerts.level.info",
  levelWarning: "alerts.level.warning",
  levelError: "alerts.level.error",
  levelFatal: "alerts.level.fatal",
  levelUnknown: "alerts.level.unknown",

  // ── kinds ────────────────────────────────────────────────────────────────
  kindException: "alerts.kind.exception",
  kindLog: "alerts.kind.log",
  kindDlq: "alerts.kind.dlq",
  kindMonitoring: "alerts.kind.monitoring",
  kindManual: "alerts.kind.manual",
  kindUnknown: "alerts.kind.unknown",

  // ── statuses ─────────────────────────────────────────────────────────────
  statusNew: "alerts.status.new",
  statusFixed: "alerts.status.fixed",
  statusRegressed: "alerts.status.regressed",
  statusMuted: "alerts.status.muted",
  statusUnknown: "alerts.status.unknown",

  // ── the filter bar ───────────────────────────────────────────────────────
  filterStatus: "alerts.filter.status",
  filterLevel: "alerts.filter.level",
  filterService: "alerts.filter.service",
  filterSince: "alerts.filter.since",
  filterOpenOnly: "alerts.filter.openOnly",
  filterOpenOnlyHint: "alerts.filter.openOnlyHint",
  filterAnyStatus: "alerts.filter.anyStatus",
  filterAnyLevel: "alerts.filter.anyLevel",
  filterAnyService: "alerts.filter.anyService",
  filterSinceAny: "alerts.filter.sinceAny",
  filterSinceDay: "alerts.filter.sinceDay",
  filterSinceWeek: "alerts.filter.sinceWeek",
  filterSinceMonth: "alerts.filter.sinceMonth",
  filterClear: "alerts.filter.clear",

  // ── the issue ────────────────────────────────────────────────────────────
  detailTitle: "alerts.detail.title",
  detailLoading: "alerts.detail.loading",
  detailFailed: "alerts.detail.failed",
  detailNotFound: "alerts.detail.notFound",
  detailNotFoundHint: "alerts.detail.notFoundHint",
  detailService: "alerts.detail.service",
  detailEnvironment: "alerts.detail.environment",
  detailKind: "alerts.detail.kind",
  detailFingerprint: "alerts.detail.fingerprint",
  detailCount: "alerts.detail.count",
  detailSinceFix: "alerts.detail.sinceFix",
  detailFirstSeen: "alerts.detail.firstSeen",
  detailLastSeen: "alerts.detail.lastSeen",
  detailFixedIn: "alerts.detail.fixedIn",
  detailFixedSha: "alerts.detail.fixedSha",
  detailFixedAt: "alerts.detail.fixedAt",
  detailMutedUntil: "alerts.detail.mutedUntil",
  detailMutedForever: "alerts.detail.mutedForever",
  detailNote: "alerts.detail.note",
  detailRegressed: "alerts.detail.regressed",
  detailRegressedHint: "alerts.detail.regressedHint",
  detailSentry: "alerts.detail.sentry",
  detailMarkFixed: "alerts.detail.markFixed",
  detailMute: "alerts.detail.mute",
  detailReopen: "alerts.detail.reopen",
  detailReopenConfirm: "alerts.detail.reopenConfirm",
  detailEvents: "alerts.detail.events",
  detailEventsHint: "alerts.detail.eventsHint",
  detailEventsEmpty: "alerts.detail.eventsEmpty",
  detailEventsEmptyHint: "alerts.detail.eventsEmptyHint",
  detailTrace: "alerts.detail.trace",
  detailNoTrace: "alerts.detail.noTrace",
  detailContext: "alerts.detail.context",
  detailNoContext: "alerts.detail.noContext",
  detailRequestPath: "alerts.detail.requestPath",
  detailTraceId: "alerts.detail.traceId",
  detailRelease: "alerts.detail.release",
  detailOccurrences: "alerts.detail.occurrences",
  detailReceivedAt: "alerts.detail.receivedAt",
  detailRedacted: "alerts.detail.redacted",

  // ── mark fixed ───────────────────────────────────────────────────────────
  fixTitle: "alerts.fix.title",
  fixBody: "alerts.fix.body",
  fixVersion: "alerts.fix.version",
  fixVersionHint: "alerts.fix.versionHint",
  fixSha: "alerts.fix.sha",
  fixShaHint: "alerts.fix.shaHint",
  fixBlank: "alerts.fix.blank",
  fixSubmit: "alerts.fix.submit",

  // ── mute ─────────────────────────────────────────────────────────────────
  muteTitle: "alerts.mute.title",
  muteBody: "alerts.mute.body",
  muteUntil: "alerts.mute.until",
  muteDay: "alerts.mute.day",
  muteWeek: "alerts.mute.week",
  muteMonth: "alerts.mute.month",
  muteForever: "alerts.mute.forever",
  muteForeverHint: "alerts.mute.foreverHint",
  muteNote: "alerts.mute.note",
  muteNoteHint: "alerts.mute.noteHint",
  muteSubmit: "alerts.mute.submit",
} as const;

export type AlertsI18nKey =
  (typeof ALERTS_I18N_KEYS)[keyof typeof ALERTS_I18N_KEYS];

/**
 * The English fallback bundle: the generated backend error catalogue spread in
 * first (so coverage of every refusal is total by construction), then this
 * pair's own UI copy.
 */
export const alertsI18nBundleEn: I18nDictionary = {
  ...alertsErrorBundleEn,

  "alerts.error.unknown": "Something went wrong. Please try again.",
  "alerts.nav.feed": "Alerts",
  "alerts.nav.issue": "Issue",
  "alerts.value.none": "—",
  "alerts.dialog.dismiss": "Close",
  "alerts.dialog.cancel": "Cancel",

  "alerts.feed.title": "Alerts",
  "alerts.feed.intro":
    "Every bug this fleet has recorded, one row each, newest activity first.",
  "alerts.feed.loading": "Reading the tracker…",
  "alerts.feed.failed": "Could not read the tracker.",
  "alerts.feed.empty": "Nothing has failed",
  "alerts.feed.emptyHint":
    "No service has reported an error. This is what a quiet fleet looks like — the tracker is reachable and has nothing to show.",
  "alerts.feed.emptyFiltered": "No issue matches these filters",
  "alerts.feed.emptyFilteredHint":
    "Something may still be failing outside them — clear the filters to see the whole board.",
  "alerts.feed.staffOnly": "The tracker is staff-only",
  "alerts.feed.staffOnlyHint":
    "You are signed in, but this account is not staff. Nothing here is hidden because it is empty — it is hidden because it is not yours to read.",
  "alerts.feed.signedOut": "Sign in to read the tracker",
  "alerts.feed.signedOutHint":
    "Your session is not valid any more. Sign in again and the board comes back.",
  "alerts.feed.refresh": "Check now",
  "alerts.feed.checking": "Checking…",
  "alerts.feed.upToDate": "Up to date",
  "alerts.feed.range": "{from}–{to} of {total}",
  "alerts.feed.previous": "Previous",
  "alerts.feed.next": "Next",
  "alerts.feed.groupSummary": "{issues} issues · {count} occurrences",

  "alerts.col.issue": "Issue",
  "alerts.col.level": "Level",
  "alerts.col.count": "Count",
  "alerts.col.firstSeen": "First seen",
  "alerts.col.lastSeen": "Last seen",
  "alerts.col.status": "Status",
  "alerts.row.open": "Open",
  "alerts.row.sinceFix": "{count} since the fix",
  "alerts.row.seenRange": "first {first} · last {last}",

  "alerts.level.debug": "Debug",
  "alerts.level.info": "Info",
  "alerts.level.warning": "Warning",
  "alerts.level.error": "Error",
  "alerts.level.fatal": "Fatal",
  "alerts.level.unknown": "Unknown ({level})",

  "alerts.kind.exception": "Exception",
  "alerts.kind.log": "Log record",
  "alerts.kind.dlq": "Dropped work",
  "alerts.kind.monitoring": "Monitoring blind spot",
  "alerts.kind.manual": "Reported by hand",
  "alerts.kind.unknown": "Unknown ({kind})",

  "alerts.status.new": "New",
  "alerts.status.fixed": "Fixed",
  "alerts.status.regressed": "Came back",
  "alerts.status.muted": "Muted",
  "alerts.status.unknown": "Unknown ({status})",

  "alerts.filter.status": "Status",
  "alerts.filter.level": "Level",
  "alerts.filter.service": "Service",
  "alerts.filter.since": "Active since",
  "alerts.filter.openOnly": "Open only",
  "alerts.filter.openOnlyHint": "New and came-back issues",
  "alerts.filter.anyStatus": "Any status",
  "alerts.filter.anyLevel": "Any level",
  "alerts.filter.anyService": "Any service",
  "alerts.filter.sinceAny": "Any time",
  "alerts.filter.sinceDay": "Last 24 hours",
  "alerts.filter.sinceWeek": "Last 7 days",
  "alerts.filter.sinceMonth": "Last 30 days",
  "alerts.filter.clear": "Clear filters",

  "alerts.detail.title": "Issue",
  "alerts.detail.loading": "Reading the issue…",
  "alerts.detail.failed": "Could not read this issue.",
  "alerts.detail.notFound": "No such issue",
  "alerts.detail.notFoundHint":
    "It was never recorded here, or a sweep removed it after it was closed. An open issue is never swept, however old.",
  "alerts.detail.service": "Service",
  "alerts.detail.environment": "Environment",
  "alerts.detail.kind": "Source",
  "alerts.detail.fingerprint": "Fingerprint",
  "alerts.detail.count": "Occurrences",
  "alerts.detail.sinceFix": "Since the fix",
  "alerts.detail.firstSeen": "First seen",
  "alerts.detail.lastSeen": "Last seen",
  "alerts.detail.fixedIn": "Fixed in",
  "alerts.detail.fixedSha": "Commit",
  "alerts.detail.fixedAt": "Closed",
  "alerts.detail.mutedUntil": "Muted until",
  "alerts.detail.mutedForever": "Muted with no deadline",
  "alerts.detail.note": "Note",
  "alerts.detail.regressed": "This came back after it was closed",
  "alerts.detail.regressedHint":
    "The store set this itself, when a new event arrived for an issue marked fixed in {version}. Nobody can assert or withhold it.",
  "alerts.detail.sentry": "Sentry event",
  "alerts.detail.markFixed": "Mark fixed",
  "alerts.detail.mute": "Mute",
  "alerts.detail.reopen": "Reopen",
  "alerts.detail.reopenConfirm":
    "Put this back on the board as new. The release that claimed the fix stays recorded.",
  "alerts.detail.events": "Occurrences",
  "alerts.detail.eventsHint":
    "The last {shown} of {count}. Older ones are swept by retention; the count is the fact, these are the sample.",
  "alerts.detail.eventsEmpty": "No occurrence is still stored",
  "alerts.detail.eventsEmptyHint":
    "Retention swept the events for this issue. The row survives, because deleting it would turn “unresolved” into “never happened”.",
  "alerts.detail.trace": "Traceback",
  "alerts.detail.noTrace": "This occurrence carried no traceback.",
  "alerts.detail.context": "Context",
  "alerts.detail.noContext": "No context was recorded.",
  "alerts.detail.requestPath": "Request",
  "alerts.detail.traceId": "Trace id",
  "alerts.detail.release": "Release",
  "alerts.detail.occurrences": "Folded in",
  "alerts.detail.receivedAt": "Received",
  "alerts.detail.redacted":
    "Context is redacted by the store before it is written.",

  "alerts.fix.title": "Mark fixed",
  "alerts.fix.body":
    "Name the release that claims the fix. If this happens again, the store reopens the issue itself and this is what tells you which deploy was supposed to have stopped it.",
  "alerts.fix.version": "Version",
  "alerts.fix.versionHint": "The release tag, e.g. 0.42.1",
  "alerts.fix.sha": "Commit",
  "alerts.fix.shaHint": "The commit that carries the fix",
  "alerts.fix.blank":
    "Closing with neither still closes it — just with nothing to point at when it comes back.",
  "alerts.fix.submit": "Mark fixed",

  "alerts.mute.title": "Mute this issue",
  "alerts.mute.body":
    "Muting stops the notifications. It does not stop the recording: occurrences keep arriving and the count keeps rising.",
  "alerts.mute.until": "Until",
  "alerts.mute.day": "Tomorrow",
  "alerts.mute.week": "Next week",
  "alerts.mute.month": "Next month",
  "alerts.mute.forever": "No deadline",
  "alerts.mute.foreverHint":
    "Nothing will ever bring this back on its own. Prefer a date.",
  "alerts.mute.note": "Why",
  "alerts.mute.noteHint":
    "A silenced row with no reason is a trap for whoever reads this next.",
  "alerts.mute.submit": "Mute",
};

/**
 * Register alerts-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerAlertsI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, alertsI18nBundleEn);
}
