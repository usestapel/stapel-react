# @stapel/orders-react — module guide

React pair for **stapel-orders** (`/orders/api/v1/`). Human companion to the
generated `llms.txt` and `manifest.json`.

## Hooks (`model/`)

| Hook | Endpoint | Notes |
|---|---|---|
| `useCart()` | `GET cart/` | waits for the session: a guest session IS the cart's owner |
| `useAddToCart()` | `POST cart/lines/` | writes the returned cart into the cache, then invalidates `["orders","cart"]` |
| `useUpdateCartLine()` | `PATCH cart/lines/{id}/` | quantity `0` removes the line |
| `useRemoveCartLine()` / `useClearCart()` | `DELETE cart/lines/{id}/`, `DELETE cart/` | an empty cart is a 200 with `lines: []` |
| `useCheckout()` | `POST checkout/` | keeps one `idempotency_key` in state until a success; a double click or a retry replays, never duplicates |
| `useOrders({status?, limit?})` | `GET orders/` | infinite query over `AnchorPagination`; `has_next` is the authority |
| `useOrder(id)` / `useCancelOrder()` | `GET orders/{id}/`, `POST orders/{id}/cancel/` | a foreign id 404s like an absent one |

A refusal that carries the refreshed cart in `params.cart`
(`error.409.cart_price_changed`, `error.409.purchasable_unavailable`) is written
into the cart cache, so the screen shows the numbers the next submit uses.

## Headless and skin

- `AddToCartButton({purchasableType, purchasableKey, quantity?, disabled?, onAdded?})`
  exists twice with one contract: a native button in the main entry and an
  antd one in `./default`. Both always render `data-testid="add-to-cart"`, own
  the request, and offer "Go to cart" after a success. `useAddToCartButton`
  is the shared bag for a custom renderer.
- `./default`: `CartPage`, `CheckoutPage`, `OrderHistoryPane`,
  `OrderDetailPane` (route param `id`), `CartBadge` (hidden at 0).
- Navigation: pages render plain links (`/cart`, `/checkout`, `/orders/<id>`)
  unless the container passes `onNavigate(href)`; hrefs are props.

## Nav

`orders.cart` `/cart` (public, hidden from the menu), `orders.checkout`
`/checkout` (public, hidden), `orders.mine` under `account.root` (member),
`orders.detail` `/orders/:id` (member, hidden). Embed `orders.cart_badge` →
`topbar.end`, surface `any`, opens `orders.cart`. Whether a guest may place
the order is the backend's `CHECKOUT_REQUIRES_ACCOUNT` (a 403 the page shows).

## Not in 0.1.0 (named gaps)

- The `orders.add_to_cart` embed into `page.actions` on `listings.detail`
  needs `scope` + `routeProps` on `@stapel/core` `NavEmbed` and listings-react
  rendering `page.actions` (spec asks C1, R1). Until then a page renders
  `<AddToCartButton/>` itself.
- `testids` in `manifest.json` and a pair-shipped `flows.json` for the
  preview walker (spec §6) are not emitted yet.
- No icon in the shell registry reads as a cart; the entries use `TagOutlined`
  and `OrderedListOutlined`.

## Extension seams (frontend-standard §7)

- Client injected via `<OrdersProvider>` / core's per-module client override.
- The headless layer is copy-and-own; the skin is replaceable per screen.
