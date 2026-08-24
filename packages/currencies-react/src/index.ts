/**
 * `@stapel/currencies-react` — the Money layer of the fleet.
 *
 * Business + state only, zero visual opinion at this entry (`./default` is the
 * shipped antd skin). Built on `@stapel/core`'s StapelClient, i18n engine and
 * query layer.
 *
 * ONE formatter for the whole fleet: `useMoney()` / `formatMoney()` are what
 * `@stapel/billing-react` and `@stapel/listings-react` render prices through,
 * so a price is spelled the same way — with the same locale rules, the same
 * minor units and the same symbol placement — wherever it appears.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createCurrenciesApi, UNKNOWN_CURRENCY_CODE } from "./api/currenciesApi.js";
export type { CurrenciesApi } from "./api/currenciesApi.js";
export type { Currency, Schemas } from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { CURRENCIES_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  CurrenciesFlowId,
  CurrenciesFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createCurrenciesRuntime } from "./model/runtime.js";
export type {
  CurrenciesRuntime,
  CreateCurrenciesRuntimeOptions,
  MoneyPolicy,
} from "./model/runtime.js";
export {
  CurrenciesRuntimeContext,
  useCurrenciesRuntime,
  useCurrenciesApi,
  useCurrenciesAnalytics,
} from "./model/context.js";
export { currenciesQueryKeys } from "./model/queryKeys.js";
export { useCurrencies, useCurrency } from "./model/queries.js";
export type { CurrenciesBag } from "./model/queries.js";
export { createDisplayCurrencyStore } from "./model/preference.js";
export type { DisplayCurrencyStore } from "./model/preference.js";

// ── money (pure: no React, no network) ───────────────────────────────────────
export {
  convert,
  crossRate,
  formatMoney,
  minorUnitsOf,
  isValidAmount,
  parseDecimal,
  formatDecimal,
  quantize,
  catalogOf,
  RATE_DECIMAL_PLACES,
} from "./model/money.js";
export type {
  ConvertOptions,
  CurrencyCatalog,
  Decimal,
  FormatMoneyOptions,
  SymbolDisplay,
} from "./model/money.js";

// ── headless (renderless components + hooks) ─────────────────────────────────
export { CurrenciesProvider } from "./headless/CurrenciesProvider.js";
export { useMoney } from "./headless/useMoney.js";
export type { MoneyBag } from "./headless/useMoney.js";
export { useDisplayCurrency } from "./headless/useDisplayCurrency.js";
export type { DisplayCurrencyBag } from "./headless/useDisplayCurrency.js";
export { usePrice } from "./headless/usePrice.js";
export type { PriceBag, PriceState, UsePriceOptions } from "./headless/usePrice.js";
export { Money } from "./headless/Money.js";
export type { MoneyProps } from "./headless/Money.js";

// ── analytics ────────────────────────────────────────────────────────────────
export { CURRENCIES_EVENTS } from "./analytics/events.js";
export type { CurrenciesEventName } from "./analytics/events.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  CURRENCIES_I18N_KEYS,
  CURRENCY_NAME_KEYS,
  currenciesI18nBundleEn,
  registerCurrenciesI18n,
} from "./i18n/keys.js";
export type { CurrenciesI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  CURRENCIES_ERRORS,
  CURRENCIES_ERROR_CODES,
  currenciesErrorBundleEn,
  explainCurrenciesError,
} from "./i18n/errorsMap.js";
export type {
  CurrenciesErrorCode,
  CurrenciesErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
