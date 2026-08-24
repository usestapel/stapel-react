import { useMemo } from "react";
import { useMoney } from "./useMoney.js";
import { useDisplayCurrency } from "./useDisplayCurrency.js";

export interface UsePriceOptions {
  /** The amount as the wire spells it — a decimal STRING, never a number. */
  readonly amount: string;
  /** The currency the amount is IN (the seller's, the invoice's). */
  readonly currency: string;
  /** Show it in this currency instead of the viewer's chosen one. */
  readonly displayCurrency?: string;
}

/**
 * The three states a price can be in, and what each one renders.
 *
 * `"loading"` — the catalogue is in flight. The ORIGINAL is already formatted
 * and shown; only the converted line waits.
 * `"ready"` — a conversion exists (or none is needed because the display
 * currency IS the price's currency).
 * `"unavailable"` — the catalogue answered but carries no usable rate for one
 * of the codes. The original still shows.
 */
export type PriceState = "loading" | "ready" | "unavailable";

export interface PriceBag {
  /** The price in its own currency, formatted for the viewer's locale. ALWAYS
   * present — this is the number the seller actually asks for. */
  readonly original: string;
  /** The estimate in the display currency, or `undefined` when the display
   * currency IS the price's currency, while rates load, or when no rate
   * exists. Never rendered without {@link PriceBag.original} beside it. */
  readonly converted: string | undefined;
  /** `1 <currency> = <rate> <display>`, the number behind the estimate. */
  readonly rate: string | undefined;
  readonly currency: string;
  readonly displayCurrency: string;
  readonly state: PriceState;
}

/**
 * One listing price, ready to render.
 *
 * The rule this hook exists to hold: **a converted price is an estimate, and
 * an estimate never replaces the real number.** The catalogue serves no rate
 * timestamp (BACKEND-GAP C-2), so nothing here can tell a person how fresh the
 * conversion is — which makes showing it alone a claim the data cannot back.
 * `original` is therefore always populated, in every state, and `converted` is
 * the optional half.
 */
export function usePrice(options: UsePriceOptions): PriceBag {
  const money = useMoney();
  const display = useDisplayCurrency();
  const currency = options.currency.toUpperCase();
  const displayCurrency = (options.displayCurrency ?? display.code).toUpperCase();
  const { amount } = options;
  const { format, convert, rate: rateOf, rates } = money;

  return useMemo(() => {
    const original = format(amount, currency);
    if (currency === displayCurrency) {
      return {
        original,
        converted: undefined,
        rate: undefined,
        currency,
        displayCurrency,
        state: "ready" as const,
      };
    }
    if (rates.status === "loading") {
      return {
        original,
        converted: undefined,
        rate: undefined,
        currency,
        displayCurrency,
        state: "loading" as const,
      };
    }
    const convertedAmount = convert(amount, currency, displayCurrency);
    if (convertedAmount === undefined) {
      return {
        original,
        converted: undefined,
        rate: undefined,
        currency,
        displayCurrency,
        state: "unavailable" as const,
      };
    }
    return {
      original,
      converted: format(convertedAmount, displayCurrency),
      rate: rateOf(currency, displayCurrency),
      currency,
      displayCurrency,
      state: "ready" as const,
    };
  }, [amount, currency, displayCurrency, format, convert, rateOf, rates.status]);
}
