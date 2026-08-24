/**
 * What to show for one queue item, at every stage of its life.
 *
 * A tile in an upload grid has three possible sources of pixels and they take
 * turns: the local object URL of the pick (instantly, before any request), the
 * CDN's smallest ready variant (once the ladder exists), and nothing at all
 * (an item restored from a stored reference whose row has not been resolved
 * yet). Every upload control in this fleet has re-derived that sequence by
 * hand; this is it, once.
 */
import { useObjectUrlPreview } from "@stapel/core";
import type { CdnImage } from "../api/types.js";
import { imageRowOf } from "./useUploadQueue.js";
import type { UploadItem } from "./useUploadQueue.js";

export interface UploadPreview {
  /** The object URL of the local pick, or `null`. Revoked for you. */
  readonly localUrl: string | null;
  /** A ready CDN thumbnail, or `null` while the ladder is still being made. */
  readonly thumbnailUrl: string | null;
  /** Whatever there is to render right now, preferring the local pick. */
  readonly url: string | null;
}

/**
 * The smallest generated variant, read from `variants_meta` rather than from
 * a `variant_<n>_url` field.
 *
 * The flat fields are always POPULATED — they are computed paths, not
 * evidence — so reading one before the background task has run yields a URL
 * that 404s, which renders as a broken image and reads to the person as "my
 * upload was rejected". `variants_meta` lists only what exists.
 */
export function smallestVariantUrl(image: CdnImage | null): string | null {
  if (image === null) return null;
  let best: { tier: number; url: string } | null = null;
  for (const variant of image.variants_meta) {
    if (best === null || variant.tier < best.tier) {
      best = { tier: variant.tier, url: variant.url };
    }
  }
  return best?.url ?? null;
}

export function useUploadPreview(item: UploadItem): UploadPreview {
  const localUrl = useObjectUrlPreview(item.file);
  // Only an image has a ladder to take a thumbnail from. A video's picture is
  // its poster and an audio row's is its waveform — both live in `render_meta`
  // and are drawn by `<Image>`, not by this hook.
  const thumbnailUrl = smallestVariantUrl(imageRowOf(item));
  return { localUrl, thumbnailUrl, url: localUrl ?? thumbnailUrl };
}
