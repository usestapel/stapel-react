import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { driveErrorBundleRu } from "./generated/errors.ru.gen.js";

export { driveErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for drive-react — shipped as the
 * `@stapel/drive-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit and the
 * bundle-purity test).
 *
 * Two halves, as everywhere: the generated `driveErrorBundleRu` covers all 77
 * codes of stapel-docs' registry (the module ships
 * `translations/errors.ru.json`), and the UI copy below is this pair's own,
 * which no backend catalogue can own.
 */
export const driveI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for every code in the registry.
  ...driveErrorBundleRu,

  // drive-react UI
  "drive.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

  "drive.nav.drive": "Диск",
  "drive.crumb.root": "Мой диск",
  "drive.crumb.label": "Путь к папке",

  "drive.tab.files": "Файлы",
  "drive.tab.starred": "Избранное",
  "drive.tab.recents": "Недавние",
  "drive.tab.trash": "Корзина",

  "drive.list.loading": "Загружаем папку…",
  "drive.list.error": "Не удалось загрузить папку.",
  "drive.list.retry": "Попробовать снова",
  "drive.list.empty": "В этой папке пусто.",
  "drive.list.emptyHint": "Загрузите файл, чтобы здесь что-то появилось.",
  "drive.view.list": "Списком",
  "drive.view.grid": "Плиткой",
  "drive.item.folder": "Папка",
  "drive.item.document": "Файл",

  "drive.star.add": "В избранное",
  "drive.star.remove": "Убрать из избранного",
  "drive.starred.empty": "В избранном пока пусто.",
  "drive.starred.emptyHint":
    "Добавьте файл в избранное, чтобы он был под рукой.",
  "drive.starred.error": "Не удалось загрузить избранное.",

  "drive.recents.empty": "Вы пока ничего не открывали.",
  "drive.recents.emptyHint": "Открытые файлы появятся здесь.",
  "drive.recents.error": "Не удалось загрузить недавние файлы.",

  "drive.search.label": "Поиск по диску",
  "drive.search.placeholder": "Искать файлы и папки",
  "drive.search.idle": "Начните вводить, чтобы искать по диску.",
  "drive.search.empty": "Ничего не нашлось.",
  "drive.search.error": "Не удалось выполнить поиск.",
  "drive.search.inRoot": "В моём диске",

  "drive.actions.label": "Действия",
  "drive.action.open": "Открыть",
  "drive.action.rename": "Переименовать",
  "drive.action.move": "Переместить",
  "drive.action.download": "Скачать",
  "drive.action.trash": "В корзину",
  "drive.rename.title": "Переименование",
  "drive.rename.field": "Название",
  "drive.rename.empty": "Название обязательно.",
  "drive.rename.unchanged": "Это и есть текущее название.",
  "drive.rename.submit": "Переименовать",
  "drive.move.title": "Переместить в",
  "drive.move.toRoot": "Мой диск",
  "drive.move.submit": "Переместить",
  "drive.move.sameFolder": "Уже находится здесь.",
  "drive.trash.confirm": "Переместить в корзину?",

  "drive.upload.action": "Загрузить",
  "drive.upload.trayTitle": "Загрузки",
  "drive.upload.queued": "В очереди",
  "drive.upload.uploading": "Загружаем…",
  "drive.upload.done": "Загружено",
  "drive.upload.failed": "Не удалось загрузить",
  "drive.upload.canceled": "Отменено",
  "drive.upload.retry": "Повторить",
  "drive.upload.cancel": "Отменить",
  "drive.upload.clear": "Очистить завершённые",
  "drive.upload.empty": "Загрузок пока нет.",
  "drive.upload.quotaTitle": "В рабочем пространстве закончилось место.",
  "drive.upload.quotaHint":
    "Загрузка не продолжится, пока не освободится место — очистите корзину или запросите увеличение квоты.",

  "drive.preview.alt": "Предпросмотр",
};

/**
 * Register the Russian bundle (call after {@link registerDriveI18n} so the en
 * floor is underneath and any key this file misses still resolves).
 */
export function registerDriveI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", driveI18nBundleRu);
}
