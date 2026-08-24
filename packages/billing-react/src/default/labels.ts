/**
 * WIRE ENUM → i18n KEY. One table per enum, and a stated fallback for the
 * value a newer backend invents.
 *
 * A raw enum on the glass (`past_due`, `transcription_charge`,
 * `partial_debit`) is the same defect as a raw UUID or a raw ISO date — the
 * machine's spelling shown to a person (visual class VC-A4/VC-A8). The fix is
 * a lookup, and the interesting half of a lookup is what it does with a value
 * it does not know.
 *
 * These return `undefined` for an unknown value rather than a "?" key,
 * because the two call sites want different things from that case: a ledger
 * row falls back to the entry's own `description` (the server's sentence
 * about that specific charge, which is better than any generic label), while
 * a debt falls back to a neutral "Adjustment". Deciding here would take that
 * choice away from both.
 */
import { BILLING_I18N_KEYS } from "../i18n/keys.js";
import type { BillingI18nKey } from "../i18n/keys.js";

/** `models.TransactionType` → the label key for a ledger row. */
const TRANSACTION_TYPE_KEYS: Readonly<Record<string, BillingI18nKey>> = {
  credit_purchase: BILLING_I18N_KEYS.txTypeCreditPurchase,
  transcription_charge: BILLING_I18N_KEYS.txTypeTranscriptionCharge,
  ai_charge: BILLING_I18N_KEYS.txTypeAiCharge,
  subscription_bonus: BILLING_I18N_KEYS.txTypeSubscriptionBonus,
  refund: BILLING_I18N_KEYS.txTypeRefund,
  adjustment: BILLING_I18N_KEYS.txTypeAdjustment,
  expiration: BILLING_I18N_KEYS.txTypeExpiration,
};

/** The label key for a ledger entry's `type`, or `undefined` when the
 * backend sent one this release has no word for. */
export function transactionTypeKey(type: string): BillingI18nKey | undefined {
  return TRANSACTION_TYPE_KEYS[type];
}

/** `models.DebtReason` → the label key for a debt row. */
const DEBT_REASON_KEYS: Readonly<Record<string, BillingI18nKey>> = {
  partial_debit: BILLING_I18N_KEYS.walletDebtReasonPartialDebit,
  clawback: BILLING_I18N_KEYS.walletDebtReasonClawback,
};

/** The label key for a debt's `reason`, or `undefined` for an unknown one. */
export function debtReasonKey(reason: string): BillingI18nKey | undefined {
  return DEBT_REASON_KEYS[reason];
}

/**
 * `models.SubscriptionStatus` → the label key for the status chip.
 *
 * `active` deliberately maps to the pair's existing `subActive` ("Active"),
 * so the five statuses read as five states of one thing rather than as one
 * translated word beside four raw ones.
 */
const SUBSCRIPTION_STATUS_KEYS: Readonly<Record<string, BillingI18nKey>> = {
  active: BILLING_I18N_KEYS.subActive,
  trialing: BILLING_I18N_KEYS.subTrialing,
  past_due: BILLING_I18N_KEYS.subPastDue,
  cancelled: BILLING_I18N_KEYS.subCancelled,
  incomplete: BILLING_I18N_KEYS.subIncomplete,
};

/** The label key for a subscription `status`; unknown statuses fall back to
 * the pair's "Inactive", which is the safe reading of a state we cannot
 * name — never the raw token. */
export function subscriptionStatusKey(status: string): BillingI18nKey {
  return SUBSCRIPTION_STATUS_KEYS[status] ?? BILLING_I18N_KEYS.subInactive;
}

/**
 * A slug as a last-resort display name — `team_plus` → `Team plus`.
 *
 * The catalogue names its own products and that name is what a screen should
 * show; this is what happens when the catalogue does not list the plan the
 * caller is on (a legacy plan, a plan sold elsewhere, a catalogue read that
 * has not answered yet). The alternative is the raw slug beside title-cased
 * names, which is the `secretary`-among-`Owner/Admin` defect the visual pass
 * found in another pair — a machine token sitting in a row of human words.
 */
export function titleCaseSlug(slug: string): string {
  const words = slug.replaceAll(/[_-]+/g, " ").trim();
  if (words.length === 0) return slug;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
