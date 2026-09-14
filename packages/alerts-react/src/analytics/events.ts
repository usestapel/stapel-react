/**
 * The pair's analytics vocabulary.
 *
 * Three events, and every one of them is a JUDGEMENT an operator made about a
 * live bug — this is fixed, by this release; this is known and I do not want
 * to hear about it until Monday; this is back, reopen it. Reading the feed is
 * not on the list: it happens whenever the tab is open and reports nothing
 * about what anyone decided.
 *
 * The names are constants rather than `defineEvent` declarations because a
 * pair carries no `@stapel/analytics` runtime by architecture (slim wave
 * §21/S1): it emits through the `Analytics` SEAM the host injects.
 *
 * **Nothing here carries an issue id, a title, a trace or a service name.** A
 * fingerprint plus a culprit is a map of where a system is weakest, and a
 * product-analytics stream is not where that belongs. `level` is the whole
 * payload — enough to answer "are operators closing fatals or debug noise",
 * which is the only question this data is for.
 */
export const ALERTS_EVENTS = {
  /** An issue was closed with a release. Prop: `level`. */
  issueFixed: "alerts.issue.fixed",
  /** An issue was muted. Props: `level`, `hasDeadline`. */
  issueMuted: "alerts.issue.muted",
  /** An issue was put back on the board. Prop: `level`. */
  issueReopened: "alerts.issue.reopened",
} as const;

export type AlertsEventName = (typeof ALERTS_EVENTS)[keyof typeof ALERTS_EVENTS];
