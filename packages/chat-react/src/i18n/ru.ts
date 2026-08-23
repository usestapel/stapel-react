import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { chatI18nBundleEn } from "./keys.js";
import { chatErrorBundleRu } from "./generated/errors.ru.gen.js";

export { chatErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for chat-react — the pair's `ru` locale, shipped as the
 * `@stapel/chat-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the bundle-purity
 * test).
 *
 * TWO SOURCES, ON PURPOSE. The generated `chatErrorBundleRu` covers the 42
 * cross-cutting keys stapel-core owns and localizes. The 12 keys stapel-chat
 * owns are NOT in it, and cannot be: the module ships no `translations/`
 * directory at all, so the generator emits a `Partial` bundle and says so in
 * its own header (`ERRORS_LOCALE_EXEMPT_OWNERS`, the stapel-forms precedent).
 * They are authored below, beside the UI copy. When upstream ships
 * `translations/errors.ru.json`, these twelve lines are deleted and the
 * generated bundle covers them — the keys and the texts do not move.
 */
export const chatI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for every key core owns.
  ...chatErrorBundleRu,

  // Backend error codes stapel-chat owns — authored here (see the note above).
  "error.400.chat_attachments_disabled": "Вложения отключены в этой установке",
  "error.400.chat_body_too_long": "Сообщение длиннее допустимого предела",
  "error.400.chat_empty_message":
    "В сообщении должен быть текст или хотя бы одно вложение",
  "error.400.chat_invalid_direct":
    "В личной переписке должен быть ровно один собеседник",
  "error.400.chat_invalid_kind": "Неизвестный тип диалога",
  "error.400.chat_invalid_reply":
    "Сообщение, на которое вы отвечаете, не из этого диалога",
  "error.400.chat_kind_disabled": "Этот тип диалога отключён в этой установке",
  "error.400.chat_not_support":
    "Это действие применимо только к обращениям в поддержку",
  "error.403.chat_not_operator":
    "Это действие доступно только оператору поддержки",
  "error.403.chat_not_participant": "Вы не участник этого диалога",
  "error.404.chat_conversation_not_found": "Диалог не найден",
  "error.409.chat_already_assigned": "Это обращение уже взято в работу",

  // chat-react UI (hand-written ru mirror of the en copy in keys.ts)
  "chat.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

  "chat.list.title": "Сообщения",
  "chat.list.empty": "Диалогов пока нет.",
  "chat.list.loading": "Загрузка диалогов…",
  "chat.list.load_more": "Показать ещё",
  "chat.list.end": "Это все диалоги.",
  "chat.list.retry": "Повторить",
  "chat.list.unread": "Непрочитанных: {count}",
  "chat.list.open": "Открыть",

  "chat.kind.direct": "Личная переписка",
  "chat.kind.group": "Групповой диалог",
  "chat.kind.support": "Поддержка",

  "chat.thread.loading": "Загрузка сообщений…",
  "chat.thread.empty": "Сообщений пока нет. Напишите первым.",
  "chat.thread.retry": "Повторить",
  "chat.thread.load_older": "Показать более ранние",
  "chat.thread.beginning": "Это начало переписки.",
  "chat.thread.system": "Системное сообщение",

  "chat.composer.placeholder": "Напишите сообщение…",
  "chat.composer.send": "Отправить",
  "chat.composer.sending": "Отправка…",
  "chat.composer.blocked.empty": "Сначала напишите текст.",
  "chat.composer.blocked.too_long":
    "Это длиннее {max} символов — немного сократите.",

  "chat.start.button": "Написать продавцу",
  "chat.start.starting": "Открываем…",
  "chat.start.blocked.self": "Это ваше собственное объявление.",
  "chat.start.blocked.unknown_seller": "У этого объявления не указан продавец.",
  "chat.start.blocked.sign_in": "Войдите, чтобы написать продавцу.",
  "chat.start.blocked.mandate_unknown": "Проверяем вашу сессию…",
  "chat.start.sign_in": "Войти",

  "chat.transport.live": "На связи",
  "chat.transport.polling": "Обновляется каждые несколько секунд",
  "chat.transport.idle": "Приостановлено",

  "chat.nav.conversations": "Сообщения",
};

/**
 * Register the pair's `ru` locale into a core i18n engine (call once at
 * startup, after {@link registerChatI18n}). Layers per the merge-priority
 * convention (i18n-shipping.md §3): the en floor is registered UNDER the ru
 * texts inside the `ru` locale, so a key the ru bundle ever misses degrades to
 * its English text — never to a raw key.
 */
export function registerChatI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", chatI18nBundleEn);
  engine.registerBundle("ru", chatI18nBundleRu);
}
