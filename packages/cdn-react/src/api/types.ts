/**
 * The pair's public wire types — projected from the GENERATED schema
 * (`api/generated/schema.ts`, emitted by `pnpm gen:api` from stapel-cdn's own
 * `docs/schema.json`), never re-typed by hand.
 *
 * Two projections are widened on purpose, and both are recorded here rather
 * than fixed silently, because the widening is what keeps a real deployment's
 * answers assignable:
 *
 * 1. `Image.type` is generated as the enum `"avatar"`, because the schema's
 *    `TypeEnum` is built from `STAPEL_CDN["ASSET_TYPES"]` whose LIBRARY default
 *    is `("avatar",)`. The general image endpoint does not read that setting at
 *    all: `POST /upload/image/` writes `type="product"` unconditionally
 *    (`stapel_cdn/views.py`, `ImageUploadView.post`), so the value that comes
 *    back on the storefront's own upload path is not in the generated union.
 *    A host that adds `product`/`chat`/`review` to `ASSET_TYPES` widens it
 *    further. So the asset type is a deployment-configured STRING here, and a
 *    reference built from it is opaque — see {@link CdnRef}.
 * 2. `FileExistsResponse.type` is `string | null` on the wire; the three values
 *    the view can actually produce are `"image" | "video" | "file"`
 *    (`FileExistsView._exists_response`). {@link CdnFileKind} names them
 *    WITHOUT narrowing the parsed value: a fourth kind added upstream must not
 *    become a runtime cast that lies.
 */
import type { components } from "./generated/schema.js";

/** Every component schema stapel-cdn declares. */
export type Schemas = components["schemas"];

/**
 * One generated variant of an image, with its geometry.
 *
 * NOTE the tier is a NUMBER here. `@stapel/image`'s `VariantMeta.tier` is a
 * decimal STRING (`"720"`) plus the `"original"` sentinel, because that
 * component consumes `stapel_core.media.dto`'s render metadata, which
 * stringifies the ladder. stapel-cdn's own serializer emits an int. The two
 * contracts are not the same shape and neither is wrong — {@link toStapelImage}
 * in `model/refs.ts` is the one place that converts, so no screen has to know.
 */
export type CdnVariantMeta = Schemas["Image"]["variants_meta"][number];

/**
 * An uploaded image row, with the whole variant ladder and its geometry.
 * `type` is widened to `string` — see this module's header.
 */
export type CdnImage = Omit<Schemas["Image"], "type"> & {
  readonly type: string;
};

export type CdnVideo = Schemas["Video"];
export type CdnFileModel = Schemas["FileModel"];

export type CdnImageUploadResponse = Omit<
  Schemas["ImageUploadResponse"],
  "image"
> & { readonly image: CdnImage };
export type CdnVideoUploadResponse = Schemas["VideoUploadResponse"];
export type CdnFileUploadResponse = Schemas["FileUploadResponse"];

/** What `file/exists/` answers with when it found something. */
export type CdnFileKind = "image" | "video" | "file";

/** The `file/exists/` answer, with `file` narrowed alongside `type`. */
export type CdnFileExistsResponse = Omit<
  Schemas["FileExistsResponse"],
  "file"
> & { readonly file: CdnImage | CdnVideo | CdnFileModel | null };

/**
 * The opaque `<type>/<hash>` string a consuming module stores — `Profile.avatar`,
 * `Listing.images_draft` ("Opaque list of CDN image references",
 * `stapel_listings/models.py`). It is the value this pair hands OUT; it is not
 * a URL and must not be parsed into one by a caller.
 *
 * Content-addressed, so a new upload always yields a new reference and no
 * cache-busting query parameter is ever needed.
 */
export type CdnRef = string;

/** A reference split into its two halves (`model/refs.ts`). */
export interface ParsedCdnRef {
  /** The asset type — `avatar`, `product`, or whatever the host configured. */
  readonly assetType: string;
  /** The SHA-256 of the ORIGINAL bytes, 64 lowercase hex characters. */
  readonly fileHash: string;
}
