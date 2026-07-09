---
"@stapel/analytics": minor
---

New package: **`@stapel/analytics`** — the Stapel analytics facade
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
