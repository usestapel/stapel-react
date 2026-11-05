import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { toStapelApiError, useElevation, useT } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type { Cart } from "../api/types.js";
import { ORDERS_I18N_KEYS } from "../i18n/keys.js";
import { ORDERS_ELEVATION_ACTIONS } from "../model/elevation.js";
import { useAddToCart } from "../model/mutations.js";
import { useCart } from "../model/queries.js";
import { ORDERS_TESTIDS } from "../testids.js";

export interface AddToCartProps {
  readonly purchasableType: string;
  readonly purchasableKey: string;
  /** Default 1. The server caps a line at its own maximum. */
  readonly quantity?: number;
  readonly disabled?: boolean;
  /** Called with the whole cart after a successful add. */
  readonly onAdded?: (cart: Cart) => void;
}

/** What {@link useAddToCartButton} hands a renderer. */
export interface AddToCartBag {
  /** Send the add. Ignored while one is already in flight. */
  readonly add: () => void;
  readonly pending: boolean;
  readonly disabled: boolean;
  /** Lines in the cart after the last successful add from THIS control. */
  readonly lineCount: number | undefined;
  /** Set after a success; the renderer offers "Go to cart". */
  readonly added: boolean;
  /**
   * The add's refusal, or the guest mint's failure (wrapped so the renderer
   * reads one `code`). `null` while neither failed.
   */
  readonly error: StapelApiError | null;
}

/**
 * The add-to-cart state machine every renderer shares: the control owns its
 * request, so a page only names the purchasable and can never wire a button
 * that does nothing.
 *
 * The add runs through core's elevation (`orders.add_to_cart`): with an
 * `ElevationProvider` that lists the action, a visitor with no session gets a
 * guest identity minted on the click, and the POST follows it, so the cart has
 * an owner instead of a 401. Without a provider, `run` performs at once.
 */
export function useAddToCartButton(props: AddToCartProps): AddToCartBag {
  const mutation = useAddToCart();
  const cart = useCart();
  const elevation = useElevation(ORDERS_ELEVATION_ACTIONS.addToCart);
  const pending = elevation.pending || mutation.isPending;
  const disabled = props.disabled === true || pending;
  const mintError =
    elevation.error !== undefined ? toStapelApiError(elevation.error) : null;
  // `pending` reaches the closure only after a render, and the mutation's
  // state lands a tick after `mutate`; a double click falls in that gap. The
  // ref closes it synchronously and opens again when the add settles or the
  // mint fails (a failed mint never reaches `perform`).
  const inFlight = useRef(false);
  useEffect(() => {
    if (elevation.error !== undefined) inFlight.current = false;
  }, [elevation.error]);
  return {
    add: () => {
      if (disabled || inFlight.current) return;
      inFlight.current = true;
      elevation.run(() => {
        mutation.mutate(
          {
            purchasableType: props.purchasableType,
            purchasableKey: props.purchasableKey,
            ...(props.quantity !== undefined ? { quantity: props.quantity } : {}),
          },
          {
            onSuccess: (next) => props.onAdded?.(next),
            onSettled: () => {
              inFlight.current = false;
            },
          }
        );
      });
    },
    pending,
    disabled,
    lineCount: mutation.isSuccess
      ? (cart.data?.line_count ?? mutation.data.line_count)
      : undefined,
    added: mutation.isSuccess,
    error: mutation.error ?? mintError,
  };
}

export interface AddToCartButtonProps extends AddToCartProps {
  /** Where "Go to cart" leads. Default `/cart` (the `orders.cart` entry). */
  readonly cartHref?: string;
  /** Client-side navigation; without it "Go to cart" is a plain link. */
  readonly onNavigate?: (href: string) => void;
  readonly className?: string;
  /** Replace the default label. */
  readonly children?: ReactNode;
}

/**
 * A native `<button>` with no visual opinion. It ALWAYS renders
 * `data-testid="add-to-cart"` (see `testids.ts`); after a success it shows the
 * cart's line count and a "Go to cart" link. The antd-styled twin lives in
 * `@stapel/orders-react/default`.
 */
export function AddToCartButton(props: AddToCartButtonProps): ReactElement {
  const t = useT();
  const bag = useAddToCartButton(props);
  const cartHref = props.cartHref ?? "/cart";
  return (
    <span className={props.className}>
      <button
        type="button"
        data-testid={ORDERS_TESTIDS.addToCart}
        data-analytics="none"
        data-analytics-reason="business action — the host app wraps this with its own tracked(); the pair ships no analytics runtime and no flow machine for a single POST"
        disabled={bag.disabled}
        aria-busy={bag.pending}
        onClick={bag.add}
      >
        {bag.pending
          ? t(ORDERS_I18N_KEYS.addAdding)
          : (props.children ?? t(ORDERS_I18N_KEYS.addLabel))}
      </button>
      {bag.added && (
        <span role="status">
          {t(ORDERS_I18N_KEYS.addInCart, { count: bag.lineCount ?? 0 })}{" "}
          <a
            href={cartHref}
            data-testid={ORDERS_TESTIDS.goToCart}
            data-analytics="none"
            data-analytics-reason="navigation — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            onClick={(event) => {
              if (props.onNavigate === undefined) return;
              event.preventDefault();
              props.onNavigate(cartHref);
            }}
          >
            {t(ORDERS_I18N_KEYS.addGoToCart)}
          </a>
        </span>
      )}
      {bag.error !== null && (
        <span role="alert">{t(bag.error.code || ORDERS_I18N_KEYS.unknownError)}</span>
      )}
    </span>
  );
}
