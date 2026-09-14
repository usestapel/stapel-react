/**
 * Wire types for the stapel-alerts HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The one
 * source of truth is `components["schemas"]` in this pair's own package-LOCAL
 * generated schema (`./generated/schema.js`, produced by `pnpm gen:api` from
 * stapel-alerts's own committed `docs/schema.json`).
 *
 * ── BACKEND-GAP A-1: the list answers a PAGE, the schema says an array ────
 *
 * `docs/schema.json` declares `GET /issues` → `Issue[]`, because
 * drf-spectacular reads `responses=IssueSerializer(many=True)` off the
 * decorator. The VIEW returns something else — `views.IssueListView.get`
 * builds `{count, offset, limit, results}` and hands it to `_conditional`.
 * Both halves are green in isolation and the statement joining them is false,
 * which is the seam defect in its purest form.
 *
 * A generated `Issue[]` is what a pair that trusted the schema would have
 * typed, and every row on the triage screen would have been `undefined`. So
 * {@link IssuePage} is declared here, by hand, with the ROWS still typed from
 * the generated `Issue` — the part of the contract that is true — and
 * `test/pair.test.ts` drives the real envelope through the real transport so
 * this correction is checked against the wire and not against a belief.
 *
 * ── The three enums come from the schema and are not re-narrowed ──────────
 *
 * `level`, `kind` and `status` are real `enum`s in the contract, so the
 * generated unions are the narrowing. What this module adds is the ORDERED
 * tuples a screen iterates (a filter bar, a legend): declaration order in a
 * generated file is alphabetical-ish and meaningless, while `debug → fatal` is
 * a severity ramp somebody reads top to bottom.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** The tracker row: one bug, with the status a fix wave reconciles against. */
export type Issue = Schemas["Issue"];

/** One issue plus its last events (`views.DETAIL_EVENTS` = 20 of them). */
export type IssueDetail = Schemas["IssueDetail"];

/** One occurrence: the trace, the redacted context, the correlation id. */
export type ErrorEvent = Schemas["ErrorEvent"];

/** The body `PATCH /issues/{id}` takes. */
export type IssuePatch = Schemas["PatchedIssuePatch"];

/** The body `POST /issues/{id}/fix` takes — both fields optional, both kept. */
export type IssueFix = Schemas["IssueFix"];

/** Severity, as the backend's `Level` choices spell it. */
export type IssueLevel = Schemas["LevelEnum"];

/** Where an occurrence came from (`Kind` choices). */
export type IssueKind = Schemas["KindEnum"];

/** Where an issue is in its life — including the one nobody may assign. */
export type IssueStatus = Schemas["Status295Enum"];

/** The statuses a CALLER may assign (`serializers.SETTABLE_STATUSES`). */
export type SettableIssueStatus = Schemas["IssuePatchStatusEnum"];

/**
 * A page of the triage list — the body the view actually returns (A-1 above).
 *
 * `limit` is the server's page size (`views.PAGE_SIZE`, 50) echoed back rather
 * than a number the client asked for: the endpoint takes no page-size
 * parameter at all, so a pair that hardcoded 50 would be one backend constant
 * away from paging past rows nobody ever saw.
 */
export interface IssuePage {
  /** How many issues match the filters — not how many are in `results`. */
  readonly count: number;
  /** The offset this page starts at. */
  readonly offset: number;
  /** The server's page size, as it reports it. */
  readonly limit: number;
  readonly results: readonly Issue[];
}

/**
 * Severity, weakest first. The order is the whole point: a filter bar built
 * from `Object.keys` of a generated type puts `debug` next to `fatal` in
 * whatever order the emitter felt like.
 */
export const ISSUE_LEVELS: readonly IssueLevel[] = [
  "debug",
  "info",
  "warning",
  "error",
  "fatal",
];

/** The four statuses an issue can be in, in lifecycle order. */
export const ISSUE_STATUSES: readonly IssueStatus[] = [
  "new",
  "regressed",
  "fixed",
  "muted",
];

/**
 * The three a caller may ASSERT.
 *
 * `regressed` is absent, and not by omission: the store sets it when a fixed
 * issue receives a new event (`services.record`), and a caller able to set it
 * would be a caller able to decline to. `POST`ing it back answers
 * `error.400.alerts_status_not_settable`, so a control offering it would exist
 * only to be refused.
 */
export const SETTABLE_ISSUE_STATUSES: readonly SettableIssueStatus[] = [
  "new",
  "fixed",
  "muted",
];

/** Statuses the backend counts as open (`models.OPEN_STATUSES`). */
export const OPEN_ISSUE_STATUSES: readonly IssueStatus[] = ["new", "regressed"];

/** Is this one of the statuses `PATCH /issues/{id}` accepts? */
export function isSettableStatus(value: string): value is SettableIssueStatus {
  return (SETTABLE_ISSUE_STATUSES as readonly string[]).includes(value);
}

/** Is this issue one the store still considers unresolved? */
export function isOpenStatus(value: string): boolean {
  return (OPEN_ISSUE_STATUSES as readonly string[]).includes(value);
}
