---
"@stapel/eslint-plugin": minor
---

Two server-state guardrails (frontend-guardrails §2.2 / §2.6 — the last two
written rules of the declared set), both data-driven and both with a one-legal-
home carve-out in the recommended preset:

- **`stapel/no-string-paths`** — API URLs are reached through NAMED operations
  of the codegen client, never a hand-written path string. Fires on two shapes:
  a `client.<verb>("/…")` call on an http verb (syntactic, holds without a
  catalog), and a bare literal/template that IS a catalogued operation path
  (data-driven — read from each package `manifest.json §operations` via the new
  `loadOperationCatalog`, degrading to a no-op when absent). A client-relative
  literal (`/me/`) resolves to its operation by trailing-segment suffix, so the
  message can name the op to call. Path strings in object-KEY position (route /
  mock-handler tables) are skipped — the bypass is argument position. The preset
  turns it OFF in the api layer (`api/`, `*client.ts`, `generated/`), mirroring
  the `no-raw-fetch` carve-out. Vendor list of verbs / operation paths overridable
  via `options` / `settings.stapel`.
- **`stapel/query-keys-from-factory`** (core gap #8) — TanStack Query keys come
  only from the module key factory (`<module>QueryKeys`, e.g.
  `authQueryKeys.sessions()`). An inline `queryKey`/`mutationKey` array literal
  inside `useQuery`/`useMutation`/`queryClient.*` (options object or a
  positional `setQueryData` key) is an error: a hand-rolled array drifts from the
  invalidations that target the factory — the write lands, the cache goes stale.
  The preset turns it OFF in the factory file itself (`**/queryKeys.*`).

RuleTester valid/invalid coverage for both; the monorepo run is clean.
