import { useCallback } from "react";
import type { DocDocument } from "@stapel/docs-react";
import { THUMBNAIL_TIERS } from "../api/types.js";
import type { ThumbnailTier } from "../api/types.js";
import { useDriveApi } from "./context.js";

/**
 * Which documents CAN have a preview, decided the way the backend decides it:
 * a `type=file` document whose mime is an image. Asking for a thumbnail of
 * anything else is a 400 (`error.400.docs_thumbnail_unsupported`), so this
 * predicate is what keeps a list of PDFs from firing one refused request per
 * row on every scroll.
 *
 * It is a hint, not a guarantee — the renderer may still be absent (503) or
 * the cache entry unbuilt (404), which is why every thumbnail surface also
 * falls back on error. Both halves are needed: the predicate stops the
 * pointless requests, the fallback covers the ones that are not pointless and
 * fail anyway.
 */
export function hasImagePreview(document: DocDocument): boolean {
  return document.type === "file" && document.mime_type.startsWith("image/");
}

/** The tier a box of `px` logical pixels should ask for (nearest rung up). */
export function thumbnailTierFor(px: number): ThumbnailTier {
  // A fixed ladder, walked upward: a 200px box asks for 480 and downscales,
  // rather than asking for 160 and upscaling into mush. The last rung is the
  // ceiling — there is no third tier to grow into.
  const ladder = THUMBNAIL_TIERS;
  return ladder.find((tier) => tier >= px) ?? ladder[ladder.length - 1] ?? 480;
}

/**
 * The `<img src>` builder for document previews, bound to the runtime's base
 * URL.
 *
 * Authentication is the CONTENT endpoint's, unchanged: the browser attaches
 * the `stapel_jwt` cookie to the subresource request exactly as it does for
 * `GET /documents/:id/content`, and the same `authorize()` gate answers. A
 * host on a cross-origin API therefore needs the same `credentials:
 * "include"` it already needs for content, and nothing else — no second token
 * path, no signed preview URL, no public bucket (spec §3.6: private bytes
 * never transit a public pipeline).
 */
export function useThumbnailUrl(): (
  documentId: string,
  tier: ThumbnailTier
) => string {
  const api = useDriveApi();
  return useCallback(
    (documentId: string, tier: ThumbnailTier) => api.thumbnailUrl(documentId, tier),
    [api]
  );
}
