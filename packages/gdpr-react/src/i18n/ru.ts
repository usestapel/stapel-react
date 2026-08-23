import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { gdprErrorBundleRu } from "./generated/errors.ru.gen.js";

export { gdprErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for gdpr-react — shipped as the `@stapel/gdpr-react/i18n/ru`
 * subpath (i18n-shipping.md §2) so the locale is opt-in: hosts that don't
 * register it never carry these strings (the main entry does not import this
 * module — gated by size-limit and the bundle-purity test).
 *
 * ONE SOURCE FOR THE ERRORS, unlike most pairs. stapel-gdpr ships
 * `translations/errors.ru.json` covering all fifteen keys it owns, and
 * stapel-core supplies the forty-two cross-cutting ones, so
 * `gdprErrorBundleRu` is COMPLETE over the registry — there is no
 * `ERRORS_LOCALE_EXEMPT_OWNERS` here and nothing to author by hand (contrast
 * `@stapel/video-react` / `@stapel/chat-react`, whose modules ship no
 * `translations/` at all). What is authored below is this pair's own UI copy,
 * plus the same four deliberate OVERRIDES the en bundle makes.
 *
 * The overrides matter more in Russian than they look. The registry's text for
 * `error.404.gdpr.no_active_closure` is a sentence about a REQUEST that does
 * not exist — which, on the screen a person opens to ask whether their account
 * is being deleted, reads as "your request vanished". The model layer folds
 * that 404 into `null` so it should never reach a screen at all; and if a host
 * renders the raw error anyway, it must still read as reassurance rather than
 * as loss.
 */
export const gdprI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts, complete over the registry.
  ...gdprErrorBundleRu,

  // The four overrides (see the header, and the en bundle's note).
  "error.404.gdpr.no_active_closure": "Аккаунт не запланирован к удалению",
  "error.404.gdpr.export_not_found": "Вы ещё не запрашивали копию своих данных",
  "error.409.gdpr.legal_hold":
    "Эти данные удерживаются по юридическому требованию и пока не могут быть удалены. Поддержка объяснит причину.",
  "error.409.gdpr.export_cooldown":
    "Копию данных можно запрашивать раз в 30 дней",

  // UI copy.
  "gdpr.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "gdpr.action.retry": "Повторить",
  "gdpr.admin.staff_only":
    "Этот раздел — для сотрудников. Вы вошли под аккаунтом без доступа к нему.",

  "gdpr.privacy.heading": "Приватность и ваши данные",
  "gdpr.admin.heading": "Приватность: операции",

  "gdpr.closure.heading": "Удаление аккаунта",
  "gdpr.closure.explain":
    "Удаление аккаунта запускает 30-дневный период ожидания. Мы сразу завершим все ваши сессии, но до конца этого периода решение можно отменить.",
  "gdpr.closure.loading": "Проверяем аккаунт…",
  "gdpr.closure.none": "Аккаунт не запланирован к удалению",
  "gdpr.closure.initiate": "Удалить аккаунт",
  "gdpr.closure.confirm_title": "Удалить этот аккаунт?",
  "gdpr.closure.confirm_body":
    "Вы выйдете из аккаунта на всех устройствах сейчас. Данные будут удалены по окончании периода ожидания — {date}.",
  "gdpr.closure.confirm_ok": "Да, начать удаление",
  "gdpr.closure.confirm_cancel": "Не сейчас",
  "gdpr.closure.scheduled": "Аккаунт будет удалён {date}",
  "gdpr.closure.cancel": "Оставить аккаунт",
  "gdpr.closure.cancelled": "Удаление отменено — аккаунт снова активен",
  "gdpr.closure.deleting": "Аккаунт удаляется. Отменить это уже нельзя.",
  "gdpr.closure.deleted": "Этот аккаунт удалён",

  "gdpr.deletions.heading": "Ожидает удаления",
  "gdpr.deletions.loading": "Загружаем список удаляемого…",
  "gdpr.deletions.empty": "Ничего из ваших данных не ожидает удаления",
  "gdpr.deletions.column.subject": "Объект",
  "gdpr.deletions.column.state": "Состояние",
  "gdpr.deletions.column.due": "Удалим у себя до",
  "gdpr.deletions.column.fully_erased": "Удалят везде до",
  "gdpr.deletions.fully_erased_hint":
    "Наши системы заканчивают первыми; у сервисов, которыми мы пользуемся, свои договорные сроки — вторая дата и есть закрытие последнего из них.",
  "gdpr.deletions.waiting_on": "Ждём: {owners}",
  "gdpr.deletions.state.queued": "В очереди",
  "gdpr.deletions.state.erasing": "Удаляется",
  "gdpr.deletions.state.deleted": "Удалено",
  "gdpr.deletions.state.timeout": "Просрочено",
  "gdpr.deletions.timeout_hint":
    "Одна из систем, где хранится часть этих данных, не подтвердила удаление. Поддержка уже уведомлена; объект не потерян из виду.",

  "gdpr.subject.account": "Аккаунт",
  "gdpr.subject.workspace": "Пространство",
  "gdpr.subject.meeting": "Встреча",
  "gdpr.subject.recording": "Запись",
  "gdpr.subject.document": "Документ",
  "gdpr.subject.file": "Файл",

  "gdpr.export.heading": "Скачать свои данные",
  "gdpr.export.explain":
    "Мы соберём архив со всем, что храним о вас. Он готовится до 48 часов; запрашивать можно раз в 30 дней.",
  "gdpr.export.loading": "Проверяем ваш архив…",
  "gdpr.export.none": "Вы ещё не запрашивали копию своих данных",
  "gdpr.export.request": "Запросить мои данные",
  "gdpr.export.requested":
    "Собираем архив. Мы напишем вам, когда он будет готов.",
  "gdpr.export.progress": "Готово разделов: {done} из {total}",
  "gdpr.export.partial": "Некоторые разделы не удалось включить: {services}",
  "gdpr.export.expires": "Ссылка на скачивание действует до {date}",
  "gdpr.export.download": "Скачать архив",
  "gdpr.export.token_hint":
    "Ссылка на скачивание — в письме, которое мы вам отправили. Она одноразовая, и архив удаляется сразу после выдачи.",
  "gdpr.export.state.pending": "В очереди",
  "gdpr.export.state.processing": "Готовится",
  "gdpr.export.state.ready": "Готов",
  "gdpr.export.state.failed": "Ошибка",
  "gdpr.export.state.expired": "Истёк",

  "gdpr.dsar.heading": "Обращение по защите данных",
  "gdpr.dsar.explain":
    "Запросите копию своих данных, исправление или удаление. Мы подтверждаем получение в течение трёх рабочих дней и отвечаем в течение 30 дней.",
  "gdpr.dsar.kind_label": "Что вы хотите?",
  "gdpr.dsar.kind.access": "Копию моих данных",
  "gdpr.dsar.kind.erasure": "Удаление моих данных",
  "gdpr.dsar.kind.rectification": "Исправление",
  "gdpr.dsar.kind.portability": "Мои данные в переносимом формате",
  "gdpr.dsar.email_label": "Ваш адрес электронной почты",
  "gdpr.dsar.email_required": "Без адреса почты мы не сможем вам ответить",
  "gdpr.dsar.note_label": "Что добавить к обращению",
  "gdpr.dsar.submit": "Отправить",
  "gdpr.dsar.submitted": "Обращение принято. Подтверждение отправлено вам на почту.",
  "gdpr.dsar.reference": "Ваш номер обращения: {id}",
  "gdpr.dsar.ack_by": "Подтверждение — до {date}",
  "gdpr.dsar.resolve_by": "Ответ — до {date}",

  "gdpr.queue.heading": "Обращения по защите данных",
  "gdpr.queue.loading": "Загружаем обращения…",
  "gdpr.queue.empty": "Обращений нет",
  "gdpr.queue.column.reference": "№",
  "gdpr.queue.column.kind": "Запрос",
  "gdpr.queue.column.channel": "Канал",
  "gdpr.queue.column.subject": "Заявитель",
  "gdpr.queue.column.state": "Состояние",
  "gdpr.queue.column.ack_due": "Подтвердить до",
  "gdpr.queue.column.resolve_due": "Ответить до",
  "gdpr.queue.overdue": "Просрочено",
  "gdpr.queue.ack_sent": "Подтверждено {date}",
  "gdpr.queue.ack_missing": "Подтверждение не отправлено",
  "gdpr.queue.save_note": "Сохранить заметку",
  "gdpr.queue.state.received": "Получено",
  "gdpr.queue.state.acknowledged": "Подтверждено",
  "gdpr.queue.state.in_progress": "В работе",
  "gdpr.queue.state.resolved": "Закрыто",
  "gdpr.queue.state.rejected": "Отклонено",
  "gdpr.queue.channel.app": "В приложении",
  "gdpr.queue.channel.form": "Публичная форма",
  "gdpr.queue.channel.email": "Почта",

  "gdpr.owners.heading": "Владельцы данных",
  "gdpr.owners.explain":
    "Каждая система, где лежат персональные данные, отвечает на ежедневный опрос из того же подписчика, который выполняет удаление. Система, переставшая отвечать, — это система, чьи удаления никто не подтверждает.",
  "gdpr.owners.loading": "Загружаем владельцев данных…",
  "gdpr.owners.empty":
    "Ни один владелец данных не объявлен — удаление некому исполнять",
  "gdpr.owners.column.owner": "Система",
  "gdpr.owners.column.state": "Состояние",
  "gdpr.owners.column.last_alive": "Последний ответ",
  "gdpr.owners.column.subjects": "Хранит",
  "gdpr.owners.alive": "Отвечает",
  "gdpr.owners.silent": "Молчит",
  "gdpr.owners.never_answered": "Не отвечала ни разу",
  "gdpr.owners.silent_count": "Не отвечают систем: {count} из {total}",
  "gdpr.owners.subject_mismatch":
    "Объявлено {declared}, отвечает за {answered}",
};

/** Register the Russian bundle into a core i18n engine. */
export function registerGdprI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, gdprI18nBundleRu);
}
