# @stapel/alerts-react

**The fleet's error tracker, read and reconciled from a browser.**

[`stapel-alerts`](https://github.com/usestapel/stapel-alerts) collects what a
fleet without Sentry would otherwise leave in `docker logs`: one `Issue` per
bug, with a status a fix wave is reconciled against, and one `ErrorEvent` per
occurrence with the trace and the redacted context. This package is the pair
that reads it — the triage feed, the issue, and the three judgements an
operator can record.

**It does not report.** `POST /report` is authenticated with a service key that
lives in every container in the fleet, and the blast radius of one leaking must
not include a browser. There is no code path here that can reach it, and
`test/pair.test.ts` asserts as much over the source.

## Install

```bash
pnpm add @stapel/alerts-react @stapel/core @tanstack/react-query
# the default skin (opt-in):
pnpm add antd @stapel/tokens-antd
```

## Mount

```tsx
import { createAlertsRuntime, AlertsProvider } from "@stapel/alerts-react";
import { IssuesFeed, IssueDetail } from "@stapel/alerts-react/default";

const runtime = createAlertsRuntime({
  baseUrl: "/alerts/api/v1/",
  credentials: "include",          // the staff session the tracker requires
  commitRefUrl: (sha) => `https://github.com/acme/api/commit/${sha}`,
});

// runtime.client goes into core's <StapelConfigProvider config={{ client }}>
<AlertsProvider runtime={runtime}>
  <IssuesFeed issueHref={(id) => `/admin/alerts/${id}`} />
</AlertsProvider>
```

## The reads are conditional, and that is the point

Both `GET`s answer an `ETag` and honour `If-None-Match` with a **304 and no
body** — the module's own stated requirement, because a triage board open on a
wall re-asks every minute and should not be handed a page of JSON it already
has.

`useIssues` and `useIssue` implement the other half:

- the cached value is `{etag, page}` — the rows and the validator the server
  issued *for those rows*, stored together because that is what they are;
- a 304 returns **the previous object itself**, so TanStack sees the same
  reference, notifies nobody, and a board polling through a quiet night
  repaints exactly zero times;
- the validator is offered only when there are rows it belongs to.

`@stapel/core`'s `StapelClient` cannot express either side of this — it parses a
JSON body and surfaces no headers, and a 304 is not `response.ok`, so it would
be thrown as an error. So the two reads speak `fetch` directly (the
`@stapel/docs-react` precedent), with every non-2xx folded through core's own
`parseErrorEnvelope`: **one error dialect out of both transports**, so a caller
always catches a `StapelApiError` with a `.code`.

## Hooks

| hook | what it answers |
|---|---|
| `useIssues(filters)` | the triage page: rows, the same rows grouped by service worst-first, the total apart from the page, the cursor, and the validator; `filters.limit` is the page size (1..200, server default 50) |
| `useIssue(id)` | one issue with its last 20 occurrences, their traces and their context |
| `useIssueStatus()` | `fix` (POST `/fix` with the release), `mute`, `reopen`, `annotate` |

`groupIssuesByService` is exported and pure: "which service is on fire" is the
first question the feed answers and it must be answerable without a render.

## What this pair will not let you do

- **Set `regressed`.** The store asserts it from evidence (a fixed issue
  received a new event), and a caller able to set it would be a caller able to
  withhold it. `SETTABLE_ISSUE_STATUSES` is the list every control is built
  from, and it has three members.
- **Close an issue with `PATCH {status: "fixed"}`.** Only `POST /fix` records
  the release AND zeroes `count_since_fix`, which is the entire answer to "did
  it come back?".
- **Mute by omitting the deadline.** `muted_until` on its own IS the mute (the
  store infers `status: "muted"` from it and clears it on the way out of a
  mute), so `mute` always sends the key — `null` for a mute with no deadline.
  A patch without it is a note.

## What the contract states, and the pair leans on

- `GET /issues` answers `IssuePage` — `{count, offset, limit, results}` — and
  the schema declares it, so the type is generated; `test/pair.test.ts` still
  proves the envelope on the wire.
- `?limit=` is a parameter (1..200, default 50). It is clamped, not refused,
  and the envelope echoes the size applied, so `useIssues` pages by the echo
  and never by the number it asked for.
- `muted_until` belongs to the muted status: a patch of the deadline alone
  mutes, and every transition out of `muted` clears it, so a non-muted row
  never carries a deadline and the detail draws one only while muted.

## Staff-only, and it says so

Every tracker route is `IsStaffUser`. The nav axis has two values
(`public` | `member`) and cannot say "staff", so the SCREEN says it: the door
stays visible and the pane names the refusal (`isAlertsStaffOnly`) instead of
drawing an empty triage table. A hidden door teaches nobody anything; an empty
board teaches the wrong thing — *nothing is broken* is the one sentence an
error tracker must never say by accident. A 401 is a different sentence again
("sign in"), because the raw conditional reads do not run core's bearer-refresh
retry.

## The default skin

`@stapel/alerts-react/default` ships `IssuesFeed`, `IssueDetail`,
`IssueFilterBar`, `FixIssueDialog` and `MuteIssueDialog` on antd through
`@stapel/tokens-antd/skin` — tokens only, no raw colours, every string an i18n
key. Import the subpath to opt in; the main entry pulls no antd at all.

## i18n

```tsx
import { registerAlertsI18n } from "@stapel/alerts-react";
import { registerAlertsI18nRu } from "@stapel/alerts-react/i18n/ru";
```

`en` ships in the main entry (backend error codes included); `ru` and `es` are
opt-in subpaths, and every backend code is covered in all three: stapel-alerts
0.2.0 ships `translations/errors.{ru,es}.json` for the six keys it owns, merged
over stapel-core's catalogue by `gen:errors` exactly as the backend loader
merges them at runtime. Nothing here hand-authors a backend refusal.

## Navigation

Two entries under the container-owned `admin.root`: `admin.alerts` (the board)
and `admin.alerts-issue` (`:issueId`, a route and not a menu item — nobody
navigates to one bug from a menu; they arrive from a row or from an
`alerts:<issue-id>` reference in a commit message, which is why the id is
stable).

---

- Module guide: [MODULE.md](./MODULE.md) · Agent context:
  [llms.txt](./llms.txt) · Machine catalog:
  [manifest.json](./manifest.json)
- [CHANGELOG.md](./CHANGELOG.md) · MIT
