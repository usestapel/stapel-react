import type { ReactElement, ReactNode } from "react";
import { usePrice } from "./usePrice.js";
import type { PriceBag, UsePriceOptions } from "./usePrice.js";

export interface MoneyProps extends UsePriceOptions {
  /** Render prop: everything {@link usePrice} computed, nothing drawn. */
  readonly children: (bag: PriceBag) => ReactNode;
}

/**
 * `<Money>` — the render-prop form of {@link usePrice}, for a host drawing its
 * own price row with its own design system.
 *
 * Renderless by construction: it returns exactly what the child returns, so a
 * host's typography, layout and truncation stay the host's. The default skin's
 * `<Price>` is one consumer of the same bag.
 */
export function Money(props: MoneyProps): ReactElement {
  const { children, ...options } = props;
  const bag = usePrice(options);
  return <>{children(bag)}</>;
}
