import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import { StapelApiError } from "@stapel/core";
import type {
  DocDocument,
  DocFolder,
  DocRevision,
  EmptyTrashRequest,
  SaveContentResult,
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
  readonly emptyTrash: UseMutationResult<void, StapelApiError, EmptyTrashRequest>;
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
    void,
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
