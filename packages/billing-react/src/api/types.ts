/**
 * Wire types for the stapel-billing HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-billing's OWN `docs/schema.json` — the
 * §17-native per-module contract, not the unified monolith). Alias the schemas this pair uses under local
 * names here; do NOT write parallel response bodies. Where drf-spectacular +
 * openapi-typescript under-describe the runtime, apply a small documented
 * correction (see auth-react `api/types.ts` for the three canonical patterns).
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── aliases (the stapel-billing schemas this pair uses) ───────────────────────

/** GET /wallet 200 body — the caller's wallet: balance, currency, auto-recharge. */
export type Wallet = Schemas["WalletResponse"];
/** PATCH /wallet request body — a partial auto-recharge / alert settings update. */
export type WalletUpdate = Schemas["PatchedWalletUpdateRequest"];
/** GET /wallet/transactions 200 body — a cursor page of ledger entries. */
export type TransactionList = Schemas["TransactionListResponse"];
/** One credit-ledger entry (a row of {@link TransactionList}). */
export type Transaction = Schemas["TransactionResponse"];
/** GET /products 200 body — the purchasable catalogue (packages + plans). */
export type Catalog = Schemas["CatalogResponse"];
/** One one-time credit package in the {@link Catalog}. */
export type CreditPackage = Schemas["PackageResponse"];
/** One recurring subscription plan in the {@link Catalog}. */
export type Plan = Schemas["PlanResponse"];
/** POST /checkout request body — start a Stripe Checkout for a package OR plan. */
export type CheckoutRequest = Schemas["CheckoutRequest"];
/** POST /checkout 200 body — the hosted Stripe Checkout URL to redirect to. */
export type CheckoutSession = Schemas["CheckoutResponse"];
/** GET /portal 200 body — the Stripe customer-portal URL to redirect to. */
export type CustomerPortal = Schemas["CustomerPortalResponse"];
/** GET /subscription (and POST /subscription/cancel) 200 body. */
export type Subscription = Schemas["SubscriptionResponse"];

// ── documented corrections (drf-spectacular under-describes) ──────────────────

/**
 * The subscription lifecycle status. The generated schema types `status` as a
 * bare `string`, but the backend (`models.SubscriptionStatus`, a Django
 * `TextChoices`) constrains it to exactly these values. Narrowing here gives
 * call sites a checked union — the one documented correction this pair needs.
 */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "incomplete";
