import { useFormat } from "@stapel/core";

/**
 * Render a decimal string the server summed, at the app's locale. The number
 * is converted for DISPLAY only — the pair never adds prices. An amount that
 * does not parse is shown verbatim next to its currency rather than as `NaN`.
 */
export function useMoney(): (amount: string, currency: string | null) => string {
  const format = useFormat();
  return (amount, currency) => {
    const value = Number(amount);
    if (currency === null || currency.length !== 3 || !Number.isFinite(value)) {
      return currency === null ? amount : `${amount} ${currency}`;
    }
    return (
      format.number(value, { style: "currency", currency: currency.toUpperCase() }) ??
      `${amount} ${currency}`
    );
  };
}
