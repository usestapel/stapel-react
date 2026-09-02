import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { driveErrorBundleEn } from "./errorsMap.js";

/**
 * drive-react's own translation KEYS (frontend-standard §4.2): nothing in
 * this package renders a literal string — hosts resolve these through core's
 * i18n engine (`useT`). Backend error codes flow through the SAME contour:
 * the generated en floor for all 77 codes of stapel-docs' registry spreads
 * UNDER this bundle (see `errorsMap.ts`). All UI keys live under the `drive.`
 * namespace; `ru` and `es` mirror this file key-for-key
 * (`src/i18n/{ru,es}.ts`, gated by `test/i18n.test.ts` AND by
 * `stapel/i18n-locale-parity`, which anchors on this file).
 */
export const DRIVE_I18N_KEYS = {
  unknownError: "drive.error.unknown",

  // Navigation (DriveScreen chrome + DriveBreadcrumb)
  navDrive: "drive.nav.drive",
  rootCrumb: "drive.crumb.root",
  breadcrumbLabel: "drive.crumb.label",

  // Tabs
  tabFiles: "drive.tab.files",
  tabStarred: "drive.tab.starred",
  tabRecents: "drive.tab.recents",
  tabTrash: "drive.tab.trash",

  // The folder listing (DriveList / DriveGrid)
  listLoading: "drive.list.loading",
  listError: "drive.list.error",
  listRetry: "drive.list.retry",
  listEmpty: "drive.list.empty",
  listEmptyHint: "drive.list.emptyHint",
  viewList: "drive.view.list",
  viewGrid: "drive.view.grid",
  itemsFolder: "drive.item.folder",
  itemsDocument: "drive.item.document",

  // Stars
  star: "drive.star.add",
  unstar: "drive.star.remove",
  starredEmpty: "drive.starred.empty",
  starredEmptyHint: "drive.starred.emptyHint",
  starredError: "drive.starred.error",

  // Recents
  recentsEmpty: "drive.recents.empty",
  recentsEmptyHint: "drive.recents.emptyHint",
  recentsError: "drive.recents.error",

  // Search
  searchLabel: "drive.search.label",
  searchPlaceholder: "drive.search.placeholder",
  searchIdle: "drive.search.idle",
  searchEmpty: "drive.search.empty",
  searchError: "drive.search.error",
  searchInRoot: "drive.search.inRoot",

  // Row actions (the bottom action sheet)
  actionsLabel: "drive.actions.label",
  actionOpen: "drive.action.open",
  actionRename: "drive.action.rename",
  actionMove: "drive.action.move",
  actionDownload: "drive.action.download",
  actionTrash: "drive.action.trash",
  renameTitle: "drive.rename.title",
  renameField: "drive.rename.field",
  renameEmpty: "drive.rename.empty",
  renameUnchanged: "drive.rename.unchanged",
  renameSubmit: "drive.rename.submit",
  moveTitle: "drive.move.title",
  moveToRoot: "drive.move.toRoot",
  moveSubmit: "drive.move.submit",
  moveSameFolder: "drive.move.sameFolder",
  trashConfirm: "drive.trash.confirm",

  // Upload (the FAB + the tray)
  uploadAction: "drive.upload.action",
  uploadTrayTitle: "drive.upload.trayTitle",
  uploadQueued: "drive.upload.queued",
  uploadUploading: "drive.upload.uploading",
  uploadDone: "drive.upload.done",
  uploadFailed: "drive.upload.failed",
  uploadCanceled: "drive.upload.canceled",
  uploadRetry: "drive.upload.retry",
  uploadCancel: "drive.upload.cancel",
  uploadClear: "drive.upload.clear",
  uploadEmpty: "drive.upload.empty",
  uploadQuotaTitle: "drive.upload.quotaTitle",
  uploadQuotaHint: "drive.upload.quotaHint",

  // Previews
  previewAlt: "drive.preview.alt",
} as const;

/** One key of {@link DRIVE_I18N_KEYS}. */
export type DriveI18nKey = (typeof DRIVE_I18N_KEYS)[keyof typeof DRIVE_I18N_KEYS];

/**
 * The English bundle: the generated backend-error floor for all 77 codes,
 * then this pair's own UI copy on top.
 */
export const driveI18nBundleEn: I18nDictionary = {
  // Backend error codes — the generated en floor (stapel-docs' registry).
  ...driveErrorBundleEn,

  // drive-react UI
  "drive.error.unknown": "Something went wrong. Please try again.",

  "drive.nav.drive": "Drive",
  "drive.crumb.root": "My drive",
  "drive.crumb.label": "Folder path",

  "drive.tab.files": "Files",
  "drive.tab.starred": "Starred",
  "drive.tab.recents": "Recent",
  "drive.tab.trash": "Trash",

  "drive.list.loading": "Loading this folder…",
  "drive.list.error": "This folder could not be loaded.",
  "drive.list.retry": "Try again",
  "drive.list.empty": "This folder is empty.",
  "drive.list.emptyHint": "Upload a file to put something here.",
  "drive.view.list": "List view",
  "drive.view.grid": "Grid view",
  "drive.item.folder": "Folder",
  "drive.item.document": "File",

  "drive.star.add": "Star",
  "drive.star.remove": "Remove star",
  "drive.starred.empty": "Nothing is starred yet.",
  "drive.starred.emptyHint": "Star a file to keep it one tap away.",
  "drive.starred.error": "Starred items could not be loaded.",

  "drive.recents.empty": "Nothing opened yet.",
  "drive.recents.emptyHint": "Files you open show up here.",
  "drive.recents.error": "Recent files could not be loaded.",

  "drive.search.label": "Search this drive",
  "drive.search.placeholder": "Search files and folders",
  "drive.search.idle": "Type to search this drive.",
  "drive.search.empty": "Nothing matches that.",
  "drive.search.error": "The search could not be run.",
  "drive.search.inRoot": "In my drive",

  "drive.actions.label": "Actions",
  "drive.action.open": "Open",
  "drive.action.rename": "Rename",
  "drive.action.move": "Move",
  "drive.action.download": "Download",
  "drive.action.trash": "Move to trash",
  "drive.rename.title": "Rename",
  "drive.rename.field": "Name",
  "drive.rename.empty": "A name is required.",
  "drive.rename.unchanged": "That is already the name.",
  "drive.rename.submit": "Rename",
  "drive.move.title": "Move to",
  "drive.move.toRoot": "My drive",
  "drive.move.submit": "Move",
  "drive.move.sameFolder": "It is already there.",
  "drive.trash.confirm": "Move this to the trash?",

  "drive.upload.action": "Upload",
  "drive.upload.trayTitle": "Uploads",
  "drive.upload.queued": "Waiting",
  "drive.upload.uploading": "Uploading…",
  "drive.upload.done": "Uploaded",
  "drive.upload.failed": "Upload failed",
  "drive.upload.canceled": "Canceled",
  "drive.upload.retry": "Try again",
  "drive.upload.cancel": "Cancel",
  "drive.upload.clear": "Clear finished",
  "drive.upload.empty": "No uploads yet.",
  "drive.upload.quotaTitle": "This workspace is out of space.",
  "drive.upload.quotaHint":
    "Nothing more will upload until room is freed — empty the trash, or ask for a bigger quota.",

  "drive.preview.alt": "Preview",
};

/**
 * Register drive-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`).
 *
 * MERGE-PRIORITY CONVENTION (i18n-shipping.md §3): registration order is
 * override priority — later wins per key. A HOST bundle registered AFTER this
 * call overrides any pair text without a fork. `ru` and `es` ship as the
 * opt-in `./i18n/ru` / `./i18n/es` subpaths, so a host that ships one locale
 * never carries the other two.
 */
export function registerDriveI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, driveI18nBundleEn);
}
