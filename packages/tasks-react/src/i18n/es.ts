import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { tasksI18nBundleEn } from "./keys.js";
import { tasksErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for tasks-react — shipped as the
 * `@stapel/tasks-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: a host that never registers it never carries these strings (the main
 * entry does not import this module).
 *
 * The backend error catalogue for this locale is GENERATED from
 * stapel-tasks's own `translations/errors.es.json` and spread in FIRST, so
 * every backend code keeps coverage by construction.
 */
export const tasksI18nBundleEs: I18nDictionary = {
  ...tasksErrorBundleEs,

  "tasks.error.unknown": "Algo salió mal. Inténtalo de nuevo.",

  "tasks.nav.boards": "Tableros",
  "tasks.nav.board": "Tablero",

  "tasks.boards.title": "Tableros",
  "tasks.boards.empty": "Aún no hay tableros",
  "tasks.boards.emptyHint":
    "Un tablero son las columnas por las que avanzan las tarjetas.",
  "tasks.boards.create": "Nuevo tablero",
  "tasks.boards.open": "Abrir tablero",
  "tasks.boards.archive": "Archivar",
  "tasks.boards.archiveQuestion": "¿Archivar este tablero?",
  "tasks.boards.archiveBody":
    "El tablero y sus tarjetas se conservan, pero salen de esta lista.",
  "tasks.boards.columnCount": "{count} columnas",
  "tasks.boards.created": "Creado el {date}",
  "tasks.boards.loading": "Cargando tableros…",
  "tasks.boards.failed": "No se pudieron cargar los tableros.",

  "tasks.board.create.title": "Nuevo tablero",
  "tasks.board.create.name": "Nombre",
  "tasks.board.create.namePlaceholder": "Versión 2.0",
  "tasks.board.create.preset": "Forma",
  "tasks.board.create.presetCustom": "Columnas propias",
  "tasks.board.create.columns": "Columnas",
  "tasks.board.create.addColumn": "Añadir columna",
  "tasks.board.create.columnKey": "Clave",
  "tasks.board.create.columnName": "Nombre de la columna",
  "tasks.board.create.category": "Categoría",
  "tasks.board.create.wipLimit": "Límite WIP",
  "tasks.board.create.submit": "Crear tablero",
  "tasks.board.create.removeColumn": "Quitar la columna {name}",

  "tasks.column.todo": "Por hacer",
  "tasks.column.in_progress": "En curso",
  "tasks.column.done": "Hecho",

  "tasks.category.backlog": "Pendientes",
  "tasks.category.active": "En curso",
  "tasks.category.review": "Revisión",
  "tasks.category.waiting": "En espera",
  "tasks.category.done": "Hecho",

  "tasks.board.truncated":
    "Mostrando las {count} tarjetas más recientes. Filtra para ver el resto.",
  "tasks.board.emptyColumn": "Nada por aquí",
  "tasks.board.empty": "Este tablero todavía no tiene columnas.",
  "tasks.board.noBoard": "Ningún tablero seleccionado",
  "tasks.board.noBoardHint": "Abre un tablero desde la lista de tableros.",
  "tasks.board.addCard": "Añadir tarjeta",
  "tasks.board.addCardPlaceholder": "Título de la tarjeta",
  "tasks.board.addCardSubmit": "Añadir",
  "tasks.board.wip": "{count}/{limit}",
  "tasks.board.wipExceeded": "Por encima del límite WIP de {limit}",
  "tasks.board.phone.columnSwitcher": "Columna",
  "tasks.board.manageColumns": "Gestionar columnas",

  "tasks.board.filters.title": "Filtros",
  "tasks.board.filters.assignee": "Responsable",
  "tasks.board.filters.category": "Categoría",
  "tasks.board.filters.text": "Buscar en los títulos",
  "tasks.board.filters.clear": "Quitar filtros",
  "tasks.board.filters.any": "Cualquiera",

  "tasks.card.dragHandle": "Arrastrar {title}",
  "tasks.card.due": "Vence el {date}",
  "tasks.card.overdue": "Vencida desde el {date}",
  "tasks.card.checklist": "{done} de {total} pasos",
  "tasks.card.blocked": "Bloqueada por {count} tarjetas",
  "tasks.card.open": "Abrir {title}",

  "tasks.move.applied": "Movida a {column}.",
  "tasks.move.deferred": "Movida, a la espera de aprobación.",
  "tasks.move.denied": "El flujo de este tablero no permite ese movimiento.",
  "tasks.move.failed":
    "No se pudo guardar el movimiento. La tarjeta volvió a su sitio.",
  "tasks.move.pendingBadge": "Pendiente de aprobación",

  "tasks.task.title": "Título",
  "tasks.task.sheetTitle": "Tarjeta",
  "tasks.task.description": "Descripción",
  "tasks.task.descriptionPlaceholder": "¿Qué hay que hacer?",
  "tasks.task.column": "Columna",
  "tasks.task.priority": "Prioridad",
  "tasks.task.priorityNone": "Ninguna",
  "tasks.task.due": "Fecha límite",
  "tasks.task.assignees": "Responsables",
  "tasks.task.assigneesReadOnly":
    "Esta aplicación no ha conectado un selector de personas, así que aquí los responsables solo se pueden leer.",
  "tasks.task.assigneesEmpty": "Todavía nadie",
  "tasks.task.features": "Campos propios",
  "tasks.task.checklist": "Lista de pasos",
  "tasks.task.comments": "Comentarios",
  "tasks.task.created": "Creada el {date}",
  "tasks.task.completed": "Completada el {date}",
  "tasks.task.archived": "Esta tarjeta está archivada y solo se puede leer.",
  "tasks.task.archive": "Archivar tarjeta",
  "tasks.task.archiveQuestion": "¿Archivar esta tarjeta?",
  "tasks.task.save": "Guardar",
  "tasks.task.saving": "Guardando…",
  "tasks.task.loading": "Cargando la tarjeta…",

  "tasks.priority.low": "Baja",
  "tasks.priority.normal": "Normal",
  "tasks.priority.high": "Alta",
  "tasks.priority.urgent": "Urgente",

  "tasks.checklist.add": "Añadir paso",
  "tasks.checklist.placeholder": "Siguiente paso",
  "tasks.checklist.empty": "Todavía no hay pasos",
  "tasks.checklist.markDone": "Marcar {text} como hecho",
  "tasks.checklist.markPending": "Marcar {text} como no hecho",
  "tasks.checklist.markFailed": "Marcar {text} como fallido",
  "tasks.checklist.stateFailed": "Fallido",
  "tasks.checklist.more": "Más acciones para {text}",

  "tasks.comment.placeholder": "Escribe un comentario",
  "tasks.comment.send": "Enviar",
  "tasks.comment.empty": "Todavía no hay comentarios",
  "tasks.comment.hint": "Enter envía, Shift+Enter salta de línea.",

  "tasks.columns.title": "Columnas",
  "tasks.columns.reorderHint":
    "Arrastra una columna para cambiar su sitio en el tablero.",
  "tasks.columns.noRename":
    "Aquí las columnas se pueden reordenar y añadir. Renombrarlas o eliminarlas no está disponible.",
  "tasks.columns.dragHandle": "Reordenar {name}",
  "tasks.columns.saveOrder": "Guardar el orden",
  "tasks.columns.existsHint": "Elige una clave que el tablero no use ya.",

  "tasks.gate.titleRequired": "Primero ponle un título a la tarjeta.",
  "tasks.gate.columnsRequired": "Un tablero necesita al menos una columna.",
  "tasks.gate.nameRequired": "Primero ponle un nombre al tablero.",
  "tasks.gate.archived": "Esta tarjeta está archivada.",
  "tasks.gate.noPicker": "Elegir personas no está disponible aquí.",
  "tasks.gate.commentEmpty": "Escribe algo primero.",
  "tasks.gate.noColumn": "El tablero no tiene columnas donde añadir una tarjeta.",
  "tasks.gate.noColumnChange":
    "Abre esta tarjeta desde su tablero para moverla a otra columna.",
  "tasks.gate.noNavigation": "Abrir un tablero no está disponible aquí.",

  "tasks.scope.unresolved":
    "Esta instalación no pudo determinar a qué espacio de trabajo pertenece el tablero. Elige uno e inténtalo de nuevo.",

  "tasks.dialog.dismiss": "Cerrar",
};

/**
 * Register the Spanish bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerTasksI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, tasksI18nBundleEn);
  engine.registerBundle(locale, tasksI18nBundleEs);
}
