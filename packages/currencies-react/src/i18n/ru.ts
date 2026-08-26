import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { currenciesI18nBundleEn } from "./keys.js";
import { currenciesErrorBundleRu } from "./generated/errors.ru.gen.js";

export { currenciesErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for currencies-react — shipped as the
 * `@stapel/currencies-react/i18n/ru` subpath (i18n-shipping.md §2) so the
 * locale is opt-in: a host that never registers it never carries these strings
 * (the main entry does not import this module).
 *
 * Composition mirrors {@link currenciesI18nBundleEn}: the GENERATED backend
 * error texts (stapel-currencies `translations/errors.ru.json`, `pnpm
 * gen:errors`) go first for coverage by construction, then the hand-written ru
 * UI copy and the 16 currency names.
 */
export const currenciesI18nBundleRu: I18nDictionary = {
  ...currenciesErrorBundleRu,

  "currencies.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

  "currencies.price.approx": "около {value}",
  "currencies.price.rate": "1 {from} — это {rate} {to}",
  "currencies.price.unavailable": "Пересчёт недоступен",

  "currencies.picker.label": "Валюта отображения",
  "currencies.picker.placeholder": "Выберите валюту",
  "currencies.picker.search": "Поиск по коду или названию",
  "currencies.picker.loading": "Загрузка валют…",
  "currencies.catalog.empty": "Для этого сайта не настроена ни одна валюта.",
  "currencies.catalog.emptyHint":
    "Пока валюту не добавят, цены остаются в той, которую указал продавец.",
  "currencies.catalog.failed": "Не удалось загрузить валюты.",
  "currencies.picker.retry": "Повторить",

  "currencies.field.amount": "Сумма",
  "currencies.field.invalidAmount": "Введите сумму, например 1500 или 1500.00.",

  "currencies.table.code": "Код",
  "currencies.table.name": "Название",
  "currencies.table.rate": "Курс",
  "currencies.table.baseNote":
    "Курсы указаны относительно {base}. Каталог не передаёт время обновления, поэтому это последние сохранённые значения, а не котировка.",

  "currencies.dialog.dismiss": "Закрыть",

  "currency.usd": "Доллар США",
  "currency.eur": "Евро",
  "currency.gbp": "Фунт стерлингов",
  "currency.chf": "Швейцарский франк",
  "currency.pln": "Польский злотый",
  "currency.czk": "Чешская крона",
  "currency.sek": "Шведская крона",
  "currency.nok": "Норвежская крона",
  "currency.dkk": "Датская крона",
  "currency.huf": "Венгерский форинт",
  "currency.ron": "Румынский лей",
  "currency.bgn": "Болгарский лев",
  "currency.hrk": "Хорватская куна",
  "currency.rsd": "Сербский динар",
  "currency.uah": "Украинская гривна",
  "currency.rub": "Российский рубль",
};

/**
 * Register the Russian bundle. The en bundle goes UNDER it (merge-priority
 * convention): a key this locale has not translated yet degrades to ENGLISH,
 * never to a raw key.
 */
export function registerCurrenciesI18nRu(
  engine: I18nEngine,
  locale = "ru"
): void {
  engine.registerBundle(locale, currenciesI18nBundleEn);
  engine.registerBundle(locale, currenciesI18nBundleRu);
}
