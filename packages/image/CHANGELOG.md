# @stapel/image

## 0.1.0

### Minor Changes

- 3a8846a: New package: image rendering over the stapel-cdn variant ladder (§61,
  docs/pending/images-and-cdn.md). Pure tier/branch math — `pickTier` (smallest
  tier with needed ≤ T×1.1), `limitingAxis` (cover/contain limiting side from
  image×slot aspect), `chooseVariant` (+DPR, original fallback past the
  ladder); `useImageSlot` (ResizeObserver, per-axis high-water mark, SSR-safe);
  `<Image>` with aspect-ratio from metadata, blur-up from `preview_b64`, and
  upgrade-only tier fetching with swap-after-decode. Types `RenderMetadata` /
  `VariantMeta` mirror the cdn.describe snapshot.
