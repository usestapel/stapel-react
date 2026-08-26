import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { docsErrorBundleRu } from "./generated/errors.ru.gen.js";

export { docsErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for docs-react — shipped as the `@stapel/docs-react/i18n/ru`
 * subpath (i18n-shipping.md §2) so the locale is opt-in: hosts that don't
 * register it never carry these strings (the main entry does not import this
 * module — gated by size-limit and the bundle-purity test).
 *
 * ONE source, unlike the reviews/listings precedent: stapel-docs DOES ship
 * `translations/errors.ru.json`, so the generated `docsErrorBundleRu` covers
 * all 74 registry codes — module-owned ones included. Nothing is authored by
 * hand here except this pair's own UI copy, which no backend catalogue can
 * own. `test/i18n.test.ts` gates both halves in both directions.
 */
export const docsI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for every code in the registry.
  ...docsErrorBundleRu,

  // docs-react UI
  "docs.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "docs.list.loading": "Загружаем документы…",
  "docs.list.empty": "Документов пока нет.",
  "docs.list.error": "Не удалось загрузить документы.",
  "docs.list.retry": "Попробовать снова",
  "docs.tree.loading": "Загружаем папки…",
  "docs.tree.error": "Не удалось загрузить папки.",
  "docs.tree.root": "Все документы",
  "docs.editor.loading": "Загружаем документ…",
  "docs.editor.save": "Сохранить",
  "docs.editor.saving": "Сохраняем…",
  "docs.editor.saved": "Все изменения сохранены.",
  "docs.editor.conflict":
    "Пока вы редактировали, документ сохранил кто-то ещё.",
  "docs.editor.override": "Сохранить всё равно (обе версии останутся в истории)",
  "docs.editor.downloadOnly": "Документы этого типа открываются как файл.",
  "docs.revisions.loading": "Загружаем историю…",
  "docs.revisions.empty": "Версий пока нет.",
  "docs.revisions.create": "Назвать эту версию",
  "docs.revisions.restore": "Восстановить",
  "docs.revisions.restoring": "Восстанавливаем…",
  "docs.trash.emptyState": "Корзина пуста.",
  "docs.trash.restore": "Восстановить",
  "docs.trash.emptyAction": "Очистить корзину",
  "docs.trash.emptying": "Очищаем…",
  "docs.upload.action": "Загрузить файл",
  "docs.upload.uploading": "Загружаем…",
  "docs.upload.done": "Файл загружен.",
  "docs.upload.failed": "Не удалось загрузить файл.",
  "docs.media.download": "Скачать",
  "docs.media.minting": "Готовим ссылку на скачивание…",
  "docs.manager.filesView": "Файлы",
  "docs.manager.trashView": "Корзина",
  "docs.manager.newFolder": "Новая папка",
  "docs.manager.upload": "Загрузить",
  "docs.manager.foldersEmpty": "Папок пока нет.",
  "docs.manager.newDocument": "Новый документ",
  "docs.manager.foldersPane": "Папки",
  "docs.manager.filesPane": "Документы",
  "docs.manager.nameColumn": "Название",
  "docs.manager.updatedColumn": "Изменён",
  "docs.manager.sizeColumn": "Размер",
  "docs.menu.open": "Открыть",
  "docs.menu.rename": "Переименовать",
  "docs.menu.move": "Переместить…",
  "docs.menu.newSubfolder": "Новая вложенная папка",
  "docs.menu.moveToTrash": "В корзину",
  "docs.menu.download": "Скачать",
  "docs.menu.history": "История версий",
  "docs.menu.restore": "Восстановить",
  "docs.menu.deleteForever": "Удалить навсегда",
  "docs.menu.actions": "Действия",
  "docs.dialog.renameTitle": "Переименовать",
  "docs.dialog.moveTitle": "Переместить в папку",
  "docs.dialog.moveTarget": "Папка назначения",
  "docs.dialog.newFolderTitle": "Новая папка",
  "docs.dialog.namePlaceholder": "Название",
  "docs.dialog.ok": "ОК",
  "docs.dialog.renameConfirm": "Переименовать",
  "docs.dialog.createFolderConfirm": "Создать папку",
  "docs.dialog.moveConfirm": "Переместить",
  "docs.dialog.createDocumentConfirm": "Создать",
  "docs.dialog.cancel": "Отмена",
  "docs.dialog.close": "Закрыть",
  "docs.dialog.rootFolder": "Все документы",
  "docs.dialog.newDocumentTitle": "Новый документ",
  "docs.dialog.documentType": "Тип документа",
  "docs.dialog.nameBlockedEmpty": "Сначала введите название.",
  "docs.dialog.moveBlockedUnchanged": "Здесь он уже и находится.",
  "docs.type.text": "Обычный текст",
  "docs.type.markdown": "Markdown",
  "docs.type.csv": "Таблица (CSV)",
  "docs.revisions.title": "История версий",
  "docs.revisions.automatic": "Автоматическая версия",
  "docs.revisions.previewEmpty": "Выберите версию, чтобы посмотреть её.",
  "docs.revisions.previewBinary":
    "Эта версия — двоичный снимок: чтобы посмотреть, скачайте её.",
  "docs.revisions.rollback": "Вернуться к этой версии",
  "docs.revisions.rollbackConfirm":
    "Восстановить эту версию? Текущее содержимое останется в истории.",
  "docs.revisions.rollbackBlockedHead": "Это текущая версия документа.",
  "docs.revisions.namePlaceholder": "Название версии",
  "docs.revisions.download": "Скачать версию",
  "docs.revisions.nameBlockedEmpty": "Сначала введите название версии.",
  "docs.editor.dirty": "Есть несохранённые изменения",
  "docs.editor.addRow": "Добавить строку",
  "docs.editor.addColumn": "Добавить столбец",
  "docs.editor.deleteRow": "Удалить строку",
  "docs.trash.emptyConfirm":
    "Удалить всё содержимое корзины навсегда? Это нельзя отменить.",
  "docs.trash.kindFolder": "Папка",
  "docs.trash.kindDocument": "Документ",
  "docs.trash.emptyBlocked": "В корзине нечего удалять.",
  "docs.list.emptyHint": "Создайте документ или загрузите файл, чтобы начать.",
  "docs.trash.emptyHint": "Удалённые документы сначала попадают сюда.",
  "docs.editor.collabUnsupported": "Этот документ редактируется совместно.",
  "docs.editor.collabUnsupportedHint":
    "Для его типа не зарегистрирован совместный редактор, поэтому здесь его не отредактировать. Скачайте документ или зарегистрируйте редактор через registerDocEditor.",
  "docs.nav.files": "Документы",
  "docs.nav.document": "Документ",
};

/** Register the Russian bundle into a core i18n engine. */
export function registerDocsI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, docsI18nBundleRu);
}
