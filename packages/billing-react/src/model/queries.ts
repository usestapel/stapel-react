import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  Catalog,
  Subscription,
  TransactionList,
  Wallet,
} from "../api/types.js";
import { useBillingApi } from "./context.js";
import { billingQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the billing API. Staleness follows core's query defaults;
 * override per call site via a page that needs fresher data. Keys are
 * namespaced (see `billingQueryKeys`).
 */

/**
 * The caller's wallet — balance, currency, auto-recharge settings (GET
 * /wallet). Gated on {@link useActiveSessionReady} (owner-diagnosed live
 * incident, 2026-07-17): a top-level "the caller's own …" hook with no
 * natural `enabled` condition of its own is exactly the shape that raced a
 * still-bootstrapping session and read a live one as "expired" — zero
 * manual `enabled` wiring needed at the call site by design.
 */
export function useWallet(): UseQueryResult<Wallet, StapelApiError> {
  const api = useBillingApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: billingQueryKeys.wallet(),
    queryFn: () => api.getWallet(),
    enabled: sessionReady,
  });
}

/**
 * A cursor page of the caller's credit-ledger entries (GET /wallet/transactions).
 * Pass a `cursor` from a previous page's `next_cursor` to page forward; each
 * page is cached under its own key. Gated on session readiness — see
 * {@link useWallet}.
 */
export function useTransactions(
  cursor?: string
): UseQueryResult<TransactionList, StapelApiError> {
  const api = useBillingApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: billingQueryKeys.transactions(cursor),
    queryFn: () => api.listTransactions(cursor),
    enabled: sessionReady,
  });
}

/**
 * The purchasable catalogue — packages + plans (GET /products). Deliberately
 * NOT session-gated: this is a public pricing/plans list (a signed-out
 * visitor on a pricing page needs it too), unlike the caller-scoped hooks
 * around it.
 */
export function useCatalog(): UseQueryResult<Catalog, StapelApiError> {
  const api = useBillingApi();
  return useQuery({
    queryKey: billingQueryKeys.catalog(),
    queryFn: () => api.getCatalog(),
  });
}

/** The caller's current subscription (GET /subscription). Gated on session
 * readiness — see {@link useWallet}. */
export function useSubscription(): UseQueryResult<
  Subscription,
  StapelApiError
> {
  const api = useBillingApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: billingQueryKeys.subscription(),
    queryFn: () => api.getSubscription(),
    enabled: sessionReady,
  });
}
