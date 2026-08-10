import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
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

/**
 * The catalogue a SUCCEEDED read carries — both lists, normalized. The wire
 * marks each array optional; inside a load that succeeded an absent key
 * honestly means "the shop sells none of those", which is the empty arm.
 */
export interface PricingCatalog {
  /** One-time credit packages. */
  readonly packages: readonly CreditPackage[];
  /** Recurring subscription plans. */
  readonly plans: readonly Plan[];
}

/** Render-prop bag for {@link PricingTable}. */
export interface PricingTableBag {
  /**
   * The catalogue read. ONE state for BOTH lists, deliberately: packages and
   * plans arrive in the same `GET /products` body, so two states could never
   * hold different statuses — splitting them would only invite a skin to
   * render two spinners and two alerts for one request, and to branch on a
   * "plans failed, packages loaded" case the wire cannot produce. Project one
   * list where you render it:
   * `matchList(mapLoad(state, (c) => c.packages), { … })`.
   *
   * A pricing table that says "no plans available" because the pricing
   * endpoint is down is a shop telling customers it sells nothing; only the
   * `empty` arm of `matchList` may say that, and it is reachable only from a
   * read that actually answered.
   */
  readonly state: LoadState<PricingCatalog>;
  /** Start Stripe Checkout for the given package or plan. */
  checkout(selection: CheckoutSelection): void;
  /** A checkout call is in flight (redirect pending). */
  readonly isCheckingOut: boolean;
  /** The checkout WRITE failed (the read's failure lives in `state`). */
  readonly isError: boolean;
  /**
   * The checkout error, when `isError` (a localizable `StapelApiError`), else
   * null. A bad slug surfaces here as `error.400.invalid_package` /
   * `invalid_plan`.
   */
  readonly error: StapelApiError | null;
  /**
   * The hosted Stripe Checkout URL from the last successful `checkout`, else
   * null. The host redirects the browser here (`window.location.assign`).
   */
  readonly checkoutUrl: string | null;
  /** Re-read the catalogue — the retry affordance for the failed arm. */
  refetch(): void;
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
 *   {({ state, checkout, checkoutUrl }) => ( ... )}
 * </PricingTable>
 * ```
 */
export function PricingTable(props: {
  children: (bag: PricingTableBag) => ReactNode;
}): ReactNode {
  const query = useCatalog();
  const mutation = useCreateCheckout();
  const state = mapLoad(
    loadStateFromQuery(query),
    (catalog): PricingCatalog => ({
      packages: catalog.packages ?? [],
      plans: catalog.plans ?? [],
    })
  );
  return props.children({
    state,
    checkout: (selection) => {
      mutation.mutate(selection);
    },
    isCheckingOut: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error ?? null,
    checkoutUrl: mutation.data?.checkout_url ?? null,
    refetch: () => {
      void query.refetch();
    },
  });
}
