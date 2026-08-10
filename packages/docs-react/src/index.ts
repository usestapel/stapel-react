/**
 * `@stapel/docs-react` — the headless React flow pair for stapel-docs
 * (frontend-standard §2). Business + state only, zero visual opinion. Built
 * on `@stapel/core`'s StapelClient (verification-403 interception, token
 * refresh, i18n, analytics, query layer).
 *
 * The pair's distinctive surface is the EDITOR REGISTRY: a document's
 * `editor_hint` resolves to an editor component (explicit registration >
 * builtin > null = download-only), so a customer adds an editor for a new
 * document type with `registerDocEditor(hint, component)` — never a fork.
 * Builtins ("text", "markdown", "csv") are snapshot editors on the If-Match
 * discipline (`DocEditor`: load `head_seq` → PUT with `If-Match` → 409/412
 * becomes typed conflict state + `overrideSave`).
 *
 * CONTRACT NOTE: stapel-docs does not emit its contract artifacts
 * (docs/{schema,flows,errors}.json) yet — the api layer is hand-typed to the
 * module's endpoint table and the generated surfaces (schema, error map,
 * manifest enrollment in the root gen:* drivers) are a mandatory follow-up
 * once the backend commits its contract. See `api/types.ts`.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createDocsApi } from "./api/docsApi.js";
export type { DocsApi, DocsApiOptions } from "./api/docsApi.js";
export {
  DOCS_HEAD_SEQ_HEADER,
  getDocumentContent,
  putDocumentContent,
  exportDocument,
  getRevisionContent,
  uploadToPutUrl,
} from "./api/content.js";
export type { DocsRawTransport, PutContentOptions } from "./api/content.js";
export type {
  DocFolder,
  DocDocument,
  DocRevision,
  DocUpdate,
  DocUpdatesResponse,
  CreateFolderRequest,
  PatchFolderRequest,
  DocumentListParams,
  CreateDocumentRequest,
  PatchDocumentRequest,
  CreateRevisionRequest,
  EmptyTrashRequest,
  PostUpdateRequest,
  CreateUploadRequest,
  CreateUploadResponse,
  DownloadUrl,
  SaveContentOk,
  SaveConflict,
  SaveContentResult,
  DocumentContent,
  TrashListing,
} from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { DOCS_FLOWS, flowEndpoints } from "./flows/registry.js";
export type { DocsFlowId, DocsFlowSpec, FlowEndpoint } from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createDocsRuntime } from "./model/runtime.js";
export type { DocsRuntime, CreateDocsRuntimeOptions } from "./model/runtime.js";
export {
  DocsRuntimeContext,
  useDocsRuntime,
  useDocsApi,
  useDocsAnalytics,
} from "./model/context.js";
export { docsQueryKeys } from "./model/queryKeys.js";
export { buildFolderTree, folderTrail } from "./model/folderTree.js";
export type { FolderTreeNode } from "./model/folderTree.js";
export {
  useFolders,
  useFolderTree,
  useDocuments,
  useDocument,
  useDocumentContent,
  useRevisions,
  useRevisionContent,
  useTrash,
  useDownloadUrl,
} from "./model/queries.js";
export type { DocumentText, RevisionText } from "./model/queries.js";
export {
  useSaveContent,
  useCreateRevision,
  useRestoreRevision,
  useTrashActions,
  useUpload,
  useExportUrl,
  useCreateFolder,
  useUpdateFolder,
  useTrashFolder,
  useCreateDocument,
  useUpdateDocument,
  useTrashDocument,
} from "./model/mutations.js";
export type {
  SaveContentVariables,
  CreateRevisionVariables,
  RestoreRevisionVariables,
  TrashActions,
  UploadVariables,
  UploadResult,
  ExportUrlVariables,
  UpdateFolderVariables,
  UpdateDocumentVariables,
} from "./model/mutations.js";

// ── editor registry (the customer seam) + builtin editors ────────────────────
export {
  registerDocEditor,
  unregisterDocEditor,
  resolveDocEditor,
  explicitDocEditor,
  registeredDocEditorHints,
} from "./editors/registry.js";
export type {
  DocEditorAdapterProps,
  DocEditorComponent,
} from "./editors/registry.js";
export { TextEditor } from "./editors/builtin/TextEditor.js";
export { MarkdownEditor } from "./editors/builtin/MarkdownEditor.js";
export { CsvEditor } from "./editors/builtin/CsvEditor.js";
export { parseCsv, serializeCsv } from "./editors/csv.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { DocsProvider } from "./headless/DocsProvider.js";
export { DocumentList } from "./headless/DocumentList.js";
export type { DocumentListBag } from "./headless/DocumentList.js";
export { FolderTree } from "./headless/FolderTree.js";
export type { FolderTreeBag, FolderTreeView } from "./headless/FolderTree.js";
export { Breadcrumbs } from "./headless/Breadcrumbs.js";
export type { BreadcrumbsBag, BreadcrumbTrail } from "./headless/Breadcrumbs.js";
export { DocEditor } from "./headless/DocEditor.js";
export type { DocEditorBag } from "./headless/DocEditor.js";
export { RevisionHistory } from "./headless/RevisionHistory.js";
export type { RevisionHistoryBag } from "./headless/RevisionHistory.js";
export { TrashBin } from "./headless/TrashBin.js";
export type { TrashBag } from "./headless/TrashBin.js";
export { DocUploader } from "./headless/DocUploader.js";
export type { UploadBag } from "./headless/DocUploader.js";
export { MediaViewer } from "./headless/MediaViewer.js";
export type {
  MediaViewerBag,
  MediaKind,
  MediaPresentation,
} from "./headless/MediaViewer.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  DOCS_I18N_KEYS,
  docsI18nBundleEn,
  registerDocsI18n,
} from "./i18n/keys.js";
export type { DocsI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated post-contract) ─
export {
  DOCS_ERRORS,
  DOCS_ERROR_CODES,
  docsErrorBundleEn,
  explainDocsError,
} from "./i18n/errorsMap.js";
export type {
  DocsErrorCode,
  DocsErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
