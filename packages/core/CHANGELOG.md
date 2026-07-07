# @stapel/core

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
