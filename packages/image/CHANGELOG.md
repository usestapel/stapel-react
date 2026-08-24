# @stapel/image

## 0.3.1

### Patch Changes

- d778c54: An image no longer disappears when its caller re-renders while it loads.

  The load effect was keyed on the chosen variant OBJECT. `meta` is a value the
  host builds — `resolveImage: (ref) => ({ … })`, called in render, is the
  documented shape — so it had a new identity on every render, the effect
  restarted, and its cleanup cancelled the `decode()` already in flight. On any
  screen that re-renders while a photo loads (a listing page settling four
  queries) every attempt was cancelled by the next and nothing was ever
  committed: no image, no error box, an empty slot indefinitely. The load is now
  keyed on the variant URL, which is what the browser is actually fetching.

  Second fix in the same effect: the upgrade-only guard compared variant AREAS,
  and a resolver that honestly reports `width: null` on every variant made both
  sides `0`, so `0 <= 0` refused every upgrade for the component's whole life.
  Areas are now compared only when both are known.

## 0.3.0

### Minor Changes

- fca3942: A failed image load is not a successful one: `renderError` and an honest default

  `loader.onerror = commit`. One line, and it meant the component treated a load
  that never arrived exactly like a load that did: state flipped to "displayed",
  an `<img src>` went into the DOM pointed at a url the browser had already
  refused, and the page drew the native broken-image rendering — a torn-page
  glyph sized to the slot, the alt string in the browser's own font, inside a
  container the design system otherwise controls completely. There was no error
  arm at all, so a caller could not say anything else either.

  A failed variant now lands in an error state:

  - **the default** is a neutral placeholder — a sunken box using token roles
    (`--stapel-surface-sunken` / `--stapel-text-muted`, referenced as CSS
    variables so the package keeps its zero runtime dependencies), an inline
    broken-image glyph in `currentColor`, and the `alt` text the caller already
    wrote, announced as `role="img"` with `aria-label={alt}`;
  - **`renderError({ alt, meta, url })`** replaces it wholesale for a host with
    its own missing-media treatment.

  Two rules the tests pin, because both are ways this could have been wrong:

  1. **A failed UPGRADE is not an error.** If a tier is already on screen and a
     bigger one fails, the person keeps looking at the image — the error state is
     only for a slot that has nothing in it.
  2. **A later success clears it.** A re-measure that picks a variant which does
     load replaces the placeholder with the image.

  `decode()`'s rejection is now treated as the failure it reports (an
  `EncodingError`, or the load failure itself) rather than being swallowed into
  the success path; the no-`decode` branch uses `onload` / `onerror` the same way.

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
