import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { docsErrorBundleEn } from "./errorsMap.js";

/**
 * docs-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's
 * i18n engine (`useT`). Backend error codes flow through the SAME contour
 * once stapel-docs commits its error registry (the generated en floor spreads
 * under this bundle then — see `errorsMap.ts`). All UI keys live under the
 * `docs.` namespace.
 */
export const DOCS_I18N_KEYS = {
  unknownError: "docs.error.unknown",
  // Document list (DocumentList headless)
  listLoading: "docs.list.loading",
  listEmpty: "docs.list.empty",
  listError: "docs.list.error",
  listRetry: "docs.list.retry",
  // Folder tree + breadcrumbs (FolderTree / Breadcrumbs headless)
  treeLoading: "docs.tree.loading",
  treeError: "docs.tree.error",
  treeRoot: "docs.tree.root",
  // Editor (DocEditor headless + builtin editors)
  editorLoading: "docs.editor.loading",
  editorSave: "docs.editor.save",
  editorSaving: "docs.editor.saving",
  editorSaved: "docs.editor.saved",
  editorConflict: "docs.editor.conflict",
  editorOverride: "docs.editor.override",
  editorDownloadOnly: "docs.editor.downloadOnly",
  // Revisions (RevisionHistory headless)
  revisionsLoading: "docs.revisions.loading",
  revisionsEmpty: "docs.revisions.empty",
  revisionsCreate: "docs.revisions.create",
  revisionsRestore: "docs.revisions.restore",
  revisionsRestoring: "docs.revisions.restoring",
  // Trash (TrashBin headless)
  trashEmptyState: "docs.trash.emptyState",
  trashRestore: "docs.trash.restore",
  trashEmptyAction: "docs.trash.emptyAction",
  trashEmptying: "docs.trash.emptying",
  // Upload (DocUploader headless)
  uploadAction: "docs.upload.action",
  uploadUploading: "docs.upload.uploading",
  uploadDone: "docs.upload.done",
  uploadFailed: "docs.upload.failed",
  // Media (MediaViewer headless)
  mediaDownload: "docs.media.download",
  // File manager (default skin: FileManager + panes)
  managerFilesView: "docs.manager.filesView",
  managerTrashView: "docs.manager.trashView",
  managerNewFolder: "docs.manager.newFolder",
  managerUpload: "docs.manager.upload",
  managerFoldersEmpty: "docs.manager.foldersEmpty",
  managerNameColumn: "docs.manager.nameColumn",
  managerUpdatedColumn: "docs.manager.updatedColumn",
  managerSizeColumn: "docs.manager.sizeColumn",
  // Context menus (default skin: folder / document / trash items)
  menuOpen: "docs.menu.open",
  menuRename: "docs.menu.rename",
  menuMove: "docs.menu.move",
  menuNewSubfolder: "docs.menu.newSubfolder",
  menuMoveToTrash: "docs.menu.moveToTrash",
  menuDownload: "docs.menu.download",
  menuHistory: "docs.menu.history",
  menuRestore: "docs.menu.restore",
  menuDeleteForever: "docs.menu.deleteForever",
  // Dialogs (default skin: rename / move / new folder)
  dialogRenameTitle: "docs.dialog.renameTitle",
  dialogMoveTitle: "docs.dialog.moveTitle",
  dialogMoveTarget: "docs.dialog.moveTarget",
  dialogNewFolderTitle: "docs.dialog.newFolderTitle",
  dialogNamePlaceholder: "docs.dialog.namePlaceholder",
  dialogOk: "docs.dialog.ok",
  dialogCancel: "docs.dialog.cancel",
  dialogRootFolder: "docs.dialog.rootFolder",
  // Revisions modal (default skin: RevisionsModal)
  revisionsTitle: "docs.revisions.title",
  revisionsAutomatic: "docs.revisions.automatic",
  revisionsPreviewEmpty: "docs.revisions.previewEmpty",
  revisionsPreviewBinary: "docs.revisions.previewBinary",
  revisionsRollback: "docs.revisions.rollback",
  revisionsRollbackConfirm: "docs.revisions.rollbackConfirm",
  revisionsNamePlaceholder: "docs.revisions.namePlaceholder",
  revisionsDownload: "docs.revisions.download",
  // Editor chrome (default skin: EditorChrome + default editors)
  editorDirty: "docs.editor.dirty",
  editorAddRow: "docs.editor.addRow",
  editorAddColumn: "docs.editor.addColumn",
  editorDeleteRow: "docs.editor.deleteRow",
  // Trash pane (default skin: TrashPane)
  trashEmptyConfirm: "docs.trash.emptyConfirm",
  trashKindFolder: "docs.trash.kindFolder",
  trashKindDocument: "docs.trash.kindDocument",
  /** Why "Empty trash" is off when the trash loaded and holds nothing —
   * core's floor covers the loading/failed reasons (`useActionGate`). */
  trashEmptyBlocked: "docs.trash.emptyBlocked",
} as const;

export type DocsI18nKey = (typeof DOCS_I18N_KEYS)[keyof typeof DOCS_I18N_KEYS];

/**
 * English fallback bundle for docs-react UI keys (+ backend error codes once
 * the generated floor exists — spread FIRST so a `StapelApiError.code` never
 * renders as a raw key; empty today, see `errorsMap.ts`). Hand-polished copy
 * below overrides the generated English for the keys users see most.
 */
export const docsI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (empty until enrollment).
  ...docsErrorBundleEn,

  // docs-react UI
  "docs.error.unknown": "Something went wrong. Please try again.",
  "docs.list.loading": "Loading documents…",
  "docs.list.empty": "No documents yet.",
  "docs.list.error": "Couldn't load documents.",
  "docs.list.retry": "Try again",
  "docs.tree.loading": "Loading folders…",
  "docs.tree.error": "Couldn't load folders.",
  "docs.tree.root": "All documents",
  "docs.editor.loading": "Loading document…",
  "docs.editor.save": "Save",
  "docs.editor.saving": "Saving…",
  "docs.editor.saved": "All changes saved.",
  "docs.editor.conflict":
    "Someone else saved this document while you were editing.",
  "docs.editor.override": "Save anyway (keeps both versions in history)",
  "docs.editor.downloadOnly": "This document type opens as a download.",
  "docs.revisions.loading": "Loading history…",
  "docs.revisions.empty": "No revisions yet.",
  "docs.revisions.create": "Name this version",
  "docs.revisions.restore": "Restore",
  "docs.revisions.restoring": "Restoring…",
  "docs.trash.emptyState": "Trash is empty.",
  "docs.trash.restore": "Restore",
  "docs.trash.emptyAction": "Empty trash",
  "docs.trash.emptying": "Emptying…",
  "docs.upload.action": "Upload a file",
  "docs.upload.uploading": "Uploading…",
  "docs.upload.done": "Upload finished.",
  "docs.upload.failed": "Upload failed.",
  "docs.media.download": "Download",
  "docs.manager.filesView": "Files",
  "docs.manager.trashView": "Trash",
  "docs.manager.newFolder": "New folder",
  "docs.manager.upload": "Upload",
  "docs.manager.foldersEmpty": "No folders yet.",
  "docs.manager.nameColumn": "Name",
  "docs.manager.updatedColumn": "Updated",
  "docs.manager.sizeColumn": "Size",
  "docs.menu.open": "Open",
  "docs.menu.rename": "Rename",
  "docs.menu.move": "Move to…",
  "docs.menu.newSubfolder": "New subfolder",
  "docs.menu.moveToTrash": "Move to trash",
  "docs.menu.download": "Download",
  "docs.menu.history": "Version history",
  "docs.menu.restore": "Restore",
  "docs.menu.deleteForever": "Delete forever",
  "docs.dialog.renameTitle": "Rename",
  "docs.dialog.moveTitle": "Move to folder",
  "docs.dialog.moveTarget": "Destination folder",
  "docs.dialog.newFolderTitle": "New folder",
  "docs.dialog.namePlaceholder": "Name",
  "docs.dialog.ok": "OK",
  "docs.dialog.cancel": "Cancel",
  "docs.dialog.rootFolder": "All documents",
  "docs.revisions.title": "Version history",
  "docs.revisions.automatic": "Automatic revision",
  "docs.revisions.previewEmpty": "Select a revision to preview it.",
  "docs.revisions.previewBinary":
    "This revision is a binary snapshot — download it to view.",
  "docs.revisions.rollback": "Roll back to this revision",
  "docs.revisions.rollbackConfirm":
    "Restore this revision? The current content stays in history.",
  "docs.revisions.namePlaceholder": "Version name",
  "docs.revisions.download": "Download revision",
  "docs.editor.dirty": "Unsaved changes",
  "docs.editor.addRow": "Add row",
  "docs.editor.addColumn": "Add column",
  "docs.editor.deleteRow": "Delete row",
  "docs.trash.emptyConfirm":
    "Permanently delete everything in the trash? This cannot be undone.",
  "docs.trash.kindFolder": "Folder",
  "docs.trash.kindDocument": "Document",
  "docs.trash.emptyBlocked": "There is nothing in the trash to delete.",
};

/**
 * Register docs-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`); a later
 * `loadLocale` from stapel-translate can layer localized overrides on top.
 *
 * MERGE-PRIORITY CONVENTION (i18n-shipping.md §3): registration order is
 * override priority — later wins per key. A HOST bundle registered AFTER this
 * call overrides any pair text without a fork. stapel-docs ships no locale
 * catalogs yet, so this pair is en-only; a `./i18n/<locale>` subpath follows
 * the notifications etalon once it does.
 */
export function registerDocsI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, docsI18nBundleEn);
}
