/**
 * Bodies shaped per stapel-billing 0.8.1's `docs/schema.json` — the field
 * names, the snake_case, the nullability and the server-chosen ORDER of
 * `lots[]` (expiring soonest first, non-expiring last) are all as the wire
 * sends them, so no test asserts against a shape the backend could not
 * produce.
 */
import type {
  Catalog,
  CreditDebt,
  CreditHold,
  CreditLot,
  Subscription,
  TransactionList,
  Wallet,
} from "../src/api/types.js";

/** A subscription lot — the kind that dies at the period end. */
export const SUBSCRIPTION_LOT: CreditLot = {
  id: "0f6c1a5e-0000-4000-8000-000000000001",
  credits_remaining: 400,
  credits_initial: 1000,
  source: "subscription",
  expires_at: "2026-09-01T00:00:00Z",
  created_at: "2026-08-01T00:00:00Z",
};

/** A purchased lot — bought credits do not expire. */
export const PURCHASE_LOT: CreditLot = {
  id: "0f6c1a5e-0000-4000-8000-000000000002",
  credits_remaining: 840,
  credits_initial: 2000,
  source: "purchase",
  expires_at: null,
  created_at: "2026-07-11T00:00:00Z",
};

/** An open reservation: 60 credits already out of `balance`. */
export const OPEN_HOLD: CreditHold = {
  id: "0f6c1a5e-0000-4000-8000-000000000003",
  credits: 60,
  type: "usage",
  description: "transcription in flight",
  status: "held",
  expires_at: "2026-08-23T12:00:00Z",
  created_at: "2026-08-23T11:00:00Z",
};

/**
 * The wallet a paying caller has: two lots in the server's spend order, one
 * open hold, and a deadline the SERVER picked (it names the subscription lot,
 * which is the one that expires).
 */
export const WALLET: Wallet = {
  user_id: "b3f1c0de-0000-4000-8000-000000000001",
  balance: 1240,
  currency: "USD",
  auto_recharge_enabled: false,
  auto_recharge_threshold: 100,
  auto_recharge_package: null,
  low_balance_alert: 50,
  updated_at: "2026-08-23T11:00:00Z",
  lots: [SUBSCRIPTION_LOT, PURCHASE_LOT],
  holds: [OPEN_HOLD],
  expiring_soon: { credits: 400, expires_at: "2026-09-01T00:00:00Z" },
};

/** A brand-new wallet: nothing bought, nothing granted, nothing reserved. */
export const EMPTY_WALLET: Wallet = {
  ...WALLET,
  balance: 0,
  updated_at: "2026-08-23T11:00:00Z",
  lots: [],
  holds: [],
  expiring_soon: null,
};

/**
 * What a host still pointed at a 0.7.x server receives: the three keys are
 * optional in the schema, so their ABSENCE is a valid body — not a broken
 * contract, and not a failed read.
 */
export const WALLET_WITHOUT_LOTS: Wallet = {
  user_id: WALLET.user_id,
  balance: 1240,
  currency: "USD",
  auto_recharge_enabled: false,
  auto_recharge_threshold: 100,
  auto_recharge_package: null,
  low_balance_alert: 50,
  updated_at: "2026-08-23T11:00:00Z",
};

/**
 * The shop. Priced so the plan really is cheaper per credit — $18.00 / 2000 =
 * $0.009 against $29.00 / 5000 = $0.0058, a 36% saving — which is the claim
 * the panel makes out loud and the test checks.
 */
export const CATALOG: Catalog = {
  packages: [
    {
      slug: "credits-2000",
      name: "2000 credits",
      credits: 2000,
      price_cents: 1800,
      currency: "USD",
    },
    {
      slug: "credits-500",
      name: "500 credits",
      credits: 500,
      price_cents: 500,
      currency: "USD",
    },
  ],
  plans: [
    {
      slug: "team",
      name: "Team",
      price_cents: 2900,
      currency: "USD",
      monthly_credits_included: 5000,
      storage_limit_bytes: 107374182400,
      description: "5000 credits every month",
    },
  ],
};

/**
 * A debt the wallet carries (stapel-billing 0.11.0): work served without
 * cover. `credits_outstanding < credits_initial` because part of it was
 * already collected from credits that arrived since.
 */
export const PARTIAL_DEBIT_DEBT: CreditDebt = {
  id: "0f6c1a5e-0000-4000-8000-000000000010",
  credits_outstanding: 120,
  credits_initial: 200,
  reason: "partial_debit",
  type: "transcription_charge",
  description: "90-minute interview",
  created_at: "2026-08-19T09:00:00Z",
};

/** The other direction in time: money taken back after the credits were
 * spent, so there was nothing left to claw back. */
export const CLAWBACK_DEBT: CreditDebt = {
  id: "0f6c1a5e-0000-4000-8000-000000000011",
  credits_outstanding: 60,
  credits_initial: 60,
  reason: "clawback",
  type: "refund",
  description: null,
  created_at: "2026-08-21T16:30:00Z",
};

/**
 * A wallet that OWES credits. The balance is a real balance — a debt is not a
 * negative balance — and `debt_outstanding` is the server's own total, which
 * is deliberately NOT the sum a client would compute if it were wrong.
 */
export const WALLET_IN_DEBT: Wallet = {
  ...WALLET,
  debts: [PARTIAL_DEBIT_DEBT, CLAWBACK_DEBT],
  debt_outstanding: 180,
};

/** The free row stapel-billing auto-creates for every caller: no paid plan,
 * and never a 404. */
export const SUBSCRIPTION_FREE: Subscription = {
  plan: "free",
  status: "active",
  stripe_subscription_id: null,
  current_period_start: null,
  current_period_end: null,
  cancelled_at: null,
};

/** A live paid subscription on the plan the CATALOG also sells. */
export const SUBSCRIPTION_ACTIVE: Subscription = {
  plan: "team",
  status: "active",
  stripe_subscription_id: "sub_test",
  current_period_start: "2026-08-01T00:00:00Z",
  current_period_end: "2026-09-01T00:00:00Z",
  cancelled_at: null,
};

/** The payment bounced. */
export const SUBSCRIPTION_PAST_DUE: Subscription = {
  ...SUBSCRIPTION_ACTIVE,
  status: "past_due",
};

/** Cancelled and running out — cancelling again is not an action. */
export const SUBSCRIPTION_CANCELLED: Subscription = {
  ...SUBSCRIPTION_ACTIVE,
  status: "cancelled",
  cancelled_at: "2026-08-20T10:00:00Z",
};

/** A ledger page with both directions and a cursor to the next one. */
export const TRANSACTIONS: TransactionList = {
  transactions: [
    {
      id: "1a000000-0000-4000-8000-000000000001",
      type: "credit_purchase",
      amount_cents: 1800,
      credits_delta: 2000,
      balance_after: 2840,
      description: "2000 credits",
      metadata: {},
      created_at: "2026-08-23T09:12:00Z",
    },
    {
      id: "1a000000-0000-4000-8000-000000000002",
      type: "transcription_charge",
      amount_cents: null,
      credits_delta: -120,
      balance_after: 840,
      description: "90-minute interview",
      metadata: {},
      created_at: "2026-08-22T17:40:00Z",
    },
  ],
  next_cursor: "cursor-page-2",
  has_more: true,
};

/** The second page, and the end of the ledger. */
export const TRANSACTIONS_PAGE_2: TransactionList = {
  transactions: [
    {
      id: "1a000000-0000-4000-8000-000000000003",
      type: "expiration",
      amount_cents: null,
      credits_delta: -40,
      balance_after: 800,
      description: null,
      metadata: {},
      created_at: "2026-07-31T23:59:00Z",
    },
  ],
  next_cursor: null,
  has_more: false,
};

/** An answered ledger with nothing in it. */
export const TRANSACTIONS_EMPTY: TransactionList = {
  transactions: [],
  next_cursor: null,
  has_more: false,
};
