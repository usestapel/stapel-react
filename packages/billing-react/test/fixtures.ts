/**
 * Bodies shaped per stapel-billing 0.8.1's `docs/schema.json` — the field
 * names, the snake_case, the nullability and the server-chosen ORDER of
 * `lots[]` (expiring soonest first, non-expiring last) are all as the wire
 * sends them, so no test asserts against a shape the backend could not
 * produce.
 */
import type {
  Catalog,
  CreditHold,
  CreditLot,
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
