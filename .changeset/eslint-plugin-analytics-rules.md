---
"@stapel/eslint-plugin": minor
---

Analytics guardrail rules (frontend-guardrails §3, task G4) — the enforcement
tier over typed analytics (`defineEvent`/`tracked`, `events.json`). All four are
data-driven or purely syntactic, and every message teaches the fix.

- **`clickable-needs-event`** — an interactive JSX element (`onClick`/`onSubmit`/
  `onPointerDown`/…) must declare exactly one of three static outcomes: (a) the
  handler is wrapped — `onClick={tracked(event, props, handler)}` /
  `trackedSubmit(...)`; (b) it steps a flow machine — `data-analytics="flow"`
  (the auto-instrumented funnel emits `flow.<id>.<step>` itself); or (c) it opts
  out — `data-analytics="none"` with a **non-empty** `data-analytics-reason="…"`
  (the report lists it under "explicitly untracked"). Decorative/technical
  handlers whose body only calls `e.stopPropagation()`/`preventDefault()` are
  exempt by policy; custom components that merely forward `onClick` still need an
  outcome (mark them `none` reason `"passthrough"`).
- **`no-double-count`** — a hard ban (user decision Q12а, overriding open
  question §7): `tracked()`/`trackedSubmit()` over a handler that also steps a
  flow machine double-counts the funnel. Fires when the wrapped handler calls a
  `run`/`step`/`submit*` method, or when the same element carries both
  `data-analytics="flow"` and a `tracked()` wrapper. Message: the flow step
  already emits the funnel — drop the wrapper or the marker, keep one channel.
- **`event-literal-meta`** — `defineEvent()` must be a literal object (literal
  `name`/`description`, every prop via a `prop.*` builder) so the `gen:events`
  extractor can project it into `events.json`; a dynamic definition is invisible
  to the registry and reports.
- **`known-event`** — `track()`/`tracked()` with an event name absent from the
  generated `events.json` → **warning** (drift; goes green after `pnpm
  gen:events`). Reads the same `manifest.events` projection the report reads;
  resolves string literals and in-file `defineEvent` identifiers, and skips
  anything it can't statically read (no false positives).

Severities in the `recommended` preset: `no-double-count` and
`event-literal-meta` error, `clickable-needs-event` error (JSX), `known-event`
warn; all four off in `test`/`fixtures` (where anti-patterns are trained on
purpose). Adds an `events.json`/`manifest.events` loader to the data layer
(dynamic + cached + `__resetCaches`), degrading to a no-op when the manifest is
absent. 41 new RuleTester cases; the whole monorepo lints clean.
