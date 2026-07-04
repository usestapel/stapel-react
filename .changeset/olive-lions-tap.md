---
"@stapel/core": minor
---

Analytics facade per analytics-standard §1–2: `createAnalytics` with fan-out
to N providers, consent gate (pending buffers / granted flushes / denied
drops; persisted), offline queue on the shared persist storage surviving
instance recreation, batched delivery with per-provider tracking and
exponential-backoff retries, PII guard (strip/warn/off) on props and traits,
SHA-256-hashed `identify`, event-registry dev warning, built-in
`consoleProvider` and `stapelCollectorProvider` (batch POST to
`/analytics/api/events`, `sendBeacon` on page teardown), `trackFlowStep`
helper (`flow.<flowId>.<stepId>`), `AnalyticsContext`/`useAnalytics`, and an
optional backward-compatible `analytics` prop on `StapelConfigProvider`.
