import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { calendarErrorBundleEs } from "./generated/errors.es.gen.js";

export { calendarErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for calendar-react — the `@stapel/calendar-react/i18n/es`
 * subpath (i18n-shipping.md §2), opt-in exactly like `./i18n/ru`.
 *
 * Same two sources, same reason (see `./ru.ts`): 42 cross-cutting keys come
 * from stapel-core's catalogue through the generated bundle, and the 7 keys
 * stapel-calendar owns are authored below until upstream ships
 * `translations/errors.es.json`.
 *
 * The UI copy travels here too, not only the error keys: a calendar is read
 * word by word — a cancellation, a replace-set warning, an incomplete
 * availability answer — and half a translation is worse than either language
 * on its own (the chat-react precedent).
 */
export const calendarI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts for every key core owns.
  ...calendarErrorBundleEs,

  // Backend error codes stapel-calendar owns — authored here (see above).
  "error.400.calendar_invalid_range":
    "Ese intervalo no funciona: el final es anterior al inicio.",
  "error.400.calendar_invalid_recurrence": "La regla de repetición no es válida",
  "error.400.calendar_invalid_rsvp":
    "La respuesta debe ser una de: aceptada, quizá, rechazada",
  "error.400.calendar_invalid_slot_minutes":
    "La duración del hueco debe ser un número entero de minutos, mínimo 1.",
  "error.403.calendar_not_event_owner":
    "Solo quien creó el evento puede cambiarlo.",
  "error.404.calendar_event_not_found": "Evento no encontrado",
  "error.404.calendar_not_invited": "No estás invitado a este evento.",
  // Core-owned, re-said as a sentence: this refusal means "we could not ask
  // whether you may", not "you may not".
  "error.503.mandate_unavailable":
    "No hemos podido comprobar tu acceso al espacio de trabajo. Inténtalo en un momento.",

  // UI copy.
  "calendar.error.unknown": "Algo ha fallado. Inténtalo de nuevo.",

  "calendar.blocked.not_owner": "Solo quien creó el evento puede cambiarlo.",
  "calendar.blocked.owner_unknown":
    "No podemos saber si el evento es tuyo, así que la edición está desactivada.",
  "calendar.blocked.not_invited":
    "No estás en la lista de invitados, así que no hay nada que responder.",
  "calendar.blocked.event_cancelled": "Este evento se canceló.",
  "calendar.blocked.no_changes": "Todavía no has cambiado nada.",
  "calendar.blocked.virtual_occurrence":
    "Esta hora viene de una serie que se repite: abre la serie para cambiarla.",
  "calendar.blocked.no_mandate":
    "Este calendario pertenece a un espacio de trabajo del que no formas parte.",

  "calendar.validation.end_before_start":
    "La hora de fin es anterior a la de inicio.",
  "calendar.validation.range_incomplete": "Elige una hora de inicio y una de fin.",
  "calendar.validation.slot_minutes":
    "La duración del hueco debe ser un número entero de minutos, mínimo 1.",
  "calendar.validation.title_required": "Ponle un título al evento.",

  "calendar.view.heading": "Calendario",
  "calendar.view.loading": "Cargando tu calendario…",
  "calendar.view.empty": "No hay nada previsto en este periodo.",
  "calendar.view.empty_hint": "Lo que crees aparecerá aquí.",
  "calendar.view.error": "No hemos podido cargar tu calendario.",
  "calendar.view.retry": "Reintentar",
  "calendar.view.today": "Hoy",
  "calendar.view.previous": "Anterior",
  "calendar.view.next": "Siguiente",
  "calendar.view.mode.month": "Mes",
  "calendar.view.mode.week": "Semana",
  "calendar.view.mode.day": "Día",
  "calendar.view.new_event": "Nuevo evento",
  "calendar.view.cancelled": "Cancelado",
  "calendar.view.repeats": "Parte de una serie",
  "calendar.view.marker": "Marca",
  "calendar.view.open_event": "Abrir evento",
  "calendar.view.more_count.one": "{count} más",
  "calendar.view.more_count.other": "{count} más",
  "calendar.view.untitled": "Evento sin título",
  "calendar.view.agenda_layout": "Agenda",

  "calendar.agenda.heading": "Agenda",
  "calendar.agenda.empty": "No hay nada previsto.",
  "calendar.agenda.empty_hint": "Tus próximos eventos aparecerán aquí.",
  "calendar.agenda.day_empty": "Nada este día",

  "calendar.detail.heading": "Evento",
  "calendar.detail.no_description": "Sin descripción",
  "calendar.detail.organizer": "Organizador",
  "calendar.detail.when": "Cuándo",
  "calendar.detail.participants": "Invitados",
  "calendar.detail.no_participants": "Todavía no hay nadie invitado.",
  "calendar.detail.rsvp_summary":
    "{accepted} aceptan · {tentative} quizá · {declined} rechazan · {invited} sin respuesta",
  "calendar.detail.add_to_calendar": "Añadir al calendario",
  "calendar.detail.edit": "Editar",
  "calendar.detail.close": "Cerrar",
  "calendar.detail.cancelled_banner":
    "Este evento se canceló. Sigue en el calendario para que todos vean que se suspendió.",
  "calendar.detail.series_note": "Una de las repeticiones de una serie.",

  "calendar.rsvp.heading": "¿Vas a ir?",
  "calendar.rsvp.accept": "Aceptar",
  "calendar.rsvp.tentative": "Quizá",
  "calendar.rsvp.decline": "Rechazar",
  "calendar.rsvp.responding": "Guardando tu respuesta…",
  "calendar.rsvp.your_answer": "Tu respuesta: {answer}",
  "calendar.rsvp.no_answer": "Todavía no has respondido.",
  "calendar.rsvp.state.invited": "Sin respuesta",
  "calendar.rsvp.state.accepted": "Va",
  "calendar.rsvp.state.tentative": "Quizá",
  "calendar.rsvp.state.declined": "No va",

  "calendar.composer.create": "Crear evento",
  "calendar.composer.creating": "Creando…",
  "calendar.composer.created": "Evento creado.",
  "calendar.editor.create_heading": "Nuevo evento",
  "calendar.editor.edit_heading": "Editar evento",
  "calendar.editor.title": "Título",
  "calendar.editor.title_placeholder": "¿De qué se trata?",
  "calendar.editor.description": "Descripción",
  "calendar.editor.start": "Empieza",
  "calendar.editor.end": "Termina",
  "calendar.editor.save": "Guardar cambios",
  "calendar.editor.saving": "Guardando…",
  "calendar.editor.saved": "Guardado.",
  "calendar.editor.discard": "Descartar",
  "calendar.editor.marker_hint":
    "El inicio y el fin coinciden: se guarda como una marca y no ocupa tiempo.",
  "calendar.editor.cancel_event": "Cancelar evento",
  "calendar.editor.cancel_question": "¿Cancelar este evento?",
  "calendar.editor.cancel_body":
    "Seguirá en el calendario de todos marcado como cancelado y dejará de ocupar tiempo. No es lo mismo que eliminarlo.",
  "calendar.editor.cancel_confirm": "Cancelar el evento",

  "calendar.recurrence.label": "Se repite",
  "calendar.recurrence.interval": "Cada",
  "calendar.recurrence.weekdays": "Estos días",
  "calendar.recurrence.ends": "Termina",
  "calendar.recurrence.end.never": "Nunca",
  "calendar.recurrence.end.until": "En una fecha",
  "calendar.recurrence.end.count": "Tras un número de veces",
  "calendar.recurrence.until_label": "Última fecha",
  "calendar.recurrence.count_label": "Número de veces",
  "calendar.recurrence.exclusive_hint":
    "Una serie termina en una fecha o tras un número de veces, nunca las dos cosas.",
  "calendar.recurrence.preset.none": "No se repite",
  "calendar.recurrence.preset.daily": "Cada día",
  "calendar.recurrence.preset.weekdays": "Cada día laborable",
  "calendar.recurrence.preset.weekly": "Cada semana",
  "calendar.recurrence.preset.biweekly": "Cada dos semanas",
  "calendar.recurrence.preset.monthly": "Cada mes",
  "calendar.recurrence.preset.custom": "Personalizado…",

  "calendar.participants.heading": "Invitados",
  "calendar.participants.add": "Invitar",
  "calendar.participants.add_placeholder": "Identificador de usuario",
  "calendar.participants.remove": "Quitar",
  "calendar.participants.result_heading":
    "Al guardar, quedan invitadas exactamente estas personas",
  "calendar.participants.replace_warning":
    "Guardar sustituye toda la lista de invitados por la de arriba: quien no aparezca pierde su invitación.",
  "calendar.participants.nobody": "No quedaría nadie invitado.",
  "calendar.participants.save": "Guardar invitados",
  "calendar.participants.saving": "Guardando…",
  "calendar.participants.saved": "Invitados guardados.",
  "calendar.participants.reset": "Deshacer los cambios",
  "calendar.participants.added_count.one": "{count} recibirá la invitación",
  "calendar.participants.added_count.other": "{count} recibirán la invitación",
  "calendar.participants.removed_count.one": "{count} perderá su invitación",
  "calendar.participants.removed_count.other": "{count} perderán su invitación",

  "calendar.delete.action": "Eliminar evento",
  "calendar.delete.question": "¿Eliminar este evento?",
  "calendar.delete.body":
    "Desaparece del calendario de todos. Si quieres suspenderlo pero que siga a la vista, cancélalo en lugar de eliminarlo.",
  "calendar.delete.occurrence_body":
    "Es una de las repeticiones de una serie. Eliminarla quita esa hora para siempre: no volverá la próxima vez que se dibuje la serie.",
  "calendar.delete.confirm": "Eliminar",
  "calendar.delete.deleting": "Eliminando…",

  "calendar.availability.heading": "Tiempo libre",
  "calendar.availability.slot_length": "Duración del hueco (minutos)",
  "calendar.availability.slots": "Huecos libres",
  "calendar.availability.pick": "Reservar este hueco",
  "calendar.availability.busy": "Ocupado",
  "calendar.availability.no_busy": "No hay nada ocupado en este periodo.",
  "calendar.availability.no_windows":
    "No hay tiempo reservable en este periodo.",
  "calendar.availability.no_windows_hint":
    "Los huecos libres salen de las ventanas de disponibilidad. No hay ninguna configurada, así que todavía no hay nada que reservar: esto no significa que el tiempo esté ocupado.",
  "calendar.availability.truncated": "Esta respuesta está incompleta.",
  "calendar.availability.truncated_hint":
    "Una serie repetida era demasiado larga para desplegarla entera, así que las horas más lejanas pueden estar ya ocupadas aunque parezcan libres. Acota el periodo para obtener una respuesta completa.",
  "calendar.availability.refresh": "Actualizar",
  "calendar.availability.loading": "Comprobando tu tiempo libre…",
};

/** Register the Spanish bundle (call after `registerCalendarI18n`). */
export function registerCalendarI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", calendarI18nBundleEs);
}
