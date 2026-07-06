---
"@stapel/core": minor
"@stapel/auth-react": minor
---

Flow-machine primitive moved into `@stapel/core` (frontend-core-architecture §4b).

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
