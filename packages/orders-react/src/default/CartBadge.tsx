import type { ReactElement } from "react";
import { Badge, Button, theme as antdTheme } from "antd";
import { useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { ORDERS_I18N_KEYS } from "../i18n/keys.js";
import { useCart } from "../model/queries.js";
import { ORDERS_TESTIDS } from "../testids.js";
import { CartIcon } from "./icons.js";
import { DEFAULT_CART_HREF } from "./navigate.js";
import type { ThemeModeProp } from "./types.js";

const BADGE_OVERFLOW = 99;

export interface CartBadgeProps extends ThemeModeProp {
  /** Open the cart — the shell passes its router push (`opens: orders.cart`). */
  readonly onOpen?: (() => void) | undefined;
  /** Link target when no `onOpen` is given. Default `/cart`. */
  readonly href?: string | undefined;
}

/**
 * The top-bar cart badge (`orders.cart_badge` → `topbar.end`). Hidden while
 * the cart is empty, loading or unreadable: a badge is a count, and there is
 * no count to show.
 */
export function CartBadge(props: CartBadgeProps): ReactElement | null {
  const t = useT();
  const { token } = antdTheme.useToken();
  const cart = useCart();
  const count = cart.data?.line_count ?? 0;
  if (count <= 0) return null;
  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="bare"
      style={{ display: "inline-flex" }}
    >
      <Badge count={count} overflowCount={BADGE_OVERFLOW} size="small" color={token.colorPrimary}>
        <Button
          type="text"
          shape="circle"
          aria-label={t(ORDERS_I18N_KEYS.badgeLabel, { count })}
          data-testid={ORDERS_TESTIDS.cartBadge}
          data-count={count}
          data-analytics="none"
          data-analytics-reason="navigation — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          {...(props.onOpen !== undefined
            ? { onClick: props.onOpen }
            : { href: props.href ?? DEFAULT_CART_HREF })}
        >
          <CartIcon />
        </Button>
      </Badge>
    </SkinTheme>
  );
}
