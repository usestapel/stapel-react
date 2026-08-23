import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { billingErrorBundleEn } from "./generated/errors.gen.js";

/**
 * billing-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. Add UI keys under the `billing.` namespace as you build flows.
 */
export const BILLING_I18N_KEYS = {
  unknownError: "billing.error.unknown",
  // Wallet (Wallet headless)
  walletLoading: "billing.wallet.loading",
  walletBalance: "billing.wallet.balance",
  walletAutoRecharge: "billing.wallet.auto_recharge",
  walletSave: "billing.wallet.save",
  walletSaving: "billing.wallet.saving",
  walletSaved: "billing.wallet.saved",
  // Wallet lots + holds (stapel-billing 0.8.0; /default WalletPanel)
  walletExpiring: "billing.wallet.expiring",
  walletHeld: "billing.wallet.held",
  walletEmpty: "billing.wallet.empty",
  walletRetry: "billing.wallet.retry",
  walletBuyHeading: "billing.wallet.buy_heading",
  // Pricing table (PricingTable headless)
  pricingPackages: "billing.pricing.packages",
  pricingPlans: "billing.pricing.plans",
  pricingBuy: "billing.pricing.buy",
  pricingSubscribe: "billing.pricing.subscribe",
  pricingCheckingOut: "billing.pricing.checking_out",
  pricingError: "billing.pricing.error",
  pricingRetry: "billing.pricing.retry",
  // Comparing the two ways to buy (/default WalletPanel)
  pricingCredits: "billing.pricing.credits",
  pricingCreditsMonthly: "billing.pricing.credits_monthly",
  pricingPerCredit: "billing.pricing.per_credit",
  pricingPerMonth: "billing.pricing.per_month",
  pricingBestValue: "billing.pricing.best_value",
  pricingPlanSaves: "billing.pricing.plan_saves",
  pricingEmpty: "billing.pricing.empty",
  // Subscription (Subscription headless)
  subActive: "billing.subscription.active",
  subInactive: "billing.subscription.inactive",
  subCancel: "billing.subscription.cancel",
  subCancelling: "billing.subscription.cancelling",
  subManage: "billing.subscription.manage",
} as const;

export type BillingI18nKey =
  (typeof BILLING_I18N_KEYS)[keyof typeof BILLING_I18N_KEYS];

/**
 * English fallback bundle for billing-react UI keys + backend error codes.
 * The generated `billingErrorBundleEn` (from stapel-billing's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 */
export const billingI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...billingErrorBundleEn,

  // billing-react UI
  "billing.error.unknown": "Something went wrong. Please try again.",
  "billing.wallet.loading": "Loading wallet…",
  "billing.wallet.balance": "Balance",
  "billing.wallet.auto_recharge": "Auto-recharge",
  "billing.wallet.save": "Save settings",
  "billing.wallet.saving": "Saving…",
  "billing.wallet.saved": "Settings saved.",
  "billing.wallet.expiring": "{credits} credits expire on {date}",
  "billing.wallet.held": "{credits} credits reserved",
  "billing.wallet.empty": "No credits yet.",
  "billing.wallet.retry": "Try again",
  "billing.wallet.buy_heading": "Two ways to buy",
  "billing.pricing.packages": "Credit packages",
  "billing.pricing.plans": "Plans",
  "billing.pricing.buy": "Buy",
  "billing.pricing.subscribe": "Subscribe",
  "billing.pricing.checking_out": "Redirecting to checkout…",
  "billing.pricing.error": "Couldn't load pricing.",
  "billing.pricing.retry": "Try again",
  "billing.pricing.credits": "{credits} credits",
  "billing.pricing.credits_monthly": "{credits} credits every month",
  "billing.pricing.per_credit": "{price} per credit",
  "billing.pricing.per_month": "{price} / month",
  "billing.pricing.best_value": "Best value",
  "billing.pricing.plan_saves": "Save {percent}% per credit",
  "billing.pricing.empty": "Nothing is on sale right now.",
  "billing.subscription.active": "Active",
  "billing.subscription.inactive": "Inactive",
  "billing.subscription.cancel": "Cancel subscription",
  "billing.subscription.cancelling": "Cancelling…",
  "billing.subscription.manage": "Manage billing",
};

/**
 * Register billing-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`); a later
 * `loadLocale` from stapel-translate can layer localized overrides.
 *
 * MERGE-PRIORITY CONVENTION (pair checklist rule; i18n-shipping.md §3 — every
 * `@stapel/*-react` pair follows it): registration order IS override
 * priority, later wins per key. Within a locale, layers register bottom-up:
 *
 *   1. generated en floor  (`BillingErrorBundleEn` — coverage by construction),
 *   2. the pair's polish / UI copy (this bundle spreads 1 then overrides),
 *   3. the pair's locale bundle from the `./i18n/<locale>` subpath
 *      (e.g. `registerBillingI18nRu` — registers the en floor UNDER the
 *      locale texts so a missing key degrades to English, never a raw key),
 *   4. the HOST's own bundle — always registered LAST, so a host overrides any
 *      pair text without a fork.
 *
 * Dynamic overrides (stapel-translate `loadLocale`) layer on top at runtime.
 */
export function registerBillingI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, billingI18nBundleEn);
}
