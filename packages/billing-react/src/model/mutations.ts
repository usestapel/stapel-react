import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  CheckoutRequest,
  CheckoutSession,
  CustomerPortal,
  Subscription,
  Wallet,
  WalletUpdate,
} from "../api/types.js";
import { useBillingApi } from "./context.js";
import { billingQueryKeys } from "./queryKeys.js";

/**
 * Write hooks (frontend-standard §2 — "мутации с инвалидацией"). Each mutation
 * invalidates exactly the server state it can move. Payments are server-truth,
 * so NONE of these are optimistic (frontend-core-architecture §2.6: optimistic
 * is for local-echo UX, never for flows with server truth like billing).
 *
 * Options are built as typed `UseMutationOptions` objects (not call-site
 * generics) so `void` stays in type-reference position, which
 * `no-invalid-void-type` permits.
 */

/** Update the caller's auto-recharge / alert settings — refreshes the wallet. */
export function useUpdateWallet(): UseMutationResult<
  Wallet,
  StapelApiError,
  WalletUpdate
> {
  const api = useBillingApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<Wallet, StapelApiError, WalletUpdate> = {
    mutationFn: (patch) => api.updateWallet(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(billingQueryKeys.wallet(), updated);
    },
  };
  return useMutation(options);
}

/**
 * Start a Stripe Checkout session for a package OR plan (server truth — no
 * optimism). Resolves to the hosted `checkout_url`; the caller redirects the
 * browser there. A bad package/plan slug surfaces as a localizable
 * `StapelApiError` (`error.400.invalid_package` / `error.400.invalid_plan`).
 */
export function useCreateCheckout(): UseMutationResult<
  CheckoutSession,
  StapelApiError,
  CheckoutRequest
> {
  const api = useBillingApi();
  const options: UseMutationOptions<
    CheckoutSession,
    StapelApiError,
    CheckoutRequest
  > = {
    mutationFn: (body) => api.createCheckout(body),
  };
  return useMutation(options);
}

/** Cancel the caller's subscription — refreshes the subscription query. */
export function useCancelSubscription(): UseMutationResult<
  Subscription,
  StapelApiError,
  void
> {
  const api = useBillingApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<Subscription, StapelApiError, void> = {
    mutationFn: () => api.cancelSubscription(),
    onSuccess: (updated) => {
      queryClient.setQueryData(billingQueryKeys.subscription(), updated);
    },
  };
  return useMutation(options);
}

/**
 * Request a Stripe customer-portal link on demand. Modeled as a mutation (an
 * imperative "give me a fresh URL now, then redirect") even though the endpoint
 * is a GET — its result is a one-shot redirect target, never cached page state.
 */
export function useOpenCustomerPortal(): UseMutationResult<
  CustomerPortal,
  StapelApiError,
  void
> {
  const api = useBillingApi();
  const options: UseMutationOptions<CustomerPortal, StapelApiError, void> = {
    mutationFn: () => api.getCustomerPortal(),
  };
  return useMutation(options);
}
