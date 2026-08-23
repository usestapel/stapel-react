/**
 * The two ways to buy credits, made comparable.
 *
 * A credit package and a subscription plan are different products on the wire
 * — one is a one-time `PackageResponse` with `credits`, the other a recurring
 * `PlanResponse` with `monthly_credits_included` — and a shop that renders
 * them as two unrelated lists leaves the only question a buyer actually has
 * ("which of these is cheaper per credit?") to be answered with a calculator.
 * `stapel-billing`'s own pricing intent is that the plan wins; nothing on the
 * wire SAYS so, so the comparison has to be computed, and it has to be
 * computed the same way for both sides or the claim is not honest.
 *
 * Everything here is pure and unit-tested: no React, no formatting decisions
 * beyond `Intl`, and no opinion about which offer to highlight beyond
 * arithmetic on numbers the server sent.
 */
import type { CreditPackage, Plan } from "../api/types.js";

/** Which side of the shop an offer came from. */
export type OfferKind = "package" | "plan";

/**
 * One buyable option, normalized so a package and a plan can stand side by
 * side under the same columns.
 */
export interface CreditOffer {
  /** `package` (one-time) or `plan` (recurring). */
  readonly kind: OfferKind;
  /** The slug the checkout call takes. */
  readonly slug: string;
  /** The product's display name, as the shop configured it. */
  readonly name: string;
  /** Credits obtained per charge — a package's `credits`, a plan's
   * `monthly_credits_included`. */
  readonly credits: number;
  /** What one charge costs, in minor units. */
  readonly priceCents: number;
  /** ISO 4217, from the product itself — the shop may price the two sides in
   * different currencies, and a comparison across them would be a lie. */
  readonly currency: string;
  /**
   * Price of ONE credit, in minor units — the number the comparison is about.
   * `null` when the offer carries no credits at all (a plan sold for storage
   * alone): dividing by zero is not "free", and a shop that printed "$0.00
   * per credit" there would be advertising something it does not sell.
   */
  readonly perCreditCents: number | null;
}

function perCredit(priceCents: number, credits: number): number | null {
  if (!Number.isFinite(priceCents) || !Number.isFinite(credits)) return null;
  if (credits <= 0) return null;
  return priceCents / credits;
}

/** A one-time credit package as a comparable {@link CreditOffer}. */
export function packageOffer(pack: CreditPackage): CreditOffer {
  return {
    kind: "package",
    slug: pack.slug,
    name: pack.name,
    credits: pack.credits,
    priceCents: pack.price_cents,
    currency: pack.currency,
    perCreditCents: perCredit(pack.price_cents, pack.credits),
  };
}

/**
 * A subscription plan as a comparable {@link CreditOffer}. The credits counted
 * are the ones the plan INCLUDES each period — the plan's storage allowance is
 * real value the per-credit number deliberately ignores, which is why the
 * comparison is stated as "per credit" and never as "cheaper", full stop.
 */
export function planOffer(plan: Plan): CreditOffer {
  return {
    kind: "plan",
    slug: plan.slug,
    name: plan.name,
    credits: plan.monthly_credits_included,
    priceCents: plan.price_cents,
    currency: plan.currency,
    perCreditCents: perCredit(plan.price_cents, plan.monthly_credits_included),
  };
}

/**
 * The offer with the lowest per-credit price, or `null` when none of them
 * prices credits at all. Ties keep the FIRST offer — the catalogue's own
 * order, which the shop chose.
 */
export function bestPerCredit(
  offers: readonly CreditOffer[]
): CreditOffer | null {
  let best: CreditOffer | null = null;
  for (const offer of offers) {
    const rate = offer.perCreditCents;
    if (rate === null) continue;
    const bestRate = best?.perCreditCents;
    if (bestRate === undefined || bestRate === null || rate < bestRate) {
      best = offer;
    }
  }
  return best;
}

/**
 * How much cheaper `cheaper` is than `dearer`, per credit, as whole percent
 * — the sentence a buyer can check ("save 40% per credit"). `null` when
 * either side does not price credits, when the two are priced in different
 * currencies (an unconvertible comparison this pair refuses to fake), or when
 * `cheaper` is not in fact cheaper.
 */
export function perCreditSavingsPercent(
  dearer: CreditOffer | null,
  cheaper: CreditOffer | null
): number | null {
  const from = dearer?.perCreditCents;
  const to = cheaper?.perCreditCents;
  if (from === undefined || from === null || from <= 0) return null;
  if (to === undefined || to === null) return null;
  if (dearer?.currency !== cheaper?.currency) return null;
  if (to >= from) return null;
  return Math.round(((from - to) / from) * 100);
}

/**
 * A price in minor units as money. A price is DATA, not copy — `Intl`
 * localizes it from the host's own locale, so it needs no i18n key and cannot
 * go stale in a catalogue.
 */
export function formatMoney(
  locale: string,
  currency: string,
  cents: number
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * A per-credit rate as money. Widened to four fraction digits on purpose: at
 * two, every offer in a credit shop rounds to the same "$0.01" and the
 * comparison the panel exists to show disappears.
 */
export function formatPerCredit(
  locale: string,
  currency: string,
  cents: number
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cents / 100);
}

/**
 * An ISO 8601 instant as a plain date. Same rule as money: a deadline is data,
 * localized by `Intl` from the host's locale. An unparseable value yields the
 * empty string rather than "Invalid Date" on a customer's screen.
 */
export function formatExpiryDate(locale: string, iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(parsed);
}
