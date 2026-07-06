/**
 * `@stapel/billing-react` — the headless React flow pair for stapel-billing
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createBillingApi } from "./api/billingApi.js";
export type { BillingApi } from "./api/billingApi.js";
export type { Schemas } from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { BILLING_FLOWS, flowEndpoints } from "./flows/generated/flows.gen.js";
export type {
  BillingFlowId,
  BillingFlowSpec,
  FlowEndpoint,
} from "./flows/generated/flows.gen.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createBillingRuntime } from "./model/runtime.js";
export type {
  BillingRuntime,
  CreateBillingRuntimeOptions,
} from "./model/runtime.js";
export {
  BillingRuntimeContext,
  useBillingRuntime,
  useBillingApi,
  useBillingAnalytics,
} from "./model/context.js";
export { billingQueryKeys } from "./model/queryKeys.js";

// ── model (read hooks) ───────────────────────────────────────────────────────
export {
  useWallet,
  useTransactions,
  useCatalog,
  useSubscription,
} from "./model/queries.js";

// ── model (write hooks) ──────────────────────────────────────────────────────
export {
  useUpdateWallet,
  useCreateCheckout,
  useCancelSubscription,
  useOpenCustomerPortal,
} from "./model/mutations.js";

// ── api (wire type aliases) ──────────────────────────────────────────────────
export type {
  Wallet as WalletData,
  WalletUpdate,
  TransactionList,
  Transaction,
  Catalog,
  CreditPackage,
  Plan,
  CheckoutRequest,
  CheckoutSession,
  CustomerPortal,
  Subscription as SubscriptionData,
  SubscriptionStatus,
} from "./api/types.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { BillingProvider } from "./headless/BillingProvider.js";
export { Wallet } from "./headless/Wallet.js";
export type { WalletBag } from "./headless/Wallet.js";
export { PricingTable } from "./headless/PricingTable.js";
export type {
  PricingTableBag,
  CheckoutSelection,
} from "./headless/PricingTable.js";
export { Subscription } from "./headless/Subscription.js";
export type { SubscriptionBag } from "./headless/Subscription.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  BILLING_I18N_KEYS,
  billingI18nBundleEn,
  registerBillingI18n,
} from "./i18n/keys.js";
export type { BillingI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  BILLING_ERRORS,
  BILLING_ERROR_CODES,
  billingErrorBundleEn,
  explainBillingError,
} from "./i18n/errorsMap.js";
export type {
  BillingErrorCode,
  BillingErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
