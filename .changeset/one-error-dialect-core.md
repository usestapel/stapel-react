---
"@stapel/core": minor
---

**One error dialect.** A thrown value reaches a call site in one of two
shapes: `StapelApiError` (what `createStapelClient` throws — has `.status`),
or the RAW envelope `{localizable_error, error, params}` — the parsed response
BODY, rethrown by any second transport (`if (error) throw error` over an
openapi-fetch-style `{ data, error }` result), which has **no `.status` at
all**. Call sites papered over the split with `(e as { status?: number
})?.status === 404` — a branch that can never be true on the second dialect,
with the cast silencing the only check that would have caught it.

Core now owns the discrimination, so no consumer has to invent it again:

- `isStapelApiError(value)` — the typeguard;
- `isErrorEnvelope(value)` — the raw dialect, recognised;
- `errorCode(value)` / `errorStatus(value)` — read the code/status from
  EITHER dialect (`errorStatus` also recovers the status the code itself
  carries: `error.404.…`, `stapel.http.503`), `undefined` when genuinely
  unknowable;
- `hasErrorCode(value, ...codes)` and `errorCodePredicate(...codes)` — the
  named-state predicate factory (`const isFeatureDisabled =
  errorCodePredicate("error.404.feature_disabled")`), so two DIFFERENT 404s
  stay two different states, which `.status === 404` can never express;
- `toStapelApiError(value, fallbackStatus?)` — the fold a second transport
  applies at its single rethrow point (`throw toStapelApiError(error,
  response.status)`) so its call sites only ever see dialect 1;
- `TRANSPORT_ERROR_CODE` — the honest code for "never reached the backend"
  (no invented HTTP status).

**Behaviour change — network traffic.** The default query client's `retry`
predicate now reads `errorStatus(error)` instead of `(error as {status?:
number}).status`. A 4xx that arrives as the raw envelope was previously
invisible to the predicate and got retried twice; it is now recognised and
**not retried**. Requests that were fired three times are fired once. Nothing
that was retried before and *should* be still is: 5xx and status-less faults
(network, abort) keep the `failureCount < 2` budget. Minor, not patch — this
changes what goes over the wire in consuming apps; a host that depended on the
extra attempts must set its own `retry` on the `QueryClient` it passes in.

Covered by a test that mocks the WIRE (a real 404 envelope through a real
second-transport rethrow), not the module — see CONTRIBUTING.md
"Mock the wire, not the module".
