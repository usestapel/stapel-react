import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { CheckoutRequest, CreditPackage, Plan } from "../api/types.js";
import { useCatalog } from "../model/queries.js";
import { useCreateCheckout } from "../model/mutations.js";

/**
 * A checkout selection — pass exactly one of `package` / `plan` (the backend
 * rejects both-or-neither with `error.400.invalid_package`). Optional
 * `success_url` / `cancel_url` override the server's configured redirects. Alias
 * of the generated {@link CheckoutRequest} body.
 */
export type CheckoutSelection = CheckoutRequest;

/** Render-prop bag for {@link PricingTable}. */
export interface PricingTableBag {
  /** One-time credit packages, once the catalogue loads. */
  readonly packages: readonly CreditPackage[];
  /** Recurring subscription plans, once the catalogue loads. */
  readonly plans: readonly Plan[];
  /** The catalogue load is in flight. */
  readonly isLoading: boolean;
  /** The catalogue read or a checkout attempt failed. */
  readonly isError: boolean;
  /**
   * The error, when `isError` (a localizable `StapelApiError`), else null. A
   * bad slug surfaces here as `error.400.invalid_package` / `invalid_plan`.
   */
  readonly error: StapelApiError | null;
  /** Start Stripe Checkout for the given package or plan. */
  checkout(selection: CheckoutSelection): void;
  /** A checkout call is in flight (redirect pending). */
  readonly isCheckingOut: boolean;
  /**
   * The hosted Stripe Checkout URL from the last successful `checkout`, else
   * null. The host redirects the browser here (`window.location.assign`).
   */
  readonly checkoutUrl: string | null;
}

/**
 * Headless pricing table — renderless catalogue + checkout. Wires
 * {@link useCatalog} + {@link useCreateCheckout} and hands a
 * {@link PricingTableBag} to `children`; bring your own cards / buttons. Payment
 * is server truth, so checkout is never optimistic — the bag exposes the hosted
 * `checkoutUrl` for you to redirect to. Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <PricingTable>
 *   {({ packages, checkout, checkoutUrl }) => ( ... )}
 * </PricingTable>
 * ```
 */
export function PricingTable(props: {
  children: (bag: PricingTableBag) => ReactNode;
}): ReactNode {
  const query = useCatalog();
  const mutation = useCreateCheckout();
  return props.children({
    packages: query.data?.packages ?? [],
    plans: query.data?.plans ?? [],
    isLoading: query.isLoading,
    isError: query.isError || mutation.isError,
    error: query.error ?? mutation.error ?? null,
    checkout: (selection) => {
      mutation.mutate(selection);
    },
    isCheckingOut: mutation.isPending,
    checkoutUrl: mutation.data?.checkout_url ?? null,
  });
}
