---
"@stapel/billing-react": patch
---

Regenerated against **stapel-billing 0.12.0**: the declared backend contract moves from `>=0.11 <0.12` to `>=0.12 <0.13` in `manifest.json` and `llms.txt`.

Nothing on the wire changed — `docs/schema.json`, `docs/errors.json` and `docs/flows.json` are byte-identical between the two releases (0.12.0 adds a server-side `user.merged` consumer that folds a merged guest's credit lots, holds, debts and ledger into the surviving account, which a host observes only as a wallet that gained rows), so no type, endpoint, i18n key or error code in this package moved. The published 0.10.1 still announced `>=0.11 <0.12`; this release is that range, shipped.
