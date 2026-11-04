import type { MouseEvent } from "react";

/** A link that a container may take over with its own router push. */
export function linkProps(
  href: string,
  onNavigate: ((href: string) => void) | undefined
): { href: string; onClick?: (event: MouseEvent<HTMLElement>) => void } {
  if (onNavigate === undefined) return { href };
  return {
    href,
    onClick: (event) => {
      event.preventDefault();
      onNavigate(href);
    },
  };
}

/** Default addresses, matching the pair's nav manifest. */
export const DEFAULT_CART_HREF = "/cart";
// A browser route, not a request (see nav/manifest.ts for the same note).
// eslint-disable-next-line stapel/no-string-paths -- route, not an API path
export const DEFAULT_CHECKOUT_HREF = "/checkout";
// eslint-disable-next-line stapel/no-string-paths -- the `orders.detail` route, not an API path
export const defaultOrderHref = (orderId: number): string => `/orders/${orderId}`;
