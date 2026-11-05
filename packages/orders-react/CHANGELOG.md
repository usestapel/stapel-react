# @stapel/orders-react

## 0.2.0

### Minor Changes

- f16443f: Guest cart: the add-to-cart control (headless and antd) runs its POST through core's `useElevation(ORDERS_ELEVATION_ACTIONS.addToCart).run(...)`, so a visitor with no session gets a guest minted on the click instead of a 401; the mint's pending and error states fold into the button. Without an `ElevationProvider` the add goes out at once, as before. New exports: `ORDERS_ELEVATION_ACTIONS` (`{ addToCart: "orders.add_to_cart" }`) and `useHasCartSession()`. `useCart` (and so `CartBadge`) stays idle while the session is `"unauthenticated"`, and `CartPage` shows an empty cart for no session. The add also holds one request in flight synchronously, so a double click sends one POST.

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
