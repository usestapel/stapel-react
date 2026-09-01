/**
 * Namespaced TanStack Query keys (frontend-standard §2 — namespaced keys).
 * Everything under the `"docs"` root so a host can invalidate the whole module
 * or match a single resource. Explicit tuple return types satisfy
 * `--isolatedDeclarations`. One entry per read-operation.
 *
 * Content-affecting mutations (save, restore-revision, upload) invalidate the
 * per-document keys they shift plus the list read; structural mutations
 * (trash actions) invalidate the module root — a restore changes the list,
 * the tree, AND the trash at once.
 */
import type { DocumentListParams } from "../api/types.js";

const ROOT = "docs" as const;

export const docsQueryKeys: {
  readonly all: readonly ["docs"];
  folders(workspaceId: string): readonly ["docs", "folders", string];
  documents(
    params: DocumentListParams
  ): readonly ["docs", "documents", DocumentListParams];
  document(documentId: string): readonly ["docs", "document", string];
  content(documentId: string): readonly ["docs", "content", string];
  updates(documentId: string): readonly ["docs", "updates", string];
  revisions(documentId: string): readonly ["docs", "revisions", string];
  revisionContent(
    documentId: string,
    revisionId: string
  ): readonly ["docs", "revisionContent", string, string];
  downloadUrl(documentId: string): readonly ["docs", "downloadUrl", string];
  trash(workspaceId: string): readonly ["docs", "trash", string];
} = {
  all: [ROOT],
  folders: (workspaceId) => [ROOT, "folders", workspaceId],
  // The list key carries its params object so a folder view, a type filter,
  // and a search are cached distinctly (different read surfaces, not the
  // same list).
  documents: (params) => [ROOT, "documents", params],
  document: (documentId) => [ROOT, "document", documentId],
  content: (documentId) => [ROOT, "content", documentId],
  // The journal poll (`useDocUpdates`). The cursor is deliberately NOT in the
  // key: `?since=` moves on every tick, and a key that moved with it would
  // mint a new cache entry per poll instead of refreshing one.
  updates: (documentId) => [ROOT, "updates", documentId],
  revisions: (documentId) => [ROOT, "revisions", documentId],
  revisionContent: (documentId, revisionId) => [
    ROOT,
    "revisionContent",
    documentId,
    revisionId,
  ],
  downloadUrl: (documentId) => [ROOT, "downloadUrl", documentId],
  trash: (workspaceId) => [ROOT, "trash", workspaceId],
};
