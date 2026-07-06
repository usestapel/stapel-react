---
"@stapel/core": minor
"@stapel/auth-react": patch
---

Typed analytics — `defineEvent` / `tracked` over the facade (frontend-guardrails §3, G3):

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
