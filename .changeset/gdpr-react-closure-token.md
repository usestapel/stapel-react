---
"@stapel/gdpr-react": minor
---

gdpr: a closure that revoked every session now hands back a way to reach it

Pin → **stapel-gdpr v0.5.8**. The declared range stays `>=0.5 <0.6`; the wire
moved additively inside it.

Closing an account revokes all of its sessions, including the one that asked —
so on Django's default auth backend the caller was left holding no credential
and could neither poll the closure's status nor cancel it inside the grace
period. The 202 now carries `closure_token`, a single-purpose capability scoped
to that one closure and expiring with its grace period. It travels as the
`X-Closure-Token` header; the status and cancel routes accept it as the other
credential, and three refusals around it become real envelope keys:
`error.401.gdpr.closure_token_invalid`, `error.401.gdpr.closure_token_expired`,
`error.403.gdpr.closure_token_scope`. ru and es ship upstream.

The erasure report also learns to distinguish silence from failure: `outcome`
(pending | complete | incomplete), `unanswered_owners`, and `unanswered` on the
per-owner part — an owner that never answered is not an owner that reported a
failure, and the report is never `complete` while one is outstanding.

**Additive.** New optional fields and a new optional header; nothing is removed
and no required set narrows.
