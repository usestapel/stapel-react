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

// Slot measurement (ResizeObserver, high-water-mark, SSR-safe).
export { useImageSlot } from "./useImageSlot.js";
export type { ImageSlot, ImageSlotSize } from "./useImageSlot.js";

// Blur-up component over the ladder.
export { Image } from "./Image.js";
export type { ImageProps } from "./Image.js";
