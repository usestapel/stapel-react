# @stapel/orders-react

## 0.1.0

### Minor Changes

- c58b5c8: First release: the React pair for stapel-orders 0.1.0. A cart for guest and
  member sessions, one-call checkout with an idempotency key kept until success
  (a double click replays, never duplicates), and anchor-paginated order history.
  `AddToCartButton` (headless native button and antd skin) always renders
  `data-testid="add-to-cart"` and owns its `POST cart/lines/`; a page only names
  `(purchasableType, purchasableKey)`. `./default` ships `CartPage`,
  `CheckoutPage`, `OrderHistoryPane`, `OrderDetailPane` and the `CartBadge`
  embed for `topbar.end`. Fixed test ids live in `src/testids.ts`.
- 03d2364: `orders.add_to_cart` embeds into `page.actions` on `listings.detail` with
  `routeProps: { purchasableKey: "id" }` and `props: { purchasableType: "listing" }`,
  so a project with the listings pair gets the button on the listing page. The cart
  and checkout nav entries use the shell's `ShoppingCartOutlined`. `manifest.json`
  carries the pair's `testids`, and the pair ships `flows.json` (`stapel.flows/1`:
  `cart` and `purchase`) for a preview walker, exported as `./flows.json`.

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
