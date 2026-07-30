---
"@stapel/eslint-plugin": minor
---

New rule **`stapel/no-raw-error-shape`**, wired into `recommended` (direct
precedent: `no-raw-fetch` — "raw access is forbidden, go through the layer").

Bans, outside the transport/error layer:

- `as`-casting a caught value (`catch (e) { … e as StapelApiError … }`, and
  the same on a `.catch((e) => …)` parameter);
- casting anything to a hand-written error shape (`{ status?: number }`,
  `{ localizable_error?: string }`, …) — this catches the defect even where
  the value is not catch-bound, e.g. a `retry(failureCount, error)` predicate;
- reading `.status` / `.code` / `.localizable_error` off an un-narrowed
  caught value.

Narrowing is accepted only through `instanceof StapelApiError` or an
**imported** predicate (`isStapelApiError`, `hasErrorCode`, a named
`errorCodePredicate(…)` export) — via `if`, `? :`, `&&`, or an early-exit
`if (!guard) return/throw`.

Why: a thrown value has two dialects — `StapelApiError` (has `.status`) and
the raw `{localizable_error, error, params}` envelope (has none) — so
`(e as { status?: number })?.status === 404` is dead code against the second
one, and the cast is what hides it. In production this told users "the AI
found nothing" about a meeting nobody had analysed.

Scoped by path, deliberately: **off** in `**/api/**`, `*client.*`, `errors.*`,
`error-layer/**` (somebody must touch the raw shape to fold it — that is the
layer's job), off in Node-side `scripts/**`, `bin/**`, `*.config.*` (there
`e.code` is an errno, not an envelope), and off in tests/fixtures. An unscoped
version would just get blanket-disabled, and then it guards nothing. Tune with
`options.properties` / `options.errorClasses`.

Consumers on `recommended` may see new errors on existing code — that is the
point; each one is a state discrimination that cannot fire in production.
