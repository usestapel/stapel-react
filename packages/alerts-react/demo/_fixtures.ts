/**
 * Demo fixtures — the wire shapes stapel-alerts actually sends.
 *
 * Every row here is a full `Issue`/`ErrorEvent` body: snake_case, every field
 * the serializer lists, `context` already redacted the way the store redacts
 * it. A trimmed fixture would document a screen nobody ships.
 */
import type { ErrorEvent, Issue, IssueDetail, IssuePage } from "../src/index.js";

const HOUR = 60 * 60 * 1000;

/** Fixed instants, so a demo screenshot is the same picture every run. */
const NOW = Date.parse("2026-09-14T09:00:00Z");
const ago = (hours: number): string => new Date(NOW - hours * HOUR).toISOString();

function issue(over: Partial<Issue> & Pick<Issue, "id" | "service" | "title">): Issue {
  return {
    fingerprint: "b4f1c0d2e3a4",
    environment: "production",
    level: "error",
    kind: "exception",
    culprit: "views.py:142 in post",
    exception_class: "IntegrityError",
    status: "new",
    note: "",
    count: 12,
    count_since_fix: 0,
    first_seen: ago(30),
    last_seen: ago(1),
    fixed_in_version: "",
    fixed_in_sha: "",
    fixed_at: null,
    regressed_at: null,
    muted_until: null,
    sentry_event_id: "",
    ...over,
  };
}

/** A fatal nobody has looked at — the row an outage looks like. */
export const FATAL: Issue = issue({
  id: "11111111-1111-4111-8111-111111111111",
  service: "svc-billing",
  title: "IntegrityError: duplicate key value violates unique constraint",
  level: "fatal",
  count: 412,
  last_seen: ago(0.2),
});

/** A warning from the same service — louder in count, weaker in level. */
export const WARNING: Issue = issue({
  id: "22222222-2222-4222-8222-222222222222",
  service: "svc-billing",
  title: "Provider timed out, retrying",
  level: "warning",
  kind: "log",
  culprit: "transport.py:88 in send",
  exception_class: "",
  count: 1804,
  last_seen: ago(0.5),
});

/** A closed issue, with the release that claims it. */
export const FIXED: Issue = issue({
  id: "33333333-3333-4333-8333-333333333333",
  service: "svc-api",
  title: "KeyError: 'workspace_id'",
  status: "fixed",
  count: 31,
  count_since_fix: 0,
  fixed_in_version: "0.42.1",
  fixed_in_sha: "9c1d0ab3f4e5c6d7a8b9c0d1e2f3a4b5c6d7e8f9",
  fixed_at: ago(20),
  last_seen: ago(21),
});

/** The one the store reopened itself — a fix that did not hold. */
export const REGRESSED: Issue = issue({
  id: "44444444-4444-4444-8444-444444444444",
  service: "svc-api",
  title: "OperationalError: could not connect to server",
  status: "regressed",
  level: "error",
  count: 96,
  count_since_fix: 14,
  fixed_in_version: "0.41.0",
  fixed_in_sha: "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d",
  fixed_at: ago(48),
  regressed_at: ago(3),
  last_seen: ago(0.1),
});

/** Known, accepted and quiet — with a deadline, which is the good kind. */
export const MUTED: Issue = issue({
  id: "55555555-5555-4555-8555-555555555555",
  service: "svc-worker",
  title: "prometheus has not scraped svc-worker for 15m",
  kind: "monitoring",
  level: "warning",
  status: "muted",
  note: "Known: the exporter restarts with the nightly deploy.",
  muted_until: new Date(NOW + 72 * HOUR).toISOString(),
  count: 9,
  last_seen: ago(6),
});

function event(
  over: Partial<ErrorEvent> & Pick<ErrorEvent, "id" | "issue" | "message">
): ErrorEvent {
  return {
    received_at: ago(1),
    occurred_at: ago(1),
    service: "svc-billing",
    environment: "production",
    release: "0.42.0",
    level: "error",
    kind: "exception",
    trace:
      'Traceback (most recent call last):\n' +
      '  File "/app/svc/views.py", line 142, in post\n' +
      "    order = Order.objects.create(**payload)\n" +
      '  File "/usr/lib/python3.12/site-packages/django/db/models/query.py", line 671, in create\n' +
      "    obj.save(force_insert=True, using=self.db)\n" +
      "django.db.utils.IntegrityError: duplicate key value violates unique constraint " +
      '"orders_order_reference_key"',
    context: { order_reference: "ORD-8821", attempt: 2, card: "<redacted>" },
    request_path: "/billing/api/v1/orders",
    trace_id: "0af7651916cd43dd8448eb211c80319c",
    user_id: null,
    occurrences: 3,
    sentry_event_id: "",
    ...over,
  };
}

/** Three occurrences of the fatal, newest first, as the detail serves them. */
export const FATAL_EVENTS: readonly ErrorEvent[] = [
  event({
    id: "aaaaaaa1-0000-4000-8000-000000000001",
    issue: FATAL.id,
    message: "duplicate key value violates unique constraint",
  }),
  event({
    id: "aaaaaaa1-0000-4000-8000-000000000002",
    issue: FATAL.id,
    message: "duplicate key value violates unique constraint",
    received_at: ago(4),
    occurrences: 11,
  }),
  event({
    id: "aaaaaaa1-0000-4000-8000-000000000003",
    issue: FATAL.id,
    message: "duplicate key value violates unique constraint",
    received_at: ago(9),
    context: null,
    trace: "",
  }),
];

/** The detail body: an issue plus its last events. */
export const FATAL_DETAIL: IssueDetail = { ...FATAL, events: [...FATAL_EVENTS] };

/** A regressed issue's detail — the notice arm. */
export const REGRESSED_DETAIL: IssueDetail = {
  ...REGRESSED,
  events: [
    event({
      id: "bbbbbbb1-0000-4000-8000-000000000001",
      issue: REGRESSED.id,
      service: "svc-api",
      message: "could not connect to server",
      release: "0.41.0",
    }),
  ],
};

/** A closed issue whose events retention already swept. */
export const FIXED_DETAIL: IssueDetail = { ...FIXED, events: [] };

/** The page body the list view returns (BACKEND-GAP A-1 — not a bare array). */
export function page(rows: readonly Issue[]): IssuePage {
  return { count: rows.length, offset: 0, limit: 50, results: rows };
}

/** A busy board: two services, five rows, every status represented. */
export const BUSY_PAGE: IssuePage = page([
  FATAL,
  WARNING,
  REGRESSED,
  FIXED,
  MUTED,
]);

/** Nothing has failed — the state a quiet fleet is in. */
export const EMPTY_PAGE: IssuePage = page([]);

/** The refusal most accounts get: signed in, not staff. */
export const STAFF_ONLY = [
  403,
  {
    localizable_error: "error.403.forbidden",
    error: "You do not have permission to perform this action",
    params: {},
  },
] as const;
