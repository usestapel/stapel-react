import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import {
  exportDocument,
  getDocumentContent,
  getRevisionContent,
  putDocumentContent,
  uploadToPutUrl,
} from "./content.js";
import type { DocsRawTransport, PutContentOptions } from "./content.js";
import type {
  CreateDocumentRequest,
  CreateFolderRequest,
  CreateRevisionRequest,
  CreateUploadRequest,
  CreateUploadResponse,
  DocDocument,
  DocFolder,
  DocRevision,
  DocUpdatesResponse,
  DocumentContent,
  DocumentListParams,
  DownloadUrl,
  EmptyTrashRequest,
  PatchDocumentRequest,
  PatchFolderRequest,
  PostUpdateRequest,
  SaveContentResult,
  TrashListing,
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors the other
 * pairs): always send `X-Requested-With: XMLHttpRequest` on mutating
 * requests. Header-token clients ignore it; it is harmless there. stapel-docs
 * authenticates like every stapel module (the `stapel_jwt` cookie), so a
 * browser host on a cross-origin API builds its runtime with
 * `credentials: "include"`.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/** Optional raw-transport knobs `createDocsRuntime` forwards (see content.ts). */
export interface DocsApiOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly defaultHeaders?: Record<string, string>;
}

/**
 * The pair's typed operation surface — one method per stapel-docs endpoint a
 * JS client may call, bound to the injected {@link StapelClient} (the
 * per-module override seam of frontend-standard §7.2). Paths are relative to
 * the runtime's `baseUrl` (e.g. `/docs/api/v1/`). List routes require the
 * workspace scope; object routes authorize server-side by id.
 *
 * These operations are hand-authored here — the ONE legal home of path
 * strings (`stapel/no-string-paths` §2.3 carve-out) — typed to the module's
 * endpoint table because stapel-docs does not emit `docs/schema.json` yet.
 * Once it does: enroll the pair in the root `gen:*` drivers and reconcile
 * (see `api/types.ts` header). The raw-bytes surface (content / export /
 * revision content / presigned upload PUT) lives in `api/content.ts` and is
 * re-exposed here so hooks reach everything through `useDocsApi()`.
 */
export interface DocsApi {
  readonly client: StapelClient;

  // ── folders ────────────────────────────────────────────────────────────────
  listFolders(workspaceId: string): Promise<DocFolder[]>;
  createFolder(body: CreateFolderRequest): Promise<DocFolder>;
  getFolder(folderId: string): Promise<DocFolder>;
  patchFolder(folderId: string, body: PatchFolderRequest): Promise<DocFolder>;
  /** Move the folder to the trash. */
  deleteFolder(folderId: string): Promise<void>;
  restoreFolder(folderId: string): Promise<DocFolder>;

  // ── documents ──────────────────────────────────────────────────────────────
  listDocuments(params: DocumentListParams): Promise<DocDocument[]>;
  createDocument(body: CreateDocumentRequest): Promise<DocDocument>;
  getDocument(documentId: string): Promise<DocDocument>;
  patchDocument(
    documentId: string,
    body: PatchDocumentRequest
  ): Promise<DocDocument>;
  /** Move the document to the trash. */
  deleteDocument(documentId: string): Promise<void>;
  restoreDocument(documentId: string): Promise<DocDocument>;

  // ── content (raw bytes; see api/content.ts) ────────────────────────────────
  getContent(documentId: string, signal?: AbortSignal): Promise<DocumentContent>;
  putContent(
    documentId: string,
    body: BodyInit,
    options: PutContentOptions
  ): Promise<SaveContentResult>;
  /** `GET /documents/:id/download` — an opaque URL to hand to the browser. */
  getDownloadUrl(documentId: string): Promise<DownloadUrl>;
  exportDocument(
    documentId: string,
    format: string,
    signal?: AbortSignal
  ): Promise<Blob>;

  // ── updates (CRDT types only — v1 builtins are all snapshot) ──────────────
  getUpdates(documentId: string, since?: number): Promise<DocUpdatesResponse>;
  postUpdate(documentId: string, body: PostUpdateRequest): Promise<void>;

  // ── revisions ──────────────────────────────────────────────────────────────
  listRevisions(documentId: string): Promise<DocRevision[]>;
  createRevision(
    documentId: string,
    body: CreateRevisionRequest
  ): Promise<DocRevision>;
  getRevisionContent(
    documentId: string,
    revisionId: string,
    signal?: AbortSignal
  ): Promise<Blob>;
  getRevisionDownloadUrl(
    documentId: string,
    revisionId: string
  ): Promise<DownloadUrl>;
  /** Restore the document's content to this revision (lands as a new head). */
  restoreRevision(documentId: string, revisionId: string): Promise<DocDocument>;

  // ── trash ──────────────────────────────────────────────────────────────────
  listTrash(workspaceId: string): Promise<TrashListing>;
  emptyTrash(body: EmptyTrashRequest): Promise<void>;

  // ── uploads ────────────────────────────────────────────────────────────────
  createUpload(body: CreateUploadRequest): Promise<CreateUploadResponse>;
  finalizeUpload(uploadId: string): Promise<DocDocument>;
  /** Step 2 of the presigned path — raw PUT at `put_url` (object store). */
  uploadToPutUrl(
    putUrl: string,
    blob: Blob,
    options?: { readonly contentType?: string; readonly signal?: AbortSignal }
  ): Promise<Response>;
}

export function createDocsApi(
  client: StapelClient,
  options?: DocsApiOptions
): DocsApi {
  const transport: DocsRawTransport = {
    baseUrl: client.baseUrl,
    ...(options?.fetch !== undefined ? { fetch: options.fetch } : {}),
    ...(options?.credentials !== undefined
      ? { credentials: options.credentials }
      : {}),
    ...(options?.defaultHeaders !== undefined
      ? { headers: options.defaultHeaders }
      : {}),
  };

  const folderPath = (folderId: string): string =>
    `/folders/${encodeURIComponent(folderId)}`;
  const documentPath = (documentId: string): string =>
    `/documents/${encodeURIComponent(documentId)}`;

  return {
    client,

    // folders
    listFolders: (workspaceId) =>
      client.get("/folders", { query: { workspace_id: workspaceId } }),
    createFolder: (body) => client.post("/folders", body, mutating()),
    getFolder: (folderId) => client.get(folderPath(folderId)),
    patchFolder: (folderId, body) =>
      client.patch(folderPath(folderId), body, mutating()),
    deleteFolder: (folderId) => client.delete(folderPath(folderId), mutating()),
    restoreFolder: (folderId) =>
      client.post(`${folderPath(folderId)}/restore`, {}, mutating()),

    // documents
    listDocuments: (params) =>
      client.get("/documents", {
        query: {
          workspace_id: params.workspaceId,
          folder_id: params.folderId,
          type: params.type,
          q: params.q,
        },
      }),
    createDocument: (body) => client.post("/documents", body, mutating()),
    getDocument: (documentId) => client.get(documentPath(documentId)),
    patchDocument: (documentId, body) =>
      client.patch(documentPath(documentId), body, mutating()),
    deleteDocument: (documentId) =>
      client.delete(documentPath(documentId), mutating()),
    restoreDocument: (documentId) =>
      client.post(`${documentPath(documentId)}/restore`, {}, mutating()),

    // content
    getContent: (documentId, signal) =>
      getDocumentContent(transport, documentId, signal),
    putContent: (documentId, body, putOptions) =>
      putDocumentContent(transport, documentId, body, putOptions),
    getDownloadUrl: (documentId) =>
      client.get(`${documentPath(documentId)}/download`),
    exportDocument: (documentId, format, signal) =>
      exportDocument(transport, documentId, format, signal),

    // updates
    getUpdates: (documentId, since) =>
      client.get(`${documentPath(documentId)}/updates`, {
        query: { since },
      }),
    postUpdate: (documentId, body) =>
      client.post(`${documentPath(documentId)}/updates`, body, mutating()),

    // revisions
    listRevisions: (documentId) =>
      client.get(`${documentPath(documentId)}/revisions`),
    createRevision: (documentId, body) =>
      client.post(`${documentPath(documentId)}/revisions`, body, mutating()),
    getRevisionContent: (documentId, revisionId, signal) =>
      getRevisionContent(transport, documentId, revisionId, signal),
    getRevisionDownloadUrl: (documentId, revisionId) =>
      client.get(
        `${documentPath(documentId)}/revisions/${encodeURIComponent(revisionId)}/download`
      ),
    restoreRevision: (documentId, revisionId) =>
      client.post(
        `${documentPath(documentId)}/revisions/${encodeURIComponent(revisionId)}/restore`,
        {},
        mutating()
      ),

    // trash
    listTrash: (workspaceId) =>
      client.get("/trash", { query: { workspace_id: workspaceId } }),
    emptyTrash: (body) => client.post("/trash/empty", body, mutating()),

    // uploads
    createUpload: (body) => client.post("/uploads", body, mutating()),
    finalizeUpload: (uploadId) =>
      client.post(
        `/uploads/${encodeURIComponent(uploadId)}/finalize`,
        {},
        mutating()
      ),
    uploadToPutUrl: (putUrl, blob, uploadOptions) =>
      uploadToPutUrl(putUrl, blob, uploadOptions),
  };
}
