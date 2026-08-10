import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  DocDocument,
  DocFolder,
  DocRevision,
  DocumentListParams,
  DownloadUrl,
  TrashListing,
} from "../api/types.js";
import { useDocsApi } from "./context.js";
import { docsQueryKeys } from "./queryKeys.js";
import { buildFolderTree } from "./folderTree.js";
import type { FolderTreeNode } from "./folderTree.js";

/**
 * Read hooks over the docs API (frontend-standard §2 — read hooks).
 * Staleness follows core's query defaults; override per call site via a page
 * that needs fresher data. Keys are namespaced (see `docsQueryKeys`). Every
 * hook is gated on {@link useActiveSessionReady} (owner-diagnosed live
 * incident, 2026-07-17): list hooks have no natural `enabled` condition of
 * their own — exactly the shape that raced a still-bootstrapping session.
 * Id-scoped hooks additionally stay inert until a non-empty id exists.
 */

/** The workspace's folders, flat, as the backend lists them. */
export function useFolders(
  workspaceId: string
): UseQueryResult<DocFolder[], StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.folders(workspaceId),
    queryFn: () => api.listFolders(workspaceId),
    enabled: sessionReady && workspaceId.length > 0,
  });
}

/**
 * The workspace's folder tree — the flat list read (same cache entry as
 * {@link useFolders}) assembled by `parent_id` via a `select` projection, so
 * tree and flat consumers share one wire read.
 */
export function useFolderTree(
  workspaceId: string
): UseQueryResult<FolderTreeNode[], StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.folders(workspaceId),
    queryFn: () => api.listFolders(workspaceId),
    select: buildFolderTree,
    enabled: sessionReady && workspaceId.length > 0,
  });
}

/** Documents in a workspace, optionally filtered by folder / type / query. */
export function useDocuments(
  params: DocumentListParams
): UseQueryResult<DocDocument[], StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.documents(params),
    queryFn: () => api.listDocuments(params),
    enabled: sessionReady && params.workspaceId.length > 0,
  });
}

/** A single document head by id (`head_seq`, `editor_hint`, metadata…). */
export function useDocument(
  documentId: string
): UseQueryResult<DocDocument, StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.document(documentId),
    queryFn: () => api.getDocument(documentId),
    enabled: sessionReady && documentId.length > 0,
  });
}

/** What {@link useDocumentContent} resolves: decoded text + save handshake. */
export interface DocumentText {
  readonly text: string;
  /** The head sequence to send back as `If-Match` on save (`null` only if the
   * backend omitted the `X-Docs-Head-Seq` header). */
  readonly headSeq: number | null;
  readonly mimeType: string | null;
  readonly etag: string | null;
}

/**
 * The document's content decoded as text — the read behind the builtin
 * (snapshot) editors. Binary documents belong to `MediaViewer` / the download
 * URL, not this hook.
 */
export function useDocumentContent(
  documentId: string
): UseQueryResult<DocumentText, StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.content(documentId),
    queryFn: async (): Promise<DocumentText> => {
      const content = await api.getContent(documentId);
      return {
        text: await content.blob.text(),
        headSeq: content.headSeq,
        mimeType: content.mimeType,
        etag: content.etag,
      };
    },
    enabled: sessionReady && documentId.length > 0,
  });
}

/** The document's named + automatic revisions. */
export function useRevisions(
  documentId: string
): UseQueryResult<DocRevision[], StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.revisions(documentId),
    queryFn: () => api.listRevisions(documentId),
    enabled: sessionReady && documentId.length > 0,
  });
}

/** What {@link useRevisionContent} resolves: the revision's snapshot decoded
 * as text (revision previews — binary revisions belong to the revision
 * download URL, not this hook). */
export interface RevisionText {
  readonly text: string;
}

/**
 * One revision's content decoded as text — the read behind a revision
 * PREVIEW surface (`GET /documents/:id/revisions/:rev/content`). Revisions
 * are immutable, so the cache entry never goes stale on its own; it is
 * dropped with the module root on content-affecting mutations.
 */
export function useRevisionContent(
  documentId: string,
  revisionId: string,
  options?: { readonly enabled?: boolean }
): UseQueryResult<RevisionText, StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.revisionContent(documentId, revisionId),
    queryFn: async (): Promise<RevisionText> => {
      const blob = await api.getRevisionContent(documentId, revisionId);
      return { text: await blob.text() };
    },
    enabled:
      sessionReady &&
      documentId.length > 0 &&
      revisionId.length > 0 &&
      (options?.enabled ?? true),
  });
}

/** Everything soft-deleted in the workspace — folders and documents in their
 * own arrays (`GET /trash`; the backend's `TrashView` shape). */
export function useTrash(
  workspaceId: string
): UseQueryResult<TrashListing, StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.trash(workspaceId),
    queryFn: () => api.listTrash(workspaceId),
    enabled: sessionReady && workspaceId.length > 0,
  });
}

/**
 * The document's opaque download URL (`GET /documents/:id/download`). The URL
 * may expire — `refetch()` to mint a fresh one (see `MediaViewer`).
 */
export function useDownloadUrl(
  documentId: string,
  options?: { readonly enabled?: boolean }
): UseQueryResult<DownloadUrl, StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.downloadUrl(documentId),
    queryFn: () => api.getDownloadUrl(documentId),
    enabled:
      sessionReady && documentId.length > 0 && (options?.enabled ?? true),
  });
}
