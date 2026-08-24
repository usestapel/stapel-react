import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { notificationsI18nBundleEn } from "./keys.js";
import { notificationsErrorBundleEs } from "./generated/errors.es.gen.js";

export { notificationsErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for notifications-react — the pair's `es` locale, shipped as the
 * `@stapel/notifications-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the tree-shake
 * purity test).
 *
 * COVERAGE IS DECLARED, NOT DISCOVERED, AND IT IS NOW COMPLETE. The generated
 * backend error texts (from stapel-notifications's `translations/errors.es.json`
 * merged with stapel-core's and stapel-translate's catalogues — `pnpm
 * gen:errors`) are complete over the error registry by construction: the
 * generator fails on a gap and the Record type fails compilation on drift. The
 * pair-owned UI keys (`NOTIFICATIONS_I18N_KEYS`) follow, hand-written, and
 * `test/i18nEs.test.ts` asserts every one of them is present — the pair used
 * to ship zero, so a Spanish reader got Spanish error messages inside an
 * English screen.
 */
export const notificationsI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts (coverage by construction).
  ...notificationsErrorBundleEs,

  // notifications-react UI (hand-written es mirror of the en copy in keys.ts)
  "notifications.error.unknown": "Algo salió mal. Inténtalo de nuevo.",

  "notifications.feed.title": "Notificaciones",
  "notifications.feed.subtitle": "Lo que te hemos enviado últimamente.",
  "notifications.feed.empty": "Todavía no hay notificaciones",
  "notifications.feed.empty_hint":
    "Cuando haya algo que requiera tu atención, aparecerá aquí.",
  "notifications.feed.loading": "Cargando notificaciones…",
  "notifications.feed.load_more": "Cargar más",
  "notifications.feed.end": "Estás al día.",
  "notifications.feed.open": "Abrir",

  "notifications.live.on": "En vivo",
  "notifications.live.connecting": "Conectando…",
  "notifications.live.reconnecting": "Reconectando…",
  "notifications.live.polling": "Comprobando cada minuto",
  "notifications.live.polling_hint":
    "Este sitio no tiene conexión en vivo, así que la lista se actualiza cada minuto mientras esta pestaña esté abierta.",
  "notifications.live.stopped": "Las actualizaciones en vivo se detuvieron",
  "notifications.live.reconnect": "Reconectar",
  "notifications.live.refused_session":
    "Tu sesión caducó. Inicia sesión de nuevo para recuperar las actualizaciones en vivo.",
  "notifications.live.refused_origin":
    "Las actualizaciones en vivo no están configuradas para este sitio. La lista sigue actualizándose cada minuto.",
  "notifications.live.refused_forbidden":
    "Esta cuenta no puede recibir actualizaciones en vivo.",
  "notifications.live.refused_unknown":
    "Las actualizaciones en vivo no están disponibles en este servidor.",
  "notifications.live.refused_revoked":
    "El servidor finalizó las actualizaciones en vivo.",

  "notifications.settings.push.title": "Notificaciones push",
  "notifications.settings.push.subtitle":
    "Recibe avisos en este dispositivo aunque este sitio esté cerrado.",
  "notifications.push.toggle_label": "Notificaciones push en este dispositivo",
  "notifications.push.checking": "Comprobando este dispositivo…",
  "notifications.push.on": "Activadas en este dispositivo",
  "notifications.push.off": "Desactivadas en este dispositivo",
  "notifications.push.inactive": "Registrado, pero no se le entrega nada",
  "notifications.push.inactive_hint":
    "El servicio push rechazó el token de este dispositivo. Desactiva y vuelve a activar push para registrarlo otra vez.",
  "notifications.push.unknown": "No podemos saber si push está activo aquí",
  "notifications.push.unknown_hint":
    "Este dispositivo no nos ha dado su token push, así que solo podemos mostrar los dispositivos registrados en tu cuenta.",
  "notifications.push.denied": "Las notificaciones están bloqueadas en este navegador",
  "notifications.push.denied_hint":
    "Permite las notificaciones de este sitio en los ajustes del navegador y vuelve a intentarlo.",
  "notifications.push.unsupported": "Este navegador no puede recibir push",
  "notifications.push.unsupported_hint":
    "Push necesita una conexión segura (https) y un navegador compatible.",
  "notifications.push.token_unavailable":
    "No pudimos obtener un token push de este navegador",
  "notifications.push.token_unavailable_hint":
    "Recarga la página e inténtalo de nuevo. Si sigue ocurriendo, elimina este dispositivo abajo y regístralo de nuevo.",

  "notifications.devices.title": "Dispositivos que reciben push",
  "notifications.devices.subtitle":
    "Todos los dispositivos registrados en tu cuenta. Elimina uno para dejar de enviarle avisos.",
  "notifications.devices.empty": "No hay dispositivos registrados",
  "notifications.devices.empty_hint":
    "Activa push arriba para registrar este dispositivo.",
  "notifications.devices.this_device": "Este dispositivo",
  "notifications.devices.inactive": "Sin entrega",
  "notifications.devices.last_seen": "Último registro: {when}",
  "notifications.devices.remove": "Eliminar",
  "notifications.devices.remove_question": "¿Eliminar este dispositivo?",
  "notifications.devices.remove_body":
    "Dejará de recibir notificaciones push hasta que vuelva a registrarse.",
  "notifications.platform.ios": "iPhone o iPad",
  "notifications.platform.android": "Dispositivo Android",
  "notifications.platform.web": "Navegador",

  "notifications.nav.feed": "Notificaciones",
  "notifications.nav.push": "Notificaciones push",
};

/**
 * Register the pair's `es` locale into a core i18n engine (call once at
 * startup, after {@link registerNotificationsI18n}). Layers per the merge-priority
 * convention (i18n-shipping.md §3): the en floor is registered UNDER the es
 * texts inside the `es` locale, so any key the es bundle does not carry
 * degrades to its English text rather than to a raw key. A host bundle
 * registered after this call overrides both.
 */
export function registerNotificationsI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", notificationsI18nBundleEn);
  engine.registerBundle("es", notificationsI18nBundleEs);
}
