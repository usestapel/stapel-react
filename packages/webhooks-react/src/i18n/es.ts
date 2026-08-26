import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { webhooksI18nBundleEn } from "./keys.js";
import { webhooksErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for webhooks-react — shipped as the
 * `@stapel/webhooks-react/i18n/es` subpath (i18n-shipping.md §2) so the locale
 * is opt-in: a host that never registers it never carries these strings (the
 * main entry does not import this module).
 *
 * The backend error catalogue for this locale is spread in FIRST, exactly as
 * `keys.ts` spreads the en one, so every backend code keeps coverage by
 * construction. The pair's own UI keys follow.
 */
export const webhooksI18nBundleEs: I18nDictionary = {
  ...webhooksErrorBundleEs,

  "webhooks.error.unknown": "Algo salió mal. Inténtalo de nuevo.",
  "webhooks.nav.webhooks": "Webhooks",

  "webhooks.title": "Webhooks",
  "webhooks.intro":
    "Envía los eventos de este espacio de trabajo a tus propios sistemas, en el momento en que ocurren.",
  "webhooks.empty": "Aún no hay webhooks",
  "webhooks.emptyHint":
    "Un webhook envía un evento a una URL tuya en cuanto sucede — un anuncio nuevo, una reserva completada — para que tus sistemas reaccionen en vez de consultar los nuestros.",
  "webhooks.docs": "Cómo recibir y verificar eventos",
  "webhooks.new": "Nuevo webhook",
  "webhooks.loading": "Cargando webhooks…",
  "webhooks.failed": "No pudimos cargar tus webhooks.",
  "webhooks.mandate": "No pudimos verificar tu acceso al espacio de trabajo",
  "webhooks.mandateHint":
    "Es cosa nuestra, no de tu configuración. Vuelve a intentarlo en un momento.",
  "webhooks.never": "—",

  "webhooks.col.event": "Evento",
  "webhooks.col.delivery": "Entrega",
  "webhooks.col.target": "Destino",
  "webhooks.col.active": "Activo",
  "webhooks.col.strikes": "Fallos",
  "webhooks.col.lastDelivery": "Última entrega",
  "webhooks.col.actions": "Acciones",
  "webhooks.strikes": "{count} seguidos",
  "webhooks.autoDisabled":
    "Desactivado automáticamente tras varias entregas fallidas seguidas.",
  "webhooks.disabledAt": "Desactivado el {date}",
  "webhooks.active.label": "Activo",
  "webhooks.active.on": "Recibiendo eventos",
  "webhooks.active.off": "Sin recibir eventos",
  "webhooks.active.reactivatedNote":
    "Al volver a activarlo se pone a cero el contador de fallos, así que dispone otra vez de todos los reintentos.",
  "webhooks.edit": "Editar",
  "webhooks.openLog": "Entregas",
  "webhooks.remove": "Eliminar",
  "webhooks.removeConfirm": "¿Eliminar este webhook?",
  "webhooks.removeConfirmBody":
    "Su historial de entregas se va con él, incluidas las fallidas que no hayas reenviado. Esto no se puede deshacer.",

  "webhooks.form.title": "Nuevo webhook",
  "webhooks.form.editTitle": "Editar webhook",
  "webhooks.form.event": "Evento",
  "webhooks.form.eventHint":
    "Solo se listan los eventos que emiten realmente los módulos instalados aquí.",
  "webhooks.form.eventPlaceholder": "Elige un evento",
  "webhooks.form.delivery": "Entrega",
  "webhooks.form.target": "Destino",
  "webhooks.form.url": "URL",
  "webhooks.form.urlHint": "Debe ser https — no enviamos eventos por http.",
  "webhooks.form.notificationType": "Tipo de notificación",
  "webhooks.form.recipient": "Destinatario",
  "webhooks.form.stream": "Canal",
  "webhooks.form.path": "Ruta del manejador",
  "webhooks.form.targetField": "{field}",
  "webhooks.form.filter": "Filtro (opcional)",
  "webhooks.form.filterHint":
    "Una condición JSON sobre los datos del evento. Déjalo vacío para recibir todos los eventos de este tipo.",
  "webhooks.form.description": "Descripción",
  "webhooks.form.submit": "Crear webhook",
  "webhooks.form.save": "Guardar cambios",
  "webhooks.form.needsEvent": "Elige el evento al que reacciona este webhook.",
  "webhooks.form.needsDelivery": "Elige cómo se debe entregar el evento.",
  "webhooks.form.noChanges": "Todavía no ha cambiado nada.",
  "webhooks.form.unknownDeliveryTarget":
    "Este tipo de entrega lo añadió esta instalación, así que su destino se edita como JSON.",

  "webhooks.delivery.webhook": "Petición HTTPS",
  "webhooks.delivery.notification": "Notificación",
  "webhooks.delivery.ws": "Canal en vivo",
  "webhooks.delivery.custom": "Manejador interno",
  "webhooks.delivery.unknown": "{delivery}",

  "webhooks.target.missing": "«{field}» es obligatorio para este tipo de entrega.",
  "webhooks.target.noRecipient":
    "Indica un destinatario: un usuario, un correo, un teléfono o un chat de Telegram.",
  "webhooks.target.insecure":
    "La URL debe empezar por https:// — los eventos nunca se envían por http.",

  "webhooks.filter.notJson": "Esto no es JSON válido: {detail}",
  "webhooks.filter.notObject": "Un filtro debe ser un objeto JSON.",
  "webhooks.filter.tooDeep":
    "Un filtro puede anidarse como mucho {limit} niveles.",
  "webhooks.filter.badKey": "La clave de un filtro debe ser texto no vacío.",
  "webhooks.filter.badPath": "«{path}» no es una ruta válida del evento.",
  "webhooks.filter.unknownGroupOp":
    "«{op}» no es un operador de agrupación. Usa $or, $and o $not.",
  "webhooks.filter.groupNeedsList": "{op} recibe una lista no vacía de filtros.",
  "webhooks.filter.emptyMatcher": "«{path}» tiene una condición vacía.",
  "webhooks.filter.unknownFieldOp": "«{path}»: {op} no es un operador que ejecutemos.",
  "webhooks.filter.opNeedsList": "«{path}»: {op} recibe una lista de valores.",
  "webhooks.filter.opNeedsBoolean": "«{path}»: {op} recibe true o false.",
  "webhooks.filter.opNeedsString": "«{path}»: {op} recibe texto.",
  "webhooks.filter.opNeedsNumber": "«{path}»: {op} recibe un número.",
  "webhooks.filter.valid": "El filtro es correcto.",

  "webhooks.secret.title": "Secreto de firma",
  "webhooks.secret.shownOnce":
    "Es la única vez que se muestra este secreto. Guárdalo ahora: solo conservamos un hash y no podremos volver a enseñarlo.",
  "webhooks.secret.copy": "Copiar el secreto de firma",
  "webhooks.secret.copied": "Copiado",
  "webhooks.secret.ack": "He guardado este secreto",
  "webhooks.secret.close": "Listo",
  "webhooks.secret.docs": "Cómo verificar la firma",
  "webhooks.secret.rotate": "Rotar secreto",
  "webhooks.secret.rotateConfirm": "¿Rotar el secreto de firma?",
  "webhooks.secret.rotateConfirmBody":
    "El secreto anterior deja de funcionar de inmediato: no hay solapamiento. Cada entrega será rechazada hasta que actualices tu receptor, y con suficientes rechazos el webhook se desactiva.",
  "webhooks.secret.rotateUnsigned":
    "Las entregas de tipo «{delivery}» no se firman, así que no hay secreto que rotar.",
  "webhooks.secret.rotateUnsaved": "Crea primero el webhook.",
  "webhooks.secret.present": "Hay un secreto de firma.",
  "webhooks.secret.absent": "Sin secreto de firma.",

  "webhooks.log.title": "Entregas",
  "webhooks.log.empty": "Todavía no se ha entregado nada",
  "webhooks.log.emptyHint":
    "Los intentos aparecerán aquí en cuanto un evento coincida con este webhook.",
  "webhooks.log.retention":
    "Las entregas correctas se guardan {succeededDays} días; las fallidas, {deadDays}.",
  "webhooks.log.status": "Estado",
  "webhooks.log.status.pending": "En cola",
  "webhooks.log.status.retrying": "Reintentando",
  "webhooks.log.status.succeeded": "Entregado",
  "webhooks.log.status.dead": "Fallida",
  "webhooks.log.status.unknown": "Desconocido ({status})",
  "webhooks.log.status.all": "Cualquier estado",
  "webhooks.log.attempts": "Intentos",
  "webhooks.log.response": "Respuesta",
  "webhooks.log.error": "Error",
  "webhooks.log.next": "Próximo intento",
  "webhooks.log.last": "Último intento",
  "webhooks.log.replay": "Reenviar",
  "webhooks.log.replayOnlyDead":
    "Solo se puede reenviar una entrega fallida — esta está {status}.",
  "webhooks.log.replayed": "De vuelta en la cola, desde el primer intento.",
  "webhooks.log.payload": "Datos del evento",
  "webhooks.log.polling": "Buscando novedades…",
  "webhooks.log.openDetail": "Abrir esta entrega",

  "webhooks.detail.title": "Entrega",
  "webhooks.detail.envelope": "Sobre",
  "webhooks.detail.headers": "Cabeceras",
  "webhooks.detail.reconstructed":
    "Reconstruido a partir del evento guardado: es lo que enviaría un reenvío, no una grabación de la petición original.",
  "webhooks.detail.response": "Código de respuesta",
  "webhooks.detail.noResponse": "No se recibió respuesta.",
  "webhooks.detail.lastError": "Último error",

  "webhooks.dialog.dismiss": "Cerrar",
};

/**
 * Register the Spanish bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerWebhooksI18nEs(
  engine: I18nEngine,
  locale = "es"
): void {
  engine.registerBundle(locale, webhooksI18nBundleEn);
  engine.registerBundle(locale, webhooksI18nBundleEs);
}
