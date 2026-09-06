/**
 * Demo bodies, shaped exactly as stapel-moderation sends them.
 *
 * MOCK THE WIRE, NOT THE MODULE: every field name here is the snake_case the
 * presenters declare, every optional is present or absent the way the DTO says,
 * and nothing is pre-digested into something a component could not have
 * derived. A fixture that hand-shaped a value would document a screen the
 * backend cannot produce.
 */
import type {
  Appeal,
  Case,
  CaseDetail,
  CaseEvent,
  PolicyDisclosure,
  Stats,
} from "../src/api/types.js";

/** An error envelope, in core's dialect. */
export const refusal = (
  status: number,
  code: string
): readonly [number, unknown] => [
  status,
  { localizable_error: code, error: code, params: {} },
];

/** A signed-in person without the moderation mandate. */
export const STAFF_ONLY: readonly [number, unknown] = refusal(
  403,
  "error.403.moderation_forbidden"
);

/** The screening stage is on, and says so (Art. 15(1)(e)). */
export const POLICY: PolicyDisclosure = {
  lang: "en",
  reasons: [
    {
      code: "spam",
      severity: 20,
      requires_description: false,
      label_key: "moderation.reason.spam.label",
      description_key: "moderation.reason.spam.description",
      policy_clause: "",
    },
    {
      code: "harassment",
      severity: 70,
      requires_description: true,
      label_key: "moderation.reason.harassment.label",
      description_key: "moderation.reason.harassment.description",
      policy_clause: "",
    },
    {
      code: "other",
      severity: 10,
      requires_description: true,
      label_key: "moderation.reason.other.label",
      description_key: "moderation.reason.other.description",
      policy_clause: "",
    },
  ],
  rules: [],
  automated_means: {
    enabled: true,
    stages: ["screen"],
    model_size: "small",
    confidence_floor: 0.8,
    on_unavailable: "hold",
  },
  human_review: {
    always_available: true,
    auto_resolve_after_seconds: null,
    appeal_requires_different_actor: true,
  },
};

/** A deployment that screens nothing — every case is read by a person. */
export const POLICY_NO_AUTOMATION: PolicyDisclosure = {
  ...POLICY,
  automated_means: { ...POLICY.automated_means, enabled: false, stages: [] },
};

/** A registry with nothing in it: the form has nothing to offer, and says so. */
export const POLICY_EMPTY: PolicyDisclosure = { ...POLICY, reasons: [] };

/**
 * A lease that is still running, measured from whenever the demo is rendered.
 *
 * A fixed instant is either already in the past — and the console correctly
 * reports the hold as expired, which is not the state the story is named for —
 * or it is a sentinel like `2099-01-01`, which reaches the glass as
 * "holding this case until Jan 1, 2099" and reads as a defect.
 */
const LEASE_STILL_RUNNING: string = new Date(
  Date.now() + 42 * 60_000
).toISOString();

const MODERATOR = "7f3a1c22-0b41-4f0e-9a1e-2f8b6d0c1e55";
const COLLEAGUE = "1c9d5e40-7a2b-4c8e-b3d1-9f0a6e2b4c77";
const AUTHOR = "4e21b8a0-33cd-4a17-8f52-6b90d1c4e2a8";

/** Waiting for a person; nobody holding it. */
export const CASE_QUEUED: Case = {
  id: "2b7f0d18-91e4-4a63-8d21-5c6e7f809a10",
  target_type: "listing",
  target_key: "8842",
  scope_key: "",
  origin: "report",
  state: "queued",
  severity: 70,
  report_count: 3,
  created_at: "2026-08-20T09:12:00Z",
  updated_at: "2026-08-21T07:40:00Z",
  subject_user_id: AUTHOR,
  claimed_by: null,
  claimed_until: null,
  last_decision: "",
};

/** Held by somebody else, with the lease still running. */
export const CASE_CLAIMED: Case = {
  ...CASE_QUEUED,
  id: "9a04e6c1-2d55-4b70-91ff-0e3c8b71d2a4",
  target_type: "review",
  target_key: "3391",
  state: "claimed",
  severity: 40,
  report_count: 1,
  claimed_by: COLLEAGUE,
  claimed_until: LEASE_STILL_RUNNING,
};

const REPORTS = [
  {
    id: "5d1b3f80-6c22-4e91-a0b7-8f2d4c6e1a93",
    reason_code: "harassment",
    description: "They keep messaging me after I asked them to stop.",
    good_faith: true,
    created_at: "2026-08-20T09:12:00Z",
    reporter_id: "0f8e2d61-4b30-4a97-9c15-7e6d3b2a1c40",
  },
];

const VERDICTS = [
  {
    id: "8c62a1d4-0e37-4b58-92fa-1d5c7e930b26",
    decision: "needs_review" as const,
    source: "llm" as const,
    reason_code: "low_confidence",
    note: "",
    confidence: 0.42,
    model: "small",
    evidence: { matched_rules: ["contact_pattern"] },
    created_at: "2026-08-20T09:12:30Z",
    actor_id: null,
  },
];

/** The card a moderator opens: content read live, one complaint, one machine
 * verdict that punted to a person. */
export const CASE_DETAIL: CaseDetail = {
  ...CASE_QUEUED,
  reports: REPORTS,
  verdicts: VERDICTS,
  sanctions: [],
  appeals: [],
  content: {
    available: true,
    title: "Vintage road bike, 56 cm",
    text: "Message me on the other app and I will knock 200 off, cash only.",
    language: "en",
    media: ["cdn://photos/8842/1.jpg", "cdn://photos/8842/2.jpg"],
    author_id: AUTHOR,
    url: "https://example.test/listings/8842",
  },
};

/** The card for a target type whose host serves no content function: the
 * moderator is told so, rather than shown an empty box. */
export const CASE_DETAIL_NO_CONTENT: CaseDetail = {
  ...CASE_DETAIL,
  id: "c3f7b201-58ad-4e62-8b13-2a9f6c0d4e71",
  content: { available: false, error: "no_content_function" },
};

/** The same card while a colleague holds the lease — every write is shut, with
 * the reason beside it. */
export const CASE_DETAIL_CLAIMED: CaseDetail = {
  ...CASE_DETAIL,
  ...CASE_CLAIMED,
  reports: REPORTS,
  verdicts: VERDICTS,
  sanctions: [
    {
      id: "e5a91c37-4d68-4b02-9f7a-3c1e8d20b654",
      kind: "posting_restricted",
      scope: "*",
      reason_code: "harassment",
      note: "",
      state: "active",
      case_id: CASE_CLAIMED.id,
      subject_user_id: AUTHOR,
      starts_at: "2026-08-21T07:40:00Z",
      expires_at: "2026-08-28T07:40:00Z",
      issued_by: MODERATOR,
      lifted_by: null,
      lifted_at: null,
    },
  ],
  appeals: [],
};

/**
 * The two seams broken at once, as the client stand had them on 2026-09-06:
 * a content function asked for a key that names nothing, and an LLM proxy
 * nobody could reach. Two classes, deliberately, because one counter could not
 * tell them apart and that is the whole reason the DLQ tab groups.
 */
const DLQ_AT_OLD = "2026-09-01T04:12:00Z";
const DLQ_AT_NEW = "2026-09-05T22:41:00Z";

/** Parked by a content function that could not resolve the target key. */
export const CASE_DLQ_CONTENT: Case = {
  ...CASE_QUEUED,
  id: "6f2c9b41-73ae-4d05-8c19-4b7e5a0d3f62",
  target_type: "listing",
  target_key: "draft:71bde8564c",
  origin: "submission",
  state: "dlq",
  report_count: 0,
  dlq_at: DLQ_AT_OLD,
  last_error_class: "ContentUnavailable",
  last_error:
    "ContentUnavailable(\"function 'listings.moderation_content' failed remotely: LookupError('listing draft:71bde8564c not found')\")",
};

/** The same fault, a second case — so the group carries a count. */
export const CASE_DLQ_CONTENT_2: Case = {
  ...CASE_DLQ_CONTENT,
  id: "0d51a7e3-9c26-4f8b-a410-63d2e8f1b905",
  target_key: "draft:9a0c1de772",
  dlq_at: DLQ_AT_NEW,
};

/** Parked by an unreachable screener — an unrelated fault, running at once. */
export const CASE_DLQ_SCREENER: Case = {
  ...CASE_QUEUED,
  id: "3e8b6d02-1f47-45a9-9d63-8c07f2a1e4b8",
  target_type: "review",
  target_key: "3391",
  state: "dlq",
  report_count: 1,
  dlq_at: DLQ_AT_NEW,
  last_error_class: "ScreeningUnavailable",
  last_error:
    'ScreeningUnavailable("llm.complete failed remotely: ConnectionError(\'proxy: connection refused\')")',
};

/**
 * The card of a dead-lettered case: state `dlq`, and NO verdict — the whole
 * point of the state is that nothing looked.
 *
 * It carries NONE of the dlq stamps on purpose. `CaseDetailPresenter` does not
 * present them (backend 0.7.0), and a fixture that added them would document a
 * card the backend cannot send and let the console pass a test for a field it
 * will never receive.
 */
export const CASE_DETAIL_DLQ: CaseDetail = {
  ...CASE_DETAIL,
  id: CASE_DLQ_CONTENT.id,
  target_type: CASE_DLQ_CONTENT.target_type,
  target_key: CASE_DLQ_CONTENT.target_key,
  origin: CASE_DLQ_CONTENT.origin,
  state: "dlq",
  report_count: 0,
  reports: [],
  verdicts: [],
  sanctions: [],
  appeals: [],
  content: { available: false, error: "target_not_found" },
};

/** The audit trail the card reads the failure off — `CaseDetailPresenterDTO`
 * does not carry the dlq stamps, the `dead_lettered` row's payload does. */
export const CASE_EVENTS_DLQ: readonly CaseEvent[] = [
  {
    id: "aa1f6c78-2b90-4e35-83d1-7c0a4e6b2915",
    kind: "screen_failed",
    from_state: "screening",
    to_state: "screening",
    payload: { error_class: "ContentUnavailable" },
    created_at: "2026-09-01T04:11:00Z",
    actor_id: null,
  },
  {
    id: "b72e0d19-5a34-4c86-91f0-2d5c8b7e0463",
    kind: "dead_lettered",
    from_state: "screening",
    to_state: "dlq",
    payload: {
      error_class: CASE_DLQ_CONTENT.last_error_class,
      error: CASE_DLQ_CONTENT.last_error,
      reason_code: "screening_failed",
    },
    created_at: DLQ_AT_OLD,
    actor_id: null,
  },
];

/**
 * The console header's counters.
 *
 * `queue_total` and `dlq_total` are separate on the wire and stay separate on
 * the glass; `open_total` is their sum plus the transient states, and this
 * fixture keeps it only because the backend sends it — nothing in the console
 * draws it any more.
 */
export const STATS: Stats = {
  by_state: { queued: 12, claimed: 3, dlq: 3, resolved: 154 },
  by_target_type: { listing: 9, review: 6 },
  by_severity: { "70": 4 },
  open_total: 18,
  resolved_total: 154,
  queue_total: 15,
  dlq_total: 3,
  dlq_by_error_class: { ContentUnavailable: 2, ScreeningUnavailable: 1 },
};

/** Nothing broken: the good empty of the DLQ tab. */
export const STATS_CLEAR_DLQ: Stats = {
  ...STATS,
  by_state: { queued: 12, claimed: 3, resolved: 154 },
  open_total: 15,
  dlq_total: 0,
  dlq_by_error_class: {},
};

/** An appeal waiting for a moderator who did not decide the case. */
export const APPEAL_OPEN: Appeal = {
  id: "b81d0a95-6e34-4f27-9c05-7a2b3d1e8f60",
  body: "The listing said nothing about payment outside the platform — that line was quoted from the buyer, not from me.",
  state: "open",
  resolution_note: "",
  case_id: CASE_QUEUED.id,
  appellant_id: AUTHOR,
  created_at: "2026-08-22T11:03:00Z",
};

/** One already decided: nothing left to resolve, and the row says so. */
export const APPEAL_UPHELD: Appeal = {
  ...APPEAL_OPEN,
  id: "d40c7b16-9f52-4a83-b6e1-05c8d3a7291f",
  state: "upheld",
  resolution_note: "The quoted line is still in the description.",
  resolved_by: MODERATOR,
  resolved_at: "2026-08-23T08:20:00Z",
};
