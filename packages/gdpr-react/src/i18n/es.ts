import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { gdprErrorBundleEs } from "./generated/errors.es.gen.js";

export { gdprErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for gdpr-react — shipped as the `@stapel/gdpr-react/i18n/es`
 * subpath (i18n-shipping.md §2) so the locale is opt-in: hosts that don't
 * register it never carry these strings (the main entry does not import this
 * module — gated by size-limit and the bundle-purity test).
 *
 * ONE SOURCE FOR THE ERRORS, as in `ru.ts`. stapel-gdpr ships
 * `translations/errors.es.json` covering all fifteen keys it owns and
 * stapel-core supplies the forty-two cross-cutting ones, so
 * `gdprErrorBundleEs` is COMPLETE over the registry and nothing below is
 * authored to paper over an upstream gap. What is authored here is this pair's
 * own UI copy, plus the same four deliberate OVERRIDES the en and ru bundles
 * make.
 *
 * The overrides matter for the same reason they do in Russian: the registry's
 * text for `error.404.gdpr.no_active_closure` is a sentence about a REQUEST
 * that does not exist ("Solicitud de cierre no encontrada"), which on the
 * screen a person opens to ask whether their account is being deleted reads as
 * "your request vanished". The model layer folds that 404 into `null` so it
 * should never reach a screen; if a host renders the raw error anyway, it must
 * still read as reassurance rather than as loss.
 *
 * Formality: `tú`, matching the module's other member-facing surfaces — this
 * is a person asking about their own data, not a contract clause.
 */
export const gdprI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts, complete over the registry.
  ...gdprErrorBundleEs,

  // The four overrides (see the header, and the en bundle's note).
  "error.404.gdpr.no_active_closure": "Tu cuenta no está programada para eliminarse",
  "error.404.gdpr.export_not_found": "Todavía no has pedido una copia de tus datos",
  "error.409.gdpr.legal_hold":
    "Estos datos están bajo una retención legal y todavía no se pueden eliminar. El equipo de soporte puede explicarte por qué.",
  "error.409.gdpr.export_cooldown":
    "Puedes pedir una copia de tus datos una vez cada 30 días.",

  // UI copy.
  "gdpr.error.unknown": "Algo ha salido mal. Inténtalo de nuevo.",
  "gdpr.action.close": "Cerrar",
  "gdpr.admin.staff_only":
    "Esta pantalla es para el personal. Has iniciado sesión con una cuenta que no tiene acceso a ella.",

  "gdpr.privacy.heading": "Privacidad y tus datos",
  "gdpr.privacy.explain":
    "Consigue una copia de lo que guardamos, mira qué se está borrando ya y pídenos que borremos el resto.",
  "gdpr.admin.heading": "Privacidad: operaciones",
  "gdpr.public.heading": "Solicitudes de privacidad",
  "gdpr.public.explain":
    "No necesitas una cuenta. Pregunta qué guardamos sobre ti, pide una corrección o pide que lo eliminemos: respondemos a la dirección que nos indiques.",

  "gdpr.closure.heading": "Eliminar tu cuenta",
  "gdpr.closure.explain":
    "Al eliminar tu cuenta empieza un periodo de gracia de 30 días. Se cierra tu sesión en todos los dispositivos de inmediato y puedes cambiar de opinión hasta que termine ese periodo.",
  "gdpr.closure.none": "Tu cuenta no está programada para eliminarse",
  "gdpr.closure.grace_left": "Quedan {count} días",
  "gdpr.closure.grace_left.one": "Queda {count} día",
  "gdpr.closure.grace_left.few": "Quedan {count} días",
  "gdpr.closure.grace_left.many": "Quedan {count} días",
  "gdpr.closure.grace_left.other": "Quedan {count} días",
  "gdpr.closure.initiate": "Eliminar mi cuenta",
  "gdpr.closure.confirm_title": "¿Eliminar esta cuenta?",
  "gdpr.closure.confirm_body":
    "Se cerrará tu sesión en todos los dispositivos ahora. Tus datos se borran cuando termine el periodo de gracia, el {date}.",
  "gdpr.closure.confirm_ok": "Sí, empezar la eliminación",
  "gdpr.closure.confirm_cancel": "Ahora no",
  "gdpr.closure.scheduled": "Tu cuenta se eliminará el {date}",
  "gdpr.closure.cancel": "Conservar mi cuenta",
  "gdpr.closure.cancelled": "Eliminación cancelada: tu cuenta vuelve a estar activa",
  "gdpr.closure.deleting":
    "Tu cuenta se está borrando. Esto ya no se puede cancelar.",
  "gdpr.closure.deleted": "Esta cuenta ya se ha borrado",

  "gdpr.deletions.heading": "En espera de eliminación",
  "gdpr.deletions.empty": "No hay nada tuyo esperando a ser eliminado",
  "gdpr.deletions.column.subject": "Elemento",
  "gdpr.deletions.column.state": "Estado",
  "gdpr.deletions.column.due": "Borrado de nuestros sistemas antes del",
  "gdpr.deletions.column.fully_erased": "Borrado en todas partes antes del",
  "gdpr.deletions.fully_erased_hint":
    "Nuestros propios sistemas terminan primero; los proveedores que utilizamos tienen sus propios plazos contractuales, y la fecha posterior es cuando se cierra el último de ellos.",
  "gdpr.deletions.waiting_on": "Pendiente de: {owners}",
  "gdpr.deletions.state.queued": "En cola",
  "gdpr.deletions.state.erasing": "Borrándose",
  "gdpr.deletions.state.deleted": "Borrado",
  "gdpr.deletions.state.timeout": "Fuera de plazo",
  "gdpr.deletions.timeout_hint":
    "Un sistema que guarda parte de este elemento no ha confirmado. Se ha avisado al equipo de soporte; el elemento no se ha perdido de vista.",
  "gdpr.deletions.expand": "Ver qué sistemas han confirmado",
  "gdpr.deletions.overdue_count": "Borrados a la espera de un sistema: {count}",
  "gdpr.deletions.reference": "Ref. {reference}",
  "gdpr.deletions.parts_heading": "Sistemas que lo guardan",
  "gdpr.deletions.parts_empty": "Ningún sistema ha reclamado todavía este elemento",
  "gdpr.deletions.part.done": "Confirmado",
  "gdpr.deletions.part.pending": "En espera",
  "gdpr.deletions.part.timeout": "Sin respuesta",
  "gdpr.deletions.part.receipt": "Confirmado el {date}",
  "gdpr.deletions.obligations_heading": "Proveedores que también lo guardan",
  "gdpr.deletions.obligation": "{provider} — su plazo termina el {date}",

  "gdpr.subject.account": "Cuenta",
  "gdpr.subject.workspace": "Espacio de trabajo",
  "gdpr.subject.meeting": "Reunión",
  "gdpr.subject.recording": "Grabación",
  "gdpr.subject.document": "Documento",
  "gdpr.subject.file": "Archivo",

  "gdpr.export.heading": "Descargar tus datos",
  "gdpr.export.explain":
    "Preparamos un archivo con todo lo que guardamos sobre ti. Está listo en menos de 48 horas y se puede pedir una vez cada 30 días.",
  "gdpr.export.none": "Todavía no has pedido una copia de tus datos",
  "gdpr.export.request": "Pedir mis datos",
  "gdpr.export.requested":
    "Estamos preparando tu archivo. Te escribiremos cuando esté listo.",
  "gdpr.export.in_flight":
    "Ya estamos preparando un archivo para ti. Podrás pedir otro cuando este esté listo.",
  "gdpr.export.progress": "{done} de {total} secciones listas",
  "gdpr.export.partial": "Algunas secciones no se han podido incluir: {services}",
  "gdpr.export.expires": "El enlace de descarga caduca el {date}",
  "gdpr.export.download": "Descargar el archivo",
  "gdpr.export.token_hint":
    "El enlace de descarga está en el correo que te enviamos. Funciona una sola vez, y el archivo se borra en cuanto se entrega.",
  "gdpr.export.state.pending": "En cola",
  "gdpr.export.state.processing": "Preparándose",
  "gdpr.export.state.ready": "Listo",
  "gdpr.export.state.failed": "Ha fallado",
  "gdpr.export.state.expired": "Caducado",

  "gdpr.dsar.heading": "Presentar una solicitud de protección de datos",
  "gdpr.dsar.explain":
    "Pide una copia de tus datos, una corrección o su eliminación. Confirmamos la recepción en tres días hábiles y respondemos en 30 días.",
  "gdpr.dsar.kind_label": "¿Qué quieres pedir?",
  "gdpr.dsar.kind.access": "Una copia de mis datos",
  "gdpr.dsar.kind.erasure": "La eliminación de mis datos",
  "gdpr.dsar.kind.rectification": "Una corrección",
  "gdpr.dsar.kind.portability": "Mis datos en un formato portable",
  "gdpr.dsar.email_label": "Tu dirección de correo",
  "gdpr.dsar.email_required": "Necesitamos una dirección de correo para responderte",
  "gdpr.dsar.note_label": "Lo que quieras añadir",
  "gdpr.dsar.submit": "Enviar la solicitud",
  "gdpr.dsar.submitted":
    "Solicitud recibida. Te hemos enviado la confirmación por correo.",
  "gdpr.dsar.reference": "Tu referencia: {id}",
  "gdpr.dsar.ack_by": "Confirmada antes del {date}",
  "gdpr.dsar.resolve_by": "Respondida antes del {date}",

  "gdpr.queue.heading": "Solicitudes de protección de datos",
  "gdpr.queue.empty": "No hay solicitudes de protección de datos",
  "gdpr.queue.column.kind": "Pide",
  "gdpr.queue.column.channel": "Llegó por",
  "gdpr.queue.column.subject": "Solicitante",
  "gdpr.queue.column.state": "Estado",
  "gdpr.queue.column.ack_due": "Confirmar antes del",
  "gdpr.queue.column.resolve_due": "Responder antes del",
  "gdpr.queue.overdue": "Fuera de plazo",
  "gdpr.queue.ack_sent": "Confirmada el {date}",
  "gdpr.queue.ack_missing": "Sin confirmar",
  "gdpr.queue.reference": "Ref. {reference}",
  "gdpr.queue.ack_overdue_count":
    "Fuera del plazo de confirmación: {count}",
  "gdpr.queue.ack_automated":
    "La confirmación se envía automáticamente, así que si falta es que el envío de avisos está roto, no que alguien se haya retrasado.",
  "gdpr.queue.save_note": "Guardar la nota",
  "gdpr.queue.note_unchanged": "La nota se guarda en cuanto la cambias.",
  "gdpr.queue.state.received": "Recibida",
  "gdpr.queue.state.acknowledged": "Confirmada",
  "gdpr.queue.state.in_progress": "En curso",
  "gdpr.queue.state.resolved": "Resuelta",
  "gdpr.queue.state.rejected": "Rechazada",
  "gdpr.queue.channel.app": "En la aplicación",
  "gdpr.queue.channel.form": "Formulario público",
  "gdpr.queue.channel.email": "Correo",

  "gdpr.owners.heading": "Sistemas que guardan datos",
  "gdpr.owners.explain":
    "Cada sistema que guarda datos personales responde a un sondeo diario del mismo suscriptor que ejecuta el borrado. Un sistema que deja de responder es un sistema cuyos borrados no confirma nadie.",
  "gdpr.owners.empty":
    "No hay ningún sistema declarado: no habría nadie que ejecutara un borrado",
  "gdpr.owners.column.owner": "Sistema",
  "gdpr.owners.column.state": "Estado",
  "gdpr.owners.column.last_alive": "Última respuesta",
  "gdpr.owners.column.subjects": "Guarda",
  "gdpr.owners.alive": "Responde",
  "gdpr.owners.silent": "En silencio",
  "gdpr.owners.never_answered": "No ha respondido nunca",
  "gdpr.owners.silent_count": "Sin responder: {count} de {total} sistemas",
  "gdpr.owners.subject_mismatch": "No responde por {subjects}",
  "gdpr.owners.subject_undeclared":
    "Responde por {subjects}, que no declara",
};

/** Register the Spanish bundle into a core i18n engine. */
export function registerGdprI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, gdprI18nBundleEs);
}
