// Pure tier/branch math (no DOM, no React).
export { pickTier, limitingAxis, chooseVariant, numericTier } from "./tiers.js";
export type {
  Branch,
  ChooseVariantArgs,
  Fit,
  RenderMetadata,
  StapelImage,
  VariantMeta,
} from "./tiers.js";

// Per-element slot measurement (ResizeObserver, debounced, SSR-safe) and the
// device pixel ratio, which is not a constant.
export { useImageSlot, useDevicePixelRatio } from "./useImageSlot.js";
export type { ImageSlot, ImageSlotOptions, ImageSlotSize } from "./useImageSlot.js";

// Blur-up component over the ladder.
export { Image } from "./Image.js";
export type { ImageErrorInfo, ImageProps } from "./Image.js";
