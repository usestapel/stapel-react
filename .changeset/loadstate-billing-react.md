---
"@stapel/billing-react": minor
---

A pricing table whose catalogue read failed no longer tells customers the shop sells nothing: `PricingTableBag` hands out one `state: LoadState<PricingCatalog>` — packages and plans arrive in the same `GET /products` body, so a single state is the only honest shape — instead of pre-flattened `packages` / `plans` / `isLoading`, and gains `refetch()` so the failed arm has a retry. `isError` / `error` survive but now describe the checkout WRITE only.

Render the catalogue through `matchList(mapLoad(state, (c) => c.packages), …)`, whose four required arms keep "loaded and genuinely empty" and "the request failed" from sharing a branch. New keys `billing.pricing.error` / `billing.pricing.retry` (en + ru).
