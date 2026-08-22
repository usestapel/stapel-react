/**
 * The `<type>/<hash>` reference — the unit this pair hands out — and the one
 * conversion between stapel-cdn's variant ladder and `@stapel/image`'s.
 *
 * `Profile.avatar` stores a reference. `Listing.images_draft` stores a list of
 * them ("Opaque list of CDN image references", `stapel_listings/models.py`).
 * Neither stores a URL, and this pair does not invent one: the reference is
 * content-addressed and opaque, and the URLs live on the row the CDN returns.
 */
import type { StapelImage, VariantMeta } from "@stapel/image";
import type { CdnImage, CdnRef, ParsedCdnRef } from "../api/types.js";

const HASH = /^[0-9a-f]{64}$/;

/** Build the reference for an asset type and a content hash. */
export function formatCdnRef(assetType: string, fileHash: string): CdnRef {
  return `${assetType}/${fileHash}`;
}

/**
 * Split a reference into its halves, or `null` when the string is not one.
 *
 * Strict about the hash (64 lowercase hex — what the backend writes) and
 * deliberately loose about the type, which is whatever this deployment put in
 * `STAPEL_CDN["ASSET_TYPES"]` plus the hardcoded `product` of the general
 * image endpoint. Rejecting an unfamiliar type here would refuse a host's own
 * configuration.
 */
export function parseCdnRef(ref: CdnRef): ParsedCdnRef | null {
  const slash = ref.indexOf("/");
  if (slash <= 0) return null;
  const assetType = ref.slice(0, slash);
  const fileHash = ref.slice(slash + 1);
  if (!HASH.test(fileHash)) return null;
  return { assetType, fileHash };
}

/**
 * Convert an uploaded image row into the source-agnostic descriptor
 * `@stapel/image`'s `<Image>` consumes.
 *
 * THE TWO CONTRACTS DISAGREE ON ONE FIELD AND THIS IS THE ONLY PLACE THAT
 * KNOWS. stapel-cdn's `variants_meta[].tier` is an integer; `@stapel/image`
 * reads the `stapel_core.media.dto` form, where `tier` is a decimal STRING
 * with an `"original"` sentinel. Converting at the boundary costs one map and
 * keeps both sides honest; teaching either one the other's shape would put a
 * conditional in every renderer.
 *
 * `branch` is optional upstream and absent for thumbnail-class tiers; the
 * renderer's contract wants an explicit `null` there, which is the same
 * statement said out loud.
 *
 * The type import above is TYPE-ONLY and `@stapel/image` is an OPTIONAL peer:
 * a host that renders its own images carries no dependency on it and this
 * function still typechecks, because nothing of it survives to runtime.
 */
export function toStapelImage(image: CdnImage): StapelImage {
  const variants: VariantMeta[] = image.variants_meta.map((variant) => ({
    tier: String(variant.tier),
    branch: variant.branch ?? null,
    url: variant.url,
    width: variant.width,
    height: variant.height,
  }));
  const width = image.original_width;
  const height = image.original_height;
  return {
    source: "cdn",
    url: image.original_url,
    // The CDN row carries the extension, not the MIME type, and the variants
    // are all WebP regardless of what came in. Saying `null` is the true
    // statement; guessing a MIME from the extension would be the wrong one.
    mime: null,
    width,
    height,
    aspect: height > 0 ? width / height : null,
    square: width === height,
    // stapel-cdn generates no inline blur placeholder. `<Image>` degrades to
    // the aspect box, which is the layout-shift protection that actually
    // matters here.
    preview_b64: null,
    variants,
  };
}

/**
 * The reference for an uploaded image row.
 *
 * Reads `prefix` — the serializer's own `<type>/<hash>` — rather than
 * rebuilding it from `type` and `file_hash`, so a host that reconfigures the
 * layout upstream does not get a reference this pair invented.
 */
export function refOf(image: { readonly prefix: string }): CdnRef {
  return image.prefix;
}
