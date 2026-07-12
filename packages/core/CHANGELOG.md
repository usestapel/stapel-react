# @stapel/core

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
