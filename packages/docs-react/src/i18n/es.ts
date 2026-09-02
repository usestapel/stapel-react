import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { docsErrorBundleEs } from "./generated/errors.es.gen.js";

export { docsErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for docs-react — shipped as the `@stapel/docs-react/i18n/es`
 * subpath (i18n-shipping.md §2) so the locale is opt-in: hosts that don't
 * register it never carry these strings (the main entry does not import this
 * module — gated by size-limit and the bundle-purity test).
 *
 * Same two halves as `ru.ts`: the generated `docsErrorBundleEs` covers all 74
 * backend codes from the module's own `translations/errors.es.json`, and the
 * UI copy below is this pair's. `test/i18n.test.ts` gates both, in both
 * directions — a key added to `keys.ts` without a translation fails here.
 */
export const docsI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts for every code in the registry.
  ...docsErrorBundleEs,

  // docs-react UI
  "docs.error.unknown": "Algo ha salido mal. Inténtalo de nuevo.",
  "docs.list.loading": "Cargando documentos…",
  "docs.list.empty": "Todavía no hay documentos.",
  "docs.list.error": "No se han podido cargar los documentos.",
  "docs.list.retry": "Reintentar",
  "docs.tree.loading": "Cargando carpetas…",
  "docs.tree.error": "No se han podido cargar las carpetas.",
  "docs.tree.root": "Todos los documentos",
  "docs.editor.loading": "Cargando documento…",
  "docs.editor.save": "Guardar",
  "docs.editor.saving": "Guardando…",
  "docs.editor.saved": "Todos los cambios están guardados.",
  "docs.editor.conflict":
    "Otra persona ha guardado este documento mientras lo editabas.",
  "docs.editor.override":
    "Guardar de todos modos (ambas versiones quedan en el historial)",
  "docs.editor.downloadOnly": "Este tipo de documento se abre como descarga.",
  "docs.revisions.loading": "Cargando historial…",
  "docs.revisions.empty": "Todavía no hay versiones.",
  "docs.revisions.create": "Dar nombre a esta versión",
  "docs.revisions.restore": "Restaurar",
  "docs.revisions.restoring": "Restaurando…",
  "docs.trash.emptyState": "La papelera está vacía.",
  "docs.trash.restore": "Restaurar",
  "docs.trash.emptyAction": "Vaciar la papelera",
  "docs.trash.emptying": "Vaciando…",
  "docs.upload.action": "Subir un archivo",
  "docs.upload.uploading": "Subiendo…",
  "docs.upload.done": "Subida completada.",
  "docs.upload.failed": "No se ha podido subir el archivo.",
  "docs.media.download": "Descargar",
  "docs.media.minting": "Preparando el enlace de descarga…",
  "docs.manager.filesView": "Archivos",
  "docs.manager.trashView": "Papelera",
  "docs.manager.newFolder": "Nueva carpeta",
  "docs.manager.upload": "Subir",
  "docs.manager.foldersEmpty": "Todavía no hay carpetas.",
  "docs.manager.newDocument": "Nuevo documento",
  "docs.manager.foldersPane": "Carpetas",
  "docs.manager.filesPane": "Documentos",
  "docs.manager.nameColumn": "Nombre",
  "docs.manager.updatedColumn": "Modificado",
  "docs.manager.sizeColumn": "Tamaño",
  "docs.menu.open": "Abrir",
  "docs.menu.rename": "Cambiar el nombre",
  "docs.menu.move": "Mover a…",
  "docs.menu.newSubfolder": "Nueva subcarpeta",
  "docs.menu.moveToTrash": "Mover a la papelera",
  "docs.menu.download": "Descargar",
  "docs.menu.history": "Historial de versiones",
  "docs.menu.restore": "Restaurar",
  "docs.menu.deleteForever": "Eliminar definitivamente",
  "docs.menu.actions": "Acciones",
  "docs.dialog.renameTitle": "Cambiar el nombre",
  "docs.dialog.moveTitle": "Mover a una carpeta",
  "docs.dialog.moveTarget": "Carpeta de destino",
  "docs.dialog.newFolderTitle": "Nueva carpeta",
  "docs.dialog.namePlaceholder": "Nombre",
  "docs.dialog.ok": "Aceptar",
  "docs.dialog.renameConfirm": "Renombrar",
  "docs.dialog.createFolderConfirm": "Crear carpeta",
  "docs.dialog.moveConfirm": "Mover",
  "docs.dialog.createDocumentConfirm": "Crear",
  "docs.dialog.cancel": "Cancelar",
  "docs.dialog.close": "Cerrar",
  "docs.dialog.rootFolder": "Todos los documentos",
  "docs.dialog.newDocumentTitle": "Nuevo documento",
  "docs.dialog.documentType": "Tipo de documento",
  "docs.dialog.nameBlockedEmpty": "Escribe un nombre primero.",
  "docs.dialog.moveBlockedUnchanged": "Ahí es donde ya está.",
  "docs.type.text": "Texto sin formato",
  "docs.type.markdown": "Markdown",
  "docs.type.csv": "Hoja de cálculo (CSV)",
  "docs.revisions.title": "Historial de versiones",
  "docs.revisions.automatic": "Versión automática",
  "docs.revisions.previewEmpty": "Elige una versión para verla.",
  "docs.revisions.previewBinary":
    "Esta versión es una instantánea binaria: descárgala para verla.",
  "docs.revisions.rollback": "Volver a esta versión",
  "docs.revisions.rollbackConfirm":
    "¿Restaurar esta versión? El contenido actual permanece en el historial.",
  "docs.revisions.rollbackBlockedHead": "Es la versión actual del documento.",
  "docs.revisions.namePlaceholder": "Nombre de la versión",
  "docs.revisions.download": "Descargar la versión",
  "docs.revisions.nameBlockedEmpty":
    "Escribe primero un nombre para esta versión.",
  "docs.editor.dirty": "Cambios sin guardar",
  "docs.editor.addRow": "Añadir fila",
  "docs.editor.addColumn": "Añadir columna",
  "docs.editor.deleteRow": "Eliminar la fila",
  "docs.trash.emptyConfirm":
    "¿Eliminar definitivamente todo lo que hay en la papelera? No se puede deshacer.",
  "docs.trash.kindFolder": "Carpeta",
  "docs.trash.kindDocument": "Documento",
  "docs.trash.emptyBlocked": "No hay nada que eliminar en la papelera.",
  "docs.list.emptyHint": "Crea un documento o sube un archivo para empezar.",
  "docs.trash.emptyHint": "Los documentos que elimines llegan aquí primero.",
  "docs.editor.collabUnsupported": "Este documento se edita de forma colaborativa.",
  "docs.editor.collabUnsupportedHint":
    "No hay ningún editor colaborativo registrado para su tipo, así que aquí no se puede editar. Descárgalo o registra uno con registerDocEditor.",
  "docs.editor.engineLoading": "Preparando el editor…",
  "docs.editor.engineMissing":
    "El paquete opcional del editor no está instalado: se edita el código fuente.",
  "docs.editor.engineFailed":
    "El editor no pudo iniciarse: se edita el código fuente.",
  "docs.editor.modeSource": "Editar el código",
  "docs.editor.modeRich": "Editar con formato",
  "docs.share.title": "Compartir",
  "docs.share.people": "Personas con acceso",
  "docs.share.links": "Enlaces",
  "docs.share.mintLink": "Crear un enlace",
  "docs.share.copyLink": "Copiar enlace",
  "docs.share.linkCopied": "Enlace copiado.",
  "docs.share.revokeLink": "Revocar el enlace",
  "docs.share.expires": "Dejará de funcionar el {date}",
  "docs.share.firstOpened": "Se abrió por primera vez el {date}",
  "docs.share.neverOpened": "Todavía sin abrir",
  "docs.share.linksEmpty": "Aún no hay enlaces.",
  "docs.share.peopleEmpty": "Nadie más tiene acceso.",
  "docs.share.levelView": "Puede ver",
  "docs.share.levelEdit": "Puede editar",
  "docs.share.statusActive": "Activo",
  "docs.share.statusExpired": "Caducado",
  "docs.share.statusRevoked": "Revocado",
  "docs.share.addPerson": "Dar acceso",
  "docs.share.subjectUser": "Una persona",
  "docs.share.subjectRef": "Un grupo",
  "docs.share.subjectPlaceholder": "Identificador de usuario",
  "docs.share.removePerson": "Quitar el acceso",
  "docs.share.suspended": "En pausa por configuración",
  "docs.share.suspendedHint":
    "Esta forma de compartir está desactivada en esta instalación, así que ahora mismo la fila no concede nada. No se revocó: al volver a activarla, el acceso regresa.",
  "docs.share.unavailable": "No puedes administrar esta forma de compartir.",
  "docs.share.loading": "Cargando el acceso…",
  "docs.share.error": "No se pudo cargar el acceso.",
  "docs.shared.readOnly": "Compartido contigo: solo lectura.",
  "docs.shared.notFound": "Este enlace no abre nada.",
  "docs.shared.notFoundHint":
    "Puede haber caducado o haber sido revocado. Pide uno nuevo a quien te lo compartió.",
  "docs.shared.authRequired": "Inicia sesión para abrir este documento.",
  "docs.shared.download": "Descargar",
  "docs.shared.loading": "Abriendo el documento compartido…",
  "docs.nav.files": "Documentos",
  "docs.nav.document": "Documento",
};

/** Register the Spanish bundle into a core i18n engine. */
export function registerDocsI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, docsI18nBundleEs);
}
