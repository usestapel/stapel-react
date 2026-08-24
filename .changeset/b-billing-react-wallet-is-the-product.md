---
"@stapel/billing-react": minor
---

The wallet becomes a product: two credit pools, the debt, the subscription, auto-recharge and the ledger.

The backend's whole 0.8 → 0.11 arc reached the model layer and stopped before the skin. Five of eight
caller-facing operations had hooks and no pixels; `GET /wallet/transactions` had no consumer anywhere.

**The two pools.** A wallet holding 840 bought credits and 400 that die on the 1st rendered as "1240 USD".
It now renders as two lines with their fates in words, and `creditPools()` has no field that could spell
their sum. The split is on `expires_at`, not `source` — a bought credit a deployment expires is an
expiring credit. The deadline is still the server's `expiring_soon`, never a client-side scan.

**The debt** (`debts[]` / `debt_outstanding`, new in 0.11.0) is stated with what it will do to the next
credits, and every offer in the shop says how many of ITS credits are already spoken for.

**New default skins** — `SubscriptionCard`, `WalletSettings`, `TransactionHistory` — filling two §54 holes
and spending seven i18n keys that were written, translated and rendered by nothing. `BuyOptions` reads
`useSubscription` and no longer offers the plan the caller already holds; its columns are sized by the
ELEMENT, not the viewport, so the shop in a narrow panel gets the narrow layout.

**Spanish is real.** All 31+ pair-owned UI keys are translated; `es` shipped Spanish errors inside an
English screen before. Counts go through `tPlural` (CLDR families, four forms in Russian) instead of
`credit(s)`.

**Breaking (pre-1.0 = minor):** `/default` no longer exports `BillingSkinTheme` or its own `ErrorAlert` —
both come from `@stapel/tokens-antd/skin` (`SkinTheme`, `ErrorAlert`), one reviewed copy for the fleet,
reactive to the document's live `data-theme`. Peer floors are now `@stapel/core >=0.18.0` and
`@stapel/tokens-antd >=0.6.0`. `WalletCredits` gains `debts` / `debtOutstanding` as LoadStates, so a
custom `WalletBag` consumer implementing the interface by hand must supply them. Schema regenerated
against stapel-billing 0.11.0; contract pin `>=0.11 <0.12`. New nav entry `account.billing`.
