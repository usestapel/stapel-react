---
"@stapel/orders-react": minor
---

Guest cart: the add-to-cart control (headless and antd) runs its POST through core's `useElevation(ORDERS_ELEVATION_ACTIONS.addToCart).run(...)`, so a visitor with no session gets a guest minted on the click instead of a 401; the mint's pending and error states fold into the button. Without an `ElevationProvider` the add goes out at once, as before. New exports: `ORDERS_ELEVATION_ACTIONS` (`{ addToCart: "orders.add_to_cart" }`) and `useHasCartSession()`. `useCart` (and so `CartBadge`) stays idle while the session is `"unauthenticated"`, and `CartPage` shows an empty cart for no session. The add also holds one request in flight synchronously, so a double click sends one POST.
