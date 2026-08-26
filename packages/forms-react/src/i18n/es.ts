import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { formsErrorBundleEs } from "./generated/errors.es.gen.js";

export { formsErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for forms-react — the pair's `es` locale, shipped as the
 * `@stapel/forms-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the bundle-purity
 * test).
 *
 * Composition mirrors `formsI18nBundleEn`; see `ru.ts` for the same structure
 * and the same provenance statement — stapel-forms' es catalogue ships
 * `origin=seed:authored` and is UNREVIEWED (backend delta note 10), and the
 * pair-authored strings below are the same grade.
 */
const ATTRIBUTES_ERRORS_ES: Readonly<Record<string, string>> = {
  "error.400.feature_below_minimum": "El valor es inferior al mínimo de «{feature}»",
  "error.400.feature_above_maximum": "El valor supera el máximo de «{feature}»",
  "error.400.feature_not_in_options":
    "El valor no está entre las opciones permitidas de «{feature}»",
  "error.400.feature_invalid_type": "Tipo de valor no válido para «{feature}»",
  "error.400.feature_invalid_format": "Formato no válido para «{feature}»",
  "error.400.feature_mandatory_missing": "El campo «{feature}» es obligatorio",
  "error.400.feature_unknown_type": "Tipo de campo desconocido para «{feature}»",
  "error.400.feature_not_allowed": "El campo «{feature}» no se permite aquí",
  "error.400.feature_unknown": "Campo desconocido «{feature}»",
  "error.400.feature_invalid_config": "Configuración no válida para «{feature}»",
  "error.400.description_too_short": "La descripción debe tener al menos {min_length} caracteres",
  "error.400.description_too_long": "La descripción debe tener como máximo {max_length} caracteres",
};

export const formsI18nBundleEs: I18nDictionary = {
  ...formsErrorBundleEs,
  ...ATTRIBUTES_ERRORS_ES,

  "forms.error.unknown": "Algo salió mal. Inténtalo de nuevo.",
  "forms.blocked.capability":
    "No tienes {capability}, el permiso que esto necesita. Un administrador del espacio de trabajo puede concederlo.",
  "forms.error.no_workspace":
    "Esta pantalla necesita un espacio de trabajo. Pasa `workspaceId` o decláralo en el runtime con `createFormsRuntime({ workspaceId })`.",

  "forms.nav.list": "Formularios",
  "forms.nav.builder": "Editor de formularios",
  "forms.nav.responses": "Respuestas",

  "forms.fill.loading": "Cargando el formulario…",
  "forms.fill.retry": "Reintentar",
  "forms.fill.load_failed":
    "No pudimos cargar este formulario. Es un problema nuestro, no de tu enlace.",
  "forms.fill.not_found": "Este enlace de formulario no es válido.",
  "forms.fill.closed": "Este formulario está cerrado y ya no acepta respuestas.",
  "forms.fill.superseded":
    "El formulario cambió mientras lo rellenabas. Revisa tus respuestas y envíalo de nuevo.",
  "forms.fill.unsupported_field":
    "Este tipo de campo ({kind}) no se puede mostrar en esta versión de la aplicación.",
  "forms.fill.required": "Obligatorio",
  "forms.fill.submit": "Enviar",
  "forms.fill.submitting": "Enviando…",
  "forms.fill.thanks": "Gracias, hemos registrado tu respuesta.",
  "forms.fill.optional_hint": "Opcional",
  "forms.fill.bool_yes": "Sí",
  "forms.fill.bool_no": "No",
  "forms.fill.select_placeholder": "Elige…",
  "forms.fill.unlimited": "Sin límite",

  "forms.submit.blocked.done": "Ya has enviado este formulario.",
  "forms.submit.blocked.in_flight": "Enviando tu respuesta…",
  "forms.submit.blocked.unsupported_kind":
    "Este formulario usa un tipo de campo que la aplicación no puede mostrar ({kinds}), así que no se puede enviar con seguridad.",

  "forms.builder.title": "Editor de formularios",
  "forms.builder.add_field": "Añadir campo",
  "forms.builder.remove_field": "Eliminar campo",
  "forms.builder.move_up": "Subir",
  "forms.builder.move_down": "Bajar",
  "forms.builder.field_slug": "Clave",
  "forms.builder.field_label": "Etiqueta",
  "forms.builder.field_required": "Obligatorio",
  "forms.builder.field_kind": "Tipo",
  "forms.builder.save": "Guardar borrador",
  "forms.builder.publish": "Publicar",
  "forms.builder.blocked.saving": "Guardando el borrador…",
  "forms.builder.blocked.publishing": "Publicando…",
  "forms.builder.blocked.no_changes": "Nada ha cambiado desde el último guardado.",
  "forms.builder.blocked.empty_schema": "Añade al menos un campo antes de publicar.",
  "forms.builder.blocked.unsaved_draft":
    "Guarda el borrador primero: publicar ahora lanzaría la versión guardada anteriormente.",
  "forms.builder.builder_less":
    "Este tipo de campo no tiene opciones editables aquí. Su configuración se define mediante la API de borradores.",
  "forms.builder.kind_unregistered":
    "Esta instalación no reconoce este tipo de campo, así que no se puede configurar ni mostrar aquí. El campo se conserva para que no desaparezca del esquema sin avisar.",
  "forms.builder.kinds_failed":
    "No pudimos cargar la lista de tipos de campo, así que ahora no se pueden añadir campos.",
  "forms.builder.no_kinds":
    "Esta instalación no tiene tipos de campo configurables disponibles.",
  "forms.builder.unsupported_config":
    "Algunas opciones de este campo ({keys}) aún no se pueden editar aquí.",
  "forms.builder.empty": "Este formulario aún no tiene campos.",
  "forms.builder.meta_title": "Título del formulario",
  "forms.builder.meta_description": "Descripción",
  "forms.builder.meta_submit_label": "Texto del botón de envío",
  "forms.builder.meta_confirmation": "Mensaje de confirmación",
  "forms.builder.state_open": "Abierto",
  "forms.builder.state_closed": "Cerrado",
  "forms.builder.state_draft": "Borrador",
  "forms.builder.rotate_link": "Renovar el enlace público",
  "forms.builder.public_link": "Enlace público",
  "forms.builder.blocked.first_field": "Ya es el primer campo.",
  "forms.builder.blocked.last_field": "Ya es el último campo.",

  "forms.settings.title": "Ajustes del formulario",
  "forms.settings.open": "Ajustes",
  "forms.settings.close": "Cerrar",
  "forms.settings.form_title": "Nombre del formulario",
  "forms.settings.notify_emails": "Avisar a estas direcciones de correo",
  "forms.settings.notify_emails_hint":
    "Cada respuesta nueva se envía por correo a estas direcciones. Sin ninguna configurada, las respuestas se guardan y nadie se entera.",
  "forms.settings.notify_telegram": "Avisar a estos chats de Telegram",
  "forms.settings.notify_telegram_hint":
    "Identificadores de chat, no nombres de usuario: el id de un grupo empieza por un signo menos.",
  "forms.settings.add_destination": "Escribe un destino y pulsa Intro",
  "forms.settings.retention": "Eliminar las respuestas después de",
  "forms.settings.retention_hint":
    "Días. Una excepción solo puede ACORTAR el periodo de conservación de esta instalación; déjalo vacío para usar el suyo.",
  "forms.settings.retention_default": "Periodo de la instalación",
  "forms.settings.no_destination":
    "No hay ningún destino configurado: una respuesta nueva se guardará y nadie recibirá aviso.",
  "forms.settings.suspect_emails":
    "Esto no parecen direcciones de correo y puede que nunca se entreguen: {list}",
  "forms.settings.save": "Guardar los ajustes",
  "forms.settings.saved": "Ajustes guardados.",
  "forms.settings.load_failed": "No pudimos cargar los ajustes de este formulario.",
  "forms.settings.blocked.loading": "Cargando los ajustes del formulario…",
  "forms.settings.blocked.saving": "Guardando…",
  "forms.settings.blocked.no_changes": "Nada ha cambiado desde la última vez que se guardó.",
  "forms.settings.blocked.retention": "Las respuestas deben conservarse al menos un día.",
  "forms.settings.blocked.no_title": "Primero dale un nombre al formulario.",

  "forms.responses.title": "Respuestas",
  "forms.responses.empty": "Todavía no hay respuestas.",
  "forms.responses.load_failed": "No pudimos cargar las respuestas.",
  "forms.responses.submitted_at": "Enviada",
  "forms.responses.respondent": "Participante",
  "forms.responses.anonymous": "Anónimo",
  "forms.responses.version": "Versión",
  "forms.responses.all_versions": "Todas las versiones",
  "forms.responses.next": "Siguiente",
  "forms.responses.prev": "Anterior",
  "forms.responses.blocked.at_end": "Esta es la última página.",
  "forms.responses.blocked.at_start": "Esta es la primera página.",
  "forms.responses.delete": "Eliminar",
  "forms.responses.delete_confirm": "¿Eliminar esta respuesta de forma permanente?",
  "forms.responses.resend": "Reenviar",
  "forms.responses.resend_sent": "Enviado a {count} destino(s).",
  "forms.responses.resend_override": "Enviar a direcciones concretas",
  "forms.responses.resend_override_hint":
    "Sustituyen a los destinatarios configurados del formulario para este envío.",
  "forms.responses.export": "Exportar CSV",
  "forms.responses.exporting": "Exportando… ({pages} página(s))",
  "forms.responses.erased": "Borrada",
  "forms.responses.blocked.erased":
    "Esta respuesta fue borrada, así que ya no se puede reenviar ni eliminar.",
  "forms.responses.detail": "Detalle de la respuesta",
  "forms.responses.close": "Cerrar",
  "forms.responses.refresh": "Buscar respuestas nuevas",
  "forms.responses.polling_note":
    "Esta lista no se actualiza sola: vuelve a comprobarla para ver las respuestas llegadas desde que se cargó.",
  "forms.responses.forbidden":
    "No puedes ver las respuestas de este formulario. Es una decisión, no un fallo: pide a un administrador del espacio de trabajo el permiso forms.responses.view.",
  "forms.responses.gate_unavailable":
    "Esto es cosa nuestra: no pudimos contactar con el servicio que comprueba tus permisos, así que no se ha denegado ni leído nada. Vuelve a intentarlo.",

  "forms.list.title": "Formularios",
  "forms.list.empty": "Todavía no hay formularios en este espacio de trabajo.",
  "forms.list.load_failed": "No pudimos cargar los formularios.",
  "forms.list.create": "Nuevo formulario",
  "forms.list.new_title": "Formulario sin título",
  "forms.list.submission_count": "{count} respuesta(s)",
  "forms.list.empty_hint":
    "Un formulario recoge respuestas mediante un enlace público que puedes poner en cualquier página.",
  "forms.list.open": "Abrir",
  "forms.list.delete": "Eliminar",
  "forms.list.delete_confirm": "¿Eliminar «{title}»?",
  "forms.list.delete_body":
    "El formulario y sus {count} respuesta(s) dejarán de estar accesibles. El enlace público dejará de funcionar de inmediato.",
  "forms.list.delete_body_open":
    "Este formulario está ABIERTO. Al eliminarlo se cierra: el enlace público dejará de funcionar de inmediato y sus {count} respuesta(s) dejarán de estar accesibles.",
  "forms.list.state_filter": "Filtrar por estado",
};

/** Register the es bundle. Call AFTER `registerFormsI18n` so it layers over
 * the en floor (merge priority = registration order). */
export function registerFormsI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", formsI18nBundleEs);
}
