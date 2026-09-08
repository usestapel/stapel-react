---
"@stapel/core": patch
---

`parseErrorEnvelope` reads the locale of the backend's `error` text from `error_language` — the name every Stapel backend actually sends.

The parser looked for a field named `language`, while `stapel_core.django.api.errors.StapelError` has always emitted `error_language`. So `StapelApiError.language` / `FlowError.language` were `undefined` on every response from every deployment, and `formatFlowError`'s second fallback — "use the backend's own sentence when it is written in the host's current locale" — could never fire. The ru/es refusal catalogues the python libraries ship were unreachable from the glass.

`language` stays accepted as a legacy alias (no Stapel backend emits it), so hosts and fixtures spelling it the old way keep working; `error_language` wins when a body carries both. No API change: the parsed property is still `.language`.
