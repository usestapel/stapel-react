# @stapel/alerts-react

## 0.1.1

### Patch Changes

- 493df78: pin stapel-alerts 0.2.1: IssuePage from the schema, limit parameter

  The contract caught up with the wire, so the pair stops correcting it.

  **`IssuePage` is generated.** `docs/schema.json` now declares `GET /issues`
  as the `{count, offset, limit, results}` envelope the view always returned;
  the hand-declared type goes and `api/types.ts` re-exports the schema's.
  `test/pair.test.ts` still proves the envelope on the wire — a generated type
  is a statement about the contract, and the rows a screen draws come from the
  body.

  **`useIssues(filters)` takes `limit`.** `?limit=` is a parameter (1..200,
  server default 50 when omitted). The server clamps rather than refuses and
  echoes the size it applied, and the hook pages by that echo, never by the
  number it asked for — a request for 500 rows cut to 200 does not skip 300.
  `limit` rides in the filter key like the offset does, because a different
  page size is a different server answer. It is a view setting, not a filter:
  the feed's empty state does not count it, and "Clear" keeps it.

  **`mute` sends the deadline alone.** `muted_until` on its own is a mute —
  the store infers `status: "muted"` from it — so the patch no longer carries
  a status. The key itself is still always sent (`null` for "forever"): a patch
  without it is a note, not a mute.

  **A non-muted row never carries a deadline.** Every transition out of `muted`
  now clears `muted_until`, so the detail's "draw the deadline only while
  muted" is no longer a workaround for a stale field but the plain rule that a
  deadline belongs to the muted status. The test that fed a fixed row a stale
  deadline exercised a wire state the backend can no longer produce and is
  gone.

## 0.1.0

### Minor Changes

- f47c5bf: The React pair for stapel-alerts 0.1.0 — first release.

  An alert store answers "which bugs are open, which are fixed, and which came
  back". This package is the screen a person reconciles a fix wave against: the
  triage feed grouped by the service that reported, the issue with its last
  occurrences and their redacted context, and the three judgements an operator
  can record.

  **It reads and manages the tracker; it does not report to it.** `POST /report`
  is authenticated with a service key that lives in every container in the fleet,
  and the blast radius of one leaking must not include a browser. There is no
  code path here that can reach it, and `test/pair.test.ts` asserts that over the
  source rather than over an export list — an operation nobody exported today is
  one refactor away from being exported tomorrow.

  **The reads are conditional, and the validator lives in the cache entry.** Both
  `GET`s answer an `ETag` and honour `If-None-Match` with a 304 and no body — the
  module's own stated requirement, because a board open on a wall re-asks every
  minute. `@stapel/core`'s client can express neither side (it surfaces no
  response headers, and a 304 is not `response.ok`, so it would be thrown), so
  the two reads speak `fetch` directly with every non-2xx folded through core's
  `parseErrorEnvelope` — one error dialect out of both transports. The cached
  value is `{etag, page}`, and on a 304 the query function returns THE PREVIOUS
  OBJECT: TanStack compares by reference, so a poll through a quiet night
  notifies nobody and repaints nothing. The test asserts `toBe`, not `toEqual` —
  a hook that rebuilt an equal object would pass the second and still repaint
  every minute.

  **Four gaps between the backend's schema and its views, worked around and
  named.** A-1: `docs/schema.json` declares `GET /issues` → `Issue[]` while the
  view returns `{count, offset, limit, results}` — a pair that trusted the schema
  would have rendered every row as `undefined`, so `IssuePage` is declared by
  hand and proved against the wire. A-2: the page size is a server constant and
  not a parameter, so it is read out of the answer. A-3: `PATCH` ignores
  `muted_until` unless the patch also carries `status`, which is answered 200 and
  changes nothing — so `mute` always sends both. A-4: `set_status` never clears
  `muted_until` when the status moves on, so the deadline is rendered only while
  the issue IS muted.

  **`regressed` is never offered.** The store asserts it from evidence — a fixed
  issue received a new event — and a caller able to set it would be a caller able
  to withhold it. Every status control is built from `SETTABLE_ISSUE_STATUSES`,
  which has three members, so the refusal cannot be provoked from this UI at all;
  `isStatusNotSettable` exists for the host that wires its own control.

  **Staff-only, said out loud.** Every route is `IsStaffUser`, and the nav axis
  (`public` | `member`) cannot say so. The door stays visible and the screen names
  the 403 — a hidden door teaches nobody anything, and an empty triage table
  teaches the wrong thing: "nothing is broken" is the one sentence an error
  tracker must never say by accident. A 401 is a separate arm with separate copy,
  because the raw conditional reads do not run core's bearer-refresh retry and an
  expired token arrives here as exactly that.

  **Pinned at stapel-alerts 0.2.0, for the locale catalogue alone.** The wire
  this pair consumes is byte-identical across 0.1.0..0.2.0 — `docs/schema.json`,
  `docs/errors.json` and `docs/flows.json` do not move — and 0.2.0 adds
  `translations/errors.{ru,es}.json` for the six codes the module owns. Without
  the bump the pair would have had to hand-author those six strings and a Russian
  host would have read six English refusals on day one; with it, `gen:errors`
  reads the module's own catalogue merged over stapel-core's, and nothing in this
  package words a backend refusal.

  `/default` ships the antd skin — `IssuesFeed`, `IssueDetail`, `IssueFilterBar`,
  `FixIssueDialog`, `MuteIssueDialog` — on `@stapel/tokens-antd/skin`, tokens
  only, with ru and es beside en. Two nav entries under the container-owned
  `admin.root`; the detail is a route and not a menu item, because nobody
  navigates to one bug from a menu — they arrive from a row, or from an
  `alerts:<issue-id>` reference in a commit message.
