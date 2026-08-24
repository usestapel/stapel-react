import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { recordingsErrorBundleRu } from "./generated/errors.ru.gen.js";

export { recordingsErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for recordings-react — the `@stapel/recordings-react/i18n/ru`
 * subpath (i18n-shipping.md §2), opt-in: a host that never registers it does
 * not carry these strings (the main entry does not import this module — gated
 * by size-limit and the bundle-purity test).
 *
 * Unlike the pairs whose backend ships no catalogs, EVERY error code here is
 * generated: stapel-recordings carries `translations/errors.ru.json` for its
 * own seventeen codes and stapel-core covers the cross-cutting ones, so
 * `recordingsErrorBundleRu` is complete and nothing below re-authors an
 * `error.*` key. What is authored here is the UI copy — the recordings screens
 * are worked in for minutes at a time, and a half-translated player with a
 * Russian menu around it is visible immediately.
 */
export const recordingsI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts, module-owned and core-owned.
  ...recordingsErrorBundleRu,

  "recordings.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "recordings.retry": "Повторить",

  "recordings.status.created": "Создана",
  "recordings.status.uploading": "Загружается",
  "recordings.status.queued": "В очереди",
  "recordings.status.analyzing": "Анализируем",
  "recordings.status.normalizing": "Готовим звук",
  "recordings.status.transcribing": "Расшифровываем",
  "recordings.status.diarizing": "Различаем говорящих",
  "recordings.status.merging": "Собираем расшифровку",
  "recordings.status.completed": "Готово",
  "recordings.status.error": "Ошибка",
  "recordings.status.deleted": "Удалена",
  "recordings.status.unknown": "Неизвестное состояние",
  "recordings.status.processing_label": "В обработке",

  "recordings.list.heading": "Записи",
  "recordings.list.loading": "Загружаем ваши записи…",
  "recordings.list.empty": "Записей пока нет.",
  "recordings.list.empty_hint":
    "Загрузите аудио или видео — мы сделаем расшифровку.",
  "recordings.list.load_failed":
    "Не удалось загрузить ваши записи. Это сбой на нашей стороне, а не признак того, что записей нет.",
  "recordings.list.error": "Не удалось загрузить записи.",
  "recordings.list.retry": "Повторить",
  "recordings.list.open": "Открыть запись",
  "recordings.list.workspace_note":
    "Показаны записи, которые открыты вам в этом пространстве.",

  "recordings.detail.heading": "Запись",
  "recordings.detail.back": "К списку записей",
  "recordings.detail.created": "Создана",
  "recordings.detail.duration": "Длительность",
  "recordings.detail.language": "Язык",
  "recordings.detail.provider": "Расшифровано",
  "recordings.detail.segments": "Фрагментов",
  "recordings.detail.speakers": "Говорящих",
  "recordings.detail.words": "Слов",
  "recordings.detail.processing": "Мы ещё работаем над этой записью.",
  "recordings.detail.unknown_value": "Пока неизвестно",

  "recordings.player.heading": "Воспроизведение",
  "recordings.player.label": "Аудио записи",
  "recordings.player.preparing": "Готовим воспроизведение…",
  "recordings.player.not_stored": "У этой записи нет сохранённого медиафайла.",
  "recordings.player.unavailable":
    "Выдача медиа сейчас недоступна. Запись цела, воспроизведение — нет.",
  "recordings.player.blocked_not_ready":
    "Воспроизведение появится, когда загрузка завершится.",
  "recordings.player.blocked_deleted": "Эта запись удалена.",
  "recordings.player.refresh": "Обновить воспроизведение",

  "recordings.transcript.heading": "Расшифровка",
  "recordings.transcript.empty": "Для этой записи расшифровки нет.",
  "recordings.transcript.pending":
    "Расшифровка появится здесь по мере готовности.",
  "recordings.transcript.load_more": "Показать дальше",
  "recordings.transcript.speaker_fallback": "Говорящий {number}",
  "recordings.transcript.seek": "Слушать с {time}",
  "recordings.transcript.current": "Звучит сейчас",
  "recordings.transcript.region_label": "Расшифровка, следует за звуком",

  "recordings.summary.heading": "Краткий пересказ",
  "recordings.summary.empty": "Пересказа для этой записи пока нет.",

  "recordings.resummarize.action": "Переписать пересказ",
  "recordings.resummarize.running": "Переписываем…",
  "recordings.resummarize.accepted":
    "Поставлено в очередь — новый пересказ заменит этот, когда будет готов.",
  "recordings.resummarize.blocked_no_transcript":
    "Пересказывать пока нечего: расшифровки нет.",
  "recordings.resummarize.blocked_processing":
    "Дождитесь окончания расшифровки.",
  "recordings.resummarize.blocked_in_flight":
    "Для этой записи пересказ уже переписывается.",

  "recordings.reprocess.action": "Расшифровать заново",
  "recordings.reprocess.confirm_title": "Расшифровать запись заново?",
  "recordings.reprocess.confirm_body":
    "Весь конвейер пойдёт с начала: вторая расшифровка и второе списание. Текущие расшифровка и пересказ будут заменены.",
  "recordings.reprocess.confirm_ok": "Расшифровать заново",
  "recordings.reprocess.running": "Отправляем…",
  "recordings.reprocess.blocked_not_completed":
    "Заново расшифровать можно только завершённую запись.",
  "recordings.reprocess.queued": "В очереди — расшифровка началась заново.",

  "recordings.payment.title": "Нужен доступный баланс",
  "recordings.payment.hint":
    "Расшифровка и пересказы тарифицируются. Пополните баланс, чтобы запустить это снова.",
  "recordings.payment.action": "Пополнить",

  "recordings.uploader.heading": "Новая запись",
  "recordings.uploader.pick": "Выберите аудио или видео",
  "recordings.uploader.picked": "{name} · {size}",
  "recordings.uploader.title_label": "Название",
  "recordings.uploader.title_placeholder": "О чём эта запись?",
  "recordings.uploader.source_label": "Источник",
  "recordings.uploader.language_label": "Язык речи",
  "recordings.uploader.language_auto": "Определить автоматически",
  "recordings.uploader.diarization_label": "Различать говорящих",
  "recordings.uploader.start": "Загрузить и расшифровать",
  "recordings.uploader.cancel": "Отменить загрузку",
  "recordings.uploader.step_creating": "Открываем загрузку…",
  "recordings.uploader.step_uploading": "Загружаем…",
  "recordings.uploader.step_finalizing": "Завершаем…",
  "recordings.uploader.done": "Загружено — расшифровка в очереди.",
  "recordings.uploader.progress": "{done} из {total}",
  "recordings.uploader.blocked_no_file": "Сначала выберите файл.",
  "recordings.uploader.blocked_no_title": "Дайте записи название.",
  "recordings.uploader.blocked_no_workspace":
    "Выберите пространство, в котором сохранить запись.",
  "recordings.uploader.too_large": "Файл больше, чем допускает эта загрузка.",
  "recordings.uploader.unsupported_type":
    "Это не аудио и не видео — расшифровывать нечего.",
  "recordings.uploader.session_expired":
    "Окно загрузки закрылось. Начните загрузку заново.",
  "recordings.uploader.source_meet": "Встреча",
  "recordings.uploader.source_dictaphone": "Диктофон",
  "recordings.uploader.source_upload": "Загрузка",
  "recordings.uploader.source_other": "Другое",

  "recordings.share.heading": "Запись по ссылке",
  "recordings.share.locked_title": "Ссылка защищена",
  "recordings.share.locked_hint":
    "Введите код доступа, который вам передали, чтобы открыть запись.",
  "recordings.share.passcode_label": "Код доступа",
  "recordings.share.unlock": "Открыть запись",
  "recordings.share.unlocking": "Проверяем…",
  "recordings.share.throttled":
    "Слишком много попыток. Подождите немного и попробуйте снова.",
  "recordings.share.not_found":
    "По этой ссылке ничего не открывается — её могли отозвать или у неё истёк срок.",
  "recordings.share.view_only": "По этой ссылке видны только сведения о записи.",
  "recordings.share.media_blocked": "Эта ссылка не даёт доступа к аудио.",
  "recordings.share.transcript_blocked":
    "Эта ссылка не даёт доступа к расшифровке.",
  "recordings.share.footer": "Этой записью поделились с вами по ссылке.",

  "recordings.composer.create": "Новая запись",
  "recordings.composer.creating": "Создаём…",
  "recordings.composer.created": "Запись создана — загрузите файл.",
  "recordings.upload.uploading": "Загружаем…",
  "recordings.finalize.submit": "Завершить загрузку",
  "recordings.finalize.finalizing": "Завершаем…",
  "recordings.finalize.done": "Загрузка завершена — расшифровка в очереди.",
};

/** Register the Russian bundle into a core i18n engine. */
export function registerRecordingsI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, recordingsI18nBundleRu);
}
