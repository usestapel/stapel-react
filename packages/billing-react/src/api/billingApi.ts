import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  Catalog,
  CheckoutRequest,
  CheckoutSession,
  CustomerPortal,
  Subscription,
  TransactionList,
  Wallet,
  WalletUpdate,
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors auth-react): the
 * simplest SPA rule is to always send `X-Requested-With: XMLHttpRequest` on
 * mutating requests. Header-token clients ignore it; it is harmless there, so
 * every mutation carries it.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/**
 * The pair's typed operation surface — one method per stapel-billing endpoint a
 * signed-in browser client may call, bound to the injected {@link StapelClient}
 * (the per-module override seam of frontend-standard §7.2). Paths are relative
 * to the runtime's `baseUrl` (e.g. `/billing/api/`).
 *
 * The service-to-service `POST /internal/debit` (credit debit from another
 * backend) and `POST /webhooks/stripe` (Stripe → server) are intentionally
 * absent — they are machine-to-machine surfaces, not part of the signed-in
 * billing UI this pair drives.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2 (task `core-typed-ops`); until then they are hand-authored here (the ONE
 * legal home of path strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface BillingApi {
  readonly client: StapelClient;

  /** The caller's wallet — balance, currency, auto-recharge settings. */
  getWallet(): Promise<Wallet>;
  /** Partially update the caller's auto-recharge / alert settings. */
  updateWallet(patch: WalletUpdate): Promise<Wallet>;
  /** A cursor page of the caller's credit-ledger entries (newest first). */
  listTransactions(cursor?: string): Promise<TransactionList>;
  /** The purchasable catalogue — one-time packages + subscription plans. */
  getCatalog(): Promise<Catalog>;
  /** Start a Stripe Checkout session — returns the hosted URL to redirect to. */
  createCheckout(body: CheckoutRequest): Promise<CheckoutSession>;
  /** The caller's current subscription. */
  getSubscription(): Promise<Subscription>;
  /** Cancel the caller's subscription — returns the updated subscription. */
  cancelSubscription(): Promise<Subscription>;
  /** The Stripe customer-portal URL to redirect to (manage payment methods). */
  getCustomerPortal(): Promise<CustomerPortal>;
}

export function createBillingApi(client: StapelClient): BillingApi {
  return {
    client,

    getWallet: () => client.get("/wallet"),

    updateWallet: (patch) =>
      client.patch("/wallet", patch satisfies WalletUpdate, mutating()),

    listTransactions: (cursor) =>
      client.get(
        cursor
          ? `/wallet/transactions?cursor=${encodeURIComponent(cursor)}`
          : "/wallet/transactions"
      ),

    getCatalog: () => client.get("/products"),

    createCheckout: (body) =>
      client.post("/checkout", body satisfies CheckoutRequest, mutating()),

    getSubscription: () => client.get("/subscription"),

    cancelSubscription: () =>
      client.post("/subscription/cancel", undefined, mutating()),

    getCustomerPortal: () => client.get("/portal"),
  };
}
