---
"@stapel/workspaces-react": patch
---

`useWorkspaceSelection` now really does return a stable bag.

The memoisation was there but two of its dependencies were TanStack result
objects — `useWorkspaces()`'s query and `useSetPreferredWorkspace()`'s
mutation — and TanStack returns a NEW object on every render. So `refetch`
and `switchTo` changed identity every render, and the bag with them.

That is exactly the #251 failure the memoisation exists to prevent:
consumers put `current` straight into `useEffect` dependency arrays, so an
unstable bag re-runs those effects every render, and where the effect also
sets state it is an unbounded render loop whose only symptom is a spinner
that never resolves, with nothing in the console. The hooks now close over
the stable `refetch` / `mutate` handles, and a regression test pins value
identity across renders (and pins that it still CHANGES on a real switch).

Found by adopting 0.11.0 in a product — the library's own tests asserted the
resolution, not the identity.
