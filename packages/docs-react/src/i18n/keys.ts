import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { docsErrorBundleEn } from "./errorsMap.js";

/**
 * docs-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's
 * i18n engine (`useT`). Backend error codes flow through the SAME contour:
 * the generated en floor for all 84 codes of `stapel-docs/docs/errors.json`
 * spreads UNDER this bundle (see `errorsMap.ts`). All UI keys live under the
 * `docs.` namespace; `ru` and `es` mirror this file key-for-key
 * (`src/i18n/{ru,es}.ts`, gated by `test/i18n.test.ts`).
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
  /** Primary action of a documents product: create one. */
  managerNewDocument: "docs.manager.newDocument",
  /** Phone master/detail switch — the folder tree pane. */
  managerFoldersPane: "docs.manager.foldersPane",
  /** Phone master/detail switch — the document list pane. */
  managerFilesPane: "docs.manager.filesPane",
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
  /** Accessible name of the per-row overflow trigger (the keyboard- and
   * touch-reachable twin of the right-click menu). */
  menuActions: "docs.menu.actions",
  // Dialogs (default skin: rename / move / new folder)
  dialogRenameTitle: "docs.dialog.renameTitle",
  dialogMoveTitle: "docs.dialog.moveTitle",
  dialogMoveTarget: "docs.dialog.moveTarget",
  dialogNewFolderTitle: "docs.dialog.newFolderTitle",
  dialogNamePlaceholder: "docs.dialog.namePlaceholder",
  /** Affirmative verbs. A dialog's confirm names the ACTION it performs —
   * "OK" is what a control says when nobody decided what it does, and the
   * visual pass found it on the create-document sheet where "Create"
   * belonged. `dialogOk` remains for a host prompt with no better verb. */
  dialogOk: "docs.dialog.ok",
  dialogRenameConfirm: "docs.dialog.renameConfirm",
  dialogCreateFolderConfirm: "docs.dialog.createFolderConfirm",
  dialogMoveConfirm: "docs.dialog.moveConfirm",
  dialogCreateDocumentConfirm: "docs.dialog.createDocumentConfirm",
  dialogCancel: "docs.dialog.cancel",
  /** Accessible name of a dialog's dismissal affordance — the modal's close
   * button and the bottom sheet's grab handle (`SkinDialog.dismissLabel`).
   * Not `dialogCancel`: cancelling an edit and closing the surface are
   * different sentences, and the sheet's handle is present with no form. */
  dialogClose: "docs.dialog.close",
  dialogRootFolder: "docs.dialog.rootFolder",
  dialogNewDocumentTitle: "docs.dialog.newDocumentTitle",
  dialogDocumentType: "docs.dialog.documentType",
  /** Why OK is off on a name prompt with nothing typed. */
  dialogNameBlockedEmpty: "docs.dialog.nameBlockedEmpty",
  /** Why OK is off when the picked destination is where the item already is. */
  dialogMoveBlockedUnchanged: "docs.dialog.moveBlockedUnchanged",
  /** Document-type labels for the create dialog (the three editable
   * builtins; `file` is created by uploading, not by this dialog). */
  typeText: "docs.type.text",
  typeMarkdown: "docs.type.markdown",
  typeCsv: "docs.type.csv",
  /** The two live (crdt) builtins of 0.7.0 — offered via
   * `CRDT_DOCUMENT_TYPES`, opt-in (see `model/documentTypes.ts`). */
  typeMarkdownLive: "docs.type.markdownLive",
  typeTextLive: "docs.type.textLive",
  // Revisions modal (default skin: RevisionsModal)
  revisionsTitle: "docs.revisions.title",
  revisionsAutomatic: "docs.revisions.automatic",
  revisionsPreviewEmpty: "docs.revisions.previewEmpty",
  revisionsPreviewBinary: "docs.revisions.previewBinary",
  revisionsRollback: "docs.revisions.rollback",
  revisionsRollbackConfirm: "docs.revisions.rollbackConfirm",
  /** Why rollback is off on the revision the document is already at — the
   * restore would write a new, byte-identical head. */
  revisionsRollbackBlockedHead: "docs.revisions.rollbackBlockedHead",
  revisionsNamePlaceholder: "docs.revisions.namePlaceholder",
  revisionsDownload: "docs.revisions.download",
  /** Why "Name this version" is off with an empty name field. */
  revisionsNameBlockedEmpty: "docs.revisions.nameBlockedEmpty",
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
  /** The download link is still being minted. A bare skeleton could not be
   * told from a stuck screen (visual pass M-3). */
  mediaMinting: "docs.media.minting",
  /** What an empty document list invites the person to do. */
  listEmptyHint: "docs.list.emptyHint",
  /** What an empty trash means (nothing was deleted). */
  trashEmptyHint: "docs.trash.emptyHint",
  /** A crdt-discipline document with no registered collaborative editor:
   * the snapshot save path is NOT legal for it, so the surface says so
   * instead of silently offering a save the journal would refuse. */
  editorCollabUnsupported: "docs.editor.collabUnsupported",
  editorCollabUnsupportedHint: "docs.editor.collabUnsupportedHint",
  // Optional editor engines (the `./editors/codemirror` and
  // `./editors/milkdown` subpaths — loaded with import() at mount).
  /** The optional engine is being fetched; the surface is not blank. */
  editorEngineLoading: "docs.editor.engineLoading",
  /** The optional peer is not installed. A designed screen, not a crash:
   * the plain-textarea builtin still edits the document under it. */
  editorEngineMissing: "docs.editor.engineMissing",
  /** The optional peer IS installed but blew up on load — a different fact
   * from "not installed", and the remedy is a different one too. */
  editorEngineFailed: "docs.editor.engineFailed",
  /** Switch the markdown surface to raw source (CodeMirror). */
  editorModeSource: "docs.editor.modeSource",
  /** Switch the markdown surface back to rich text (Milkdown). */
  editorModeRich: "docs.editor.modeRich",
  // Sharing (ShareSheet headless — the share axis of stapel-docs 0.6)
  shareTitle: "docs.share.title",
  sharePeopleSection: "docs.share.people",
  shareLinksSection: "docs.share.links",
  shareMintLink: "docs.share.mintLink",
  shareCopyLink: "docs.share.copyLink",
  shareLinkCopied: "docs.share.linkCopied",
  shareRevokeLink: "docs.share.revokeLink",
  /** The instant the link stops opening. Always present — the backend turns
   * a perpetual TTL into a century rather than a null. */
  shareExpires: "docs.share.expires",
  /** Stamped once, the first time somebody actually opened the link. */
  shareFirstOpened: "docs.share.firstOpened",
  shareNeverOpened: "docs.share.neverOpened",
  shareLinksEmpty: "docs.share.linksEmpty",
  sharePeopleEmpty: "docs.share.peopleEmpty",
  shareLevelView: "docs.share.levelView",
  shareLevelEdit: "docs.share.levelEdit",
  shareStatusActive: "docs.share.statusActive",
  shareStatusExpired: "docs.share.statusExpired",
  shareStatusRevoked: "docs.share.statusRevoked",
  shareAddPerson: "docs.share.addPerson",
  shareSubjectUser: "docs.share.subjectUser",
  shareSubjectRef: "docs.share.subjectRef",
  shareSubjectPlaceholder: "docs.share.subjectPlaceholder",
  shareRemovePerson: "docs.share.removePerson",
  /** The row exists but its mode is switched off for this deployment: inert,
   * NOT revoked. Shown on the row — hiding it makes an admin believe the
   * access was taken away. */
  shareSuspended: "docs.share.suspended",
  shareSuspendedHint: "docs.share.suspendedHint",
  /** This caller may not administer this way of sharing at all (the listing
   * endpoint refused). A section that is absent, not one that is dead. */
  shareUnavailable: "docs.share.unavailable",
  shareLoading: "docs.share.loading",
  shareError: "docs.share.error",
  // The bearer surface (SharedDocumentView headless)
  sharedReadOnly: "docs.shared.readOnly",
  sharedNotFound: "docs.shared.notFound",
  sharedNotFoundHint: "docs.shared.notFoundHint",
  sharedAuthRequired: "docs.shared.authRequired",
  sharedDownload: "docs.shared.download",
  sharedLoading: "docs.shared.loading",
  // Navigation (src/nav/manifest.ts — the scripted-fullstack nav contract)
  navFiles: "docs.nav.files",
  navDocument: "docs.nav.document",
} as const;

export type DocsI18nKey = (typeof DOCS_I18N_KEYS)[keyof typeof DOCS_I18N_KEYS];

/**
 * English fallback bundle for docs-react UI keys (+ backend error codes once
 * the generated floor exists — spread FIRST so a `StapelApiError.code` never
 * renders as a raw key; empty today, see `errorsMap.ts`). Hand-polished copy
 * below overrides the generated English for the keys users see most.
 */
export const docsI18nBundleEn: I18nDictionary = {
  // Backend error codes — the generated en floor (all 84).
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
  "docs.media.minting": "Preparing the download link…",
  "docs.manager.filesView": "Files",
  "docs.manager.trashView": "Trash",
  "docs.manager.newFolder": "New folder",
  "docs.manager.upload": "Upload",
  "docs.manager.foldersEmpty": "No folders yet.",
  "docs.manager.newDocument": "New document",
  "docs.manager.foldersPane": "Folders",
  "docs.manager.filesPane": "Documents",
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
  "docs.menu.actions": "Actions",
  "docs.dialog.renameTitle": "Rename",
  "docs.dialog.moveTitle": "Move to folder",
  "docs.dialog.moveTarget": "Destination folder",
  "docs.dialog.newFolderTitle": "New folder",
  "docs.dialog.namePlaceholder": "Name",
  "docs.dialog.ok": "OK",
  "docs.dialog.renameConfirm": "Rename",
  "docs.dialog.createFolderConfirm": "Create folder",
  "docs.dialog.moveConfirm": "Move",
  "docs.dialog.createDocumentConfirm": "Create",
  "docs.dialog.cancel": "Cancel",
  "docs.dialog.close": "Close",
  "docs.dialog.rootFolder": "All documents",
  "docs.dialog.newDocumentTitle": "New document",
  "docs.dialog.documentType": "Document type",
  "docs.dialog.nameBlockedEmpty": "Type a name first.",
  "docs.dialog.moveBlockedUnchanged": "This is where it already is.",
  "docs.type.text": "Plain text",
  "docs.type.markdown": "Markdown",
  "docs.type.csv": "Spreadsheet (CSV)",
  "docs.type.markdownLive": "Markdown (live co-editing)",
  "docs.type.textLive": "Plain text (live co-editing)",
  "docs.revisions.title": "Version history",
  "docs.revisions.automatic": "Automatic revision",
  "docs.revisions.previewEmpty": "Select a revision to preview it.",
  "docs.revisions.previewBinary":
    "This revision is a binary snapshot — download it to view.",
  "docs.revisions.rollback": "Roll back to this revision",
  "docs.revisions.rollbackConfirm":
    "Restore this revision? The current content stays in history.",
  "docs.revisions.rollbackBlockedHead":
    "This is the document's current version.",
  "docs.revisions.namePlaceholder": "Version name",
  "docs.revisions.download": "Download revision",
  "docs.revisions.nameBlockedEmpty": "Type a name for this version first.",
  "docs.editor.dirty": "Unsaved changes",
  "docs.editor.addRow": "Add row",
  "docs.editor.addColumn": "Add column",
  "docs.editor.deleteRow": "Delete row",
  "docs.trash.emptyConfirm":
    "Permanently delete everything in the trash? This cannot be undone.",
  "docs.trash.kindFolder": "Folder",
  "docs.trash.kindDocument": "Document",
  "docs.trash.emptyBlocked": "There is nothing in the trash to delete.",
  "docs.list.emptyHint": "Create a document or upload a file to get started.",
  "docs.trash.emptyHint": "Documents you delete land here first.",
  "docs.editor.collabUnsupported":
    "This document is edited collaboratively.",
  "docs.editor.collabUnsupportedHint":
    "No collaborative editor is registered for its type, so it cannot be edited here. Download it, or register one with registerDocEditor.",
  "docs.editor.engineLoading": "Preparing the editor…",
  "docs.editor.engineMissing":
    "The optional editor package is not installed — editing the plain source instead.",
  "docs.editor.engineFailed":
    "The editor could not start — editing the plain source instead.",
  "docs.editor.modeSource": "Edit source",
  "docs.editor.modeRich": "Edit rich text",
  "docs.share.title": "Share",
  "docs.share.people": "People with access",
  "docs.share.links": "Links",
  "docs.share.mintLink": "Create a link",
  "docs.share.copyLink": "Copy link",
  "docs.share.linkCopied": "Link copied.",
  "docs.share.revokeLink": "Revoke link",
  "docs.share.expires": "Stops working on {date}",
  "docs.share.firstOpened": "First opened {date}",
  "docs.share.neverOpened": "Not opened yet",
  "docs.share.linksEmpty": "No links yet.",
  "docs.share.peopleEmpty": "Nobody else has access.",
  "docs.share.levelView": "Can view",
  "docs.share.levelEdit": "Can edit",
  "docs.share.statusActive": "Active",
  "docs.share.statusExpired": "Expired",
  "docs.share.statusRevoked": "Revoked",
  "docs.share.addPerson": "Give access",
  "docs.share.subjectUser": "A person",
  "docs.share.subjectRef": "A group",
  "docs.share.subjectPlaceholder": "User id",
  "docs.share.removePerson": "Remove access",
  "docs.share.suspended": "Paused by configuration",
  "docs.share.suspendedHint":
    "This way of sharing is switched off for this deployment, so the row grants nothing right now. It was not revoked — switching the mode back on restores it.",
  "docs.share.unavailable": "You cannot manage this kind of sharing.",
  "docs.share.loading": "Loading sharing…",
  "docs.share.error": "Sharing could not be loaded.",
  "docs.shared.readOnly": "Shared with you — read only.",
  "docs.shared.notFound": "This link does not open anything.",
  "docs.shared.notFoundHint":
    "It may have expired or been revoked. Ask whoever shared it for a new one.",
  "docs.shared.authRequired": "Sign in to open this shared document.",
  "docs.shared.download": "Download",
  "docs.shared.loading": "Opening the shared document…",
  "docs.nav.files": "Documents",
  "docs.nav.document": "Document",
};

/**
 * Register docs-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`); a later
 * `loadLocale` from stapel-translate can layer localized overrides on top.
 *
 * MERGE-PRIORITY CONVENTION (i18n-shipping.md §3): registration order is
 * override priority — later wins per key. A HOST bundle registered AFTER this
 * call overrides any pair text without a fork. `ru` and `es` ship as the
 * opt-in `./i18n/ru` / `./i18n/es` subpaths (`registerDocsI18nRu` /
 * `registerDocsI18nEs`), so a host that ships one locale never carries the
 * other two.
 */
export function registerDocsI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, docsI18nBundleEn);
}
