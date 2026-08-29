import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { geoErrorBundleRu } from "./generated/errors.ru.gen.js";

export { geoErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for geo-react — shipped as the `@stapel/geo-react/i18n/ru`
 * subpath (i18n-shipping.md §2) so the locale is opt-in: hosts that don't
 * register it never carry these strings (the main entry does not import this
 * module — gated by size-limit and the bundle-purity test).
 *
 * TWO SOURCES, ON PURPOSE. The generated `geoErrorBundleRu` covers the
 * cross-cutting codes stapel-core owns and localizes. The 8 codes stapel-geo
 * owns are NOT in it, and cannot be: the module ships no `translations/`
 * directory at all, so the generator emits a `Partial` bundle and says so in
 * its own header (`ERRORS_LOCALE_EXEMPT_OWNERS`, the stapel-forms /
 * stapel-reviews precedent). They are authored below, beside the UI copy. When
 * upstream ships `translations/errors.ru.json`, those eight lines are deleted
 * and the generated bundle covers them — the keys and the texts do not move.
 *
 * Two sentences here are load-bearing, exactly as in the English bundle.
 * `geo.geocoder.unauthorized` must not read as a breakage: the deployment's
 * default really is authenticated-only geocoding, so a signed-out visitor
 * seeing it is the system working. And `geo.picker.no_address` is the answer
 * to a SUCCESSFUL call — there is no address at that point — not to a failed
 * one.
 */
export const geoI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for every key core owns.
  ...geoErrorBundleRu,

  // Backend error codes stapel-geo owns — authored here (see above).
  "error.400.geohash_required": "Требуется геохеш",
  "error.400.invalid_bbox":
    "Рамка должна состоять из четырёх чисел в допустимых пределах",
  "error.400.invalid_geojson": "Некорректный GeoJSON",
  "error.400.invalid_import_status": "Недопустимый статус импорта",
  "error.400.invalid_params": "Некорректные параметры запроса",
  "error.400.lat_lon_required": "Требуются корректные широта и долгота",
  "error.400.uuid_required": "Требуется UUID",
  "error.502.geocoder_unavailable": "Сервис адресов недоступен",

  // UI copy.
  "geo.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

  "geo.picker.title": "Выберите место",
  "geo.picker.open": "Указать на карте",
  "geo.picker.search_label": "Адрес",
  "geo.picker.search_placeholder": "Улица, город…",
  "geo.picker.use_my_position": "Определить моё местоположение",
  "geo.picker.locating": "Определяем, где вы…",
  "geo.picker.confirm": "Выбрать это место",
  "geo.picker.close": "Закрыть",
  "geo.picker.map_label":
    "Карта. Перетаскивайте, чтобы переместить метку; масштаб — кнопками или стрелками.",
  "geo.picker.zoom_in": "Приблизить",
  "geo.picker.zoom_out": "Отдалить",
  "geo.picker.pin_label": "Выбранная точка — в центре карты",
  "geo.picker.resolving": "Ищем это место…",
  "geo.picker.no_address": "Здесь нет адреса. Место всё равно сохранится.",

  "geo.field.placeholder": "Выбрать местоположение",
  "geo.field.chosen_no_address": "Точка на карте, без адреса",
  "geo.field.choose_anyway": "Выбрать место на карте",
  "geo.field.near_you": "Начинаем рядом: {place}.",

  "geo.permission.title": "Начать оттуда, где вы сейчас?",
  "geo.permission.body":
    "Тогда карта откроется на вашей улице, а не там, откуда придётся ехать. Дальше спросит браузер — адрес всегда можно ввести вручную.",
  "geo.permission.denied":
    "Сайт не видит вашу геопозицию, и браузер больше не спросит. Включить её можно в настройках сайта рядом с адресной строкой — либо просто найдите место на карте.",

  "geo.search.type_more": "Продолжайте вводить, чтобы начать поиск.",
  "geo.search.no_results":
    "Ничего не нашлось. Попробуйте короче или поставьте метку сами.",
  "geo.search.retry": "Повторить",

  "geo.geocoder.unauthorized":
    "Поиск адреса здесь доступен после входа. Карта работает — метку можно поставить самостоятельно.",
  "geo.geocoder.throttled":
    "Слишком много запросов подряд. Показываем прошлые результаты, попробуйте через минуту.",
  "geo.geocoder.unavailable":
    "Сервис адресов не отвечает. Карта работает — поставьте метку сами и попробуйте чуть позже.",
  "geo.geocoder.failed":
    "Поиск адреса не сработал. Карта работает — метку можно поставить самостоятельно.",

  "geo.position.denied":
    "Сайт не видит ваше местоположение. Разрешите доступ в настройках браузера или найдите адрес поиском.",
  "geo.position.unavailable":
    "Устройству не удалось определить, где оно находится. Найдите адрес поиском.",
  "geo.position.timeout": "Определение местоположения заняло слишком долго. Попробуйте ещё раз.",

  "geo.map.config_failed": "Не удалось загрузить карту.",
  "geo.map.retry": "Повторить",
};

/** Register the Russian bundle into a core i18n engine. */
export function registerGeoI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, geoI18nBundleRu);
}
