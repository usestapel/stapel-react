---
"@stapel/core": minor
"@stapel/eslint-plugin": minor
---

The absence of a result is no longer spelled the same way as a result.

`LoadState<T>` puts the data BEHIND a discriminant (`loading` | `ready` with
`data` | `failed` with `error`), `loadStateFromQuery(query)` adapts a TanStack
result into it, and `matchList` renders one with FOUR required arms — loading,
failed, empty, ready — so "there is nothing here" cannot share a branch with
"we could not find out". `matchLoad`, `mapLoad`, `bothLoaded`, the three
guards and the deliberately-unpleasant `loadedRowsOrEmpty` escape hatch ship
alongside.

`loadStateFromQuery` reads `query.status` and not `query.isLoading`, which is
its own bug fix: `isLoading` is `isPending && isFetching`, so it is FALSE for
a query that has not been enabled yet, and every session-ready-gated list hook
in this fleet therefore reported "not loading, no error, zero rows" for the
whole session bootstrap.

`ActionAvailability` closes the other half: a control that is switched off
states its reason. `actionBlocked(code)`, `actionBlockedByFailure(error)`,
`requireLoaded(state, …)`, `firstBlock(…)` and the `useActionGate` hook, which
returns `{disabled, reason, detail}` — flat strings a skin renders as TEXT
beside the control, because a disabled button receives no pointer events and a
tooltip on one is a reason nobody can read. There is no way to spell "blocked,
reason unknown": the union has no such member. Core's i18n floor gains
`stapel.action.blocked.loading` and `stapel.action.blocked.load_failed` in en
and ru, worded to say that WE failed to load something — never that the thing
is absent, and never blaming the person.

`@stapel/eslint-plugin` gains `stapel/no-flattened-load-state`, on at `error`
in the recommended preset: `query.data ?? []`, `x.data?.y ?? []`, `data || {}`
and friends are the line that manufactures the lie, and it is now a lint error
everywhere outside the api/transport layer.

Why: on 2026-08-09 a backend route was mounted one path segment too deep, the
workspace-list endpoint answered 404 to every request, and the frontend
rendered "you have no workspaces" and greyed out the upload button with no
explanation — for hours, with the failure visible in the network tab the whole
time. The distinction was available (the bag carried `isError` beside the
array) and every skin flattened it anyway, because the array was reachable
without mentioning the error. So this ships as a type and a lint rule rather
than a convention.
