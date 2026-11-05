/**
 * The orders actions a deployment may let a visitor with no session perform
 * by minting a guest identity on the click (core's `ElevationProvider`).
 * A host lists them in its elevation source; the scaffold collects them from
 * the module's `elevation_actions`.
 */
export const ORDERS_ELEVATION_ACTIONS = {
  addToCart: "orders.add_to_cart",
} as const;
