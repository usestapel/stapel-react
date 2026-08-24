import type { I18nDictionary, I18nEngine } from "@stapel/core";
import {
  APPEAL_OUTCOMES,
  APPEAL_STATES,
  BUILTIN_REASON_CODES,
  CASE_ORIGINS,
  CASE_STATES,
  CONTENT_UNAVAILABLE_REASONS,
  DECISIONS,
  SANCTION_KINDS,
  SANCTION_STATES,
  SYSTEM_REASON_CODES,
  VERDICT_SOURCES,
} from "../api/enums.js";
import { moderationErrorBundleEn } from "./generated/errors.gen.js";

/**
 * moderation-react's translation KEYS (frontend-standard §4.2).
 *
 * ── Two families of key, and only one of them is listed here ──────────────
 *
 * {@link MODERATION_I18N_KEYS} holds the keys a component names as a LITERAL.
 * The other family is resolved at runtime from data — a reason code the
 * backend hands out as `label_key`, a case state, a sanction kind — and those
 * are built by the small functions below (`reasonLabelKey`, `caseStateKey`, …)
 * from the vocabularies in `api/enums.ts`. Listing them here as well would be
 * a second hand-maintained copy of an enum that is already pinned to
 * `models.py`; instead `test/i18n.test.ts` walks the enums and asserts every
 * member resolves in en, ru AND es, which is the same guarantee without the
 * copy.
 *
 * The backend's own error codes ride the SAME contour: a `StapelApiError.code`
 * is already a key, so the generated bundle is spread into the en floor below.
 */
export const MODERATION_I18N_KEYS = {
  unknownError: "moderation.error.unknown",

  // ── report (the embeddable control + its sheet) ────────────────────────
  reportButton: "moderation.report.button",
  reportButtonLabel: "moderation.report.buttonLabel",
  reportTitle: "moderation.report.title",
  reportReason: "moderation.report.reason",
  reportDescription: "moderation.report.description",
  reportDescriptionRequired: "moderation.report.descriptionRequired",
  reportDescriptionOptional: "moderation.report.descriptionOptional",
  reportGoodFaith: "moderation.report.goodFaith",
  reportSubmit: "moderation.report.submit",
  reportSignIn: "moderation.report.signIn",
  reportSignInLink: "moderation.report.signInLink",
  reportAccepted: "moderation.report.accepted",
  reportAcceptedHint: "moderation.report.acceptedHint",
  reportAlreadyReported: "moderation.report.alreadyReported",
  reportOwnContent: "moderation.report.ownContent",
  reportCannotReport: "moderation.report.cannotReport",
  reportTargetGone: "moderation.report.targetGone",
  reportThrottled: "moderation.report.throttled",
  reportUnknownTargetType: "moderation.report.unknownTargetType",
  reportReasonStale: "moderation.report.reasonStale",
  reportEvidenceInvalid: "moderation.report.evidenceInvalid",
  reportAutomatedNotice: "moderation.report.automatedNotice",
  reportBlockedNoReason: "moderation.report.blockedNoReason",
  reportBlockedDescription: "moderation.report.blockedDescription",
  reportBlockedInFlight: "moderation.report.blockedInFlight",
  reportBlockedVisitor: "moderation.report.blockedVisitor",
  reportBlockedReported: "moderation.report.blockedReported",
  reportDone: "moderation.report.done",

  // ── my reports ────────────────────────────────────────────────────────
  reportsTitle: "moderation.reports.title",
  reportsEmpty: "moderation.reports.empty",
  reportsEmptyHint: "moderation.reports.emptyHint",
  reportsNoOutcome: "moderation.reports.noOutcome",
  reportsLoadMore: "moderation.reports.loadMore",
  reportsFiled: "moderation.reports.filed",

  // ── appeals (the person's side) ────────────────────────────────────────
  appealTitle: "moderation.appeal.title",
  appealNeedLink: "moderation.appeal.needLink",
  appealNeedLinkHint: "moderation.appeal.needLinkHint",
  appealBody: "moderation.appeal.body",
  appealSubmit: "moderation.appeal.submit",
  appealSubmitted: "moderation.appeal.submitted",
  appealAlreadyAppealed: "moderation.appeal.alreadyAppealed",
  appealCaseNotResolved: "moderation.appeal.caseNotResolved",
  appealNotAppellant: "moderation.appeal.notAppellant",
  appealBlockedEmpty: "moderation.appeal.blockedEmpty",
  appealBlockedInFlight: "moderation.appeal.blockedInFlight",
  appealResolutionNote: "moderation.appeal.resolutionNote",
  appealAbout: "moderation.appeal.about",
  appealsTitle: "moderation.appeals.title",
  appealsEmpty: "moderation.appeals.empty",
  appealsEmptyHint: "moderation.appeals.emptyHint",
  appealsLoadMore: "moderation.appeals.loadMore",

  // ── policy disclosure (public) ─────────────────────────────────────────
  policyTitle: "moderation.policy.title",
  policyReasons: "moderation.policy.reasons",
  policyRules: "moderation.policy.rules",
  policyRulesEmpty: "moderation.policy.rulesEmpty",
  policyAutomated: "moderation.policy.automated",
  policyAutomatedOn: "moderation.policy.automatedOn",
  policyAutomatedOff: "moderation.policy.automatedOff",
  policyConfidenceFloor: "moderation.policy.confidenceFloor",
  policyOnUnavailable: "moderation.policy.onUnavailable",
  policyHumanReview: "moderation.policy.humanReview",
  policyHumanAlways: "moderation.policy.humanAlways",
  policyAppealDifferentActor: "moderation.policy.appealDifferentActor",
  policyAppealSameActorAllowed: "moderation.policy.appealSameActorAllowed",
  policyColCode: "moderation.policy.colCode",
  policyColSeverity: "moderation.policy.colSeverity",
  policyColDescription: "moderation.policy.colDescription",
  policyColNeedsDetail: "moderation.policy.colNeedsDetail",
  policyNeedsDetailYes: "moderation.policy.needsDetailYes",

  // ── queue (console) ───────────────────────────────────────────────────
  queueTitle: "moderation.queue.title",
  queueEmpty: "moderation.queue.empty",
  queueEmptyHint: "moderation.queue.emptyHint",
  queueStaffOnly: "moderation.queue.staffOnly",
  queueStaffOnlyHint: "moderation.queue.staffOnlyHint",
  queueFilterState: "moderation.queue.filter.state",
  queueFilterTargetType: "moderation.queue.filter.targetType",
  queueFilterReason: "moderation.queue.filter.reason",
  queueFilterSeverity: "moderation.queue.filter.severity",
  queueFilterSubject: "moderation.queue.filter.subject",
  queueFilterAny: "moderation.queue.filter.any",
  queueNoTargetTypes: "moderation.queue.noTargetTypes",
  queueColState: "moderation.queue.col.state",
  queueColTarget: "moderation.queue.col.target",
  queueColOrigin: "moderation.queue.col.origin",
  queueColSeverity: "moderation.queue.col.severity",
  queueColReports: "moderation.queue.col.reports",
  queueColClaimed: "moderation.queue.col.claimed",
  queueColUpdated: "moderation.queue.col.updated",
  queueColSubject: "moderation.queue.col.subject",
  queueLoadMore: "moderation.queue.loadMore",
  queueOpenCase: "moderation.queue.openCase",
  statsOpen: "moderation.stats.open",
  statsResolved: "moderation.stats.resolved",

  // ── case card ─────────────────────────────────────────────────────────
  caseTitle: "moderation.case.title",
  caseClaim: "moderation.case.claim",
  caseExtend: "moderation.case.extend",
  caseRelease: "moderation.case.release",
  caseRescan: "moderation.case.rescan",
  caseRescanQueued: "moderation.case.rescanQueued",
  caseLeaseMine: "moderation.case.leaseMine",
  caseLeaseOther: "moderation.case.leaseOther",
  caseLeaseExpired: "moderation.case.leaseExpired",
  caseLeaseFree: "moderation.case.leaseFree",
  caseBlockedNotMine: "moderation.case.blockedNotMine",
  caseBlockedResolved: "moderation.case.blockedResolved",
  caseBlockedNotClaimed: "moderation.case.blockedNotClaimed",
  caseBlockedInFlight: "moderation.case.blockedInFlight",
  caseClaimedByAnother: "moderation.case.claimedByAnother",
  caseNotClaimant: "moderation.case.notClaimant",
  caseContent: "moderation.case.content",
  caseContentAuthor: "moderation.case.contentAuthor",
  caseContentUrl: "moderation.case.contentUrl",
  caseContentMedia: "moderation.case.contentMedia",
  caseContentEvidence: "moderation.case.contentEvidence",
  caseSeverity: "moderation.case.severity",
  caseReportCount: "moderation.case.reportCount",
  caseGoodFaith: "moderation.case.goodFaith",
  caseTabReports: "moderation.case.tab.reports",
  caseTabVerdicts: "moderation.case.tab.verdicts",
  caseTabSanctions: "moderation.case.tab.sanctions",
  caseTabAppeals: "moderation.case.tab.appeals",
  caseTabEvents: "moderation.case.tab.events",
  caseEventsShow: "moderation.case.eventsShow",
  caseEventsEmpty: "moderation.case.eventsEmpty",
  caseSystemActor: "moderation.case.systemActor",
  caseNoReports: "moderation.case.noReports",
  caseNoVerdicts: "moderation.case.noVerdicts",
  caseNoSanctions: "moderation.case.noSanctions",
  caseNoAppeals: "moderation.case.noAppeals",

  // ── verdict form ──────────────────────────────────────────────────────
  verdictTitle: "moderation.verdict.title",
  verdictReason: "moderation.verdict.reason",
  verdictNote: "moderation.verdict.note",
  verdictSubmit: "moderation.verdict.submit",
  verdictSanctionToggle: "moderation.verdict.sanctionToggle",
  verdictSanctionOnlyRejected: "moderation.verdict.sanctionOnlyRejected",
  verdictBlockedNoDecision: "moderation.verdict.blockedNoDecision",
  verdictBlockedNoKind: "moderation.verdict.blockedNoKind",
  verdictBlockedInFlight: "moderation.verdict.blockedInFlight",
  verdictConfidence: "moderation.verdict.confidence",
  verdictBy: "moderation.verdict.by",
  verdictEvidence: "moderation.verdict.evidence",

  // ── sanctions ─────────────────────────────────────────────────────────
  sanctionsTitle: "moderation.sanctions.title",
  sanctionsEmpty: "moderation.sanctions.empty",
  sanctionsEmptyHint: "moderation.sanctions.emptyHint",
  sanctionIssue: "moderation.sanction.issue",
  sanctionLift: "moderation.sanction.lift",
  sanctionLiftNote: "moderation.sanction.liftNote",
  sanctionLiftConfirm: "moderation.sanction.liftConfirm",
  sanctionHighClearance: "moderation.sanction.highClearance",
  sanctionSubject: "moderation.sanction.subject",
  sanctionScope: "moderation.sanction.scope",
  sanctionScopeAll: "moderation.sanction.scopeAll",
  sanctionNote: "moderation.sanction.note",
  sanctionReason: "moderation.sanction.reason",
  sanctionDuration: "moderation.sanction.duration",
  sanctionDurationLadder: "moderation.sanction.durationLadder",
  sanctionDurationCustom: "moderation.sanction.durationCustom",
  sanctionDurationIndefinite: "moderation.sanction.durationIndefinite",
  sanctionDurationSeconds: "moderation.sanction.durationSeconds",
  sanctionLadderHint: "moderation.sanction.ladderHint",
  sanctionNoLadder: "moderation.sanction.noLadder",
  sanctionExpires: "moderation.sanction.expires",
  sanctionIndefinite: "moderation.sanction.indefinite",
  sanctionIssuedBy: "moderation.sanction.issuedBy",
  sanctionBlockedNoSubject: "moderation.sanction.blockedNoSubject",
  sanctionBlockedInFlight: "moderation.sanction.blockedInFlight",
  sanctionBlockedNotActive: "moderation.sanction.blockedNotActive",
  sanctionFilterState: "moderation.sanction.filterState",
  sanctionFilterSubject: "moderation.sanction.filterSubject",
  sanctionsLoadMore: "moderation.sanctions.loadMore",

  // ── appeal queue (console) ────────────────────────────────────────────
  appealQueueTitle: "moderation.appealQueue.title",
  appealQueueEmpty: "moderation.appealQueue.empty",
  appealQueueEmptyHint: "moderation.appealQueue.emptyHint",
  appealQueueResolve: "moderation.appealQueue.resolve",
  appealQueueOutcome: "moderation.appealQueue.outcome",
  appealQueueSameActor: "moderation.appealQueue.sameActor",
  appealQueueAlreadyDecided: "moderation.appealQueue.alreadyDecided",
  appealQueueAppellant: "moderation.appealQueue.appellant",
  appealQueueOpenCase: "moderation.appealQueue.openCase",
  appealQueueNote: "moderation.appealQueue.note",
  appealQueueBlockedNoOutcome: "moderation.appealQueue.blockedNoOutcome",
  appealQueueBlockedInFlight: "moderation.appealQueue.blockedInFlight",
  appealQueueLoadMore: "moderation.appealQueue.loadMore",
  appealQueueFilterState: "moderation.appealQueue.filterState",

  // ── console shell ─────────────────────────────────────────────────────
  consoleTitle: "moderation.console.title",
  consoleTabQueue: "moderation.console.tab.queue",
  consoleTabSanctions: "moderation.console.tab.sanctions",
  consoleTabAppeals: "moderation.console.tab.appeals",

  // ── cross-cutting ─────────────────────────────────────────────────────
  stepUpNeeded: "moderation.stepUp.needed",
  dialogDismiss: "moderation.dialog.dismiss",
  cancel: "moderation.action.cancel",
  unknownValue: "moderation.value.unknown",

  // ── nav labels ────────────────────────────────────────────────────────
  navPolicy: "moderation.nav.policy",
  navAppeals: "moderation.nav.appeals",
  navReports: "moderation.nav.reports",
  navModeration: "moderation.nav.moderation",
} as const;

export type ModerationI18nKey =
  (typeof MODERATION_I18N_KEYS)[keyof typeof MODERATION_I18N_KEYS];

// ── data-resolved key families ──────────────────────────────────────────────
// The backend hands out `label_key`/`description_key` verbatim (defaulting to
// these shapes, `registry.py:291-294`), so a policy's reason renders through
// whatever key it names — these builders are what the pair uses for the codes
// it ships copy for, and for the enum vocabularies no endpoint describes.

/** `moderation.reason.<code>.label` — the backend's own default shape. */
export const reasonLabelKey = (code: string): string =>
  `moderation.reason.${code}.label`;
/** `moderation.reason.<code>.description`. */
export const reasonDescriptionKey = (code: string): string =>
  `moderation.reason.${code}.description`;
/** `moderation.rule.<code>.description` — the screening rules' shape. */
export const ruleDescriptionKey = (code: string): string =>
  `moderation.rule.${code}.description`;
export const caseStateKey = (state: string): string =>
  `moderation.case.state.${state}`;
export const caseOriginKey = (origin: string): string =>
  `moderation.case.origin.${origin}`;
export const contentUnavailableKey = (reason: string): string =>
  `moderation.case.content.unavailable.${reason}`;
export const decisionKey = (decision: string): string =>
  `moderation.verdict.decision.${decision}`;
export const decisionHintKey = (decision: string): string =>
  `moderation.verdict.decisionHint.${decision}`;
export const verdictSourceKey = (source: string): string =>
  `moderation.verdict.source.${source}`;
export const sanctionKindKey = (kind: string): string =>
  `moderation.sanction.kind.${kind}`;
export const sanctionStateKey = (state: string): string =>
  `moderation.sanction.state.${state}`;
export const appealStateKey = (state: string): string =>
  `moderation.appeal.state.${state}`;
export const appealOutcomeKey = (outcome: string): string =>
  `moderation.appealQueue.outcome.${outcome}`;
export const appealOutcomeHintKey = (outcome: string): string =>
  `moderation.appealQueue.outcomeHint.${outcome}`;

/** Every data-resolved key the pair ships copy for — the list `test/i18n.test.ts`
 * walks, and the list a locale bundle is checked against. */
export function dataResolvedKeys(): readonly string[] {
  const keys: string[] = [];
  for (const code of [...BUILTIN_REASON_CODES, ...SYSTEM_REASON_CODES]) {
    keys.push(reasonLabelKey(code), reasonDescriptionKey(code));
  }
  for (const state of CASE_STATES) keys.push(caseStateKey(state));
  for (const origin of CASE_ORIGINS) keys.push(caseOriginKey(origin));
  for (const reason of CONTENT_UNAVAILABLE_REASONS) {
    keys.push(contentUnavailableKey(reason));
  }
  for (const decision of DECISIONS) {
    keys.push(decisionKey(decision), decisionHintKey(decision));
  }
  for (const source of VERDICT_SOURCES) keys.push(verdictSourceKey(source));
  for (const kind of SANCTION_KINDS) keys.push(sanctionKindKey(kind));
  for (const state of SANCTION_STATES) keys.push(sanctionStateKey(state));
  for (const state of APPEAL_STATES) keys.push(appealStateKey(state));
  for (const outcome of APPEAL_OUTCOMES) {
    keys.push(appealOutcomeKey(outcome), appealOutcomeHintKey(outcome));
  }
  return keys;
}

/**
 * English fallback bundle: backend error codes (generated) first, so no
 * `StapelApiError.code` can ever render as a raw key, then the pair's own copy.
 */
export const moderationI18nBundleEn: I18nDictionary = {
  ...moderationErrorBundleEn,

  "moderation.error.unknown": "Something went wrong. Please try again.",

  "moderation.report.button": "Report",
  "moderation.report.buttonLabel": "Report this content",
  "moderation.report.title": "Report this content",
  "moderation.report.reason": "What is wrong with it?",
  "moderation.report.description": "Tell us more",
  "moderation.report.descriptionRequired": "This reason needs an explanation.",
  "moderation.report.descriptionOptional": "Optional, but it helps.",
  "moderation.report.goodFaith":
    "I believe in good faith that the information above is accurate and complete.",
  "moderation.report.submit": "Send report",
  "moderation.report.signIn": "Reports are tied to an account, so we can tell you what happened.",
  "moderation.report.signInLink": "Sign in to report",
  "moderation.report.accepted": "Thank you. Your reference is {caseRef}.",
  "moderation.report.acceptedHint": "We will let you know when a moderator has looked at it.",
  "moderation.report.alreadyReported": "You have already reported this. We are on it.",
  "moderation.report.ownContent": "This is your own content — you cannot report it.",
  "moderation.report.cannotReport": "This content cannot be reported from here.",
  "moderation.report.targetGone": "This content is no longer there.",
  "moderation.report.throttled": "You have sent a lot of reports recently. Please try again later.",
  "moderation.report.unknownTargetType": "This kind of content is not moderated here.",
  "moderation.report.reasonStale":
    "That reason does not apply to this kind of content. The list has been refreshed — please pick again.",
  "moderation.report.evidenceInvalid": "The attached copy of the content was not accepted.",
  "moderation.report.automatedNotice": "Reports may first be screened automatically.",
  "moderation.report.blockedNoReason": "Pick a reason first.",
  "moderation.report.blockedDescription": "This reason needs an explanation.",
  "moderation.report.blockedInFlight": "Sending…",
  "moderation.report.blockedVisitor": "Sign in to send a report.",
  "moderation.report.blockedReported": "You have already reported this.",
  "moderation.report.done": "Close",

  "moderation.reports.title": "Reports you sent",
  "moderation.reports.empty": "You have not reported anything.",
  "moderation.reports.emptyHint":
    "When you report something, it will be listed here with its reference.",
  "moderation.reports.noOutcome":
    "We do not show a decision here — you will be notified when this report has been reviewed.",
  "moderation.reports.loadMore": "Show more",
  "moderation.reports.filed": "Sent {date}",

  "moderation.appeal.title": "Appeal a decision",
  "moderation.appeal.needLink": "Open this page from the link in your notification.",
  "moderation.appeal.needLinkHint":
    "An appeal is about one specific decision, and the link in the message about it carries the reference. We cannot look it up from here.",
  "moderation.appeal.body": "Why should this decision be changed?",
  "moderation.appeal.submit": "Send appeal",
  "moderation.appeal.submitted": "Your appeal has been sent. A different moderator will read it.",
  "moderation.appeal.alreadyAppealed": "You have already appealed this decision.",
  "moderation.appeal.caseNotResolved": "This case has not been decided yet, so there is nothing to appeal.",
  "moderation.appeal.notAppellant": "This decision was not about your content.",
  "moderation.appeal.blockedEmpty": "Write why the decision should be changed.",
  "moderation.appeal.blockedInFlight": "Sending…",
  "moderation.appeal.resolutionNote": "Moderator's answer",
  "moderation.appeal.about": "About decision {caseRef}",
  "moderation.appeals.title": "Your appeals",
  "moderation.appeals.empty": "You have not appealed anything.",
  "moderation.appeals.emptyHint": "Appeals you send will be listed here with their outcome.",
  "moderation.appeals.loadMore": "Show more",

  "moderation.policy.title": "How content is moderated here",
  "moderation.policy.reasons": "What can be reported",
  "moderation.policy.rules": "Automatic rules",
  "moderation.policy.rulesEmpty": "No automatic rules are configured.",
  "moderation.policy.automated": "Automated screening",
  "moderation.policy.automatedOn": "Reports and submissions are screened automatically first: {stages}.",
  "moderation.policy.automatedOff": "Nothing is screened automatically — every case is read by a person.",
  "moderation.policy.confidenceFloor":
    "An automatic decision is only applied above a confidence of {floor}.",
  "moderation.policy.onUnavailable": "When screening is unavailable: {behaviour}.",
  "moderation.policy.humanReview": "Human review",
  "moderation.policy.humanAlways": "A person is always available to review a decision.",
  "moderation.policy.appealDifferentActor":
    "An appeal is always decided by a different moderator than the original decision.",
  "moderation.policy.appealSameActorAllowed":
    "An appeal may be decided by the same moderator as the original decision.",
  "moderation.policy.colCode": "Reason",
  "moderation.policy.colSeverity": "Severity",
  "moderation.policy.colDescription": "What it means",
  "moderation.policy.colNeedsDetail": "Explanation",
  "moderation.policy.needsDetailYes": "Required",

  "moderation.queue.title": "Moderation queue",
  "moderation.queue.empty": "The queue is clear.",
  "moderation.queue.emptyHint": "Nothing matches these filters right now.",
  "moderation.queue.staffOnly": "This console is for moderators.",
  "moderation.queue.staffOnlyHint":
    "You are signed in, but this account does not have the moderation clearance.",
  "moderation.queue.filter.state": "State",
  "moderation.queue.filter.targetType": "Kind",
  "moderation.queue.filter.reason": "Reason",
  "moderation.queue.filter.severity": "Minimum severity",
  "moderation.queue.filter.subject": "Author",
  "moderation.queue.filter.any": "Any",
  "moderation.queue.noTargetTypes":
    "This app did not declare which kinds of content it moderates, so the filter is off.",
  "moderation.queue.col.state": "State",
  "moderation.queue.col.target": "Content",
  "moderation.queue.col.origin": "Opened by",
  "moderation.queue.col.severity": "Severity",
  "moderation.queue.col.reports": "Reports",
  "moderation.queue.col.claimed": "Held by",
  "moderation.queue.col.updated": "Updated",
  "moderation.queue.col.subject": "Author",
  "moderation.queue.loadMore": "Show more",
  "moderation.queue.openCase": "Open case",
  "moderation.stats.open": "Open",
  "moderation.stats.resolved": "Resolved",

  "moderation.case.title": "Case {caseRef}",
  "moderation.case.claim": "Take this case",
  "moderation.case.extend": "Extend the hold",
  "moderation.case.release": "Hand it back",
  "moderation.case.rescan": "Screen it again",
  "moderation.case.rescanQueued": "Screening again — this card will update by itself.",
  "moderation.case.leaseMine": "You are holding this case until {until}.",
  "moderation.case.leaseOther": "{who} is holding this case until {until}.",
  "moderation.case.leaseExpired": "Your hold has run out — the case has gone back to the queue.",
  "moderation.case.leaseFree": "Nobody is holding this case.",
  "moderation.case.blockedNotMine": "Take the case first — somebody else is holding it.",
  "moderation.case.blockedResolved": "This case is already decided.",
  "moderation.case.blockedNotClaimed": "Take the case first.",
  "moderation.case.blockedInFlight": "Working…",
  "moderation.case.claimedByAnother": "{who} took this case first.",
  "moderation.case.notClaimant": "This hold is not yours to hand back.",
  "moderation.case.content": "The reported content",
  "moderation.case.contentAuthor": "Author",
  "moderation.case.contentUrl": "Open in the app",
  "moderation.case.contentMedia": "{count} attached files",
  "moderation.case.contentEvidence":
    "This is the reporter's own copy of something nobody serves — it is what they say they saw, not something we read.",
  "moderation.case.severity": "Severity {value}",
  "moderation.case.reportCount": "{count} reports",
  "moderation.case.goodFaith": "Declared in good faith",
  "moderation.case.tab.reports": "Reports",
  "moderation.case.tab.verdicts": "Decisions",
  "moderation.case.tab.sanctions": "Sanctions",
  "moderation.case.tab.appeals": "Appeals",
  "moderation.case.tab.events": "History",
  "moderation.case.eventsShow": "Show the full history",
  "moderation.case.eventsEmpty": "No history recorded.",
  "moderation.case.systemActor": "the system",
  "moderation.case.noReports": "No complaints — this case was opened another way.",
  "moderation.case.noVerdicts": "No decision yet.",
  "moderation.case.noSanctions": "No sanctions on this case.",
  "moderation.case.noAppeals": "No appeals on this case.",

  "moderation.verdict.title": "Decide",
  "moderation.verdict.reason": "Reason",
  "moderation.verdict.note": "Note for the record",
  "moderation.verdict.submit": "Record the decision",
  "moderation.verdict.sanctionToggle": "Also sanction the author",
  "moderation.verdict.sanctionOnlyRejected":
    "A sanction can only accompany a decision that the content breaks the rules.",
  "moderation.verdict.blockedNoDecision": "Pick a decision first.",
  "moderation.verdict.blockedNoKind": "Pick what the sanction is.",
  "moderation.verdict.blockedInFlight": "Recording…",
  "moderation.verdict.confidence": "Confidence {value}",
  "moderation.verdict.by": "by {who}",
  "moderation.verdict.evidence": "What it matched",

  "moderation.sanctions.title": "Sanctions",
  "moderation.sanctions.empty": "No sanctions match these filters.",
  "moderation.sanctions.emptyHint": "Sanctions issued with a decision appear here too.",
  "moderation.sanction.issue": "Issue a sanction",
  "moderation.sanction.lift": "Lift",
  "moderation.sanction.liftNote": "Why are you lifting it?",
  "moderation.sanction.liftConfirm": "Lift this sanction?",
  "moderation.sanction.highClearance":
    "Issuing a sanction needs a higher clearance than this account has.",
  "moderation.sanction.subject": "Author",
  "moderation.sanction.scope": "Where it applies",
  "moderation.sanction.scopeAll": "Everywhere",
  "moderation.sanction.note": "Note",
  "moderation.sanction.reason": "Reason",
  "moderation.sanction.duration": "How long",
  "moderation.sanction.durationLadder": "The usual next step",
  "moderation.sanction.durationCustom": "A length I choose",
  "moderation.sanction.durationIndefinite": "Until it is lifted",
  "moderation.sanction.durationSeconds": "Seconds",
  "moderation.sanction.ladderHint": "Usually {ladder}, unless you set a length.",
  "moderation.sanction.noLadder": "This kind has no usual length — set one, or leave it open-ended.",
  "moderation.sanction.expires": "Until {date}",
  "moderation.sanction.indefinite": "Until lifted",
  "moderation.sanction.issuedBy": "Issued by {who}",
  "moderation.sanction.blockedNoSubject": "Name the author it applies to.",
  "moderation.sanction.blockedInFlight": "Working…",
  "moderation.sanction.blockedNotActive": "Only an active sanction can be lifted.",
  "moderation.sanction.filterState": "State",
  "moderation.sanction.filterSubject": "Author",
  "moderation.sanctions.loadMore": "Show more",

  "moderation.appealQueue.title": "Appeals",
  "moderation.appealQueue.empty": "No appeals are waiting.",
  "moderation.appealQueue.emptyHint": "An appeal appears here as soon as somebody sends one.",
  "moderation.appealQueue.resolve": "Decide the appeal",
  "moderation.appealQueue.outcome": "Outcome",
  "moderation.appealQueue.sameActor":
    "You decided this case, so somebody else has to hear the appeal.",
  "moderation.appealQueue.alreadyDecided": "This appeal has already been decided.",
  "moderation.appealQueue.appellant": "From {who}",
  "moderation.appealQueue.openCase": "Open the case",
  "moderation.appealQueue.note": "Answer to the person",
  "moderation.appealQueue.blockedNoOutcome": "Pick an outcome first.",
  "moderation.appealQueue.blockedInFlight": "Recording…",
  "moderation.appealQueue.loadMore": "Show more",
  "moderation.appealQueue.filterState": "State",

  "moderation.console.title": "Moderation",
  "moderation.console.tab.queue": "Queue",
  "moderation.console.tab.sanctions": "Sanctions",
  "moderation.console.tab.appeals": "Appeals",

  "moderation.stepUp.needed": "Confirm it is you to finish this.",
  "moderation.dialog.dismiss": "Close",
  "moderation.action.cancel": "Cancel",
  "moderation.value.unknown": "Unknown",

  "moderation.nav.policy": "Content rules",
  "moderation.nav.appeals": "Appeals",
  "moderation.nav.reports": "Your reports",
  "moderation.nav.moderation": "Moderation",

  // ── data-resolved families ────────────────────────────────────────────
  "moderation.reason.spam.label": "Spam",
  "moderation.reason.spam.description": "Repetitive or unsolicited content.",
  "moderation.reason.offensive.label": "Offensive",
  "moderation.reason.offensive.description": "Insulting, hateful or obscene content.",
  "moderation.reason.harassment.label": "Harassment",
  "moderation.reason.harassment.description": "Targeted at a person or a group.",
  "moderation.reason.counterfeit.label": "Counterfeit",
  "moderation.reason.counterfeit.description": "Fake or unlicensed goods.",
  "moderation.reason.fraud.label": "Fraud",
  "moderation.reason.fraud.description": "A scam or a deliberate deception.",
  "moderation.reason.illegal.label": "Illegal",
  "moderation.reason.illegal.description": "Against the law where this service operates.",
  "moderation.reason.adult.label": "Adult content",
  "moderation.reason.adult.description": "Sexual content in the wrong place.",
  "moderation.reason.personal_data.label": "Someone's private data",
  "moderation.reason.personal_data.description":
    "Personal information published without consent.",
  "moderation.reason.off_platform_payment.label": "Payment outside the platform",
  "moderation.reason.off_platform_payment.description":
    "An attempt to move the payment somewhere unprotected.",
  "moderation.reason.wrong_category.label": "In the wrong place",
  "moderation.reason.wrong_category.description": "Posted under the wrong category.",
  "moderation.reason.other.label": "Something else",
  "moderation.reason.other.description": "Tell us what is wrong in your own words.",
  "moderation.reason.screening_unavailable.label": "Screening was unavailable",
  "moderation.reason.screening_unavailable.description":
    "The automatic check could not run, so a person decided.",
  "moderation.reason.screening_held.label": "Held for a person",
  "moderation.reason.screening_held.description":
    "The automatic check deliberately left this to a person.",
  "moderation.reason.low_confidence.label": "The automatic check was unsure",
  "moderation.reason.low_confidence.description":
    "The screener's answer was below the confidence needed to act on it.",

  "moderation.case.state.open": "New",
  "moderation.case.state.screening": "Being screened",
  "moderation.case.state.queued": "Waiting for a person",
  "moderation.case.state.claimed": "Being worked on",
  "moderation.case.state.resolved": "Decided",

  "moderation.case.origin.submission": "Submitted for review",
  "moderation.case.origin.report": "Reported",
  "moderation.case.origin.manual": "Opened by a moderator",
  "moderation.case.origin.rescan": "Screened again",
  "moderation.case.origin.appeal": "Reopened by an appeal",

  "moderation.case.content.unavailable.no_content_function":
    "This app does not serve the content of this kind of item, so there is nothing to show.",
  "moderation.case.content.unavailable.forbidden":
    "You are not allowed to read this content.",
  "moderation.case.content.unavailable.target_not_found": "The content is gone.",
  "moderation.case.content.unavailable.not_loaded":
    "The content was not read when this card was opened.",

  "moderation.verdict.decision.approved": "It is fine",
  "moderation.verdict.decisionHint.approved": "The content stays as it is.",
  "moderation.verdict.decision.rejected": "It breaks the rules",
  "moderation.verdict.decisionHint.rejected": "The content is taken down or hidden.",
  "moderation.verdict.decision.needs_review": "Somebody else should look",
  "moderation.verdict.decisionHint.needs_review": "The case stays open for another person.",
  "moderation.verdict.decision.dismissed": "The complaint is unfounded",
  "moderation.verdict.decisionHint.dismissed":
    "About the complaint, not the content: there was nothing to answer.",

  "moderation.verdict.source.llm": "Automatic screener",
  "moderation.verdict.source.rule": "Automatic rule",
  "moderation.verdict.source.human": "Moderator",
  "moderation.verdict.source.policy_default": "Policy default",
  "moderation.verdict.source.appeal": "Appeal",

  "moderation.sanction.kind.warning": "Warning",
  "moderation.sanction.kind.content_removed": "Content removed",
  "moderation.sanction.kind.posting_restricted": "Posting restricted",
  "moderation.sanction.kind.suspended": "Suspended",
  "moderation.sanction.kind.banned": "Banned",

  "moderation.sanction.state.active": "Active",
  "moderation.sanction.state.expired": "Expired",
  "moderation.sanction.state.lifted": "Lifted",
  "moderation.sanction.state.overturned": "Overturned",

  "moderation.appeal.state.open": "Waiting",
  "moderation.appeal.state.upheld": "Decision stands",
  "moderation.appeal.state.overturned": "Decision reversed",
  "moderation.appeal.state.withdrawn": "Withdrawn",

  "moderation.appealQueue.outcome.upheld": "The decision stands",
  "moderation.appealQueue.outcomeHint.upheld": "Nothing changes for the content.",
  "moderation.appealQueue.outcome.overturned": "Reverse the decision",
  "moderation.appealQueue.outcomeHint.overturned": "The case is reopened and decided again.",
  "moderation.appealQueue.outcome.withdrawn": "Withdrawn",
  "moderation.appealQueue.outcomeHint.withdrawn": "The person took the appeal back.",
};

/**
 * Register moderation-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerModerationI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, moderationI18nBundleEn);
}
