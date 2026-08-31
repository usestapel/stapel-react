import { useCallback, useMemo } from "react";
import { useOptionalI18n } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { useCurrenciesRuntime } from "../model/context.js";
import { useCurrencies } from "../model/queries.js";
import { convert, crossRate, formatMoney, formatRate } from "../model/money.js";
import type { FormatMoneyOptions, SymbolDisplay } from "../model/money.js";
import type { Currency } from "../api/types.js";

/** Everything a skin needs to print or convert an amount. */
export interface MoneyBag {
  /** Format a decimal-string amount in a currency, in the viewer's locale. */
  format: (
    amount: string,
    code: string,
    options?: Omit<FormatMoneyOptions, "locale"> & { readonly locale?: string }
  ) => string;
  /**
   * Convert between two currencies. `undefined` while the catalogue is still
   * loading and for a code it does not carry — the absence of a rate is not a
   * rate, and a price must never be shown converted by a number nobody has.
   */
  convert: (amount: string, from: string, to: string) => string | undefined;
  /** One unit of `from` in `to`, for the visible rate line. */
  rate: (from: string, to: string) => string | undefined;
  /**
   * A stored rate (`Decimal(20, 8)` off the wire) as a person reads it —
   * grouped, trimmed to four places, in the viewer's locale. A ratio, so no
   * currency token is attached.
   */
  formatRate: (value: string) => string;
  /** The catalogue load itself, for a surface that renders its own states. */
  readonly rates: LoadState<readonly Currency[]>;
  /** The deployment's base currency. */
  readonly base: string;
  refetch: () => void;
}

/**
 * The Money hook — the fleet's one formatter, wired to the viewer's locale and
 * the deployment's rate catalogue.
 *
 * The locale comes from core's i18n engine unless the runtime pins one, so a
 * price is spelled the way the rest of the page is: `$1,234.50` in en,
 * `1234,50 $` in es, `1 234,50 $` in ru. Outside an `<I18nProvider>` it falls
 * back to `en` rather than throwing — a formatter that crashes a page because
 * nobody wired i18n is worse than one that prints English.
 */
export function useMoney(): MoneyBag {
  const runtime = useCurrenciesRuntime();
  const i18n = useOptionalI18n();
  const { state, catalog, refetch } = useCurrencies();
  const locale = runtime.money.locale ?? i18n?.locale ?? "en";
  const { baseCurrency, decimalPlaces } = runtime.money;

  const format = useCallback(
    (
      amount: string,
      code: string,
      options?: Omit<FormatMoneyOptions, "locale"> & { readonly locale?: string }
    ) => {
      const row = catalog.get(code.toUpperCase());
      const symbol = row?.symbol;
      return formatMoney(amount, code, {
        locale: options?.locale ?? locale,
        ...(options?.symbolDisplay !== undefined
          ? { symbolDisplay: options.symbolDisplay as SymbolDisplay }
          : {}),
        ...(options?.minimumFractionDigits !== undefined
          ? { minimumFractionDigits: options.minimumFractionDigits }
          : {}),
        ...(options?.maximumFractionDigits !== undefined
          ? { maximumFractionDigits: options.maximumFractionDigits }
          : {}),
        ...(options?.fraction !== undefined
          ? { fraction: options.fraction }
          : {}),
        // The catalogue's own symbol is what a non-ISO token falls back to.
        ...(symbol !== undefined && symbol.length > 0
          ? { fallbackSymbol: symbol }
          : {}),
      });
    },
    [catalog, locale]
  );

  const convertAmount = useCallback(
    (amount: string, from: string, to: string) =>
      convert(amount, from, to, catalog, {
        base: baseCurrency,
        places: decimalPlaces,
      }),
    [catalog, baseCurrency, decimalPlaces]
  );

  const displayRate = useCallback(
    (value: string) => formatRate(value, { locale }),
    [locale]
  );

  const rate = useCallback(
    (from: string, to: string) =>
      crossRate(from, to, catalog, {
        base: baseCurrency,
        places: decimalPlaces,
      }),
    [catalog, baseCurrency, decimalPlaces]
  );

  return useMemo(
    () => ({
      format,
      convert: convertAmount,
      rate,
      formatRate: displayRate,
      rates: state,
      base: baseCurrency,
      refetch,
    }),
    [format, convertAmount, rate, displayRate, state, baseCurrency, refetch]
  );
}
