---
"@stapel/billing-react": minor
---

`<Subscription>` asks the SERVER whether the subscription is active.

`isActive` was `status === "active" || status === "trialing"` — a client-side
copy of a list that belongs to the backend, computed from a field that cannot
carry the answer. `status` is the provider's value MIRRORED, so a row whose
renewal webhook never arrived reads `active` for as long as nobody notices,
and every skin gated on this bag showed a lapsed subscriber an entitled
account. stapel-billing computes `is_active` from `current_period_end`
against the clock that actually bills, and sends it on `GET /subscription`.

- `isActive` now reads `is_active` when the server sends it, and falls back to
  the old status rule only when it is absent — a server older than the field
  behaves exactly as before.
- New `isPaid` (`boolean | null`) carries `is_paid`: is there a provider
  subscription behind this row at all. `plan`/`status` cannot say it — an
  account that never subscribed reads `plan: "free", status: "active"` — so
  this is the field a cancel button belongs behind. `null` where the server
  does not send it: not knowing is not `false`.

`SubscriptionBag` gains a member, so a host that spreads the bag into its own
typed object sees one new optional decision, not a break.
