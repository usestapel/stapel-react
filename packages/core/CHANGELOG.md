# @stapel/core

## 0.8.0

### Minor Changes

- cff85d2: New `createMeCachePersister` (`query.ts`) — a selective, localStorage-backed persister for "/me-class" queries only (current user, current profile, …), distinct from `createStapelQueryClient`'s existing per-user namespace persistence: on a cold load the user id isn't known yet, so per-user namespacing can't help render a last-known `/me` before the network responds.

  - Persists ONLY the caller-named query keys (matched by prefix, e.g. `authQueryKeys.me()`, `profilesQueryKeys.me()`) to one fixed `localStorage` entry — `dehydrate`d selectively via `shouldDehydrateQuery`, not the whole query cache.
  - Hydrates SYNCHRONOUSLY at construction time, before the caller's first render, so `useQuery` calls for those keys already see cached data on mount (true cache-first paint, not an async fill-in a tick later).
  - Wiped on logout through the SAME registry `createRepository(namespace, { scope: "user" })` uses (`__registerWipeWhenActive`, `session.ts`) — no bespoke clear call, no separate contract to keep in sync. Fires on both explicit `logout()` and involuntary `sessionLost()`.
  - SSR-safe: every `localStorage` touch is guarded, so this is a no-op on the server.
  - Lives in `query.ts`, already the sanctioned `no-raw-storage` home alongside `storage.ts`/`repository.ts`.

  `<StapelProvider>` gained an optional `meCacheQueryKeys` prop that wires this in for the host with one line — e.g. `<StapelProvider meCacheQueryKeys={[authQueryKeys.me(), profilesQueryKeys.me()]} .../>`. Hydration runs inside the same synchronous `useState` lazy initializer that builds the `QueryClient`, before the provider's children ever mount. Omitting the prop skips /me cache-first persistence entirely (default: off) — fully backward compatible.

## 0.7.0

### Minor Changes

- fdaf339: Add the shared navigation-manifest contract types (`NavEntry`, `NavRoute`, `NavComponentRef`, `NavPlacement`, `NavPlacementLevel`, `PackageNavManifest`), exported from the package root. Ф1 lib-side foundation for the scripted-fullstack navigation contract (owner directive: one scripted command with no LLM produces a working navigated fullstack): a pair declares its screens' nav entries in `src/nav/manifest.ts` against these types, `scripts/gen-nav-manifest.mjs` validates and emits `nav-manifest.json`, and `@stapel/shell-react`'s `resolveNav` (new package, separate changeset) turns installed manifests + a project's overrides into the tree a shell renders. Pure data types — no React, no I/O — so the same contract works at scaffold codegen time and at runtime.

## 0.6.2

### Patch Changes

- Updated dependencies [a86ced9]
  - @stapel/tokens@0.5.0

## 0.6.1

### Patch Changes

- c20f56f: Fixes a live-incident race (owner-diagnosed finisher, миттудей): `AuthSession.logout()` used to await the server-side revoke call BEFORE any local teardown. In the window between the server honoring that revoke and this session getting back around to tearing itself down, a parallel authenticated request (e.g. a Navbar still holding a stale `useWorkspaces` query) would 401, retry its own refresh against the now-revoked token, fail, and race a `sessionLost('expired'/'revoked')` teardown in ahead of the explicit logout — rendering a "session expired" banner on a logout the user asked for themselves.

  Two changes, combined:

  - `@stapel/core`'s `SessionManager.logout()` now holds a `loggingOut` guard for its full duration (set synchronously before its first `await`). `sessionLost()` is a no-op while that guard is up — in addition to its existing idempotent no-op once already `"unauthenticated"` — and now reports which case applies via its return value (`Promise<boolean>`: `true` only if it actually performed a teardown).
  - `@stapel/auth-react`'s `AuthSession.logout()` now runs the local teardown (`sessionManager.logout()` + `onTeardown('logout')`) FIRST — instant, no network dependency — and treats the server revoke as best-effort afterward. `settleRefreshFailure` only calls `onTeardown(reason)` when `sessionLost()` reports it actually tore the session down, so a racing refresh failure during an in-flight logout never fires a contradictory `onTeardown('expired'|'revoked')`.

## 0.6.0

### Minor Changes

- 6ef6c44: Session-lifecycle fix for a live incident (2026-07-17): a query hook with no
  manual `enabled` gate could race a session still bootstrapping — right after
  an external event set fresh auth state this JS runtime hadn't caught up to
  yet (e.g. a QR `session_share` scan setting httponly cookies via a plain
  redirect) — and read a live session as "expired".

  - **`SessionStatus` gains `"initializing"`** — a 4th, DISTINCT state from
    `"unauthenticated"`. `"unauthenticated"` means "checked, no session";
    `"initializing"` means "haven't checked yet". `createSessionManager` is now
    born `"initializing"` by default (previously `"unauthenticated"`, which
    collapsed the two).
  - **`SessionManager.isReady()` / `.whenReady()`** — the framework-level
    ready-gate: `false`/pending while `"initializing"`, resolves the instant the
    session settles into any of the other three states.
  - **`SessionManager.markUnauthenticated()`** — settle `"initializing"` into a
    confirmed "never had a session" with NO teardown side effects (no logout
    hooks, no `onSessionLost`) — distinct from `sessionLost()`, which assumes an
    existing session is ending.
  - **`useSessionReady(manager)` / `useActiveSessionReady()`** (new hooks) — a
    pair's query hook gates on `useActiveSessionReady()` (reads
    `getActiveSessionManager()`, zero prop plumbing) instead of hand-rolling an
    `enabled` check; `true` (never blocks) when no module has created a session
    manager at all.
  - **`createStapelClient`'s `onAuthRefresh` retry fix**: resolving `""` (empty
    string — a successful refresh with no bearer token to attach, i.e. cookie
    mode) used to be indistinguishable from `null` (refresh FAILED) because the
    retry condition checked `refreshed.length > 0` instead of `refreshed !=
null`. Every cookie-mode 401 retry threw the original error instead of ever
    re-issuing the request against the now-refreshed cookie jar. Fixed; see the
    `onAuthRefresh` doc comment for the full three-outcome contract.

  `@stapel/auth-react`'s `createAuthSession`/`createAuthRuntime` are the first
  consumer (see that package's own changeset) — a bootstrap probe on
  `restore()` plus the corrected retry contract together close the incident.

## 0.5.0

### Minor Changes

- 569d7b2: Add `formatFlowError`/`useFormatFlowError` — the renderer `toFlowError`'s own doc promised ("the frontend renders `t(code, params)`") but never actually supplied: hosts were left writing `bundle[code] ?? code`, so a bundle miss surfaced a raw, unformatted code to the user. Chain: bundle template (interpolated via the existing `interpolate()`) → the backend's own `message`, but ONLY when its `language` matches the host's current locale → the raw `code` as the last resort. `FlowError`/`StapelApiError` grow optional `message`/`language` fields to carry this (additive); `StapelErrorEnvelope` grows an optional `language` for backends that send one. `I18nEngine` grows `getBundle(locale?)` so `useFormatFlowError` can read the merged dictionary `t()` already resolves against.

## 0.4.0

### Minor Changes

- e4a29b7: Analytics restratification (slim wave §21/S1). Core keeps the analytics **type
  seam + context plumbing** — the `Analytics`/`AnalyticsProvider`/`AnalyticsEvent`
  types, the `defineEvent` type layer (`EventDef`, `EventDefInput`, `EventProps`,
  `AnyEventDef`, `PropSpec`, `PropsSchema`, `PropType`, `ResolveProps`),
  `AnalyticsContext` + `useAnalytics`, and `trackFlowStep` (flow-machine
  auto-instrumentation) — while the facade **implementation** moves to the new
  `@stapel/analytics` package.

  - **Removed exports** (now in `@stapel/analytics`): `createAnalytics`,
    `consoleProvider`, `stapelCollectorProvider`, `StapelCollectorOptions`,
    `defineEvent`, `prop`, `createTracked`, `TrackedApi`, `useTracked`.
  - **New exports**: the persistence adapters `defaultPersistStorage`,
    `idbStorage`, `localStorageAdapter`, `memoryStorage` (shared by the query
    layer and `@stapel/analytics`' offline queue), and the `ResolveProps` type.

  Rationale: mandatory analytics is a stapel-studio policy — scaffolded apps
  always wire `@stapel/analytics`; OSS consumers may bring their own provider
  behind the core type seam (pairs thread it through context; the
  `stapel/no-direct-analytics-provider` rule still guards vendor SDK imports).

- b3ac272: §17 arch-contract-pipeline Wave 0 — retire `@stapel/core`'s generated schema
  surface and the monolith as a contract source.

  `@stapel/core` no longer exports the generated `paths` / `components` /
  `operations` types (and no longer ships `src/generated/schema.ts`). Under the
  per-module contract pipeline every `@stapel/<module>-react` pair already
  generates its OWN self-contained wire types from its backend's committed
  `docs/schema.json`; nothing consumed core's aggregate export (grep-confirmed),
  and stapel-core has no DRF endpoints of its own from which a meaningful core
  slice could be emitted — the shared `User` / `StapelError` / `TokenPairResponse`
  schemas only materialise via a module's endpoints. The hand-authored runtime
  error contract (`StapelApiError`, `StapelErrorEnvelope`) is unchanged and stays
  the public error surface.

  This removed core as the last reader of the monolith aggregate: `gen:api` now
  requires per-module `API_SCHEMA` + `API_OUT` (no monolith default), and the
  monolith checkout is dropped from CI. A minor bump because generated type
  exports are removed from the public API, even though no workspace consumer
  imported them.

- c3482e7: New `<StapelProvider>` (slim wave §21/S4) — the one-provider setup composing
  `StapelConfigProvider` + TanStack's `QueryClientProvider` (via
  `createStapelQueryClient`) + `I18nProvider` (via `createI18n`). Props:
  `baseUrl` or `client` (+ per-module `clients` overrides), `locale`,
  `cacheVersion`, `analytics?`, and the escape hatches `queryClient?`,
  `queryRuntime?`, `i18n?`. Ceremony target: install → `create<Mod>Runtime` per
  pair → ONE `<StapelProvider>` + per-pair `<ModProvider>`. The individual
  providers remain exported — composition, not deprecation.

  Also new: `createModuleRuntime` / `createModuleContext` (+ `ModuleRuntime`,
  `CreateModuleRuntimeOptions`, `ModuleContextKit` types) — the one reviewed
  copy of the runtime/context/provider plumbing the six standard pairs
  previously stamped per package (§21/S2).

- dc98063: Session substrate & user-data hygiene (frontend-core-architecture-v2 §43).

  - **`createSessionManager`** (§43.1) — the one owner of session lifecycle:
    three-state status (`authenticated | anonymous | unauthenticated`),
    **single-flight refresh** (N concurrent 401s share ONE `doRefresh()` call),
    typed events (`session:refreshed` / `session:lost` / `session:logout`), a
    host-injected `onSessionLost` policy (login redirect vs anonymous
    auto-login — resolved from the host's discovery config, never hardcoded),
    and the per-session WebCrypto key repositories encrypt with.
  - **Logout-hook registry** (§43.3) — `registerLogoutHook(fn)`, run on BOTH
    explicit `logout()` and involuntary session loss; one throwing hook never
    blocks the others.
  - **`createRepository(namespace, { storage, scope, encrypted })`** (§43.4) —
    the ONE sanctioned client-side store. `scope: "user"` auto-registers
    wipe-at-logout with NO opt-out and is encrypted by default (AES-GCM,
    per-session in-memory key; logout drops the key first, synchronously, so a
    crash mid-wipe still leaves ciphertext unreadable — §43.5). `scope: "app"`
    (theme, locale) survives logout and never uses the session key.
    Contract-tested: after `logout()` user-scoped data is physically absent
    from both stores and the key is dropped. Honest boundary (in the README,
    verbatim from the governing doc): frontend encryption does NOT defend
    against XSS with code execution — it defends data at rest.
  - **`createModuleRuntime`** now registers a logout hook on the active
    `SessionManager` — the pair's `onLogout` option, or a no-op default
    (§43.7: every standard pair mechanically has a cleanup call site).
  - `createStapelClient`'s 401 path is unchanged in behavior and now documented
    as the ONE legal home of 401 handling (§43.2): `onAuthRefresh` (wire it to
    `SessionManager.refresh()`) → retry once → still 401 → session lost.

### Patch Changes

- Updated dependencies [48188d9]
- Updated dependencies [2c22f06]
  - @stapel/tokens@0.4.0

## 0.3.0

### Minor Changes

- 6c33abc: `createStapelClient` accepts a `credentials?: RequestCredentials` option,
  passed through to every fetch (including 401-refresh and verification-403
  retries). Cookie-mode backends (HTTP-only JWT cookies) need `"include"` when
  the API lives on another origin — the fetch default (`"same-origin"`) silently
  drops cookies cross-origin, so bearer mode was previously the only mode that
  worked cross-origin.
- 4a024a8: Flow-machine primitive moved into `@stapel/core` (frontend-core-architecture §4b).

  `createFlowMachine`, `useFlow`, and the `FlowError` helpers (`toFlowError`,
  `isErrorCode`) now live in `@stapel/core` — the single reviewed implementation
  every `@stapel/<module>-react` pair builds on, instead of each pair copying the
  primitive and forking its staleness/re-entrancy fixes. The primitive's tests
  travel with it. `@stapel/core.toFlowError(error, fallbackCode?)` takes an
  optional module-scoped fallback (default `stapel.error.unknown`).

  `@stapel/auth-react` now imports the primitive from core and **re-exports** it
  (`createFlowMachine`, `useFlow`, `FlowMachine`, `FlowError`, …) for one minor so
  existing imports keep resolving; its `toFlowError` wrapper pins the
  `auth.error.unknown` fallback. No behavior change — the machine implementation
  is byte-for-byte the reviewed one.

- 0db568b: Typed analytics — `defineEvent` / `tracked` over the facade (frontend-guardrails §3, G3):

  - **`defineEvent` + `prop`** (`@stapel/core`). A typed event is a literal object:
    a namespaced `name`, a one-line `description`, and a `props` schema where every
    prop carries its OWN docstring (`prop.string`/`number`/`boolean`/`oneOf`). The
    facade's `track` gains a typed overload — `track(event, props)` checks props
    against the schema (required props enforced, unknown props rejected, `oneOf`
    narrowed to its literal union), while `track(name, props?)` stays for library
    auto-instrumentation. A tsc consumer fixture (`@ts-expect-error` proofs) locks
    the enforcement in.
  - **`tracked()` / `useTracked()`** (`@stapel/core`). `tracked(event, props, handler)`
    wraps a clickable so the click both emits the typed event and runs the original
    handler; `useTracked()` binds it to the facade from context (SSR-safe — no
    mutable module singleton). `trackedSubmit` is the `onSubmit` twin.
  - **Double-count exclusion by construction.** A click that STEPS a flow machine is
    already instrumented (`flow.<id>.<step>`), so it must be marked
    `data-analytics="flow"` and NOT wrapped in `tracked()`. G4 forbids the double
    wrap statically; the facade backs it in dev — while a `tracked()` handler runs,
    a `flow.*` emission on the same instance is flagged with a teaching warning (a
    flow transition fires `started` synchronously, before the first await, so a sync
    scope catches it).
  - **Runtime-configurable flow instrumentation.** `createFlowMachine({ instrument })`
    can silence a machine's auto-funnel while keeping the facade for hand-rolled
    events (default stays on when `analytics` is present).
  - **`events.json` (generated, drift-gated).** New `gen:events` driver projects a
    pair's event registry — `defined` (defineEvent call sites, AST-extracted) +
    `flows` (auto-instrumented funnels from flows.json) — into
    `src/analytics/generated/events.json`, the single source the analytics lint (G4)
    and report (G5) read. `gen:manifest` embeds it into `manifest.json` (`events`)
    and `llms.txt`. auth-react ships its funnel registry and a typed-events
    demonstration (no full annotation of the pair).

### Patch Changes

- Updated dependencies [a6c34e2]
- Updated dependencies [f23c7f3]
  - @stapel/tokens@0.2.0

## 0.2.0

### Minor Changes

- 5dfa61e: Analytics facade per analytics-standard §1–2: `createAnalytics` with fan-out
  to N providers, consent gate (pending buffers / granted flushes / denied
  drops; persisted), offline queue on the shared persist storage surviving
  instance recreation, batched delivery with per-provider tracking and
  exponential-backoff retries, PII guard (strip/warn/off) on props and traits,
  SHA-256-hashed `identify`, event-registry dev warning, built-in
  `consoleProvider` and `stapelCollectorProvider` (batch POST to
  `/analytics/api/events`, `sendBeacon` on page teardown), `trackFlowStep`
  helper (`flow.<flowId>.<stepId>`), `AnalyticsContext`/`useAnalytics`, and an
  optional backward-compatible `analytics` prop on `StapelConfigProvider`.
