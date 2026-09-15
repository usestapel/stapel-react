---
"@stapel/billing-react": patch
---

Regenerated against **stapel-billing 0.14.0**: the pin was two minors behind
(0.12.1), which failed the fleet's contract-freshness gate and blocked every
writer's CI in this repo. The declared backend contract moves from `>=0.12
<0.13` to `>=0.14 <0.15` in `manifest.json` and `llms.txt`.

**Wire changes, additive only.** `SubscriptionResponse` gains three optional
fields — `cancel_at_period_end`, `is_paid`, `is_active` — computed
server-side (0.13.0: a subscriber who cancels stays `status="active"` for the
remainder of the period, and the auto-created free-plan row also reads
`status="active"`, so neither field alone can say "is there a paid,
currently-entitling subscription here"). None of the three is in the
schema's `required` list, so a host still on 0.12.x sends a body without them
and nothing here breaks. `POST /subscription/cancel` gains a `409` response
(`error.409.subscription_not_paid`, ru/es translated) for a caller with no
paid subscription to cancel. No operation renamed, no field removed, no
response shape narrowed. `docs/flows.json` is unchanged for the HTTP surface
this pair reads; 0.14.0's own additions (payment/subscription notification
subscribers, two newly-registered Stripe events) live entirely server-side
and inside `subscription.changed`/`payment.completed` event payloads, which
this REST pair does not consume.

**Not fixed here.** `<Subscription>`'s headless `SubscriptionBag.isActive`
(`packages/billing-react/src/headless/Subscription.tsx`) still derives
"active" from `status === "active" || status === "trialing"` alone, which
reads true for the auto-created free-plan row too — the same client-side
inference the backend's own `is_active`/`is_paid` fields exist to replace.
The pair does not read either new field anywhere. Left to the component's
owner; not touched by this contract-pin bump.
