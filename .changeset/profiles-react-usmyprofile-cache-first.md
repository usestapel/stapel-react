---
"@stapel/profiles-react": minor
---

`useMyProfile` is now cache-first / stale-while-revalidate: `staleTime: 0` makes it unconditionally revalidate on every mount via TanStack Query's default `refetchOnMount`, regardless of how fresh a hydrated snapshot looks. Pair it with `@stapel/core`'s new `createMeCachePersister` — wire `<StapelProvider meCacheQueryKeys={[profilesQueryKeys.me()]}>` — and a cold load paints the last-known profile instantly from `localStorage`, then updates once the network responds. No wiring, no persister: behavior is unchanged (a normal fetch-on-mount query).
