/**
 * Wire fixtures — full `Issue` / `ErrorEvent` / page bodies, exactly as
 * stapel-alerts serializes them. Every field the serializer lists is present:
 * a trimmed fixture would let a screen read a field the server always sends
 * and a test never would.
 */
import type { ErrorEvent, Issue, IssueDetail, IssuePage } from "../src/index.js";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-09-14T09:00:00Z");
const ago = (hours: number): string => new Date(NOW - hours * HOUR).toISOString();

export function makeIssue(
  over: Partial<Issue> & Pick<Issue, "id" | "service" | "title">
): Issue {
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

export const FATAL: Issue = makeIssue({
  id: "11111111-1111-4111-8111-111111111111",
  service: "svc-billing",
  title: "IntegrityError: duplicate key",
  level: "fatal",
  count: 412,
});

export const WARNING: Issue = makeIssue({
  id: "22222222-2222-4222-8222-222222222222",
  service: "svc-billing",
  title: "Provider timed out",
  level: "warning",
  kind: "log",
  count: 1804,
});

export const FIXED: Issue = makeIssue({
  id: "33333333-3333-4333-8333-333333333333",
  service: "svc-api",
  title: "KeyError: workspace_id",
  status: "fixed",
  fixed_in_version: "0.42.1",
  fixed_in_sha: "9c1d0ab3f4e5c6d7a8b9c0d1e2f3a4b5c6d7e8f9",
  fixed_at: ago(20),
});

export const REGRESSED: Issue = makeIssue({
  id: "44444444-4444-4444-8444-444444444444",
  service: "svc-api",
  title: "OperationalError: could not connect",
  status: "regressed",
  count: 96,
  count_since_fix: 14,
  fixed_in_version: "0.41.0",
  fixed_at: ago(48),
  regressed_at: ago(3),
});

export const MUTED: Issue = makeIssue({
  id: "55555555-5555-4555-8555-555555555555",
  service: "svc-worker",
  title: "prometheus has not scraped svc-worker for 15m",
  kind: "monitoring",
  level: "warning",
  status: "muted",
  note: "Known: the exporter restarts with the nightly deploy.",
  muted_until: new Date(NOW + 72 * HOUR).toISOString(),
  count: 9,
});

export const EVENT: ErrorEvent = {
  id: "aaaaaaa1-0000-4000-8000-000000000001",
  issue: FATAL.id,
  received_at: ago(1),
  occurred_at: ago(1),
  service: "svc-billing",
  environment: "production",
  release: "0.42.0",
  level: "error",
  kind: "exception",
  message: "duplicate key value violates unique constraint",
  trace:
    'Traceback (most recent call last):\n  File "/app/svc/views.py", line 142, in post\n    order = Order.objects.create(**payload)\ndjango.db.utils.IntegrityError: duplicate key',
  context: { order_reference: "ORD-8821", card: "<redacted>" },
  request_path: "/billing/api/v1/orders",
  trace_id: "0af7651916cd43dd8448eb211c80319c",
  user_id: null,
  occurrences: 3,
  sentry_event_id: "",
};

/** An occurrence with neither a trace nor a context — a captured log record. */
export const BARE_EVENT: ErrorEvent = {
  ...EVENT,
  id: "aaaaaaa1-0000-4000-8000-000000000002",
  trace: "",
  context: null,
  received_at: ago(6),
};

export const FATAL_DETAIL: IssueDetail = {
  ...FATAL,
  events: [EVENT, BARE_EVENT],
};

export const REGRESSED_DETAIL: IssueDetail = { ...REGRESSED, events: [EVENT] };

export const SWEPT_DETAIL: IssueDetail = { ...FIXED, events: [] };

/** The PAGE the list view returns — never the bare array its schema declares. */
export function makePage(
  rows: readonly Issue[],
  over: Partial<Omit<IssuePage, "results">> = {}
): IssuePage {
  return { count: rows.length, offset: 0, limit: 50, results: rows, ...over };
}

export const BOARD: IssuePage = makePage([
  FATAL,
  WARNING,
  REGRESSED,
  FIXED,
  MUTED,
]);
