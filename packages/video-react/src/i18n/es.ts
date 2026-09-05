import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { videoErrorBundleEs } from "./generated/errors.es.gen.js";

export { videoErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for video-react — shipped as the
 * `@stapel/video-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit and the
 * bundle-purity test).
 *
 * Same two sources as the ru bundle: the generated `videoErrorBundleEs` covers
 * the 42 cross-cutting keys stapel-core owns and localizes, and the 9 keys
 * stapel-video owns are authored below because that module ships no
 * `translations/` directory (`ERRORS_LOCALE_EXEMPT_OWNERS`). The generated
 * bundle is typed `Partial` for that reason, which is what makes the gap
 * visible to TypeScript instead of a silent English fallback.
 */
export const videoI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts for every key core owns.
  ...videoErrorBundleEs,

  // Backend error codes stapel-video owns — authored here (see above).
  "error.400.video_invalid_access_level":
    "El nivel de acceso debe ser uno de: public, scope_trusted, restricted",
  "error.400.video_invalid_usage_period":
    "El mes se indica como AAAA-MM, el número de meses entre 1 y 36, y la zona horaria debe ser una zona IANA",
  "error.400.video_invalid_webhook":
    "No se ha podido verificar el webhook del proveedor",
  "error.403.video_join_denied": "El anfitrión no te ha dejado entrar en esta sala",
  "error.403.video_not_room_host": "Solo el anfitrión de la sala puede hacer esto",
  "error.403.video_not_room_participant":
    "Esto solo lo ven las personas que están en esta sala",
  "error.404.video_participant_not_found":
    "Esa persona ya no está esperando a que la dejen entrar",
  "error.404.video_room_not_found": "Ninguna sala tiene ese código",
  // The uniform 404 — see the en bundle's note. Says nothing about WHICH of
  // the three situations it is, and never reads as "there were no calls".
  "error.404.video_scope_not_found":
    "El tiempo de llamada no está disponible para este espacio de trabajo",

  // UI copy.
  "video.error.unknown": "Algo ha ido mal. Inténtalo de nuevo.",

  "video.usage.heading": "Tiempo en llamadas",
  "video.usage.month_label": "Mes",
  "video.usage.refresh": "Actualizar",
  "video.usage.loading": "Cargando el tiempo en llamadas…",
  "video.usage.unavailable":
    "El tiempo de llamada no está disponible para este espacio de trabajo",
  "video.usage.empty": "Nadie estuvo en una llamada este mes",
  "video.usage.no_scope":
    "No hay ningún espacio de trabajo seleccionado, así que no hay nada que informar",
  "video.usage.invalid_period":
    "Ese periodo no se puede pedir: los meses deben estar entre 1 y 36",

  "video.usage.column.person": "Persona",
  "video.usage.column.talk_time": "Tiempo hablado",
  "video.usage.column.calls": "Llamadas",
  "video.usage.column.connections": "Conexiones",

  "video.usage.total.label": "Total",
  "video.usage.total.people.one": "1 persona",
  "video.usage.total.people.other": "{count} personas",
  "video.usage.total.attendances.one": "1 asistencia",
  "video.usage.total.attendances.other": "{count} asistencias",
  "video.usage.total.attendances_hint":
    "La suma de las llamadas de cada persona: tres personas en una llamada cuentan como tres",

  "video.rooms.heading": "Reuniones",
  "video.rooms.intro":
    "Empieza una reunión y comparte su código, o entra en una que te hayan enviado.",
  "video.rooms.no_directory":
    "No hay una lista de salas: se entra en una sala por su código, y esta aplicación nunca sabe de salas que no haya abierto.",
  "video.rooms.start": "Empezar una reunión",
  "video.rooms.start_hint":
    "Serás el anfitrión y decidirás quién entra si la sala de espera está activada.",
  "video.rooms.start.blocked.pending": "Creando tu reunión…",
  "video.rooms.join_heading": "Entrar en una reunión",
  "video.rooms.code_label": "Código de la reunión",
  "video.rooms.code_placeholder": "abc-defg-hij",
  "video.rooms.join": "Entrar",
  "video.rooms.join.blocked.empty": "Escribe primero el código que te enviaron.",
  "video.rooms.join.blocked.pending": "Pidiendo entrar…",
  "video.rooms.leave": "Salir de esta reunión",

  "video.room.heading": "Esta reunión",
  "video.room.code_label": "Código",
  "video.room.share_hint":
    "Cualquiera con este código puede pedir entrar.",
  "video.room.access_label": "Quién puede entrar",
  "video.room.access.public": "Cualquiera que tenga el código",
  "video.room.access.scope_trusted": "Las personas de este espacio de trabajo",
  "video.room.access.restricted": "Solo quien el anfitrión deje entrar",
  "video.room.access.unknown": "Según los ajustes del anfitrión",
  "video.room.lobby_on":
    "Sala de espera activada: el anfitrión deja entrar de uno en uno",
  "video.room.lobby_off": "Sala de espera desactivada: se entra directamente",
  "video.room.host_badge": "Eres el anfitrión",

  "video.join.admitted": "Ya estás dentro",
  "video.join.waiting": "Esperando a que el anfitrión te deje entrar",
  "video.join.waiting_hint":
    "Deja esta página abierta: te dejarán entrar sin que vuelvas a pedirlo.",
  "video.join.denied": "El anfitrión no te ha dejado entrar",
  "video.join.denied_hint":
    "Esta respuesta vale para toda la sala. Pide al anfitrión una invitación nueva.",

  "video.lobby.heading": "Esperando para entrar",
  "video.lobby.empty": "No espera nadie",
  "video.lobby.empty_hint":
    "Aquí aparece quien pide entrar mientras la sala de espera está activada.",
  "video.lobby.waiting_count.one": "1 persona esperando",
  "video.lobby.waiting_count.other": "{count} personas esperando",
  "video.lobby.admit": "Dejar entrar",
  "video.lobby.deny": "Rechazar",
  "video.lobby.deny_title": "¿Rechazar a esta persona?",
  "video.lobby.deny_body":
    "No podrá volver a pedirlo con este código, y se le dice que no la han dejado entrar.",
  "video.lobby.blocked.not_host":
    "Solo el anfitrión de la sala puede responder en la sala de espera.",
  "video.lobby.blocked.pending": "Enviando tu respuesta…",
  "video.lobby.refresh": "Comprobar otra vez",

  "video.lobby.live": "En directo",
  "video.lobby.connecting": "Conectando…",
  "video.lobby.reconnecting": "Reconectando…",
  "video.lobby.offline": "No está en directo",
  "video.lobby.offline_hint": "La lista se actualiza al pulsar Comprobar otra vez.",
  "video.lobby.refused.session":
    "Tu sesión ha caducado, así que las actualizaciones en directo se han detenido. Vuelve a iniciar sesión.",
  "video.lobby.refused.origin":
    "Esta instalación no permite actualizaciones en directo desde esta dirección. Tiene que permitirlas un administrador.",
  "video.lobby.refused.forbidden":
    "Las actualizaciones en directo no están disponibles para ti en esta sala",
  "video.lobby.refused.unknown": "Las actualizaciones en directo se han detenido",
  "video.lobby.reconnect": "Reconectar",

  "video.participants.heading": "En esta reunión",
  "video.participants.empty": "Todavía no ha entrado nadie",
  "video.participants.more":
    "En esta sala hay más personas de las que se muestran aquí",
  "video.participant.status.waiting": "Esperando",
  "video.participant.status.admitted": "En la llamada",
  "video.participant.status.denied": "Rechazada",
  "video.participant.status.left": "Se ha ido",
  "video.participant.status.unknown": "Desconocido",
  "video.participant.role.host": "Anfitrión",
  "video.participant.role.guest": "Invitado",

  "video.stage.heading": "La llamada",
  "video.stage.connecting": "Conectando con la llamada…",
  "video.stage.connected": "Ya estás conectado",
  "video.stage.failed": "No se ha podido conectar la llamada",
  "video.stage.no_peer": "El vídeo no está disponible en este dispositivo",
  "video.stage.no_peer_hint":
    "Estás en la sala y ahí se te ve, pero la imagen y el sonido no pueden empezar. Abre la sala en otro navegador o pide que activen el vídeo a quien gestiona esta aplicación.",
  "video.stage.no_token": "No hay token para esta llamada",
  "video.stage.no_token_hint":
    "El token se emite solo cuando el anfitrión te deja entrar.",
  "video.stage.no_server":
    "No hay ninguna dirección de servidor de medios configurada",
  "video.stage.leave": "Salir de la llamada",
  "video.stage.retry": "Volver a intentar la conexión",
  // ── Llamadas uno a uno ────────────────────────────────────────────────────
  "video.call.incoming.title": "Llamada entrante",
  "video.call.incoming.video": "te está llamando",
  "video.call.incoming.audio": "te está llamando — solo audio",
  "video.call.outgoing": "Llamando…",
  "video.call.accept": "Responder",
  "video.call.decline": "Rechazar",
  "video.call.cancel": "Cancelar",
  "video.call.peer_unknown": "Alguien",

  "video.call.state.ringing": "Llamando",
  "video.call.state.accepted": "En curso",
  "video.call.state.declined": "Rechazada",
  "video.call.state.missed": "Perdida",
  "video.call.state.ended": "Llamada",
  "video.call.state.failed": "No se pudo conectar",
  "video.call.state.unknown": "Llamada",

  "video.call.hang_up": "Colgar",
  "video.call.mute": "Silenciar",
  "video.call.unmute": "Activar el micrófono",
  "video.call.camera_on": "Encender la cámara",
  "video.call.camera_off": "Apagar la cámara",
  "video.call.flip_camera": "Cambiar de cámara",
  "video.call.audio_only": "Llamada de audio",
  "video.call.waiting_for_video": "Esperando su vídeo…",
  "video.call.reconnecting": "Reconectando…",
  "video.call.connection_lost": "Se ha perdido la conexión",
  "video.call.reconnect": "Reconectar",
  "video.call.media_session_artist": "Llamada",

  "video.call.mic_blocked":
    "Este sitio no puede usar tu micrófono. Permíteselo en los ajustes del navegador para este sitio.",
  "video.call.mic_failed": "No se pudo encender el micrófono",
  "video.call.camera_blocked":
    "Este sitio no puede usar tu cámara. Permíteselo en los ajustes del navegador para este sitio.",
  "video.call.camera_failed": "No se pudo encender la cámara",
  "video.call.camera_switch_failed": "Esa cámara no se pudo usar",
  "video.call.blocked.pending": "Un momento…",

  // Los seis códigos que añadió la superficie de llamadas. El 404 es UNIFORME
  // para «no existe», «no es tuya» y «ya terminó»: un id de llamada nombra a
  // dos personas y su conversación, así que un 403 confirmaría un id
  // adivinado. La frase tiene que ser cierta en los tres casos.
  "error.404.video_call_not_found": "Esa llamada no está disponible",
  "error.400.video_call_invalid_callee": "No puedes llamar a esa persona",
  "error.403.video_call_not_allowed": "No puedes llamar a esta persona",
  "error.409.video_call_busy": "Ya estás en una llamada",
  "error.409.video_call_state": "La llamada ha cambiado — vuelve a comprobarla",
  "error.503.video_call_provider_unavailable":
    "Las llamadas no están disponibles ahora mismo. Inténtalo en un momento.",
};

/** Register the Spanish bundle into a core i18n engine. */
export function registerVideoI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, videoI18nBundleEs);
}
