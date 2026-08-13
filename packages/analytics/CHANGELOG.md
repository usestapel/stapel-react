# @stapel/analytics

## 0.1.1

### Patch Changes

- a8bd3f4: Raise the `@stapel/core` peer floor to the version that actually exports what each package imports.

  `@stapel/workspaces-react` 0.15.0 shipped declaring `>=0.12.0` while importing
  `LoadState`, which core did not export until 0.13.0. npm installed it happily;
  the host's typecheck then failed on a type the package's own `.d.ts` referenced
  and the host could not resolve. Nine packages were wrong the same way — most by
  a wider margin (`recordings-react` allowed 0.3.0).

  Nothing here could have caught it by building: in this monorepo every package
  compiles against the workspace core, always the newest one, so a declared floor
  is never the version anything is compiled against. `pnpm check:peer-floors` now
  reads each package's imports from `@stapel/core`, asks core's own tagged history
  which release first exported each name, and fails when the floor is older —
  wired into CI **and** the publishing path, since a gate only on the merge path
  does not stop a release.

  Also invalidates the workspace audit query after an invite, a role change and a
  removal: the history sits beside the roster and an admin who acts on one expects
  to see it in the other. Its key is its own root, so the members invalidation did
  not reach it.

## 0.1.0

### Minor Changes

- e4a29b7: New package: **`@stapel/analytics`** — the Stapel analytics facade
  implementation, restratified out of `@stapel/core` (slim wave §21/S1). Initial
  release 0.1.0; frontend-infra versioning (independent of the pair⇄backend
  minor-tracking scheme).

  - `createAnalytics` — consent gate, PII guard, offline queue on the shared
    persist storage, batched provider fan-out with exponential-backoff retries.
  - Provider adapters: `consoleProvider`, `stapelCollectorProvider` (sendBeacon
    final batch).
  - Typed events: `defineEvent` + `prop` builders, `createTracked`,
    `useTracked` (the types they implement stay in `@stapel/core`).
  - Re-exports the core type seam (`Analytics`, `AnalyticsProvider`,
    `EventDef`, …) so the package is self-sufficient for consumers.

  Dependency direction: `@stapel/analytics` → `@stapel/core` (peer). Mandatory
  analytics is a stapel-studio policy — scaffolded apps always wire this
  package; OSS consumers may bring their own provider behind the core seam.
