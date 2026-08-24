import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { currenciesI18nBundleEn } from "./keys.js";
import { currenciesErrorBundleEs } from "./generated/errors.es.gen.js";

export { currenciesErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for currencies-react — shipped as the
 * `@stapel/currencies-react/i18n/es` subpath (i18n-shipping.md §2) so the
 * locale is opt-in: a host that never registers it never carries these strings
 * (the main entry does not import this module).
 *
 * Composition mirrors the ru bundle: generated backend error texts first
 * (coverage by construction), hand-written UI copy and the 16 currency names
 * after.
 */
export const currenciesI18nBundleEs: I18nDictionary = {
  ...currenciesErrorBundleEs,

  "currencies.error.unknown": "Algo salió mal. Inténtalo de nuevo.",

  "currencies.price.approx": "aprox. {value}",
  "currencies.price.rate": "1 {from} equivale a {rate} {to}",
  "currencies.price.unavailable": "Conversión no disponible",

  "currencies.picker.label": "Moneda de visualización",
  "currencies.picker.placeholder": "Elige una moneda",
  "currencies.picker.search": "Buscar por código o nombre",
  "currencies.picker.loading": "Cargando monedas…",
  "currencies.picker.empty": "Este sitio no tiene ninguna moneda configurada.",
  "currencies.picker.failed": "No se pudieron cargar las monedas.",
  "currencies.picker.retry": "Reintentar",

  "currencies.field.amount": "Importe",
  "currencies.field.invalidAmount": "Introduce un importe como 1500 o 1500.00.",

  "currencies.table.code": "Código",
  "currencies.table.name": "Nombre",
  "currencies.table.rate": "Tipo de cambio",
  "currencies.table.symbol": "Símbolo",
  "currencies.table.baseNote":
    "Los tipos son relativos a {base}. El catálogo no envía la hora de actualización, así que estos son los últimos valores guardados, no una cotización.",
  "currencies.table.empty": "Este sitio no tiene ninguna moneda configurada.",

  "currencies.dialog.dismiss": "Cerrar",

  "currency.usd": "Dólar estadounidense",
  "currency.eur": "Euro",
  "currency.gbp": "Libra esterlina",
  "currency.chf": "Franco suizo",
  "currency.pln": "Esloti polaco",
  "currency.czk": "Corona checa",
  "currency.sek": "Corona sueca",
  "currency.nok": "Corona noruega",
  "currency.dkk": "Corona danesa",
  "currency.huf": "Forinto húngaro",
  "currency.ron": "Leu rumano",
  "currency.bgn": "Lev búlgaro",
  "currency.hrk": "Kuna croata",
  "currency.rsd": "Dinar serbio",
  "currency.uah": "Grivna ucraniana",
  "currency.rub": "Rublo ruso",
};

/**
 * Register the Spanish bundle. The en bundle goes UNDER it (merge-priority
 * convention): a key this locale has not translated yet degrades to ENGLISH,
 * never to a raw key.
 */
export function registerCurrenciesI18nEs(
  engine: I18nEngine,
  locale = "es"
): void {
  engine.registerBundle(locale, currenciesI18nBundleEn);
  engine.registerBundle(locale, currenciesI18nBundleEs);
}
