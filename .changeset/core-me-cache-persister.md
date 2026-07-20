---
"@stapel/core": minor
---

New `createMeCachePersister` (`query.ts`) — a selective, localStorage-backed persister for "/me-class" queries only (current user, current profile, …), distinct from `createStapelQueryClient`'s existing per-user namespace persistence: on a cold load the user id isn't known yet, so per-user namespacing can't help render a last-known `/me` before the network responds.

- Persists ONLY the caller-named query keys (matched by prefix, e.g. `authQueryKeys.me()`, `profilesQueryKeys.me()`) to one fixed `localStorage` entry — `dehydrate`d selectively via `shouldDehydrateQuery`, not the whole query cache.
- Hydrates SYNCHRONOUSLY at construction time, before the caller's first render, so `useQuery` calls for those keys already see cached data on mount (true cache-first paint, not an async fill-in a tick later).
- Wiped on logout through the SAME registry `createRepository(namespace, { scope: "user" })` uses (`__registerWipeWhenActive`, `session.ts`) — no bespoke clear call, no separate contract to keep in sync. Fires on both explicit `logout()` and involuntary `sessionLost()`.
- SSR-safe: every `localStorage` touch is guarded, so this is a no-op on the server.
- Lives in `query.ts`, already the sanctioned `no-raw-storage` home alongside `storage.ts`/`repository.ts`.

`<StapelProvider>` gained an optional `meCacheQueryKeys` prop that wires this in for the host with one line — e.g. `<StapelProvider meCacheQueryKeys={[authQueryKeys.me(), profilesQueryKeys.me()]} .../>`. Hydration runs inside the same synchronous `useState` lazy initializer that builds the `QueryClient`, before the provider's children ever mount. Omitting the prop skips /me cache-first persistence entirely (default: off) — fully backward compatible.
