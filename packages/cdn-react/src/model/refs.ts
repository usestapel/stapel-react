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
import type {
  CdnFileKind,
  CdnImage,
  CdnMediaRow,
  CdnRef,
  CdnRenderMeta,
  CdnRenderMetaVariant,
  ParsedCdnRef,
} from "../api/types.js";

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
 * KNOWS — `tier`, converted in {@link toVariantMeta} below. Converting at the
 * boundary costs one map and keeps both sides honest; teaching either one the
 * other's shape would put a conditional in every renderer.
 *
 * EVERYTHING ELSE IS READ, NOT RECOMPUTED. The row carries `render_meta`, the
 * snapshot stapel-cdn produced in the same pass that stored the bytes, and this
 * function used to ignore all of it: `aspect` was recalculated locally (a second
 * answer to a question the server had already answered) and `preview_b64` was
 * hardcoded to `null` under a comment claiming the backend generated no
 * placeholder — false since 0.16, and false at the ONE boundary the whole fleet
 * renders images through.
 *
 * The type import above is TYPE-ONLY and `@stapel/image` is an OPTIONAL peer:
 * a host that renders its own images carries no dependency on it and this
 * function still typechecks, because nothing of it survives to runtime.
 */
export function toStapelImage(image: CdnImage): StapelImage {
  const width = image.original_width;
  const height = image.original_height;
  const meta = image.render_meta;

  // THE SNAPSHOT IS THE ANSWER, AND IT IS ONE ANSWER. `render_meta` is computed
  // in the same pass that stored the bytes; recomputing `aspect` here from the
  // row's own width and height produced a SECOND answer to "how big is this
  // picture", rounded differently (the server rounds to 6dp), which is the seam
  // defect this fleet keeps finding in production. So the snapshot wins, and
  // the local arithmetic survives only as the fallback for a server that has
  // not shipped one yet — `render_meta` is `readonly` and required in the 0.17
  // schema, but a host may be running an older stapel-cdn.
  const aspect = meta?.aspect ?? (height > 0 ? width / height : null);

  return {
    source: "cdn",
    url: image.original_url,
    // The row carries the extension, not the MIME type; the snapshot carries
    // the MIME, guessed once, server-side, from the same extension. Reading it
    // beats guessing here and beats the `null` this used to say.
    mime: meta?.mime ?? null,
    width,
    height,
    aspect,
    square: meta?.square ?? width === height,
    // stapel-cdn 0.16 DOES generate an inline placeholder — the same micro tier
    // it was already encoding, reused rather than re-encoded. Hardcoding `null`
    // here threw it away for the whole fleet, because this function is the one
    // boundary into `<Image>`.
    preview_b64: meta?.preview_b64 ?? null,
    variants: variantsOf(image, meta),
    // The four §83.2 facts that have nowhere else to live. `preview_kind` is
    // what lets a box be reserved in the right SHAPE while `preview_b64` is
    // still null; `duration_ms` distinguishes an unmeasured clip (`null`) from
    // an empty one (`0`); `meta_status`/`meta_reason` are a named vocabulary a
    // UI can actually say something about.
    kind: meta?.kind ?? null,
    preview_kind: meta?.preview_kind ?? null,
    duration_ms: meta?.duration_ms ?? null,
    poster_url: null,
    ...(meta === undefined ? {} : { meta_status: meta.meta_status }),
    meta_reason: meta?.meta_reason ?? null,
  };
}

/**
 * The ladder for `<Image>`, preferring the snapshot's list.
 *
 * `render_meta.variants` is `variants_meta` PLUS the `original` entry the
 * snapshot builder appends, which is a rung `<Image>` needs: past the top of
 * the ladder there is no tier that would avoid an upscale, and `"original"` is
 * the honest answer. The row's own `variants_meta` has no such entry, so a
 * conversion that reads only it can never serve a hero.
 */
function variantsOf(
  image: CdnImage,
  meta: CdnRenderMeta | undefined
): VariantMeta[] {
  const source: readonly CdnRenderMetaVariant[] =
    meta?.variants !== undefined && meta.variants.length > 0
      ? meta.variants
      : image.variants_meta;
  return source.map(toVariantMeta);
}

/**
 * One rung, in `@stapel/image`'s spelling.
 *
 * THE TWO CONTRACTS DISAGREE ON `tier` AND THIS IS THE ONLY PLACE THAT KNOWS
 * (see the module header). Note that within a single snapshot BOTH spellings
 * arrive: the ladder rungs carry an int, the appended `original` entry carries
 * the string sentinel. `String()` is correct for both — `"original"` stringifies
 * to itself — which is why this needs no branch.
 */
function toVariantMeta(variant: CdnRenderMetaVariant): VariantMeta {
  return {
    tier: String(variant.tier),
    branch: variant.branch ?? null,
    url: variant.url,
    width: variant.width ?? null,
    height: variant.height ?? null,
  };
}

/**
 * A describe snapshot → the descriptor `<Image>` consumes, for a ref this
 * client did NOT upload.
 *
 * This is the other half of `toStapelImage`: same output, but the input is what
 * `POST /describe/` answers rather than an upload row. There is no
 * `original_url` in a snapshot, so the top-level `url` is taken from the
 * `original` rung when the ladder carries one and from the largest rung
 * otherwise — an audio or document ref has neither, and its `url` is empty,
 * which `<Image>` reads as "nothing to load" and answers with the placeholder
 * its `preview_kind` asks for.
 */
export function renderMetaToStapelImage(meta: CdnRenderMeta): StapelImage {
  const variants = (meta.variants ?? []).map(toVariantMeta);
  const original = variants.find((variant) => variant.tier === "original");
  const largest = variants.reduce<VariantMeta | undefined>((best, variant) => {
    if (variant.tier === "original") return best;
    const size = Number(variant.tier);
    if (!Number.isFinite(size)) return best;
    return best === undefined || size > Number(best.tier) ? variant : best;
  }, undefined);
  const display = original ?? largest;
  return {
    source: "cdn",
    url: display?.url ?? "",
    mime: meta.mime,
    width: meta.width ?? null,
    height: meta.height ?? null,
    aspect: meta.aspect ?? null,
    square: meta.square ?? false,
    preview_b64: meta.preview_b64 ?? null,
    variants,
    kind: meta.kind ?? null,
    preview_kind: meta.preview_kind ?? null,
    duration_ms: meta.duration_ms ?? null,
    poster_url: meta.poster_url ?? null,
    meta_status: meta.meta_status,
    meta_reason: meta.meta_reason ?? null,
  };
}

/**
 * The reference for a stored row, in the order of decreasing authority.
 *
 * 1. `render_meta.ref` — the snapshot's own answer, produced by the same
 *    `media_ref()` the rest of the backend resolves references with. Every one
 *    of the three models carries it since 0.16, so this is the honest source
 *    for all of them.
 * 2. `prefix` — the image and file serializers' `<type>/<hash>`. Same value,
 *    older servers.
 * 3. `<kind>/<hash>` — built here, and ONLY for the video row, which is the one
 *    serializer that publishes neither of the above. The prefix is not a guess:
 *    `media_ref()` writes `video/` for a `Video`, and the kind comes from the
 *    target the caller chose rather than from sniffing the row.
 *
 * A pair that jumped straight to (3) would be inventing references for the two
 * models that state their own, which is how a client and a server end up
 * disagreeing about what a stored object is called.
 */
export function refOf(row: CdnMediaRow, kind: CdnFileKind): CdnRef {
  const declared = row.render_meta?.ref;
  if (typeof declared === "string" && declared !== "") return declared;
  if ("prefix" in row && typeof row.prefix === "string" && row.prefix !== "") {
    return row.prefix;
  }
  return formatCdnRef(kind, row.file_hash);
}
