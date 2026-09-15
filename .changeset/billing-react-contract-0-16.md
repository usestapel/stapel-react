---
"@stapel/billing-react": patch
---

Regenerated against **stapel-billing 0.16.1**: the pin was two minors behind
(0.14.0), which failed the fleet's contract-freshness gate. The declared
backend contract moves from `>=0.14 <0.15` to `>=0.16 <0.17` in
`manifest.json` and `llms.txt`.

Nothing on the wire changed — `docs/schema.json`, `docs/errors.json` and
`docs/flows.json` are byte-identical across 0.14.0..0.16.1. The three
releases in between are server-side only: 0.15.0 adds `manage.py
billing_grant_credits` and an `INTERNAL_ACCOUNT_POLICY=meter_only` staff
metering mode (a terminal grant path and an admin-only switch), 0.16.0 adds
a freshness gate on the notification subscribers 0.14.0 shipped
(`NOTIFY_MAX_AGE_SECONDS`, refuses to mail a stale replayed fact) plus a
required `created_at` on the internal `payment.failed` event — an
event-payload field, not part of `docs/schema.json`, which this REST pair
does not read — and 0.16.1 fixes the admin grant action's own resubmission
message. No route, field, required set or error code in this package moves.
