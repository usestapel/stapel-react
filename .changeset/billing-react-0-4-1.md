---
"@stapel/billing-react": patch
---

Re-pin to the stapel-billing `v0.4.9` contract. The 0.4.9 release refines the
semantics of `current_period_end` (the subscription's period-end timestamp); the
contract *shape* is unchanged, so the generated surface is byte-identical and
this is a documentation/pin patch only. `backend.contract` stays `>=0.4 <0.5`.
