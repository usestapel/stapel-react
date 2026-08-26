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
  "error.400.too_many_refs":
    "Слишком много ссылок в одном запросе ({count}; максимум — {max})",
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
  "cdn.pick.drop_active": "Отпустите, чтобы добавить",
  "cdn.pick.video": "Выберите видео",
  "cdn.pick.file": "Выберите документ",

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

  // PLURAL FAMILY. Russian selects on `{max}` and defines four categories. The
  // noun here is indeclinable, so all four texts coincide — a fact about the
  // word, not a missing translation.
  "cdn.gallery.count.one": "{used} из {max} фото",
  "cdn.gallery.count.few": "{used} из {max} фото",
  "cdn.gallery.count.many": "{used} из {max} фото",
  "cdn.gallery.count.other": "{used} из {max} фото",
  "cdn.gallery.empty": "Фото пока нет",
  "cdn.gallery.empty_hint": "Первое добавленное станет главным.",

  "cdn.attachment.image_alt": "Прикреплённое фото",
  "cdn.attachment.video_alt": "Прикреплённое видео",
  "cdn.attachment.audio_alt": "Прикреплённое аудио",
  "cdn.attachment.file_label": "Документ {ext}",
  "cdn.attachment.missing": "Это вложение больше недоступно",
  "cdn.attachment.open": "Открыть",
  "cdn.attachment.download": "Скачать",
  "cdn.attachment.duration_unmeasured": "Длительность не измерена",
  "cdn.attachment.meta_partial": "Часть сведений об этом файле прочитать не удалось",
  "cdn.attachment.meta_missing": "Сведения об этом файле прочитать не удалось",
  "cdn.attachment.variants_pending": "Превью для этого вложения ещё готовятся",

  "cdn.bytes.b": "{value} Б",
  "cdn.bytes.kb": "{value} КБ",
  "cdn.bytes.mb": "{value} МБ",
  "cdn.bytes.gb": "{value} ГБ",

  "cdn.upload.blocked.full": "Галерея заполнена — максимум {max}",
  "cdn.upload.blocked.pending": "Дождитесь окончания загрузки",
  "cdn.upload.blocked.failed": "Удалите или повторите неудавшиеся фото",
};

/** Register the Russian bundle into a core i18n engine. */
export function registerCdnI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, cdnI18nBundleRu);
}
