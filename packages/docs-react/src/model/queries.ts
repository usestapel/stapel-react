import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  DocDocument,
  DocFolder,
  DocRevision,
  DocumentAccessGrant,
  DocumentListParams,
  DocumentShareLink,
  DownloadUrl,
  SharedDocument,
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

/** A single document head by id (`head_seq`, `editor_hint`, metadata…).
 *
 * `options.enabled` is what lets a surface that is MOUNTED but not yet shown
 * cost nothing — a closed dialog, a collapsed pane. Default true: a caller
 * that says nothing keeps the old behavior. */
export function useDocument(
  documentId: string,
  options?: { readonly enabled?: boolean }
): UseQueryResult<DocDocument, StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.document(documentId),
    queryFn: () => api.getDocument(documentId),
    enabled:
      sessionReady && documentId.length > 0 && (options?.enabled ?? true),
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
  documentId: string,
  options?: { readonly enabled?: boolean }
): UseQueryResult<DocRevision[], StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.revisions(documentId),
    queryFn: () => api.listRevisions(documentId),
    enabled:
      sessionReady && documentId.length > 0 && (options?.enabled ?? true),
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

// ── sharing (0.6) ────────────────────────────────────────────────────────────

/**
 * The whitelist half of a document's share sheet: who has been granted it.
 *
 * The endpoint is gated on `docs.share.whitelist`, so a caller who may read
 * the document but not administer its sharing gets a 403 here — and that
 * refusal is INFORMATION, not noise: it is how a sheet learns not to offer a
 * people section. Hence `retry: false`; retrying a settled "you may not"
 * three times only delays the answer.
 *
 * Rows of a switched-off mode arrive marked `suspended` rather than filtered
 * out — the kill switch is a display state, and an operator who cannot see an
 * inert grant believes it was revoked.
 */
export function useDocumentAccess(
  documentId: string,
  options?: { readonly enabled?: boolean }
): UseQueryResult<DocumentAccessGrant[], StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.access(documentId),
    queryFn: () => api.listAccess(documentId),
    retry: false,
    enabled:
      sessionReady && documentId.length > 0 && (options?.enabled ?? true),
  });
}

/**
 * The bearer-link half of the share sheet.
 *
 * The response CARRIES LIVE TOKENS (that is the point — a sheet that cannot
 * re-show what it minted makes people mint a second link), which is why the
 * endpoint is gated on `docs.share.link` and why a 403 here is the same kind
 * of information as above rather than a failure to retry.
 */
export function useDocumentLinks(
  documentId: string,
  options?: { readonly enabled?: boolean }
): UseQueryResult<DocumentShareLink[], StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.links(documentId),
    queryFn: () => api.listLinks(documentId),
    retry: false,
    enabled:
      sessionReady && documentId.length > 0 && (options?.enabled ?? true),
  });
}

/**
 * `GET /shared/:token` — the BEARER's view of a document: title, type and
 * shape, plus the `level` the link carries. No tree, no workspace, no owner,
 * no revisions (axis §6).
 *
 * Every refusal on this path answers 404 on purpose — an expired, revoked or
 * unknown token must not be distinguishable, or the endpoint becomes an
 * oracle for guessing tokens. So a failed read here means "this link does not
 * open anything", and a bearer surface says exactly that instead of inventing
 * a reason. The one exception the registry does carry is
 * `error.401.docs_share_auth_required`: a deployment that has not enabled
 * anonymous redemption asks the holder to sign in first.
 */
export function useSharedDocument(
  token: string
): UseQueryResult<SharedDocument, StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.shared(token),
    queryFn: () => api.getSharedDocument(token),
    retry: false,
    enabled: sessionReady && token.length > 0,
  });
}

/**
 * The bearer's read of the body, decoded as text — the same projection
 * {@link useDocumentContent} makes, on the token path. Binary documents
 * belong to the bearer download URL, not this hook.
 *
 * Deliberately opt-in via `enabled`: a bearer page renders the envelope
 * first (title, type, size) and only fetches bytes for a type it can show,
 * so a 40 MB video is not downloaded to draw a filename.
 */
export function useSharedDocumentContent(
  token: string,
  options?: { readonly enabled?: boolean }
): UseQueryResult<DocumentText, StapelApiError> {
  const api = useDocsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: docsQueryKeys.sharedContent(token),
    queryFn: async (): Promise<DocumentText> => {
      const content = await api.getSharedContent(token);
      return {
        text: await content.blob.text(),
        headSeq: content.headSeq,
        mimeType: content.mimeType,
        etag: content.etag,
      };
    },
    retry: false,
    enabled: sessionReady && token.length > 0 && (options?.enabled ?? true),
  });
}
