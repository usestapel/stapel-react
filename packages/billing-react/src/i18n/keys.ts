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
  // Wallet settings form (/default WalletSettings)
  walletSettingsHeading: "billing.wallet.settings_heading",
  walletAutoRechargeHint: "billing.wallet.auto_recharge_hint",
  walletThreshold: "billing.wallet.threshold",
  walletPackage: "billing.wallet.package",
  walletPackagePlaceholder: "billing.wallet.package_placeholder",
  walletPackageNone: "billing.wallet.package_none",
  walletLowBalanceAlert: "billing.wallet.low_balance_alert",
  walletSettingsNoPackages: "billing.wallet.settings_no_packages",
  walletSettingsNeedsPackage: "billing.wallet.settings_needs_package",
  // Wallet lots + holds (stapel-billing 0.8.0; /default WalletPanel)
  walletHeading: "billing.wallet.heading",
  walletSectionsLabel: "billing.wallet.sections_label",
  walletExpiring: "billing.wallet.expiring",
  walletExpiringRelative: "billing.wallet.expiring_relative",
  walletHeld: "billing.wallet.held",
  walletEmpty: "billing.wallet.empty",
  walletEmptyHint: "billing.wallet.empty_hint",
  walletRetry: "billing.wallet.retry",
  walletBuyHeading: "billing.wallet.buy_heading",
  /** PLURAL FAMILY (`tPlural`) — see the note above the bundle. */
  walletCredits: "billing.wallet.credits",
  // The two credit pools (owner verdict 2026-08-23) — never one sum
  walletPoolsHeading: "billing.wallet.pools_heading",
  /** PLURAL FAMILY. */
  walletPoolPerpetual: "billing.wallet.pool.perpetual",
  walletPoolPerpetualHint: "billing.wallet.pool.perpetual_hint",
  walletPoolPerpetualNone: "billing.wallet.pool.perpetual_none",
  /** PLURAL FAMILY. */
  walletPoolExpiring: "billing.wallet.pool.expiring",
  walletPoolExpiringHint: "billing.wallet.pool.expiring_hint",
  walletPoolExpiringNone: "billing.wallet.pool.expiring_none",
  // Debt (stapel-billing 0.11.0)
  walletDebtHeading: "billing.wallet.debt.heading",
  /** PLURAL FAMILY. */
  walletDebtTotal: "billing.wallet.debt.total",
  walletDebtExplain: "billing.wallet.debt.explain",
  walletDebtRow: "billing.wallet.debt.row",
  walletDebtReasonPartialDebit: "billing.wallet.debt.reason.partial_debit",
  walletDebtReasonClawback: "billing.wallet.debt.reason.clawback",
  walletDebtReasonOther: "billing.wallet.debt.reason.other",
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
  pricingCurrentPlan: "billing.pricing.current_plan",
  pricingBlockedCurrentPlan: "billing.pricing.blocked_current_plan",
  /** PLURAL FAMILY. */
  pricingDebtNote: "billing.pricing.debt_note",
  /** PLURAL FAMILY. */
  pricingSpendableAfterDebt: "billing.pricing.spendable_after_debt",
  // Subscription (Subscription headless)
  subActive: "billing.subscription.active",
  subInactive: "billing.subscription.inactive",
  subCancel: "billing.subscription.cancel",
  subCancelling: "billing.subscription.cancelling",
  subManage: "billing.subscription.manage",
  subHeading: "billing.subscription.heading",
  subPlanLabel: "billing.subscription.plan_label",
  subNone: "billing.subscription.none",
  subNoneHint: "billing.subscription.none_hint",
  subRenews: "billing.subscription.renews",
  subEnds: "billing.subscription.ends",
  subTrialing: "billing.subscription.trialing",
  subPastDue: "billing.subscription.past_due",
  subPastDueHint: "billing.subscription.past_due_hint",
  subCancelled: "billing.subscription.cancelled",
  subIncomplete: "billing.subscription.incomplete",
  subCancelConfirmTitle: "billing.subscription.cancel_confirm_title",
  subCancelConfirmBody: "billing.subscription.cancel_confirm_body",
  subCancelBlocked: "billing.subscription.cancel_blocked",
  subOpeningPortal: "billing.subscription.opening_portal",
  // Credit ledger (/default TransactionHistory)
  txHeading: "billing.transactions.heading",
  txEmpty: "billing.transactions.empty",
  txEmptyHint: "billing.transactions.empty_hint",
  txMore: "billing.transactions.more",
  txBalanceAfter: "billing.transactions.balance_after",
  txTypeCreditPurchase: "billing.transactions.type.credit_purchase",
  txTypeTranscriptionCharge: "billing.transactions.type.transcription_charge",
  txTypeAiCharge: "billing.transactions.type.ai_charge",
  txTypeSubscriptionBonus: "billing.transactions.type.subscription_bonus",
  txTypeRefund: "billing.transactions.type.refund",
  txTypeAdjustment: "billing.transactions.type.adjustment",
  txTypeExpiration: "billing.transactions.type.expiration",
  txTypeOther: "billing.transactions.type.other",
} as const;

export type BillingI18nKey =
  (typeof BILLING_I18N_KEYS)[keyof typeof BILLING_I18N_KEYS];

/**
 * English fallback bundle for billing-react UI keys + backend error codes.
 * The generated `billingErrorBundleEn` (from stapel-billing's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 *
 * ── PLURAL FAMILIES ───────────────────────────────────────────────────────
 *
 * A key marked "PLURAL FAMILY" above is rendered with core's `tPlural`, which
 * looks up `<key>.<CLDR category>`, then `<key>.other`, then `<key>`. Counts
 * therefore reach the screen as language — "1 credit" / "2 credits", and in
 * Russian the four CLDR forms that language actually uses — instead of the
 * parenthetical `credit(s)` the visual pass found across the fleet (VC-A5). Each family ships its categories AND
 * a flat entry at the bare key equal to the `other` form, so the family also
 * answers a plain `t()` — locale-parity gates and host overrides read one key
 * set, not two.
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
  "billing.wallet.auto_recharge_hint":
    "When your balance falls below the trigger, we buy this package for you automatically.",
  "billing.wallet.settings_heading": "Automatic top-up",
  "billing.wallet.threshold": "Top up when the balance falls below",
  "billing.wallet.package": "Package to buy",
  "billing.wallet.package_placeholder": "Choose a package",
  "billing.wallet.package_none": "No packages to choose from",
  "billing.wallet.low_balance_alert": "Warn me when the balance falls below",
  "billing.wallet.settings_no_packages":
    "The shop sells no credit packages, so there is nothing to buy automatically.",
  "billing.wallet.settings_needs_package":
    "Choose the package to buy before switching automatic top-up on.",
  "billing.wallet.heading": "Credits & billing",
  "billing.wallet.sections_label": "Billing sections",
  "billing.wallet.expiring": "{credits} credits expire on {date}",
  "billing.wallet.expiring_relative": "{credits} credits expire on {date} — {relative}",
  "billing.wallet.held": "{credits} credits reserved",
  "billing.wallet.empty": "No credits yet.",
  "billing.wallet.empty_hint": "Buy a package or subscribe to a plan below to get started.",
  "billing.wallet.retry": "Try again",
  "billing.wallet.buy_heading": "Two ways to buy",
  "billing.wallet.credits": "{credits} credits",
  "billing.wallet.credits.one": "{credits} credit",
  "billing.wallet.credits.other": "{credits} credits",
  "billing.wallet.pools_heading": "What you hold",
  "billing.wallet.pool.perpetual": "{credits} credits that never expire",
  "billing.wallet.pool.perpetual.one": "{credits} credit that never expires",
  "billing.wallet.pool.perpetual.other": "{credits} credits that never expire",
  "billing.wallet.pool.perpetual_hint":
    "Credits you bought. They stay until you spend them, whatever happens to your subscription.",
  "billing.wallet.pool.perpetual_none": "No bought credits.",
  "billing.wallet.pool.expiring": "{credits} credits with a deadline",
  "billing.wallet.pool.expiring.one": "{credits} credit with a deadline",
  "billing.wallet.pool.expiring.other": "{credits} credits with a deadline",
  "billing.wallet.pool.expiring_hint":
    "Credits from a plan or a grant. They expire on their own dates, spent or not.",
  "billing.wallet.pool.expiring_none": "No credits are expiring.",
  "billing.wallet.debt.heading": "Credits you owe",
  "billing.wallet.debt.total": "{credits} credits owed",
  "billing.wallet.debt.total.one": "{credits} credit owed",
  "billing.wallet.debt.total.other": "{credits} credits owed",
  "billing.wallet.debt.explain":
    "The next credits added to your wallet are collected against this, oldest first, before you can spend them.",
  "billing.wallet.debt.row": "{credits} of {initial} still owed",
  "billing.wallet.debt.reason.partial_debit": "Work served without enough credits",
  "billing.wallet.debt.reason.clawback": "A refund or dispute took credits back",
  "billing.wallet.debt.reason.other": "Adjustment",
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
  "billing.pricing.current_plan": "Your plan",
  "billing.pricing.blocked_current_plan": "This is the plan you are on.",
  "billing.pricing.debt_note":
    "You owe {credits} credits. Whatever you buy next settles those first.",
  "billing.pricing.debt_note.one":
    "You owe {credits} credit. Whatever you buy next settles it first.",
  "billing.pricing.debt_note.other":
    "You owe {credits} credits. Whatever you buy next settles those first.",
  "billing.pricing.spendable_after_debt": "{credits} left to spend",
  "billing.pricing.spendable_after_debt.one": "{credits} left to spend",
  "billing.pricing.spendable_after_debt.other": "{credits} left to spend",
  "billing.subscription.active": "Active",
  "billing.subscription.inactive": "Inactive",
  "billing.subscription.cancel": "Cancel subscription",
  "billing.subscription.cancelling": "Cancelling…",
  "billing.subscription.manage": "Manage billing",
  "billing.subscription.heading": "Subscription",
  "billing.subscription.plan_label": "Plan",
  "billing.subscription.none": "You have no subscription.",
  "billing.subscription.none_hint":
    "A plan adds credits every month. Bought credits are unaffected either way.",
  "billing.subscription.renews": "Renews on {date}",
  "billing.subscription.ends": "Runs until {date}",
  "billing.subscription.trialing": "Trial",
  "billing.subscription.past_due": "Payment overdue",
  "billing.subscription.past_due_hint":
    "The last payment did not go through. Update your payment method to keep the monthly credits coming.",
  "billing.subscription.cancelled": "Cancelled",
  "billing.subscription.incomplete": "Not finished",
  "billing.subscription.cancel_confirm_title": "Cancel the {plan} subscription?",
  "billing.subscription.cancel_confirm_body":
    "Credits you bought stay in your wallet. Credits from the plan stop arriving and the ones you already have still expire on their own dates.",
  "billing.subscription.cancel_blocked": "This subscription is already cancelled.",
  "billing.subscription.opening_portal": "Opening…",
  "billing.transactions.heading": "Credit history",
  "billing.transactions.empty": "No credits have moved yet.",
  "billing.transactions.empty_hint": "Every purchase, charge and expiry shows up here.",
  "billing.transactions.more": "Show older",
  "billing.transactions.balance_after": "Balance after: {credits}",
  "billing.transactions.type.credit_purchase": "Credits bought",
  "billing.transactions.type.transcription_charge": "Transcription",
  "billing.transactions.type.ai_charge": "AI usage",
  "billing.transactions.type.subscription_bonus": "Plan credits",
  "billing.transactions.type.refund": "Refund",
  "billing.transactions.type.adjustment": "Adjustment",
  "billing.transactions.type.expiration": "Credits expired",
  "billing.transactions.type.other": "Other",
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
