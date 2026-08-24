import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { loadStateFromQuery, mapLoad, useActiveSessionReady } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type {
  Catalog,
  CreditDebt,
  CreditHold,
  CreditLot,
  ExpiringCredits,
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
 * The credit structure behind a wallet's balance (stapel-billing 0.8.0), as
 * {@link LoadState}s — so "we could not read the wallet" can never be drawn
 * as "you have no credits expiring".
 *
 * All five come from the SAME `GET /wallet` body, so they always share a
 * status; they are separate fields only because a skin renders them in
 * different places, never because they could disagree.
 */
export interface WalletCredits {
  /**
   * The live lots, in the server's SPEND order — expiring soonest first,
   * non-expiring last. That order is `debit()`'s own (`expires_at ASC NULLS
   * LAST`), so this pair does not re-sort it: any client-side ordering would
   * be drawing a spend order the backend does not use.
   */
  readonly lots: LoadState<readonly CreditLot[]>;
  /** The open reservations (`status=held`) — credits already out of `balance`. */
  readonly holds: LoadState<readonly CreditHold[]>;
  /**
   * The nearest deadline, or `null` when nothing expires. The SERVER picks it
   * (`WalletResponse.expiring_soon`) — the pair does not scan `lots` for a
   * minimum, so a wallet whose lots are paginated or trimmed one day still
   * shows the right date.
   */
  readonly expiringSoon: LoadState<ExpiringCredits | null>;
  /**
   * The open debts (`WalletResponse.debts[]`, stapel-billing 0.11.0), oldest
   * first — the order the server collects them in. A debt is credits owed,
   * NOT a negative balance: `balance` still counts the credits that exist,
   * which is exactly why a screen that shows one without the other is
   * showing a number the next purchase will silently contradict.
   */
  readonly debts: LoadState<readonly CreditDebt[]>;
  /**
   * Total credits owed (`WalletResponse.debt_outstanding`), or 0. The SERVER
   * totals it — the pair does not add up `debts[]`, for the same reason it
   * does not scan `lots` for the nearest deadline.
   */
  readonly debtOutstanding: LoadState<number>;
}

/**
 * The caller's wallet — balance, currency, auto-recharge settings, and (since
 * stapel-billing 0.8.0) the lots, holds and next expiry behind that balance
 * (GET /wallet). Gated on {@link useActiveSessionReady} (owner-diagnosed live
 * incident, 2026-07-17): a top-level "the caller's own …" hook with no
 * natural `enabled` condition of its own is exactly the shape that raced a
 * still-bootstrapping session and read a live one as "expired" — zero
 * manual `enabled` wiring needed at the call site by design.
 *
 * The three {@link WalletCredits} fields are ADDED to the query result rather
 * than replacing it, so every existing `useWallet().data` call site keeps
 * working. `notifyOnChangeProps: "all"` is deliberate and load-bearing: with
 * it unset, react-query hands back a tracked `Proxy`, and spreading a Proxy
 * both marks every property tracked anyway AND trips its `promise` trap,
 * which rejects an internal thenable unless `experimental_prefetchInRender`
 * is on. Asking for "all" up front is the honest version of what flattening
 * the result costs.
 *
 * The wire marks `lots` / `holds` / `expiring_soon` / `debts` /
 * `debt_outstanding` optional, so a host still pointed at an older server
 * reads empty lots and no debt inside a load that SUCCEEDED —
 * "this server does not report lots" and "this wallet has none" are the same
 * sentence to a screen, and neither is "the read failed".
 */
export function useWallet(): UseQueryResult<Wallet, StapelApiError> &
  WalletCredits {
  const api = useBillingApi();
  const sessionReady = useActiveSessionReady();
  // The error generic is spelled out because the result is destructured below
  // rather than returned straight: without a contextual return type to infer
  // from, `useQuery` would default `TError` to `Error` and the spread would
  // lose the localizable `StapelApiError` every call site reads.
  const query = useQuery<Wallet, StapelApiError>({
    queryKey: billingQueryKeys.wallet(),
    queryFn: () => api.getWallet(),
    enabled: sessionReady,
    notifyOnChangeProps: "all",
  });
  const state = loadStateFromQuery(query);
  return {
    ...query,
    lots: mapLoad(state, (wallet) => wallet.lots ?? []),
    holds: mapLoad(state, (wallet) => wallet.holds ?? []),
    expiringSoon: mapLoad(state, (wallet) => wallet.expiring_soon ?? null),
    debts: mapLoad(state, (wallet) => wallet.debts ?? []),
    debtOutstanding: mapLoad(state, (wallet) => wallet.debt_outstanding ?? 0),
  };
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
