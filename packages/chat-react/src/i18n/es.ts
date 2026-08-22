import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { chatI18nBundleEn } from "./keys.js";
import { chatErrorBundleEs } from "./generated/errors.es.gen.js";

export { chatErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for chat-react — the pair's `es` locale, shipped as the
 * `@stapel/chat-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in.
 *
 * Same two sources as the `ru` bundle: the generated `chatErrorBundleEs`
 * carries the keys stapel-core owns; the 12 keys stapel-chat owns are authored
 * here because the module ships no `translations/` directory (see `ru.ts` for
 * the full note). Unlike notifications-react's es bundle, this one DOES carry
 * hand-written UI copy — a marketplace's buyer-to-seller chat is the surface
 * where a half-translated screen is most obvious.
 */
export const chatI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts for every key core owns.
  ...chatErrorBundleEs,

  // Backend error codes stapel-chat owns — authored here (see the note above).
  "error.400.chat_attachments_disabled":
    "Los archivos adjuntos no están habilitados en esta instalación",
  "error.400.chat_body_too_long": "El mensaje supera la longitud máxima permitida",
  "error.400.chat_empty_message":
    "Un mensaje debe llevar texto o al menos un archivo adjunto",
  "error.400.chat_invalid_direct":
    "Una conversación directa necesita exactamente un interlocutor",
  "error.400.chat_invalid_kind": "Tipo de conversación desconocido",
  "error.400.chat_invalid_reply":
    "El mensaje al que respondes no pertenece a esta conversación",
  "error.400.chat_kind_disabled":
    "Este tipo de conversación no está habilitado en esta instalación",
  "error.400.chat_not_support":
    "Esta acción solo se aplica a conversaciones de soporte",
  "error.403.chat_not_operator":
    "Solo un operador de soporte puede realizar esta acción",
  "error.403.chat_not_participant": "No participas en esta conversación",
  "error.404.chat_conversation_not_found": "Conversación no encontrada",
  "error.409.chat_already_assigned": "Esta conversación de soporte ya está asignada",

  // chat-react UI (hand-written es mirror of the en copy in keys.ts)
  "chat.error.unknown": "Algo ha salido mal. Inténtalo de nuevo.",

  "chat.list.title": "Mensajes",
  "chat.list.empty": "Todavía no hay conversaciones.",
  "chat.list.loading": "Cargando conversaciones…",
  "chat.list.load_more": "Cargar más",
  "chat.list.end": "Esto es todo.",
  "chat.list.retry": "Reintentar",
  "chat.list.unread": "{count} sin leer",
  "chat.list.open": "Abrir",

  "chat.kind.direct": "Mensaje directo",
  "chat.kind.group": "Grupo",
  "chat.kind.support": "Soporte",

  "chat.thread.loading": "Cargando mensajes…",
  "chat.thread.empty": "Todavía no hay mensajes. Saluda.",
  "chat.thread.retry": "Reintentar",
  "chat.thread.load_older": "Ver mensajes anteriores",
  "chat.thread.beginning": "Este es el principio de la conversación.",
  "chat.thread.system": "Sistema",

  "chat.composer.placeholder": "Escribe un mensaje…",
  "chat.composer.send": "Enviar",
  "chat.composer.sending": "Enviando…",
  "chat.composer.blocked.empty": "Escribe algo primero.",
  "chat.composer.blocked.too_long":
    "Eso supera los {max} caracteres — acórtalo un poco.",

  "chat.start.button": "Escribir al vendedor",
  "chat.start.starting": "Abriendo…",
  "chat.start.blocked.self": "Este anuncio es tuyo.",
  "chat.start.blocked.unknown_seller": "Este anuncio no tiene vendedor a quien escribir.",

  "chat.transport.live": "En directo",
  "chat.transport.polling": "Actualizando cada pocos segundos",
  "chat.transport.idle": "En pausa",

  "chat.nav.conversations": "Mensajes",
};

/**
 * Register the pair's `es` locale into a core i18n engine (call once at
 * startup, after {@link registerChatI18n}). The en floor is registered UNDER
 * the es texts inside the `es` locale, so any key the es bundle does not carry
 * degrades to its English text rather than to a raw key.
 */
export function registerChatI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", chatI18nBundleEn);
  engine.registerBundle("es", chatI18nBundleEs);
}
