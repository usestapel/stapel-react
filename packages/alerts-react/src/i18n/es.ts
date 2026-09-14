import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { alertsErrorBundleEs } from "./generated/errors.es.gen.js";
import { alertsI18nBundleEn } from "./keys.js";

export { alertsErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for alerts-react — shipped as the
 * `@stapel/alerts-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: a host that never registers it never carries these strings (the main
 * entry does not import this module).
 *
 * One source, like the Russian bundle: `alertsErrorBundleEs` is generated from
 * the module's own `translations/errors.es.json` merged over stapel-core's
 * catalogue. Only this pair's UI copy is authored here.
 */
export const alertsI18nBundleEs: I18nDictionary = {
  // Every backend code, in es — the module's own catalogue merged over core's.
  ...alertsErrorBundleEs,

  // alerts-react UI
  "alerts.error.unknown": "Algo salió mal. Inténtalo de nuevo.",
  "alerts.nav.feed": "Errores",
  "alerts.nav.issue": "Incidencia",
  "alerts.value.none": "—",
  "alerts.dialog.dismiss": "Cerrar",
  "alerts.dialog.cancel": "Cancelar",

  "alerts.feed.title": "Errores",
  "alerts.feed.intro":
    "Todos los fallos que ha registrado este conjunto de servicios, una fila cada uno, con la actividad más reciente arriba.",
  "alerts.feed.loading": "Leyendo el registro…",
  "alerts.feed.failed": "No se pudo leer el registro.",
  "alerts.feed.empty": "No ha fallado nada",
  "alerts.feed.emptyHint":
    "Ningún servicio ha informado de un error. Así se ve un sistema tranquilo: el registro responde y no tiene nada que mostrar.",
  "alerts.feed.emptyFiltered": "Ninguna incidencia coincide con estos filtros",
  "alerts.feed.emptyFilteredHint":
    "Fuera de ellos algo puede seguir fallando: quita los filtros para ver el tablero completo.",
  "alerts.feed.staffOnly": "El registro es solo para el personal",
  "alerts.feed.staffOnlyHint":
    "Has iniciado sesión, pero esta cuenta no es de personal. Aquí no hay nada no porque esté vacío, sino porque no te corresponde leerlo.",
  "alerts.feed.signedOut": "Inicia sesión para leer el registro",
  "alerts.feed.signedOutHint":
    "Tu sesión ya no es válida. Vuelve a iniciar sesión y el tablero regresa.",
  "alerts.feed.refresh": "Comprobar ahora",
  "alerts.feed.checking": "Comprobando…",
  "alerts.feed.upToDate": "Al día",
  "alerts.feed.range": "{from}–{to} de {total}",
  "alerts.feed.previous": "Anterior",
  "alerts.feed.next": "Siguiente",
  "alerts.feed.groupSummary": "{issues} incidencias · {count} apariciones",

  "alerts.col.issue": "Incidencia",
  "alerts.col.level": "Nivel",
  "alerts.col.count": "Apariciones",
  "alerts.col.firstSeen": "Primera vez",
  "alerts.col.lastSeen": "Última vez",
  "alerts.col.status": "Estado",
  "alerts.row.open": "Abrir",
  "alerts.row.sinceFix": "{count} desde la corrección",
  "alerts.row.seenRange": "primera {first} · última {last}",

  "alerts.level.debug": "Depuración",
  "alerts.level.info": "Información",
  "alerts.level.warning": "Advertencia",
  "alerts.level.error": "Error",
  "alerts.level.fatal": "Crítico",
  "alerts.level.unknown": "Desconocido ({level})",

  "alerts.kind.exception": "Excepción",
  "alerts.kind.log": "Registro",
  "alerts.kind.dlq": "Trabajo perdido",
  "alerts.kind.monitoring": "Punto ciego de monitorización",
  "alerts.kind.manual": "Informado a mano",
  "alerts.kind.unknown": "Desconocido ({kind})",

  "alerts.status.new": "Nueva",
  "alerts.status.fixed": "Corregida",
  "alerts.status.regressed": "Ha vuelto",
  "alerts.status.muted": "Silenciada",
  "alerts.status.unknown": "Desconocido ({status})",

  "alerts.filter.status": "Estado",
  "alerts.filter.level": "Nivel",
  "alerts.filter.service": "Servicio",
  "alerts.filter.since": "Activa desde",
  "alerts.filter.openOnly": "Solo abiertas",
  "alerts.filter.openOnlyHint": "Nuevas y las que han vuelto",
  "alerts.filter.anyStatus": "Cualquier estado",
  "alerts.filter.anyLevel": "Cualquier nivel",
  "alerts.filter.anyService": "Cualquier servicio",
  "alerts.filter.sinceAny": "Cualquier momento",
  "alerts.filter.sinceDay": "Últimas 24 horas",
  "alerts.filter.sinceWeek": "Últimos 7 días",
  "alerts.filter.sinceMonth": "Últimos 30 días",
  "alerts.filter.clear": "Quitar filtros",

  "alerts.detail.title": "Incidencia",
  "alerts.detail.loading": "Leyendo la incidencia…",
  "alerts.detail.failed": "No se pudo leer esta incidencia.",
  "alerts.detail.notFound": "No existe esa incidencia",
  "alerts.detail.notFoundHint":
    "Nunca se registró aquí, o una limpieza la borró después de cerrarla. Una incidencia abierta no se borra nunca, por antigua que sea.",
  "alerts.detail.service": "Servicio",
  "alerts.detail.environment": "Entorno",
  "alerts.detail.kind": "Origen",
  "alerts.detail.fingerprint": "Huella",
  "alerts.detail.count": "Apariciones",
  "alerts.detail.sinceFix": "Desde la corrección",
  "alerts.detail.firstSeen": "Primera vez",
  "alerts.detail.lastSeen": "Última vez",
  "alerts.detail.fixedIn": "Corregida en",
  "alerts.detail.fixedSha": "Commit",
  "alerts.detail.fixedAt": "Cerrada",
  "alerts.detail.mutedUntil": "Silenciada hasta",
  "alerts.detail.mutedForever": "Silenciada sin plazo",
  "alerts.detail.note": "Nota",
  "alerts.detail.regressed": "Esto ha vuelto después de cerrarse",
  "alerts.detail.regressedHint":
    "Lo marcó el propio almacén al llegar un evento nuevo de una incidencia cerrada en {version}. Nadie puede afirmarlo ni ocultarlo a mano.",
  "alerts.detail.sentry": "Evento en Sentry",
  "alerts.detail.markFixed": "Marcar corregida",
  "alerts.detail.mute": "Silenciar",
  "alerts.detail.reopen": "Reabrir",
  "alerts.detail.reopenConfirm":
    "Devuelve la incidencia al tablero como nueva. La versión que reclamaba la corrección sigue registrada.",
  "alerts.detail.events": "Apariciones",
  "alerts.detail.eventsHint":
    "Las últimas {shown} de {count}. Las demás se borran por retención: el contador es el hecho, esto es la muestra.",
  "alerts.detail.eventsEmpty": "No queda guardada ninguna aparición",
  "alerts.detail.eventsEmptyHint":
    "La limpieza borró los eventos de esta incidencia. La fila permanece: borrarla convertiría «sin resolver» en «nunca ocurrió».",
  "alerts.detail.trace": "Traza",
  "alerts.detail.noTrace": "Esta aparición no traía traza.",
  "alerts.detail.context": "Contexto",
  "alerts.detail.noContext": "No se registró contexto.",
  "alerts.detail.requestPath": "Petición",
  "alerts.detail.traceId": "Id de traza",
  "alerts.detail.release": "Versión",
  "alerts.detail.occurrences": "Apariciones agrupadas",
  "alerts.detail.receivedAt": "Recibida",
  "alerts.detail.redacted":
    "El almacén depura el contexto antes de escribirlo.",

  "alerts.fix.title": "Marcar corregida",
  "alerts.fix.body":
    "Indica la versión que reclama la corrección. Si vuelve a ocurrir, el almacén reabre la incidencia por su cuenta, y esto es lo que dirá qué despliegue debía haberlo detenido.",
  "alerts.fix.version": "Versión",
  "alerts.fix.versionHint": "La etiqueta del lanzamiento, p. ej. 0.42.1",
  "alerts.fix.sha": "Commit",
  "alerts.fix.shaHint": "El commit que trae la corrección",
  "alerts.fix.blank":
    "Sin ninguno de los dos también se cierra, solo que no habrá a qué apuntar cuando vuelva.",
  "alerts.fix.submit": "Marcar corregida",

  "alerts.mute.title": "Silenciar la incidencia",
  "alerts.mute.body":
    "Silenciar detiene los avisos. No detiene el registro: las apariciones siguen llegando y el contador sigue subiendo.",
  "alerts.mute.until": "Hasta",
  "alerts.mute.day": "Mañana",
  "alerts.mute.week": "La semana que viene",
  "alerts.mute.month": "El mes que viene",
  "alerts.mute.forever": "Sin plazo",
  "alerts.mute.foreverHint":
    "Nada la devolverá al tablero por sí solo. Mejor pon una fecha.",
  "alerts.mute.note": "Por qué",
  "alerts.mute.noteHint":
    "Una fila silenciada sin motivo es una trampa para quien la lea después.",
  "alerts.mute.submit": "Silenciar",
};

/**
 * Register the Spanish bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerAlertsI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, alertsI18nBundleEn);
  engine.registerBundle(locale, alertsI18nBundleEs);
}
