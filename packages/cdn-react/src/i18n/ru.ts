import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { cdnErrorBundleRu } from "./generated/errors.ru.gen.js";

export { cdnErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for cdn-react — shipped as the `@stapel/cdn-react/i18n/ru`
 * subpath (i18n-shipping.md §2) so the locale is opt-in: hosts that don't
 * register it never carry these strings (the main entry does not import this
 * module — gated by size-limit and the bundle-purity test).
 *
 * TWO SOURCES, ON PURPOSE. The generated `cdnErrorBundleRu` covers the 42
 * cross-cutting keys stapel-core owns and localizes. The 11 keys stapel-cdn
 * owns are NOT in it, and cannot be: the module ships no `translations/`
 * directory at all, so the generator emits a `Partial` bundle and says so in
 * its own header (`ERRORS_LOCALE_EXEMPT_OWNERS`, the stapel-forms precedent).
 * They are authored below, beside the UI copy. When upstream ships
 * `translations/errors.ru.json`, these eleven lines are deleted and the
 * generated bundle covers them — the keys and the texts do not move.
 */
export const cdnI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for every key core owns.
  ...cdnErrorBundleRu,

  // Backend error codes stapel-cdn owns — authored here (see the note above).
  "error.400.file_hash_required": "Не передан параметр file_hash",
  "error.400.file_type_not_allowed": "Такой тип файла загружать нельзя",
  "error.400.invalid_format": "Формат файла не поддерживается",
  "error.400.invalid_hash": "Некорректный хеш файла",
  "error.400.invalid_image_type": "Неизвестный тип изображения",
  "error.400.missing_fields": "Заполнены не все обязательные поля",
  "error.400.no_file": "Файл не выбран",
  "error.403.storage_quota_exceeded": "Исчерпана квота на хранение",
  "error.404.no_images": "Обработанных изображений не найдено",
  "error.413.file_too_large": "Файл слишком большой",
  "error.503.image_decoder_unavailable":
    "Сервер сейчас не может обработать изображения {extension}",

  // UI copy.
  "cdn.error.unknown": "С этой загрузкой что-то пошло не так",

  "cdn.pick.image": "Выберите изображение",
  "cdn.pick.images": "Добавить фото",
  "cdn.pick.replace": "Заменить",
  "cdn.pick.hint": "{formats} · до {maxMb} МБ",
  "cdn.pick.drop_hint": "Перетащите файлы сюда или нажмите, чтобы выбрать",

  "cdn.phase.hashing": "Читаем файл…",
  "cdn.phase.checking": "Проверяем, нет ли такого файла…",
  "cdn.phase.uploading": "Загружаем…",
  "cdn.phase.processing": "Готовим превью…",
  "cdn.phase.done": "Готово",
  "cdn.phase.canceled": "Отменено",
  "cdn.phase.failed": "Не удалось",
  "cdn.phase.queued": "Ожидает очереди",

  "cdn.outcome.deduped": "Такой файл уже загружен — повторно ничего не отправлялось",
  "cdn.outcome.variants_pending": "Превью ещё готовятся; фото сохранено",
  "cdn.outcome.dedup_skipped.no_crypto":
    "Эта страница не может посчитать хеш, поэтому проверка на дубликат пропущена",
  "cdn.outcome.dedup_skipped.unauthorized":
    "Проверка на дубликат требует входа в аккаунт; загрузка выполнена без неё",
  "cdn.outcome.dedup_skipped.check_failed":
    "Проверка на дубликат не ответила; загрузка выполнена без неё",

  "cdn.item.cancel": "Отменить",
  "cdn.item.retry": "Повторить",
  "cdn.item.remove": "Удалить",
  "cdn.item.move_earlier": "Переместить назад",
  "cdn.item.move_later": "Переместить вперёд",
  "cdn.item.cover": "Главное фото",
  "cdn.item.alt": "Загруженное фото",

  "cdn.gallery.count": "{used} из {max} фото",
  "cdn.gallery.empty": "Фото пока нет",

  "cdn.upload.blocked.full": "В галерее не больше {max} фото",
  "cdn.upload.blocked.pending": "Дождитесь окончания загрузки",
  "cdn.upload.blocked.failed": "Удалите или повторите неудавшиеся фото",
};

/** Register the Russian bundle into a core i18n engine. */
export function registerCdnI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, cdnI18nBundleRu);
}
