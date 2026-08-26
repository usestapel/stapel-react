import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { currenciesErrorBundleEn } from "./generated/errors.gen.js";

/**
 * currencies-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys.
 *
 * ── The `currency.<code>` half ─────────────────────────────────────────────
 *
 * The wire's `display_name` is a KEY, not a name: the catalogue answers
 * `"currency.usd"`. Those keys are the SAME strings stapel-translate serves,
 * so a host with the translate pair wired gets its copy and a host without one
 * still renders "US Dollar" instead of `currency.usd`. All 16 seeded codes are
 * carried here in en/ru/es (`conf.DEFAULT_CURRENCIES`); a host that seeds its
 * own code registers one more key.
 */
export const CURRENCIES_I18N_KEYS = {
  unknownError: "currencies.error.unknown",

  priceApprox: "currencies.price.approx",
  priceRate: "currencies.price.rate",
  priceUnavailable: "currencies.price.unavailable",

  pickerLabel: "currencies.picker.label",
  pickerPlaceholder: "currencies.picker.placeholder",
  pickerSearch: "currencies.picker.search",
  pickerLoading: "currencies.picker.loading",
  pickerRetry: "currencies.picker.retry",

  /** One catalogue, one voice: the picker and the rate table state the same
   * two situations with the same sentences, and neither ever renders the
   * server's own `error` string. */
  catalogEmpty: "currencies.catalog.empty",
  catalogEmptyHint: "currencies.catalog.emptyHint",
  catalogFailed: "currencies.catalog.failed",

  fieldAmount: "currencies.field.amount",
  fieldInvalidAmount: "currencies.field.invalidAmount",

  tableCode: "currencies.table.code",
  tableName: "currencies.table.name",
  tableRate: "currencies.table.rate",
  tableBaseNote: "currencies.table.baseNote",

  dialogDismiss: "currencies.dialog.dismiss",
} as const;

export type CurrenciesI18nKey =
  (typeof CURRENCIES_I18N_KEYS)[keyof typeof CURRENCIES_I18N_KEYS];

/**
 * The 16 currency-name keys the backend's own seed list spells in
 * `display_name`. Exported so the locale bundles and the parity test iterate
 * the same list instead of three hand-kept copies.
 */
export const CURRENCY_NAME_KEYS: readonly string[] = [
  "currency.usd",
  "currency.eur",
  "currency.gbp",
  "currency.chf",
  "currency.pln",
  "currency.czk",
  "currency.sek",
  "currency.nok",
  "currency.dkk",
  "currency.huf",
  "currency.ron",
  "currency.bgn",
  "currency.hrk",
  "currency.rsd",
  "currency.uah",
  "currency.rub",
];

/** English fallback bundle: backend error codes first (coverage by
 * construction), then the pair's own UI copy. */
export const currenciesI18nBundleEn: I18nDictionary = {
  ...currenciesErrorBundleEn,

  "currencies.error.unknown": "Something went wrong. Please try again.",

  "currencies.price.approx": "approx. {value}",
  "currencies.price.rate": "1 {from} = {rate} {to}",
  "currencies.price.unavailable": "Conversion unavailable",

  "currencies.picker.label": "Display currency",
  "currencies.picker.placeholder": "Choose a currency",
  "currencies.picker.search": "Search by code or name",
  "currencies.picker.loading": "Loading currencies…",
  "currencies.picker.retry": "Try again",

  "currencies.catalog.empty": "No currencies are configured for this site.",
  "currencies.catalog.emptyHint":
    "Prices stay in the currency each seller quoted until one is added.",
  "currencies.catalog.failed": "Currencies could not be loaded.",

  "currencies.field.amount": "Amount",
  "currencies.field.invalidAmount": "Enter an amount like 1500 or 1500.00.",

  "currencies.table.code": "Code",
  "currencies.table.name": "Name",
  "currencies.table.rate": "Rate",
  "currencies.table.baseNote":
    "Rates are relative to {base}. The catalogue serves no update time, so these are the latest the site holds — not a quote.",

  "currencies.dialog.dismiss": "Close",

  "currency.usd": "US Dollar",
  "currency.eur": "Euro",
  "currency.gbp": "British Pound",
  "currency.chf": "Swiss Franc",
  "currency.pln": "Polish Zloty",
  "currency.czk": "Czech Koruna",
  "currency.sek": "Swedish Krona",
  "currency.nok": "Norwegian Krone",
  "currency.dkk": "Danish Krone",
  "currency.huf": "Hungarian Forint",
  "currency.ron": "Romanian Leu",
  "currency.bgn": "Bulgarian Lev",
  "currency.hrk": "Croatian Kuna",
  "currency.rsd": "Serbian Dinar",
  "currency.uah": "Ukrainian Hryvnia",
  "currency.rub": "Russian Ruble",
};

/**
 * Register currencies-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerCurrenciesI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, currenciesI18nBundleEn);
}
