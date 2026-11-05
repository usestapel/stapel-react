/**
 * @stapel/orders-react's contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `NavEmbed`). `scripts/gen-nav-
 * manifest.mjs` reads the two arrays below and writes `nav-manifest.json`.
 *
 * - `orders.cart` (`/cart`) and `orders.checkout` (`/checkout`) are PUBLIC:
 *   a guest session owns a cart (stapel-orders keys carts on the guest
 *   account). Whether a guest may place the order is the backend's
 *   `CHECKOUT_REQUIRES_ACCOUNT`, answered as a 403 the page shows.
 * - `orders.mine` hangs under the container's `account.root`; `orders.detail`
 *   (`/orders/:id`) is a navigation target, never a menu item.
 */
import type { NavEmbed, NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "orders.cart",
    labelKey: "orders.nav.cart",
    icon: "ShoppingCartOutlined",
    route: { path: "/cart" },
    component: { export: "CartPage", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: false,
    surface: "public",
    order: 60,
  },
  {
    id: "orders.checkout",
    labelKey: "orders.nav.checkout",
    icon: "ShoppingCartOutlined",
    // A browser route, not a request: billing's catalogued `checkout/`
    // operation shares the last segment, which is all the rule matches on.
    // eslint-disable-next-line stapel/no-string-paths -- route, not an API path
    route: { path: "/checkout" },
    component: { export: "CheckoutPage", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: false,
    surface: "public",
    order: 61,
  },
  {
    id: "orders.mine",
    labelKey: "orders.nav.mine",
    icon: "OrderedListOutlined",
    route: { path: "orders" },
    component: { export: "OrderHistoryPane", subpath: "default" },
    placement: { level: "submenu", parentId: "account.root" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 40,
  },
  {
    id: "orders.detail",
    labelKey: "orders.nav.detail",
    icon: "OrderedListOutlined",
    route: { path: "/orders/:id" },
    component: { export: "OrderDetailPane", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: true,
    surface: "member",
    order: 62,
  },
];

/**
 * The cart badge is header chrome on every page, guest or member, so it
 * offers `topbar.end` with surface `any`; `opens` hands the click to the cart.
 *
 * `orders.add_to_cart` is a PAGE embed: the listing page (`listings.detail`,
 * `/l/:id`) renders it in its `page.actions` slot and hands it the route's
 * `id` as `purchasableKey`; `purchasableType` is the static `"listing"`. A
 * project without the listings pair has no such page, and the scaffold drops
 * the embed.
 */
export const navEmbeds: readonly NavEmbed[] = [
  {
    id: "orders.cart_badge",
    slot: "topbar.end",
    component: { export: "CartBadge", subpath: "default" },
    order: 20,
    surface: "any",
    opens: "orders.cart",
  },
  {
    id: "orders.add_to_cart",
    slot: "page.actions",
    component: { export: "AddToCartButton", subpath: "default" },
    order: 10,
    surface: "any",
    scope: { navEntry: "listings.detail" },
    routeProps: { purchasableKey: "id" },
    props: { purchasableType: "listing" },
  },
];
