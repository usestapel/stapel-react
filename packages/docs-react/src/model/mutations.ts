import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import { StapelApiError } from "@stapel/core";
import type {
  AppendResult,
  CreateDocumentRequest,
  CreateFolderRequest,
  CreateLinkRequest,
  DocDocument,
  DocFolder,
  DocRevision,
  DocumentAccessGrant,
  DocumentShareLink,
  EmptyTrashRequest,
  GrantAccessRequest,
  PatchDocumentRequest,
  PatchFolderRequest,
  PostUpdateRequest,
  SaveContentResult,
  TrashPurgeResult,
} from "../api/types.js";
import { useDocsApi } from "./context.js";
import { docsQueryKeys } from "./queryKeys.js";

/**
 * Write hooks (frontend-standard §2 — mutations invalidate on success). A
 * docs write shifts several cached reads at once (a save moves `head_seq` on
 * the document AND its content AND grows revisions; a restore changes the
 * list, the tree, and the trash), so each mutation invalidates the module
 * root (`docsQueryKeys.all`) rather than guessing which entries changed. A
 * host that wants optimistic updates layers them on the returned mutation.
 *
 * Options are built as typed `UseMutationOptions` objects (not call-site
 * generics) so `void`/error types stay in reference position.
 */

function useInvalidateModule(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: docsQueryKeys.all });
  };
}

/**
 * Structural writes (create / rename / move / trash) for folders and
 * documents — the operations a file-manager surface's context menus run.
 * Rename and move are both a PATCH on the object (the backend's endpoint
 * table has no separate move route: `parent_id` on a folder / `folder_id`
 * on a document IS the move). Each invalidates the module root: a move
 * shifts two folder scopes, the tree, and the breadcrumb trail at once.
 */

/** `POST /folders` — create a folder. */
export function useCreateFolder(): UseMutationResult<
  DocFolder,
  StapelApiError,
  CreateFolderRequest
> {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<
    DocFolder,
    StapelApiError,
    CreateFolderRequest
  > = {
    mutationFn: (body) => api.createFolder(body),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** Variables for {@link useUpdateFolder}. */
export interface UpdateFolderVariables {
  readonly folderId: string;
  /** `name` renames; `parent_id` moves (`null` = to the workspace root). */
  readonly patch: PatchFolderRequest;
}

/** `PATCH /folders/:id` — rename (`name`) and/or move (`parent_id`). */
export function useUpdateFolder(): UseMutationResult<
  DocFolder,
  StapelApiError,
  UpdateFolderVariables
> {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<
    DocFolder,
    StapelApiError,
    UpdateFolderVariables
  > = {
    mutationFn: (vars) => api.patchFolder(vars.folderId, vars.patch),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** `DELETE /folders/:id` — move the folder (and its live subtree, documents
 * included) to the trash. Restore lives on {@link useTrashActions}. */
export function useTrashFolder(): UseMutationResult<
  void,
  StapelApiError,
  string
> {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (folderId) => api.deleteFolder(folderId),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** `POST /documents` — create a document (snapshot types may carry `body`). */
export function useCreateDocument(): UseMutationResult<
  DocDocument,
  StapelApiError,
  CreateDocumentRequest
> {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<
    DocDocument,
    StapelApiError,
    CreateDocumentRequest
  > = {
    mutationFn: (body) => api.createDocument(body),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** Variables for {@link useUpdateDocument}. */
export interface UpdateDocumentVariables {
  readonly documentId: string;
  /** `title`/`metadata` edit; `folder_id` moves (`null` = to the root). */
  readonly patch: PatchDocumentRequest;
}

/** `PATCH /documents/:id` — rename (`title`), edit `metadata`, and/or move
 * (`folder_id`). */
export function useUpdateDocument(): UseMutationResult<
  DocDocument,
  StapelApiError,
  UpdateDocumentVariables
> {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<
    DocDocument,
    StapelApiError,
    UpdateDocumentVariables
  > = {
    mutationFn: (vars) => api.patchDocument(vars.documentId, vars.patch),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** `DELETE /documents/:id` — move the document to the trash. Restore lives
 * on {@link useTrashActions}. */
export function useTrashDocument(): UseMutationResult<
  void,
  StapelApiError,
  string
> {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (documentId) => api.deleteDocument(documentId),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** Variables for {@link useSaveContent}. */
export interface SaveContentVariables {
  /** The full snapshot body (builtin editors save decoded text). */
  readonly body: string | Blob;
  /** The head sequence this save is based on — sent as `If-Match`. */
  readonly ifMatchSeq: number;
  readonly contentType?: string;
}

/**
 * Snapshot save with optimistic concurrency: `PUT /documents/:id/content`
 * carrying `If-Match: ifMatchSeq`. A 409/412 does NOT reject — it resolves to
 * the `"conflict"` arm of {@link SaveContentResult} (typed state the editor
 * renders: `{headSeq, savedBy, savedAt}` + an override affordance — see
 * `DocEditor`). Real failures (403, 500, …) reject with `StapelApiError`.
 */
export function useSaveContent(
  documentId: string
): UseMutationResult<SaveContentResult, StapelApiError, SaveContentVariables> {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<
    SaveContentResult,
    StapelApiError,
    SaveContentVariables
  > = {
    mutationFn: (vars) =>
      api.putContent(documentId, vars.body, {
        ifMatchSeq: vars.ifMatchSeq,
        ...(vars.contentType !== undefined
          ? { contentType: vars.contentType }
          : {}),
      }),
    // Invalidate on conflict too: a conflict PROVES the cached content is
    // stale (someone saved past our seq), so the refetch is exactly right.
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/**
 * `POST /documents/:id/updates` — append a BATCH of opaque encoded updates to
 * a crdt document's journal (the write half of the discipline `useDocUpdates`
 * reads). The wire never took a single payload: the body is `{updates: […],
 * client_id}`, and the answer is the document's new head.
 *
 * Invalidation is DELIBERATELY narrow — the document head only, not the module
 * root every other mutation drops. An append happens as often as a person
 * types, and the two reads a snapshot save shifts are wrong here anyway: the
 * content read is not what a crdt document is edited through, and the journal
 * read must not be invalidated at all (it is a moving cursor, and refetching
 * it out of band would replay rows the local editor already has).
 */
export function useAppendUpdates(
  documentId: string
): UseMutationResult<AppendResult, StapelApiError, PostUpdateRequest> {
  const api = useDocsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    AppendResult,
    StapelApiError,
    PostUpdateRequest
  > = {
    mutationFn: (body) => api.postUpdate(documentId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: docsQueryKeys.document(documentId),
      });
    },
  };
  return useMutation(options);
}

/** Variables for {@link useRestoreRevision}. */
export interface RestoreRevisionVariables {
  readonly revisionId: string;
}

/**
 * Restore the document's content to a revision — lands as a NEW head (the
 * restored state is a fresh sequence, not a history rewrite).
 */
export function useRestoreRevision(
  documentId: string
): UseMutationResult<DocDocument, StapelApiError, RestoreRevisionVariables> {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<
    DocDocument,
    StapelApiError,
    RestoreRevisionVariables
  > = {
    mutationFn: (vars) => api.restoreRevision(documentId, vars.revisionId),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** Variables for {@link useCreateRevision}. */
export interface CreateRevisionVariables {
  readonly name: string;
}

/** Pin the document's current content as a named revision. */
export function useCreateRevision(
  documentId: string
): UseMutationResult<DocRevision, StapelApiError, CreateRevisionVariables> {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<
    DocRevision,
    StapelApiError,
    CreateRevisionVariables
  > = {
    mutationFn: (vars) => api.createRevision(documentId, { name: vars.name }),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** The bundled trash mutations {@link useTrashActions} returns. */
export interface TrashActions {
  /** `POST /documents/:id/restore` — take a document out of the trash. */
  readonly restoreDocument: UseMutationResult<DocDocument, StapelApiError, string>;
  /** `POST /folders/:id/restore` — take a folder out of the trash. */
  readonly restoreFolder: UseMutationResult<DocFolder, StapelApiError, string>;
  /** `POST /trash/empty` — permanently delete (all, or `ids`). */
  readonly emptyTrash: UseMutationResult<
    TrashPurgeResult,
    StapelApiError,
    EmptyTrashRequest
  >;
}

/**
 * The trash surface's writes, bundled (restore document / restore folder /
 * empty). Each invalidates the module root — a restore changes the list, the
 * tree, AND the trash at once.
 */
export function useTrashActions(): TrashActions {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();

  const restoreDocumentOptions: UseMutationOptions<
    DocDocument,
    StapelApiError,
    string
  > = {
    mutationFn: (documentId) => api.restoreDocument(documentId),
    onSuccess: invalidate,
  };
  const restoreFolderOptions: UseMutationOptions<
    DocFolder,
    StapelApiError,
    string
  > = {
    mutationFn: (folderId) => api.restoreFolder(folderId),
    onSuccess: invalidate,
  };
  const emptyTrashOptions: UseMutationOptions<
    TrashPurgeResult,
    StapelApiError,
    EmptyTrashRequest
  > = {
    mutationFn: (body) => api.emptyTrash(body),
    onSuccess: invalidate,
  };

  return {
    restoreDocument: useMutation(restoreDocumentOptions),
    restoreFolder: useMutation(restoreFolderOptions),
    emptyTrash: useMutation(emptyTrashOptions),
  };
}

/** Variables for {@link useUpload}. */
export interface UploadVariables {
  readonly file: Blob;
  readonly workspaceId: string;
  readonly title: string;
  readonly folderId?: string;
  /** Defaults to the file's own `type` when it has one. */
  readonly mimeType?: string;
  /**
   * Delivery path (both are exposed on purpose):
   * - `"put_url"` (default) — `POST /uploads` → raw `PUT` at the presigned
   *   `put_url` → `POST /uploads/:id/finalize`.
   * - `"content"` — for the local-storage backend profile, where `put_url`
   *   is NOT writable: `POST /uploads` → `PUT /documents/:id/content`
   *   (`If-Match` read from the fresh document; no finalize — the content
   *   pipeline stores the bytes itself).
   */
  readonly via?: "put_url" | "content";
}

/** What {@link useUpload} resolves. */
export interface UploadResult {
  readonly documentId: string;
  readonly uploadId: string;
  readonly via: "put_url" | "content";
}

/**
 * The full upload flow as one mutation (see {@link UploadVariables.via} for
 * the two delivery paths). Resolves to the created document's id; the
 * document list is invalidated on success.
 */
export function useUpload(): UseMutationResult<
  UploadResult,
  StapelApiError,
  UploadVariables
> {
  const api = useDocsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<UploadResult, StapelApiError, UploadVariables> =
    {
      mutationFn: async (vars) => {
        const via = vars.via ?? "put_url";
        const fileType =
          vars.mimeType ??
          (vars.file.type.length > 0 ? vars.file.type : undefined);
        const upload = await api.createUpload({
          workspace_id: vars.workspaceId,
          title: vars.title,
          size_bytes: vars.file.size,
          ...(vars.folderId !== undefined ? { folder_id: vars.folderId } : {}),
          ...(fileType !== undefined ? { mime_type: fileType } : {}),
        });

        if (via === "content") {
          const document = await api.getDocument(upload.document_id);
          const result = await api.putContent(upload.document_id, vars.file, {
            ifMatchSeq: document.head_seq,
            ...(fileType !== undefined ? { contentType: fileType } : {}),
          });
          if (result.status === "conflict") {
            // A conflict on a just-created document is not an editing race a
            // user can resolve — surface it as a failed upload.
            throw new StapelApiError({
              code: "stapel.http.409",
              message: "upload content save conflicted on a fresh document",
              status: 409,
            });
          }
          return {
            documentId: upload.document_id,
            uploadId: upload.upload_id,
            via,
          };
        }

        const putResponse = await api.uploadToPutUrl(upload.put_url, vars.file, {
          ...(fileType !== undefined ? { contentType: fileType } : {}),
        });
        if (!putResponse.ok) {
          // The object store's error body is not a Stapel envelope — fold the
          // status honestly instead of inventing an error code.
          throw new StapelApiError({
            code: `stapel.http.${String(putResponse.status)}`,
            message: "upload PUT to put_url failed",
            status: putResponse.status,
          });
        }
        await api.finalizeUpload(upload.upload_id);
        return {
          documentId: upload.document_id,
          uploadId: upload.upload_id,
          via,
        };
      },
      onSuccess: invalidate,
    };
  return useMutation(options);
}

/** Variables for {@link useExportUrl}. */
export interface ExportUrlVariables {
  readonly documentId: string;
}

/**
 * Mint a fresh download URL (`GET /documents/:id/download` — the URL is
 * opaque and may expire, so this is mutation-shaped: resolve on click, hand
 * to the browser). For rendered exports (`?format=pdf`) use
 * `api.exportDocument`, which resolves the binary itself.
 */
export function useExportUrl(): UseMutationResult<
  string,
  StapelApiError,
  ExportUrlVariables
> {
  const api = useDocsApi();
  const options: UseMutationOptions<string, StapelApiError, ExportUrlVariables> =
    {
      mutationFn: async (vars) => {
        const download = await api.getDownloadUrl(vars.documentId);
        return download.url;
      },
    };
  return useMutation(options);
}

// ── sharing (0.6) ────────────────────────────────────────────────────────────

/**
 * Invalidate ONE share listing — never the module root.
 *
 * Every other write in this file drops `docsQueryKeys.all`, because a save or
 * a move genuinely shifts the list, the tree and the content at once. A share
 * write shifts neither: granting access moves no document, and dropping the
 * root would refetch the whole file manager sitting behind the sheet on every
 * keystroke-sized gesture.
 */
function useInvalidateKey(key: readonly unknown[]): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: key });
  };
}

/**
 * `POST /documents/:id/access` — grant the document to one subject at one
 * level, or re-grant an existing subject at a new one (the backend upserts;
 * re-granting is the sheet's ordinary gesture, not a duplicate error).
 *
 * The refusals worth rendering by name rather than as "something went wrong":
 * `error.400.docs_share_mode_disabled` (whitelist sharing is switched off for
 * this deployment), `error.400.docs_share_subject` (a grant names exactly one
 * subject — a `user_id` OR a `ref`, never both and never neither) and
 * `error.400.docs_share_ref_kind` (no resolver is registered for that kind of
 * reference, so the row could only ever deny and is refused at mint).
 */
export function useGrantAccess(
  documentId: string
): UseMutationResult<DocumentAccessGrant, StapelApiError, GrantAccessRequest> {
  const api = useDocsApi();
  const invalidate = useInvalidateKey(docsQueryKeys.access(documentId));
  const options: UseMutationOptions<
    DocumentAccessGrant,
    StapelApiError,
    GrantAccessRequest
  > = {
    mutationFn: (body) => api.grantAccess(documentId, body),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** `DELETE /documents/:id/access/:accessId` — revoke one grant. */
export function useRevokeAccess(
  documentId: string
): UseMutationResult<void, StapelApiError, string> {
  const api = useDocsApi();
  const invalidate = useInvalidateKey(docsQueryKeys.access(documentId));
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (accessId) => api.revokeAccess(documentId, accessId),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/**
 * `POST /documents/:id/links` — mint a bearer link.
 *
 * The level is capped twice server-side: by the deployment's
 * `SHARING.LINK.MAX_LEVEL` and by the granter's own mandate. Above either,
 * the backend REFUSES with `error.400.docs_share_level` rather than silently
 * clamping — so a sheet that offered `edit` says which level was refused
 * instead of showing a `view` link the person believes is an editing one.
 *
 * The minted row carries the token, and the fresh listing does too; there is
 * no "shown once" secret to stash, and nothing here may be logged.
 */
export function useMintShareLink(
  documentId: string
): UseMutationResult<
  DocumentShareLink,
  StapelApiError,
  CreateLinkRequest | undefined
> {
  const api = useDocsApi();
  const invalidate = useInvalidateKey(docsQueryKeys.links(documentId));
  const options: UseMutationOptions<
    DocumentShareLink,
    StapelApiError,
    CreateLinkRequest | undefined
  > = {
    mutationFn: (body) => api.createLink(documentId, body),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** `DELETE /documents/:id/links/:linkId` — revoke one link. Terminal: a
 * revoked link never revives, which is why the skin confirms it. */
export function useRevokeShareLink(
  documentId: string
): UseMutationResult<void, StapelApiError, string> {
  const api = useDocsApi();
  const invalidate = useInvalidateKey(docsQueryKeys.links(documentId));
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (linkId) => api.revokeLink(documentId, linkId),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** Variables for {@link useSharedDownloadUrl}. */
export interface SharedDownloadUrlVariables {
  readonly token: string;
}

/**
 * Mint a fresh presigned URL for a BEARER (`GET /shared/:token/download`).
 * Mutation-shaped for the same reason {@link useExportUrl} is: the URL is
 * opaque and expires, so it is resolved on the click and handed straight to
 * the browser rather than parked in a `href` that goes stale in the DOM.
 */
export function useSharedDownloadUrl(): UseMutationResult<
  string,
  StapelApiError,
  SharedDownloadUrlVariables
> {
  const api = useDocsApi();
  const options: UseMutationOptions<
    string,
    StapelApiError,
    SharedDownloadUrlVariables
  > = {
    mutationFn: async (vars) => {
      const download = await api.getSharedDownloadUrl(vars.token);
      return download.url;
    },
  };
  return useMutation(options);
}
