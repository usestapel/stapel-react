import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { DocDocument } from "../api/types.js";
import { useDocument, useDownloadUrl } from "../model/queries.js";

/** How {@link MediaViewer} classifies a document for presentation. */
export type MediaKind = "image" | "video" | "download";

/** A loaded document plus how it should be presented — what a ready
 * {@link MediaViewerBag.state} carries. `kind` lives here rather than beside
 * the state because it only means anything for a document that loaded. */
export interface MediaPresentation {
  readonly document: DocDocument;
  /** `"image"` / `"video"` by MIME prefix, else `"download"` (download-only
   * presentation — also the fallback for `resolveDocEditor(...) === null`). */
  readonly kind: MediaKind;
}

/** Render-prop bag for {@link MediaViewer}. */
export interface MediaViewerBag {
  /** The document head as a state a skin cannot flatten (core's
   * `LoadState`; `stapel/no-flattened-load-state`). */
  readonly state: LoadState<MediaPresentation>;
  /**
   * The opaque download URL to feed `<img src>` / `<video src>` / a download
   * link — a state, not a nullable string: `null` used to mean "still
   * minting" and "the mint failed" at once, and the skins built on it greyed
   * the download button out with no reason a person could read.
   */
  readonly urlState: LoadState<string>;
  /** The URL may expire — mint a fresh one. */
  refreshUrl(): void;
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
 *   {({ state, urlState }) =>
 *     matchLoad(state, { loading, failed, ready: ({ kind }) => … })}
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
    state: mapLoad(
      loadStateFromQuery(documentQuery),
      (doc): MediaPresentation => ({
        document: doc,
        kind: kindOf(doc.mime_type),
      })
    ),
    urlState: mapLoad(loadStateFromQuery(urlQuery), (minted) => minted.url),
    refreshUrl: () => {
      void urlQuery.refetch();
    },
  });
}
