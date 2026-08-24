/**
 * Wire bodies for the skin demos, shaped exactly as stapel-billing 0.11.0's
 * `docs/schema.json` declares them — snake_case, the server's own lot ORDER
 * (expiring soonest first, non-expiring last), `expiring_soon` picked by the
 * server, `debt_outstanding` totalled by it. A demo that hand-shaped a value
 * the component would otherwise derive would be photographing something the
 * backend cannot produce.
 *
 * Handler maps live here too, and they are MODULE-LEVEL constants on purpose:
 * `BillingDemoHarness` memoizes its runtime on the `handlers` identity, so an
 * inline object literal would rebuild the mock fetch on every render.
 *
 * Route order matters — `mockFetch` matches the first suffix the URL
 * CONTAINS, so `/wallet/transactions` must be declared before `/wallet`.
 */
import type { DemoHandlers } from "./_harness.js";

/** A subscription lot: dies at the period end. */
const SUBSCRIPTION_LOT = {
  id: "0f6c1a5e-0000-4000-8000-000000000001",
  credits_remaining: 400,
  credits_initial: 1000,
  source: "subscription",
  expires_at: "2026-09-01T00:00:00Z",
  created_at: "2026-08-01T00:00:00Z",
};

/** A purchased lot: bought credits do not expire. */
const PURCHASE_LOT = {
  id: "0f6c1a5e-0000-4000-8000-000000000002",
  credits_remaining: 840,
  credits_initial: 2000,
  source: "purchase",
  expires_at: null,
  created_at: "2026-07-11T00:00:00Z",
};

const OPEN_HOLD = {
  id: "0f6c1a5e-0000-4000-8000-000000000003",
  credits: 60,
  type: "transcription_charge",
  description: "transcription in flight",
  status: "held",
  expires_at: "2026-09-23T12:00:00Z",
  created_at: "2026-08-23T11:00:00Z",
};

/**
 * The two pools, side by side: 840 bought credits that survive anything, and
 * 400 that die on the 1st. The whole point of the wallet screen is that this
 * is NOT "1,240".
 */
export const DEMO_WALLET = {
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
  debts: [],
  debt_outstanding: 0,
};

/** The same wallet owing credits — work served without cover, plus a
 * clawback. The next credits bought are collected against these first. */
export const DEMO_WALLET_IN_DEBT = {
  ...DEMO_WALLET,
  balance: 0,
  lots: [],
  holds: [],
  expiring_soon: null,
  debts: [
    {
      id: "0f6c1a5e-0000-4000-8000-000000000010",
      credits_outstanding: 120,
      credits_initial: 200,
      reason: "partial_debit",
      type: "transcription_charge",
      description: "90-minute interview",
      created_at: "2026-08-19T09:00:00Z",
    },
    {
      id: "0f6c1a5e-0000-4000-8000-000000000011",
      credits_outstanding: 60,
      credits_initial: 60,
      reason: "clawback",
      type: "refund",
      description: null,
      created_at: "2026-08-21T16:30:00Z",
    },
  ],
  debt_outstanding: 180,
};

/** Nothing bought, nothing granted, nothing reserved, nothing owed. */
export const DEMO_WALLET_EMPTY = {
  ...DEMO_WALLET,
  balance: 0,
  lots: [],
  holds: [],
  expiring_soon: null,
  debts: [],
  debt_outstanding: 0,
};

/** Auto-recharge already on, pointed at a package the catalogue sells. */
export const DEMO_WALLET_AUTO_ON = {
  ...DEMO_WALLET,
  auto_recharge_enabled: true,
  auto_recharge_package: "credits-2000",
  updated_at: "2026-08-24T08:00:00Z",
};

/**
 * The shop. Priced so the plan really is cheaper per credit — $18.00 / 2000 =
 * $0.009 against $29.00 / 5000 = $0.0058, a 36% saving — which is the claim
 * the comparison makes out loud.
 */
export const DEMO_CATALOG = {
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

/** A shop with no one-time packages — auto-recharge has nothing to buy. */
export const DEMO_CATALOG_PLANS_ONLY = {
  packages: [],
  plans: DEMO_CATALOG.plans,
};

/** The free row stapel-billing auto-creates for every caller: no paid plan. */
export const DEMO_SUBSCRIPTION_FREE = {
  plan: "free",
  status: "active",
  stripe_subscription_id: null,
  current_period_start: null,
  current_period_end: null,
  cancelled_at: null,
};

/** A live paid subscription with its next renewal date. */
export const DEMO_SUBSCRIPTION_ACTIVE = {
  plan: "team",
  status: "active",
  stripe_subscription_id: "sub_demo",
  current_period_start: "2026-08-01T00:00:00Z",
  current_period_end: "2026-09-01T00:00:00Z",
  cancelled_at: null,
};

/** The payment bounced: the credits stop unless the card is fixed. */
export const DEMO_SUBSCRIPTION_PAST_DUE = {
  ...DEMO_SUBSCRIPTION_ACTIVE,
  status: "past_due",
};

/** Cancelled, and running out at the period end — the one state where
 * "Runs until" is the true sentence and cancelling again is not an action. */
export const DEMO_SUBSCRIPTION_CANCELLED = {
  ...DEMO_SUBSCRIPTION_ACTIVE,
  status: "cancelled",
  cancelled_at: "2026-08-20T10:00:00Z",
};

/** A ledger page carrying every shape a row can take: a purchase, two
 * charges, the plan's monthly grant, and credits that died of old age. */
export const DEMO_TRANSACTIONS = {
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
    {
      id: "1a000000-0000-4000-8000-000000000003",
      type: "subscription_bonus",
      amount_cents: null,
      credits_delta: 1000,
      balance_after: 960,
      description: null,
      metadata: {},
      created_at: "2026-08-01T00:00:00Z",
    },
    {
      id: "1a000000-0000-4000-8000-000000000004",
      type: "expiration",
      amount_cents: null,
      credits_delta: -40,
      balance_after: -40,
      description: null,
      metadata: {},
      created_at: "2026-07-31T23:59:00Z",
    },
  ],
  next_cursor: "cursor-page-2",
  has_more: true,
};

/** An answered ledger with nothing in it — the empty state, reachable only
 * from a read that succeeded. */
export const DEMO_TRANSACTIONS_EMPTY = {
  transactions: [],
  next_cursor: null,
  has_more: false,
};

const CHECKOUT = {
  checkout_url: "https://checkout.stripe.test/session/cs_demo",
  session_id: "cs_demo",
};

const PORTAL = { portal_url: "https://billing.stripe.test/p/session/demo" };

/** The whole billing page, wired: two pools, a live plan, the shop, the
 * ledger. */
export const WALLET_PANEL_HANDLERS: DemoHandlers = {
  "/wallet/transactions": DEMO_TRANSACTIONS,
  "/wallet": DEMO_WALLET,
  "/products": DEMO_CATALOG,
  "/subscription": DEMO_SUBSCRIPTION_ACTIVE,
  "/checkout": CHECKOUT,
  "/portal": PORTAL,
};

/** The same page for a wallet that owes credits. */
export const WALLET_PANEL_DEBT_HANDLERS: DemoHandlers = {
  ...WALLET_PANEL_HANDLERS,
  "/wallet": DEMO_WALLET_IN_DEBT,
};

/** A brand-new account: nothing held, nothing subscribed, nothing spent. */
export const WALLET_PANEL_EMPTY_HANDLERS: DemoHandlers = {
  "/wallet/transactions": DEMO_TRANSACTIONS_EMPTY,
  "/wallet": DEMO_WALLET_EMPTY,
  "/products": DEMO_CATALOG,
  "/subscription": DEMO_SUBSCRIPTION_FREE,
  "/checkout": CHECKOUT,
  "/portal": PORTAL,
};

/** The catalogue read is down — the shop must say so, never "nothing on
 * sale". */
export const WALLET_PANEL_SHOP_DOWN_HANDLERS: DemoHandlers = {
  ...WALLET_PANEL_HANDLERS,
  "/products": [503, { localizable_error: "error.503.service_unavailable" }],
};

export const SHOP_HANDLERS: DemoHandlers = {
  "/products": DEMO_CATALOG,
  "/subscription": DEMO_SUBSCRIPTION_FREE,
  "/checkout": CHECKOUT,
};

/** The caller already holds `team` — the plan card must not offer it. */
export const SHOP_SUBSCRIBED_HANDLERS: DemoHandlers = {
  ...SHOP_HANDLERS,
  "/subscription": DEMO_SUBSCRIPTION_ACTIVE,
};

export const SUBSCRIPTION_ACTIVE_HANDLERS: DemoHandlers = {
  "/subscription": DEMO_SUBSCRIPTION_ACTIVE,
  "/products": DEMO_CATALOG,
  "/portal": PORTAL,
};

export const SUBSCRIPTION_FREE_HANDLERS: DemoHandlers = {
  "/subscription": DEMO_SUBSCRIPTION_FREE,
  "/products": DEMO_CATALOG,
  "/portal": PORTAL,
};

export const SUBSCRIPTION_PAST_DUE_HANDLERS: DemoHandlers = {
  "/subscription": DEMO_SUBSCRIPTION_PAST_DUE,
  "/products": DEMO_CATALOG,
  "/portal": PORTAL,
};

export const SUBSCRIPTION_CANCELLED_HANDLERS: DemoHandlers = {
  "/subscription": DEMO_SUBSCRIPTION_CANCELLED,
  "/products": DEMO_CATALOG,
  "/portal": PORTAL,
};

export const SETTINGS_HANDLERS: DemoHandlers = {
  "/wallet": DEMO_WALLET_AUTO_ON,
  "/products": DEMO_CATALOG,
};

export const SETTINGS_NO_PACKAGES_HANDLERS: DemoHandlers = {
  "/wallet": DEMO_WALLET,
  "/products": DEMO_CATALOG_PLANS_ONLY,
};

export const LEDGER_HANDLERS: DemoHandlers = {
  "/wallet/transactions": DEMO_TRANSACTIONS,
};

export const LEDGER_EMPTY_HANDLERS: DemoHandlers = {
  "/wallet/transactions": DEMO_TRANSACTIONS_EMPTY,
};
