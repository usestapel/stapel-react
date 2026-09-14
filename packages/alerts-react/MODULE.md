# @stapel/alerts-react — module guide

The React pair for **stapel-alerts**. Human companion to the generated
`llms.txt` (agent context) and `manifest.json` (machine catalog); `README.md`
is the usage entry point.

## What this pair is for

One sentence: **an alert store answers "which bugs are open, which are fixed,
and which came back", and this is the screen a person reconciles a fix wave
against.**

Everything below follows from two facts about the backend. First, the module
is machine-facing on purpose — stable uuid ids, ETags, JSON only — because the
caller it was designed for is an agent closing issues after a fix wave; a
browser is the second caller and gets the same contract. Second, the tracker
and the REPORTING path are authenticated differently on purpose, and this pair
lives entirely on the tracker side.

## Layers

- **api/** — `createAlertsApi(client, raw?)`, plus type aliases over the
  package-LOCAL generated `components["schemas"]` (`Issue`, `IssueDetail`,
  `ErrorEvent`, the three enums), produced by `pnpm gen:api` from
  stapel-alerts's own `docs/schema.json`. Four operations; the fifth
  (`POST /report`) is deliberately absent. The two READS do not ride
  `StapelClient` — see "The two transports" below.
- **model/** — `useIssues` / `useIssue` (the conditional reads and the ETag
  machinery), `useIssueStatus` (the three writes plus a note), the query-key
  factory, `groupIssuesByService`, and the named refusals.
- **flows/** — `toFlowError` + the zero-flow `ALERTS_FLOWS` shim. The module
  annotates no `@flow_step` and its `docs/flows.json` is literally `[]`, so
  `gen:flows` emits nothing and the shim keeps the pair's public surface at its
  zero-flow shape.
- **headless/** — `<AlertsProvider>`, core's `createModuleContext` provider
  bound to this pair's names. Renders nothing.
- **default/** — the antd skin behind the `./default` subpath: two screens
  (`IssuesFeed`, `IssueDetail`), the filter bar and the two dialogs.
- **i18n/** — `keys.ts` (en, backend codes spread in first), `ru.ts`, `es.ts`.
- **nav/** — two `NavEntry` values under the container-owned `admin.root`.

## The two transports, and the one dialect

`views._conditional` answers an `ETag` on both `GET`s and honours
`If-None-Match` with a **304 and no body**. `@stapel/core`'s `StapelClient`
cannot express either side: it parses a JSON body and surfaces no response
headers (so the validator is unreadable), and a 304 is not `response.ok` (so it
would be THROWN). The two reads therefore speak `fetch` directly — the
`@stapel/docs-react` precedent for the same class of problem — bound to the
runtime's base URL, credentials and default headers.

The rule that keeps this from becoming the two-dialect defect CONTRIBUTING.md
warns about: **the raw reader folds every non-2xx through core's own
`parseErrorEnvelope` at its single rethrow point**, so a caller catches a
`StapelApiError` with a `.code` and a `.status` no matter which transport
produced it. `test/pair.test.ts` proves it by driving a real 403 envelope
through the real raw reader and reading `.code` off what was caught.

What the raw path does NOT carry is core's bearer-refresh retry. A 401 on a
read is therefore also the shape an expired token takes here, which is exactly
the case where "sign in again" is the right copy — and why `isAlertsUnauthorized`
is a different arm from `isAlertsStaffOnly`.

## Where the validator lives — and why not in a ref

The cached VALUE is `{etag, page}`. The obvious alternative, a `useRef` beside
the query, is wrong three ways: two panes on the same filters are two refs over
one cache entry; an unmount throws the validator away while the rows survive;
and a re-mount then asks unconditionally for a page it already has.

On a 304 the query function returns **the previous object itself**. The
identity is the message: TanStack compares by reference, so a poll through a
quiet night notifies nobody and repaints nothing. A hook that rebuilt an equal
object would pass a `toEqual` assertion and still repaint every minute, which
is why `test/issuesHook.test.tsx` asserts `toBe`.

## Mechanisms that exist — do not rebuild them

- **`SETTABLE_ISSUE_STATUSES`.** Every status control is built from it, so
  `regressed` cannot be offered by construction. It is the store's verdict on
  evidence; a caller able to assert it could also decline to.
- **`POST /fix` is the close.** A `PATCH {status: "fixed"}` leaves the same
  status and records no release and no zeroed `count_since_fix` — the counter
  that answers "did it come back?".
- **`mute` always sends the status.** BACKEND-GAP A-3: the deadline is only
  written when the patch carries a status. A deadline-only patch is answered
  200 and changes nothing.
- **One invalidation.** `alertsQueryKeys.issues` is a prefix of both the list
  keys and the detail key, so a write invalidates everything this module caches
  in one call, and each re-ask is conditional.
- **`groupIssuesByService` is pure and exported.** The feed's ordering rule
  (worst level, then loudest, never alphabetical) is a product decision that
  must be testable without a render.

## What this pair deliberately does NOT do

- **It does not report.** No `POST /report`, no `X-Service-Key`, no way to
  reach either. A reporter's key lives in every container in the fleet.
- **It does not invent a service directory.** The filter bar offers the
  services present in the page it has. `Service` upstream is the reporters' key
  store, not a directory an operator may filter by.
- **It does not hide the staff wall.** The nav entry stays visible and the
  screen names the 403 — an empty board would say "nothing is broken".
- **It does not draw a stale `muted_until`.** BACKEND-GAP A-4: the store never
  clears the field, so it is read only while the status IS `muted`.
- **It does not stream.** The module pushes nothing; the pair polls
  conditionally on `runtime.pollIntervalMs` (60 s by default, the interval the
  module's own API doc names), and `0` switches it off.

## Backend gaps

| id | what | where the workaround lives |
|---|---|---|
| A-1 | the list answers a PAGE; `docs/schema.json` declares a bare `Issue[]` | `api/types.ts` (`IssuePage`), proved in `test/pair.test.ts` |
| A-2 | the page size is a server constant and is not a parameter | `useIssues` reads `limit` out of the answer |
| A-3 | `PATCH` ignores `muted_until` without a `status` | `model/status.ts` `mute` |
| A-4 | `set_status` never clears `muted_until` | `default/IssueDetail.tsx` |

## Core seams used

| seam | why |
|---|---|
| `createModuleRuntime` / `createModuleContext` | the pair plumbing, one reviewed copy |
| `parseErrorEnvelope` | the raw reads' single rethrow point — one dialect |
| `loadStateFromQuery` / `mapLoad` / `matchList` / `LoadBoundary` | the four arms, so "empty" and "failed" cannot share a branch |
| `useActiveSessionReady` | no read fires before the session has an answer |
| `useFormat` | relative times and timestamps at the APP's locale |
| `toFlowError` / `isErrorCode` | the refusal helpers |
| `NavEntry` | the two admin entries |
| `@stapel/tokens-antd/skin` | `Page`, `DataTable`, `StatusTag`, `SkinDialog`, `SkinConfirm`, `ErrorAlert`, `EmptyState` |

## Not yet here

- A note editor on the issue screen. `useIssueStatus().annotate` exists and no
  skin draws it: an operator writing a sentence about a bug wants somewhere to
  put it, and the right shape for that is a decision the first host to ask can
  make.
- A "mine"/assignment axis. The backend has no field for it
  (stapel-alerts MODULE.md lists per-issue assignment as a 0.2 candidate).
- A live channel. There is none upstream, and a socket for a tracker whose
  events arrive when the system is already failing is a smoke detector wired to
  the burning fuse box.
