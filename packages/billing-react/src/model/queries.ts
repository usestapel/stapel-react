import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
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

/** The caller's wallet — balance, currency, auto-recharge settings (GET /wallet). */
export function useWallet(): UseQueryResult<Wallet, StapelApiError> {
  const api = useBillingApi();
  return useQuery({
    queryKey: billingQueryKeys.wallet(),
    queryFn: () => api.getWallet(),
  });
}

/**
 * A cursor page of the caller's credit-ledger entries (GET /wallet/transactions).
 * Pass a `cursor` from a previous page's `next_cursor` to page forward; each
 * page is cached under its own key.
 */
export function useTransactions(
  cursor?: string
): UseQueryResult<TransactionList, StapelApiError> {
  const api = useBillingApi();
  return useQuery({
    queryKey: billingQueryKeys.transactions(cursor),
    queryFn: () => api.listTransactions(cursor),
  });
}

/** The purchasable catalogue — packages + plans (GET /products). */
export function useCatalog(): UseQueryResult<Catalog, StapelApiError> {
  const api = useBillingApi();
  return useQuery({
    queryKey: billingQueryKeys.catalog(),
    queryFn: () => api.getCatalog(),
  });
}

/** The caller's current subscription (GET /subscription). */
export function useSubscription(): UseQueryResult<
  Subscription,
  StapelApiError
> {
  const api = useBillingApi();
  return useQuery({
    queryKey: billingQueryKeys.subscription(),
    queryFn: () => api.getSubscription(),
  });
}
