---
"@stapel/video-react": minor
---

New pair: `@stapel/video-react` — the workspace admin's "who talked how much",
built on the read stapel-video 0.7.0 added, with the two things that contract
makes easy to get wrong refused once, here, instead of being rediscovered per
host.

- **The 404 is not an empty table.** `error.404.video_scope_not_found` is
  returned for THREE different situations — the scope does not exist, it holds
  no calls, and the caller holds no `USAGE_MANDATE` in it — deliberately,
  because a 403 would confirm to someone guessing tenant ids that the one they
  guessed is real. A table that drew zero rows there would manufacture a claim
  about the workspace out of a refusal to answer. `isScopeUnavailable()` reads
  the CODE (never the status: the module has three other 404s), and
  `<ScopeUsageTable>` renders that arm as "call usage is not available for this
  workspace" — a separate arm from loading, from a genuine error, and from a
  month that succeeded and holds nobody. Same class as `data ?? []`, one status
  code further out.
- **`months` and `users` are optional on the wire.** Neither is in the schema's
  `required` list, so the generated types make them `?`. `normalizeScopeUsage`
  is the one place allowed to decide that absent means "no months" / "no rows";
  everywhere else both arrays are non-optional and a reader cannot reach for
  `?? []` at its own call site.

What ships:

- `useScopeUsage(scopeKey, { months, month, tz })` — TWO queries, on purpose.
  The window read (`?months=N`) feeds the month selector and stays cached while
  a person clicks through months; the month read (`?month=YYYY-MM`) feeds the
  rows. One query could not do both: `?month=` answers a one-element `months`
  list, so a selector fed from it collapses to the month already chosen. Gated
  on `useActiveSessionReady()`, because a read racing a bootstrapping session
  answers the SAME 404 that means "not available", and the screen would blame
  the workspace for a race.
- `usageQueryKeys` — `window`/`month` under `["video","usage",scope,tz,…]`. The
  zone is in the key because `?tz=` decides where the buckets are CUT: the same
  `2026-08` is genuinely different numbers in `UTC` and `Europe/Berlin`, and a
  DST month is 743 or 745 hours. Nothing here re-derives a boundary —
  `period_start`/`period_end` come off the wire.
- `/default`: `<ScopeUsageTable rows nameFor month months onMonthChange
  onRefresh/>` and `<ScopeUsagePane>`, the prop-free screen the nav manifest's
  `admin.usage` entry mounts (scope from the prop, else from
  `createVideoRuntime({ scopeKey })`; with neither it NAMES the wiring gap
  rather than drawing an empty workspace). The person column is a slot: the
  wire carries `user_id` and never a name — stapel-video keeps no FK to a user
  so erasure can pseudonymize it — so the host passes `nameFor`, and a person
  the roster does not know still appears, by id, rather than being dropped from
  a report about individuals. The footer calls the room sum **attendances**,
  because three people in one meeting make three and no scope-wide distinct-call
  number exists on the wire.
- en + ru. The 9 error keys stapel-video owns are authored in `./i18n/ru`
  because the module ships no `translations/` directory at all — the generated
  ru bundle is a `Partial` covering only the 42 cross-cutting keys core owns
  (`ERRORS_LOCALE_EXEMPT_OWNERS`, the forms/reviews precedent). A test asserts
  the split in both directions, and that the 404's copy is the SAME string in
  the error bundle and on the screen so the two arms cannot drift.

Out of scope, and not by omission: the other seven paths in stapel-video's
contract (rooms, the lobby verdicts, the join grant, the participant list, the
provider webhook) belong to a media-server client, not a React data pair —
`manifest.json` still lists the whole contract. The nav entry is
`admin.usage`, not `video.usage`: nobody looks for their team's call time under
"Video", and `admin.root` is a container-owned parent this pair does not
declare (`resolveNav` drops an orphaned submenu entry rather than throwing).

84 tests in 8 files (+4 in `test:pack`). Sizes: index 3.29 KB, default 3.71 KB,
i18n/ru 1.99 KB — all under their limits. Contract pinned at stapel-video
v0.7.0 (9441461). Not published: the first publish of a new pair is a one-time
manual bootstrap by the owner.
