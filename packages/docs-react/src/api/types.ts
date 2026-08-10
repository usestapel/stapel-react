/**
 * Wire types for the stapel-docs HTTP contract.
 *
 * HAND-AUTHORED, TEMPORARILY: stapel-docs does not emit its committed contract
 * artifacts yet (`docs/schema.json` / `docs/flows.json` / `docs/errors.json`),
 * so there is no `pnpm gen:api` source to generate `./generated/schema.ts`
 * from. These types are typed 1:1 to the module's endpoint table (base path
 * `/docs/api/v1`). THE FOLLOW-UP IS MANDATORY: once the backend commits its
 * contract, enroll this pair in the root `gen:api`/`gen:manifest`/`gen:errors`
 * driver env-lists, generate the schema module, and re-derive these aliases
 * from `./generated/schema.js` exactly like recordings-react does — hand-typed
 * wire shapes are a transitional state, never the steady state.
 *
 * Shapes marked "provisional" are not pinned by the endpoint table and were
 * typed minimally; reconcile them against the generated schema on enrollment.
 */

/** A folder in a workspace's document tree. Provisional (list shape not pinned
 * by the endpoint table beyond ids + tree edges). */
export interface DocFolder {
  readonly id: string;
  readonly workspace_id: string;
  /** Parent folder, `null` at the workspace root. */
  readonly parent_id: string | null;
  readonly name: string;
  readonly created_at: string;
  readonly updated_at: string;
}

/** A document head as read from `GET /documents/:id` (field list pinned by the
 * endpoint table). */
export interface DocDocument {
  readonly id: string;
  readonly workspace_id: string;
  readonly folder_id: string | null;
  /** Document type slug (open registry — customer modules add types). */
  readonly type: string;
  readonly title: string;
  /** Content sequence at the head — the `If-Match` value for a snapshot save. */
  readonly head_seq: number;
  /** Sequence of the last stored snapshot. */
  readonly snapshot_seq: number;
  readonly size_bytes: number;
  readonly mime_type: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  /** Editor selection hint — the key into the editor registry
   * (`registerDocEditor`); builtins cover `"text" | "markdown" | "csv"`. */
  readonly editor_hint: string;
  /** Whether the document collaborates via CRDT updates (v1 builtins are all
   * snapshot documents — `false`). */
  readonly collab: boolean;
  readonly diffable: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

/** A named revision of a document. Provisional (list shape not pinned). */
export interface DocRevision {
  readonly id: string;
  /** User-given name; `null` for automatic revisions. */
  readonly name: string | null;
  /** Content sequence the revision snapshots. */
  readonly seq: number;
  readonly author_id: string | null;
  readonly created_at: string;
}

/** One CRDT update from `GET /documents/:id/updates?since=`. */
export interface DocUpdate {
  readonly seq: number;
  /** Opaque encoded update payload. */
  readonly payload: string;
  readonly author_id: string | null;
  readonly created_at: string;
}

/** `GET /documents/:id/updates` response. */
export interface DocUpdatesResponse {
  readonly updates: readonly DocUpdate[];
  readonly head_seq: number;
  /** Present and `true` when `since` is too old — re-read full content. */
  readonly resync?: boolean;
}

// ── request bodies / query params ────────────────────────────────────────────

export interface CreateFolderRequest {
  readonly workspace_id: string;
  readonly name: string;
  readonly parent_id?: string | null;
}

export interface PatchFolderRequest {
  readonly name?: string;
  readonly parent_id?: string | null;
}

/** Query for `GET /documents` (list routes need `?workspace_id=`). */
export interface DocumentListParams {
  readonly workspaceId: string;
  readonly folderId?: string;
  readonly type?: string;
  /** Full-text query. */
  readonly q?: string;
}

export interface CreateDocumentRequest {
  readonly workspace_id: string;
  readonly type: string;
  readonly title: string;
  readonly folder_id?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Initial content for snapshot document types. */
  readonly body?: string;
}

export interface PatchDocumentRequest {
  readonly title?: string;
  readonly folder_id?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CreateRevisionRequest {
  readonly name: string;
}

export interface EmptyTrashRequest {
  readonly workspace_id: string;
  /** Restrict to these ids; omit to empty the whole trash. */
  readonly ids?: readonly string[];
}

/** `GET /trash` body — everything soft-deleted in the workspace, folders and
 * documents in their own arrays (the 0.1.0 hand-typed `DocDocument[]` was a
 * drift against the backend's `TrashView`; fixed against the real response
 * shape 2026-08-10). */
export interface TrashListing {
  readonly folders: readonly DocFolder[];
  readonly documents: readonly DocDocument[];
}

export interface PostUpdateRequest {
  /** Opaque encoded CRDT update payload. */
  readonly payload: string;
}

// ── uploads ──────────────────────────────────────────────────────────────────

export interface CreateUploadRequest {
  readonly workspace_id: string;
  readonly title: string;
  readonly folder_id?: string | null;
  readonly mime_type?: string;
  readonly size_bytes?: number;
}

/** `POST /uploads` 2xx body: the created document + where to PUT the bytes.
 * On the local-storage backend profile `put_url` is NOT writable — callers
 * fall back to `PUT /documents/:id/content` (see `useUpload`). */
export interface CreateUploadResponse {
  readonly upload_id: string;
  readonly document_id: string;
  /** Storage key of the object (opaque). */
  readonly key: string;
  readonly put_url: string;
}

// ── content (raw-bytes surface) ──────────────────────────────────────────────

/** `GET /documents/:id/download` body — an opaque (possibly expiring) URL. */
export interface DownloadUrl {
  readonly url: string;
}

/** `PUT /documents/:id/content` 200 body. */
export interface SaveContentOk {
  readonly head_seq: number;
  readonly revision_id: string;
}

/**
 * A refused save, folded from the wire (camelCase JS-facing shape):
 * - 409 — someone else saved past our `If-Match` seq; fields from the body
 *   (`{head_seq, saved_by, saved_at}`).
 * - 412 — bare precondition failure with no body; every field is `null` and
 *   the caller re-reads the head before retrying.
 */
export interface SaveConflict {
  readonly headSeq: number | null;
  readonly savedBy: string | null;
  readonly savedAt: string | null;
}

/**
 * The typed outcome of a content save: a 409/412 is a STATE the editor
 * renders (conflict banner + override), not an exception — so the api layer
 * folds it into this discriminated union instead of throwing.
 */
export type SaveContentResult =
  | { readonly status: "saved"; readonly headSeq: number; readonly revisionId: string }
  | { readonly status: "conflict"; readonly conflict: SaveConflict };

/** `GET /documents/:id/content` — the raw bytes plus the head sequence the
 * response headers carry (`X-Docs-Head-Seq`, mirrored in `ETag`). */
export interface DocumentContent {
  readonly blob: Blob;
  /** `null` only if the backend omitted the header (pre-contract tolerance). */
  readonly headSeq: number | null;
  readonly etag: string | null;
  readonly mimeType: string | null;
}
