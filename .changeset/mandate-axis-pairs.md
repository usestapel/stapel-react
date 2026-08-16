---
"@stapel/workspaces-react": minor
"@stapel/shell-react": minor
---

`useMandateState()`, and a `resolveNav` that consumes the surface axis.

`is_guest` has ridden the workspace-list response since stapel-workspaces
0.19 and had **zero readers**. `useMandateState()` is the first one: the
single point of truth for "does this person hold a mandate anywhere",
computed from two answers that already existed — the active session's status
(which settles anonymous and no-session without asking anyone) and the
server's own `is_guest` predicate. No new endpoint, and no extra request:
it reads the same `useWorkspaces()` a screen is already running.

The server evaluates the predicate; the hook does not re-derive it. A caller
can hold membership rows that grant no mandate, so `workspaces.length` is not
the question — it is consulted only against a backend too old to answer.

The unresolved case is the reason the hook is shaped the way it is. A list in
flight and a list that 502'd both resolve to `unresolved` with a reason, and
neither ever resolves to `guest`. The one-liner this forecloses —
`data?.is_guest ?? true` — turns every backend hiccup into "you are a guest",
locks members out of their own product, and explains nothing; there is no
expression of that shape available, because the pending and failed states
carry no principal to read. Render it with `matchMandate`: a wait, or the
outage stated out loud.

`resolveNav` now takes an optional `{ audience }` and every `ResolvedNavEntry`
carries its resolved `surface`. Omit the audience and nothing changes — the
scaffold-codegen call site keeps baking every route, and so does every
existing runtime caller. Pass one and a screen closed to that principal is
dropped, menu entry and route together, which is the fix: the tree a host
mounts from is the tree the axis filtered. A project's override file can flip
`menuVisible` and `order`; it deliberately cannot flip this, because a
per-project preference must not put a screen that will refuse the caller back
in front of them.

`audience` is a `MandatePrincipal`, so `"unresolved"` cannot be passed. A host
whose mandate has not settled has to render the wait or the error rather than
resolve a nav for it — the alternative is a menu that quietly empties itself
whenever the backend hiccups, which is "we could not ask" rendered as "you
may not".
