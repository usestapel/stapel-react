// Pure tier/branch math for the stapel-cdn variant ladder
// (docs/pending/images-and-cdn.md §2-3, §5). No DOM, no React — unit-testable
// against the owner's examples verbatim and reusable outside the component.

/** One generated variant file of an image (images-and-cdn.md §5).
 *
 * `tier` is a STRING on the wire: a numeric px value as its decimal string
 * (`"320"`) or the literal `"original"`. The backend emits it stringified so a
 * dataclass-declared contract (`stapel_core.media.dto`) stays one scalar type;
 * the tier math here parses the numeric ones back (`numericTier`). */
export interface VariantMeta {
  /** Ladder tier px as a decimal string (`"320"`), or `"original"`. */
  tier: string;
  /**
   * `"w"` / `"h"` — preview-class branch (resize so that width/height == tier);
   * `null` — thumbnail-class (min-side resize) and `"original"`.
   */
  branch: "w" | "h" | null;
  url: string;
  /** Actual pixel width of the file (after the no-upscale cap on native). */
  width: number | null;
  /** Actual pixel height of the file (after the no-upscale cap on native). */
  height: number | null;
}

/** The numeric px value of a tier, or `null` for the `"original"` sentinel. */
export function numericTier(tier: string): number | null {
  if (tier === "original") return null;
  const n = Number(tier);
  return Number.isFinite(n) ? n : null;
}

/**
 * What the inline `preview_b64` placeholder IS — stapel-cdn's `preview_kind`.
 *
 * The reason this is a separate field from `preview_b64` and not a guess made
 * from the bytes: it is known **before the preview exists**. A row whose
 * processing pass has not run reports `preview_kind: "waveform"` with
 * `preview_b64: null`, and that is exactly enough for a client to reserve a box
 * of the right SHAPE instead of collapsing to nothing and jumping later.
 *
 * - `"blur"` — a micro thumbnail of a still image. Blur it up.
 * - `"poster"` — a frame lifted out of a video. It is a real, sharp picture of
 *   the content; blurring it throws away the one thing it is for.
 * - `"waveform"` — a rendered amplitude strip for audio. Not a photograph at
 *   all: cropping it to `cover` and blurring it produces noise.
 */
export type PreviewKind = "blur" | "poster" | "waveform";

/**
 * stapel-cdn's OPEN media-kind registry (`STAPEL_CDN["MEDIA_KINDS"]`): the
 * built-ins are `image`, `gif`, `video`, `audio`, `file`, and a host may
 * declare its own. Spelled as the union plus `string` so the known kinds
 * autocomplete while an unknown one from a host's registry still assigns —
 * narrowing this to a closed union would make a host's own configuration a type
 * error, which is the same mistake `CdnRef`'s asset type documents.
 */
export type MediaKind = "image" | "gif" | "video" | "audio" | "file" | (string & {});

/**
 * How complete the ingest snapshot is: `"ok"` — everything this kind promises
 * is present; `"partial"` — some of it is; `"missing"` — none of it. A
 * `meta_reason` names WHY whenever it is not `"ok"` (stapel-cdn's `REASONS`:
 * `not_generated`, `decoder_missing`, `preview_over_budget`, `source_missing`,
 * `encode_failed`, `ffprobe_missing`, `ffmpeg_missing`, `probe_failed`,
 * `render_failed`, `tool_timeout`).
 */
export type MetaStatus = "ok" | "partial" | "missing";

/**
 * A SOURCE-AGNOSTIC media descriptor (`stapel_core.media.StapelImage`) — the
 * single contract `<Image>` consumes for ANY image, CDN ladder or not.
 * `variants` is the ladder when present, or `[]` for a `"link"` (external URL)
 * / unprocessed file, in which case `<Image>` degrades to the single `url` +
 * `aspect` (layout) + `preview_b64` (the placeholder, when available).
 *
 * ── The six optional fields, and why they are optional ─────────────────────
 *
 * Everything from `kind` down is stapel-cdn's single-pass render metadata
 * (§83.2), reached over `POST /cdn/api/v1/describe/` or inlined as
 * `render_meta` on an upload response. A host that builds a `StapelImage` by
 * hand — a `"link"` to somebody else's URL, a local file — knows none of it,
 * and must not be forced to write `null` six times to say so. Absent means
 * "not known", which is a different statement from `null` ("known to be
 * nothing") only for `duration_ms`, where the contract makes the distinction
 * load-bearing: `null` is *unmeasured*, `0` is an empty voice note.
 */
export interface StapelImage {
  source: "cdn" | "file" | "link";
  /** Always present — the display URL when there is no ladder. */
  url: string;
  mime: string | null;
  width: number | null;
  height: number | null;
  aspect: number | null;
  square: boolean;
  /**
   * `data:image/...;base64,…` — the inline placeholder. `<Image>` refuses
   * anything that is not a `data:image/` URI: this value is host-built as often
   * as it is server-sent, and it goes straight into a `src`.
   */
  preview_b64: string | null;
  variants: VariantMeta[];

  /** What medium this is. Drives whether an `<img>` may load `url` at all. */
  kind?: MediaKind | null;
  /** What `preview_b64` is — known even while `preview_b64` is still null. */
  preview_kind?: PreviewKind | null;
  /** Duration of a time-based medium. `null` = unmeasured; `0` = empty. */
  duration_ms?: number | null;
  /** A full-size still for a video — what an `<img>` may actually load. */
  poster_url?: string | null;
  /** How complete this snapshot is. */
  meta_status?: MetaStatus;
  /** Why `meta_status` is not `"ok"`; `null` when it is. */
  meta_reason?: string | null;
}

/**
 * The aspect a slot is reserved at when the snapshot says WHAT the preview will
 * be but carries no geometry to shape it with — an audio row has no width and
 * no height at all, and a video whose probe has not run yet has neither either.
 *
 * `"blur"` is deliberately `null`: a still photograph can be any shape, so
 * guessing one would trade a collapse for a wrong box, and a wrong box has to
 * jump twice. The other two are shapes the medium itself fixes — a waveform
 * strip is drawn wide and short, a video frame is 16:9 far more often than it
 * is anything else — and both are replaced the moment real geometry arrives.
 */
export const PREVIEW_KIND_ASPECT: Readonly<Record<PreviewKind, number | null>> = {
  blur: null,
  poster: 16 / 9,
  waveform: 4,
};

export type Fit = "cover" | "contain";

export type Branch = "w" | "h";

/**
 * Smallest tier that does not upscale beyond the ×1.1 tolerance (§2.2):
 * the smallest `T` in `tiers` with `neededPx ≤ T × 1.1`; if none qualifies,
 * the largest tier (upscaling is forbidden at this level too — past the
 * ladder the consumer falls back to "original", see `chooseVariant`).
 *
 * `neededPx` must already include DPR (`cssSize × devicePixelRatio`).
 */
export function pickTier(neededPx: number, tiers: readonly number[]): number {
  if (tiers.length === 0) {
    throw new TypeError("pickTier: tiers must be non-empty");
  }
  const sorted = [...tiers].sort((a, b) => a - b);
  for (const tier of sorted) {
    if (neededPx <= tier * 1.1) {
      return tier;
    }
  }
  return sorted[sorted.length - 1] as number;
}

/**
 * Which axis of the slot limits the pixel budget (§3.5, mode B):
 * `cover` scales by `max(slotW/imgW, slotH/imgH)` — the limiting side is the
 * one where the image is "narrower" relative to the slot; `contain` is the
 * exact opposite. Tie-break on aspect equality is "w" (branches equivalent).
 */
export function limitingAxis(imgAspect: number, slotAspect: number, fit: Fit): Branch {
  if (imgAspect === slotAspect) {
    return "w";
  }
  const imageWiderThanSlot = imgAspect > slotAspect;
  if (fit === "cover") {
    return imageWiderThanSlot ? "h" : "w";
  }
  return imageWiderThanSlot ? "w" : "h";
}

export interface ChooseVariantArgs {
  slotWidthCss: number;
  slotHeightCss: number;
  dpr: number;
  /** width / height of the image — from metadata, known before any pixel loads. */
  imgAspect: number;
  fit: Fit;
}

/**
 * Full selection (§3.5): limiting axis from (image aspect × slot aspect × fit),
 * needed pixels along that axis (CSS × DPR), then the smallest non-upscaling
 * tier among the variants that can serve that axis:
 *
 * - branch === axis — the matching preview branch;
 * - branch === null (numeric tier) — thumbnail-class min-side variants, whose
 *   BOTH sides are ≥ tier, so they serve either axis;
 * - `meta.square` — any branch (w/h identical, §3.3).
 *
 * Past the top of the ladder (needed > maxTier × 1.1) the "original" variant
 * is returned when present — no tier would avoid an upscale (§2.2).
 */
export function chooseVariant(
  args: ChooseVariantArgs,
  meta: { variants: VariantMeta[]; square?: boolean }
): VariantMeta {
  const { slotWidthCss, slotHeightCss, dpr, imgAspect, fit } = args;
  const slotAspect = slotWidthCss / slotHeightCss;
  const axis = limitingAxis(imgAspect, slotAspect, fit);
  const neededPx = (axis === "w" ? slotWidthCss : slotHeightCss) * dpr;

  const square = meta.square === true;
  const candidates = meta.variants.filter(
    (v) =>
      numericTier(v.tier) !== null &&
      (square || v.branch === null || v.branch === axis)
  );
  const original = meta.variants.find((v) => v.tier === "original");

  if (candidates.length === 0) {
    if (original !== undefined) {
      return original;
    }
    throw new TypeError("chooseVariant: metadata has no usable variants");
  }

  const tiers = [...new Set(candidates.map((v) => numericTier(v.tier) as number))];
  const maxTier = Math.max(...tiers);
  if (neededPx > maxTier * 1.1 && original !== undefined) {
    return original;
  }

  const tier = pickTier(neededPx, tiers);
  const exact = candidates.find((v) => numericTier(v.tier) === tier && v.branch === axis);
  if (exact !== undefined) {
    return exact;
  }
  const minSide = candidates.find((v) => numericTier(v.tier) === tier && v.branch === null);
  if (minSide !== undefined) {
    return minSide;
  }
  return candidates.find((v) => numericTier(v.tier) === tier) as VariantMeta;
}
