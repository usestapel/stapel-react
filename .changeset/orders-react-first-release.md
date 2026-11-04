---
"@stapel/orders-react": minor
---

First release: the React pair for stapel-orders 0.1.0. A cart for guest and
member sessions, one-call checkout with an idempotency key kept until success
(a double click replays, never duplicates), and anchor-paginated order history.
`AddToCartButton` (headless native button and antd skin) always renders
`data-testid="add-to-cart"` and owns its `POST cart/lines/`; a page only names
`(purchasableType, purchasableKey)`. `./default` ships `CartPage`,
`CheckoutPage`, `OrderHistoryPane`, `OrderDetailPane` and the `CartBadge`
embed for `topbar.end`. Fixed test ids live in `src/testids.ts`.
