import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createCurrenciesApi } from "../api/currenciesApi.js";
import type { CurrenciesApi } from "../api/currenciesApi.js";
import { createDisplayCurrencyStore } from "./preference.js";
import type { DisplayCurrencyStore } from "./preference.js";

/**
 * The deployment's money policy.
 *
 * Both numbers mirror settings the backend reads but does NOT serve
 * (BACKEND-GAP C-3): `STAPEL_CURRENCIES["BASE_CURRENCY"]` (`conf.py:42`,
 * default `USD`) and `CONVERSION_DECIMAL_PLACES` (`conf.py:53`, default 2).
 * They are declared here so a host that changed either says so once, in the
 * same place it says where the API is — rather than having every price row
 * guess.
 */
export interface MoneyPolicy {
  /** ISO code every `Currency.value` rate is relative to. */
  readonly baseCurrency: string;
  /** Decimal places a converted amount is quantized to (ROUND_HALF_UP). */
  readonly decimalPlaces: number;
  /** Force a formatting locale. Unset (the norm) = the i18n engine's locale,
   * so money follows the language the rest of the page is in. */
  readonly locale?: string;
}

export interface CurrenciesRuntime extends ModuleRuntime<CurrenciesApi> {
  readonly money: MoneyPolicy;
  readonly displayCurrency: DisplayCurrencyStore;
}

export interface CreateCurrenciesRuntimeOptions
  extends CreateModuleRuntimeOptions {
  /** Default `"USD"` — the backend's own default base. */
  readonly baseCurrency?: string;
  /** Default `2` — the backend's own `CONVERSION_DECIMAL_PLACES`. */
  readonly decimalPlaces?: number;
  /** Default: the i18n engine's current locale. */
  readonly locale?: string;
  /** Replace the client-side preference store (a host that keeps the choice on
   * a profile row rather than in the browser). */
  readonly displayCurrencyStore?: DisplayCurrencyStore;
}

/**
 * The wired currencies runtime — core's `ModuleRuntime` bound to this pair's
 * API, plus the two things money needs that an HTTP client cannot carry: the
 * deployment's {@link MoneyPolicy} and the viewer's display-currency store.
 *
 * `baseUrl` is the module's MOUNT (`/currencies/`); the `api/v1/` prefix
 * belongs to the module and is spelled in the api layer.
 */
export function createCurrenciesRuntime(
  options: CreateCurrenciesRuntimeOptions
): CurrenciesRuntime {
  const base = createModuleRuntime(createCurrenciesApi, options);
  return {
    ...base,
    money: {
      baseCurrency: (options.baseCurrency ?? "USD").toUpperCase(),
      decimalPlaces: options.decimalPlaces ?? 2,
      ...(options.locale !== undefined ? { locale: options.locale } : {}),
    },
    displayCurrency: options.displayCurrencyStore ?? createDisplayCurrencyStore(),
  };
}
