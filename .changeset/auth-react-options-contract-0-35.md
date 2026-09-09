---
"@stapel/auth-react": minor
---

auth: the pair admits the release where `OPTIONS` answers instead of dying

Pin → **stapel-auth v0.35.1**, so `backend.contract` moves `>=0.34 <0.35` →
`>=0.35 <0.36`. A host on this range must run stapel-auth 0.35.x.

**Why the range had to move.** Every viewset in stapel-auth is a
`GenericViewSet` with per-action serializer seams and no `serializer_class`, so
DRF's `GenericAPIView.get_serializer_class` answered with `AssertionError` —
not an `APIException`, so it escaped the module's error handler. `SimpleMetadata`
instantiates the view's serializer to build its `actions` block, which made
`OPTIONS` on every auth route a 500 with an HTML body. That is what a
cross-origin host's CORS preflight hits on the two pre-auth routes, before it
can sign in. 0.35.0 derives `get_serializer_class()` from the seams; the pair
could not take it while it declared `<0.35`.

**No request or response shape moves with it.** `docs/schema.json` is
byte-identical across stapel-auth v0.34.3..v0.35.0 (sha256 prefix
`dc6848350f4d0010` on both sides), and no production call site reaches
`get_serializer_class` — only DRF's metadata handler does. Every generated
change in this bump comes from 0.35.1 re-emitting the contract against the
dependency range CI installs, i.e. from shapes stapel-gdpr and stapel-core own:
`closure_token` on the closure status body, the `X-Closure-Token` header
parameter with its 401/403 on the closure status and cancel routes, the erasure
report's `outcome` / `unanswered_owners` / `unanswered`, and the corrected
`error_language` description. Three new error keys join the registry —
`error.401.gdpr.closure_token_invalid`, `error.401.gdpr.closure_token_expired`,
`error.403.gdpr.closure_token_scope` — with ru and es shipped upstream, so the
locale bundles moved with the generator and nothing was hand-written.

**Additive.** No field is removed, no required set narrows, and no exported type
disappears. A host that upgrades the pair without touching its code keeps the
behaviour it had, and gains an `OPTIONS` that answers.
