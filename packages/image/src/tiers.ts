// Pure tier/branch math for the stapel-cdn variant ladder
// (docs/pending/images-and-cdn.md §2-3, §5). No DOM, no React — unit-testable
// against the owner's examples verbatim and reusable outside the component.

/** One generated variant file of an image (images-and-cdn.md §5). */
export interface VariantMeta {
  /** Ladder tier (px along the branch axis) or the untouched original. */
  tier: number | "original";
  /**
   * `"w"` / `"h"` — preview-class branch (resize so that width/height == tier);
   * `null` — thumbnail-class (min-side resize) and `"original"`.
   */
  branch: "w" | "h" | null;
  url: string;
  /** Actual pixel width of the file (after the no-upscale cap on native). */
  width: number;
  /** Actual pixel height of the file (after the no-upscale cap on native). */
  height: number;
}

/**
 * Immutable render-metadata snapshot produced on ingest by stapel-cdn (or the
 * PIL provider) and resolved via `cdn.describe(ref)` — images-and-cdn.md §5,
 * an additive extension of the chat-design.md attachment snapshot.
 */
export interface RenderMetadata {
  mime: string;
  bytes: number;
  width: number;
  height: number;
  /** width / height. */
  aspect: number;
  /** Video/audio duration; `null`/absent for still images. */
  duration_ms?: number | null;
  /** `data:image/webp;base64,...` — the 16px micro tier, blur-up placeholder. */
  preview_b64?: string;
  /** `true` ⇒ w/h branches are identical; `variants[].branch` is irrelevant (§3.3). */
  square?: boolean;
  variants: VariantMeta[];
}

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
 * Which axis of the slot limits the pixel budget (§3.5, mode Б):
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
export function chooseVariant(args: ChooseVariantArgs, meta: RenderMetadata): VariantMeta {
  const { slotWidthCss, slotHeightCss, dpr, imgAspect, fit } = args;
  const slotAspect = slotWidthCss / slotHeightCss;
  const axis = limitingAxis(imgAspect, slotAspect, fit);
  const neededPx = (axis === "w" ? slotWidthCss : slotHeightCss) * dpr;

  const square = meta.square === true;
  const candidates = meta.variants.filter(
    (v): v is VariantMeta & { tier: number } =>
      typeof v.tier === "number" && (square || v.branch === null || v.branch === axis)
  );
  const original = meta.variants.find((v) => v.tier === "original");

  if (candidates.length === 0) {
    if (original !== undefined) {
      return original;
    }
    throw new TypeError("chooseVariant: metadata has no usable variants");
  }

  const tiers = [...new Set(candidates.map((v) => v.tier))];
  const maxTier = Math.max(...tiers);
  if (neededPx > maxTier * 1.1 && original !== undefined) {
    return original;
  }

  const tier = pickTier(neededPx, tiers);
  const exact = candidates.find((v) => v.tier === tier && v.branch === axis);
  if (exact !== undefined) {
    return exact;
  }
  const minSide = candidates.find((v) => v.tier === tier && v.branch === null);
  if (minSide !== undefined) {
    return minSide;
  }
  return candidates.find((v) => v.tier === tier) as VariantMeta;
}
