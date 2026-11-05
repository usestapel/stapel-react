# @stapel/orders-react — module guide

React pair for **stapel-orders** (`/orders/api/v1/`). Human companion to the
generated `llms.txt` and `manifest.json`.

## Hooks (`model/`)

| Hook | Endpoint | Notes |
|---|---|---|
| `useCart()` | `GET cart/` | waits for the session: a guest session IS the cart's owner; idle when the status is `"unauthenticated"` (no session, no cart, no 401) |
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
- Guest cart: the add runs inside core's
  `useElevation(ORDERS_ELEVATION_ACTIONS.addToCart).run(...)`
  (`"orders.add_to_cart"`). When the host's `ElevationProvider` lists the
  action, a click from a visitor with no session mints a guest first and the
  POST follows; the mint's pending and error states are folded into the bag.
  Without a provider (or with the action unlisted) the add goes out at once,
  as before. The bag also holds one add in flight synchronously, so a double
  click sends one POST. `useHasCartSession()` is the same session read
  `useCart` gates on; `CartPage` renders `cart-empty` for no session and
  `CartBadge` stays hidden without asking the server.
- `./default`: `CartPage`, `CheckoutPage`, `OrderHistoryPane`,
  `OrderDetailPane` (route param `id`), `CartBadge` (hidden at 0).
- Navigation: pages render plain links (`/cart`, `/checkout`, `/orders/<id>`)
  unless the container passes `onNavigate(href)`; hrefs are props.

## Nav

`orders.cart` `/cart` (public, hidden from the menu), `orders.checkout`
`/checkout` (public, hidden), both with the shell's `ShoppingCartOutlined`;
`orders.mine` under `account.root` (member), `orders.detail` `/orders/:id`
(member, hidden). Whether a guest may place the order is the backend's
`CHECKOUT_REQUIRES_ACCOUNT` (a 403 the page shows).

Embeds:

- `orders.cart_badge` → `topbar.end`, surface `any`, opens `orders.cart`.
- `orders.add_to_cart` → `page.actions` with `scope: {navEntry:
  "listings.detail"}`, `routeProps: {purchasableKey: "id"}`, `props:
  {purchasableType: "listing"}`, component `AddToCartButton` from `./default`.
  `@stapel/listings-react`'s `ListingDetailPane` renders the slot in the
  reader's buy box and hands it `{ id }`; `@stapel/core`'s `embedsForPage` +
  `resolveEmbedProps` turn the declaration into props. A project without the
  listings pair has no such page and the scaffold drops the embed; a custom
  page renders `<AddToCartButton purchasableType="part" purchasableKey={id}/>`.

## Test ids and browser flows

- `src/testids.ts` (`ORDERS_TESTIDS`) is read by `gen:manifest` into
  `manifest.json` `testids`, so a recipe's UI criteria come from the pair.
- `flows.json` (`stapel.flows/1`, exported as `./flows.json`): `cart` (a
  visitor with no session adds a listing, sees the cart line; the host must
  mount `ElevationProvider` with `orders.add_to_cart` listed and guest
  sessions on, which the scaffold wires from the module's
  `elevation_actions`) and `purchase` (a member adds, checks
  out, lands on `page-order`). It needs `{listing_id}` from the host, and
  `purchase` runs after the host's own sign-in steps (`session: "member"`,
  since `CHECKOUT_REQUIRES_ACCOUNT` defaults to true). `gen:manifest`
  validates every step against the runner's rules and the pair's test ids,
  and projects the flows into `manifest.json` `uiFlows`.

## Extension seams (frontend-standard §7)

- Client injected via `<OrdersProvider>` / core's per-module client override.
- The headless layer is copy-and-own; the skin is replaceable per screen.
