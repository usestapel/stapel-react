import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { DocDocument } from "../api/types.js";
import { useDocument, useDownloadUrl } from "../model/queries.js";

/** How {@link MediaViewer} classifies a document for presentation. */
export type MediaKind = "image" | "video" | "download";

/** Render-prop bag for {@link MediaViewer}. */
export interface MediaViewerBag {
  /** The document head, once loaded. */
  readonly document: DocDocument | null;
  /** `"image"` / `"video"` by MIME prefix, else `"download"` (download-only
   * presentation — also the fallback for `resolveDocEditor(...) === null`). */
  readonly kind: MediaKind;
  /** The opaque download URL to feed `<img src>` / `<video src>` / a
   * download link, else null while resolving. */
  readonly url: string | null;
  /** The URL may expire — mint a fresh one. */
  refreshUrl(): void;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
}

function kindOf(mimeType: string | null): MediaKind {
  if (mimeType !== null) {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
  }
  return "download";
}

/**
 * Headless media presentation — the download-only end of the editor
 * registry's resolution ladder (explicit > builtin > null → this). Resolves
 * the document's opaque download URL and classifies it by MIME prefix
 * (`image/*` / `video/*` / everything-else = plain download). Bring your own
 * `<img>`/`<video>`/link UI. Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <MediaViewer documentId={doc.id}>
 *   {({ kind, url }) => (kind === "image" && url ? <img src={url} alt={doc.title} /> : ...)}
 * </MediaViewer>
 * ```
 */
export function MediaViewer(props: {
  documentId: string;
  children: (bag: MediaViewerBag) => ReactNode;
}): ReactNode {
  const documentQuery = useDocument(props.documentId);
  const urlQuery = useDownloadUrl(props.documentId, {
    enabled: documentQuery.data !== undefined,
  });
  return props.children({
    document: documentQuery.data ?? null,
    kind: kindOf(documentQuery.data?.mime_type ?? null),
    url: urlQuery.data?.url ?? null,
    refreshUrl: () => {
      void urlQuery.refetch();
    },
    isLoading: documentQuery.isLoading || urlQuery.isLoading,
    isError: documentQuery.isError || urlQuery.isError,
    error: documentQuery.error ?? urlQuery.error ?? null,
  });
}
