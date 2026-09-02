import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { driveErrorBundleEs } from "./generated/errors.es.gen.js";

export { driveErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for drive-react — shipped as the
 * `@stapel/drive-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit and the
 * bundle-purity test).
 *
 * Same two halves as `ru.ts`: the generated `driveErrorBundleEs` covers all 77
 * backend codes from stapel-docs' own `translations/errors.es.json`, and the
 * UI copy below is this pair's.
 */
export const driveI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts for every code in the registry.
  ...driveErrorBundleEs,

  // drive-react UI
  "drive.error.unknown": "Algo ha salido mal. Inténtalo de nuevo.",

  "drive.nav.drive": "Disco",
  "drive.crumb.root": "Mi disco",
  "drive.crumb.label": "Ruta de la carpeta",

  "drive.tab.files": "Archivos",
  "drive.tab.starred": "Destacados",
  "drive.tab.recents": "Recientes",
  "drive.tab.trash": "Papelera",

  "drive.list.loading": "Cargando la carpeta…",
  "drive.list.error": "No se ha podido cargar la carpeta.",
  "drive.list.retry": "Reintentar",
  "drive.list.empty": "Esta carpeta está vacía.",
  "drive.list.emptyHint": "Sube un archivo para empezar a llenarla.",
  "drive.view.list": "Vista de lista",
  "drive.view.grid": "Vista de cuadrícula",
  "drive.item.folder": "Carpeta",
  "drive.item.document": "Archivo",

  "drive.star.add": "Destacar",
  "drive.star.remove": "Quitar de destacados",
  "drive.starred.empty": "Todavía no hay nada destacado.",
  "drive.starred.emptyHint": "Destaca un archivo para tenerlo a un toque.",
  "drive.starred.error": "No se han podido cargar los destacados.",

  "drive.recents.empty": "Todavía no has abierto nada.",
  "drive.recents.emptyHint": "Los archivos que abras aparecerán aquí.",
  "drive.recents.error": "No se han podido cargar los archivos recientes.",

  "drive.search.label": "Buscar en el disco",
  "drive.search.placeholder": "Buscar archivos y carpetas",
  "drive.search.idle": "Escribe para buscar en el disco.",
  "drive.search.empty": "No hay coincidencias.",
  "drive.search.error": "No se ha podido realizar la búsqueda.",
  "drive.search.inRoot": "En mi disco",

  "drive.actions.label": "Acciones",
  "drive.action.open": "Abrir",
  "drive.action.rename": "Cambiar el nombre",
  "drive.action.move": "Mover",
  "drive.action.download": "Descargar",
  "drive.action.trash": "Mover a la papelera",
  "drive.rename.title": "Cambiar el nombre",
  "drive.rename.field": "Nombre",
  "drive.rename.empty": "El nombre es obligatorio.",
  "drive.rename.unchanged": "Ese ya es el nombre.",
  "drive.rename.submit": "Cambiar el nombre",
  "drive.move.title": "Mover a",
  "drive.move.toRoot": "Mi disco",
  "drive.move.submit": "Mover",
  "drive.move.sameFolder": "Ya está ahí.",
  "drive.trash.confirm": "¿Mover esto a la papelera?",

  "drive.upload.action": "Subir",
  "drive.upload.trayTitle": "Subidas",
  "drive.upload.queued": "En espera",
  "drive.upload.uploading": "Subiendo…",
  "drive.upload.done": "Subido",
  "drive.upload.failed": "La subida ha fallado",
  "drive.upload.canceled": "Cancelada",
  "drive.upload.retry": "Reintentar",
  "drive.upload.cancel": "Cancelar",
  "drive.upload.clear": "Limpiar las terminadas",
  "drive.upload.empty": "Todavía no hay subidas.",
  "drive.upload.quotaTitle": "Este espacio de trabajo se ha quedado sin sitio.",
  "drive.upload.quotaHint":
    "No se subirá nada más hasta que se libere espacio: vacía la papelera o pide más cuota.",

  "drive.preview.alt": "Vista previa",
};

/**
 * Register the Spanish bundle (call after {@link registerDriveI18n} so the en
 * floor is underneath and any key this file misses still resolves).
 */
export function registerDriveI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", driveI18nBundleEs);
}
