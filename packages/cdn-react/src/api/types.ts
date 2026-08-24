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
 * 3. `RenderMeta.variants[]` generates as `Record<string, never>[]` — the
 *    backend's OpenAPI declares the entries as a bare `{"type": "object"}` with
 *    no properties, which drf-spectacular renders as "an object with no keys".
 *    What actually arrives is `variants_meta`'s own shape plus an `original`
 *    entry (`stapel_cdn/metadata.py`, `_snapshot` / `_original_variant_entry`),
 *    i.e. `{tier, branch, url, width, height}`. {@link CdnRenderMetaVariant}
 *    states that, and it is the one place the projection is widened — see
 *    {@link CdnRenderMeta}.
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
 * `type` is widened to `string`, and `render_meta` to an OPTIONAL
 * {@link CdnRenderMeta} — see this module's header (widenings 1 and 3) and
 * {@link WITH_RENDER_META}.
 */
export type CdnImage = Omit<Schemas["Image"], "type" | "render_meta"> &
  WithRenderMeta & { readonly type: string };

export type CdnVideo = Omit<Schemas["Video"], "render_meta"> & WithRenderMeta;
export type CdnFileModel = Omit<Schemas["FileModel"], "render_meta"> &
  WithRenderMeta;

/**
 * `render_meta`, widened and made OPTIONAL on every row that carries one.
 *
 * Optional is the second half of widening 3 and it is a statement about
 * deployments, not about the schema: stapel-cdn has emitted `render_meta` since
 * 0.16 and declares it required, but this pair's pin is a compatibility claim
 * about a range, and a host running 0.15 sends a row without it. Reading it as
 * possibly-absent costs one `??` at the one boundary that reads it
 * (`model/refs.ts`) and is the difference between degrading to computed
 * geometry and rendering `undefined`.
 */
interface WithRenderMeta {
  readonly render_meta?: CdnRenderMeta;
}

export type CdnImageUploadResponse = Omit<
  Schemas["ImageUploadResponse"],
  "image"
> & { readonly image: CdnImage };
export type CdnVideoUploadResponse = Omit<
  Schemas["VideoUploadResponse"],
  "video"
> & { readonly video: CdnVideo };
export type CdnFileUploadResponse = Omit<
  Schemas["FileUploadResponse"],
  "file"
> & { readonly file: CdnFileModel };

/** What `file/exists/` answers with when it found something. */
export type CdnFileKind = "image" | "video" | "file";

/** The `file/exists/` answer, with `file` narrowed alongside `type`. */
export type CdnFileExistsResponse = Omit<
  Schemas["FileExistsResponse"],
  "file"
> & { readonly file: CdnImage | CdnVideo | CdnFileModel | null };

/**
 * One entry of a describe snapshot's `variants[]`.
 *
 * TWO SPELLINGS OF `tier` ARRIVE IN THE SAME ARRAY and that is not a defect
 * upstream: the ladder entries come from `variants_meta` (an int), and the
 * `"original"` entry is appended by the snapshot builder with the string
 * sentinel (`stapel_cdn/metadata.py`, `_original_variant_entry`). Both are
 * declared here so the conversion in `model/refs.ts` handles them without a
 * cast — `@stapel/image` wants one decimal-string spelling with `"original"`
 * at the top, which is what that conversion produces.
 */
export interface CdnRenderMetaVariant {
  readonly tier: number | string;
  readonly branch?: "w" | "h" | null;
  readonly url: string;
  readonly width?: number | null;
  readonly height?: number | null;
}

/**
 * The immutable render-metadata snapshot: everything needed to draw a piece of
 * media with no second round trip and no layout jump. Inlined as `render_meta`
 * on every upload response, and resolvable for ANY ref over
 * `POST /describe/` — which is the whole reason a browser can render an
 * attachment somebody else uploaded.
 *
 * `variants` is widened to {@link CdnRenderMetaVariant} (see this module's
 * header, widening 3): the generated type for it is `Record<string, never>[]`,
 * which describes nothing.
 */
export type CdnRenderMeta = Omit<
  Schemas["DescribeManyResponse"]["items"][string],
  "variants"
> & { readonly variants?: readonly CdnRenderMetaVariant[] };

/** What one `POST /describe/` call answers: snapshots, plus refs that are gone. */
export type CdnDescribeResponse = Omit<
  Schemas["DescribeManyResponse"],
  "items"
> & { readonly items: Readonly<Record<string, CdnRenderMeta>> };

/**
 * `preview_kind` — what the inline placeholder IS. Re-exported from the
 * generated snapshot rather than re-typed, so a fourth kind upstream is a
 * compile error here and not a silent default.
 */
export type CdnPreviewKind = NonNullable<CdnRenderMeta["preview_kind"]>;

/** How complete a snapshot is: `ok` | `partial` | `missing`. */
export type CdnMetaStatus = CdnRenderMeta["meta_status"];

/**
 * The three rows an upload can produce. `file/exists/` returns the same union
 * under `file`, discriminated by its sibling `type` — never by sniffing which
 * fields a row happens to have.
 */
export type CdnMediaRow = CdnImage | CdnVideo | CdnFileModel;

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
