---
"@stapel/core": patch
---

`toFlowError` is idempotent, and `isFlowError` is exported.

It recognised `StapelApiError` and collapsed everything else to the fallback code — including a `FlowError` it had produced itself. A flow machine's refusal state carries a `FlowError`, not the thrown value, so every screen that reads a refusal OFF A MACHINE and hands it to the pair's own fold before asking a code predicate about it got the fallback code back: `isErrorCode(refused, "moderation.report.already_reported")` answered `false` for every refusal, and the screen silently rendered the generic sentence instead of the one written for that situation. Invisible wherever a pair's copy reads like the backend's own text, which is why it survived until moderation-react's wave-D screens, whose two refusal sentences differ from the backend's.

A `FlowError` now passes through unchanged (same object identity); a `StapelApiError` still goes down the real fold, so its `message` and `language` are read the way `formatFlowError` needs them; anything else still collapses to `fallbackCode`. The guard excludes `Error` instances on purpose — `StapelApiError` carries `code`/`params`/`status` too — and is exported as `isFlowError` for pairs that need the same question answered.

Pairs carrying a local idempotence wrapper in `src/flows/errors.ts` (moderation-react) can delete it and call core's directly.
