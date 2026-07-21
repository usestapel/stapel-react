# @stapel/image

## 0.2.0

### Minor Changes

- 991d00e: `<Image>` now consumes a source-agnostic `StapelImage` (`stapel_core.media`) and degrades gracefully.

  - New `StapelImage` type: a superset of `RenderMetadata` with a `source` tag (`cdn`/`file`/`link`) and an always-present top-level `url`. `<Image meta={...}>` renders the variant ladder when present, and **degrades to the single `url` + `aspect` + blur-up** when there is no ladder (a `"link"` / external OAuth avatar / unprocessed file) — so the same component renders ANY image whether or not a CDN is wired.
  - `VariantMeta.tier` is now a **string** on the wire (a decimal px string like `"320"`, or `"original"`), matching the backend's dataclass-declared contract; `numericTier()` is exported for parsing. Tier-picking math is unchanged.
  - `chooseVariant` accepts any `{ variants, square? }`, so both `RenderMetadata` and `StapelImage` feed it.

  Pairs with the `avatar_image` denormalization landing in stapel-profiles / stapel-core (`media.image(source, ref)`), which routes a cdn ref to the CDN provider regardless of the deployment's default media backend — the fix for the empty-ladder gap where a pil-default deployment described cdn-uploaded avatars with the wrong provider.

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
