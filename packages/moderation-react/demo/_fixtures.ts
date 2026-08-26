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

export const STATS: Stats = {
  by_state: { queued: 12, claimed: 3, resolved: 154 },
  by_target_type: { listing: 9, review: 6 },
  by_severity: { "70": 4 },
  open_total: 15,
  resolved_total: 154,
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
