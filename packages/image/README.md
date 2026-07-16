# @stapel/image

Image rendering over the stapel-cdn variant ladder: pure tier/branch math,
a slot-measurement hook, and a blur-up `<Image>` component.

Pairs with the stapel-cdn render-metadata snapshot (`cdn.describe(ref)` /
`stapel_core.media.describe(ref)`): an immutable `{mime, bytes, width, height,
aspect, preview_b64, square, variants[]}` object produced on ingest.

## The ladder

Default tiers `16, 32, 64, 120, 160, 240, 480, 560, 720, 1080`:

- **16 (micro)** — inlined as `preview_b64`, the blur-up placeholder;
- **32/64/120 (thumbnail)** — min-side resize, no w/h branches (`branch: null`),
  for fixed square-ish slots (avatars, grids);
- **160–1080 (preview)** — two branches per tier: `{T}w` (width == T) and
  `{T}h` (height == T), so the limiting axis of any slot is served without
  upscaling. Square images store one branch and set `square: true`.

## Pure math (`no DOM, no React`)

```ts
import { pickTier, limitingAxis, chooseVariant } from "@stapel/image";

pickTier(792, [560, 720, 1080]); // 720  — smallest T with needed ≤ T×1.1
pickTier(793, [560, 720, 1080]); // 1080
pickTier(616, [560, 720, 1080]); // 560

limitingAxis(0.75, 16 / 9, "cover"); // "w" — portrait in a wide slot

chooseVariant(
  { slotWidthCss: 640, slotHeightCss: 360, dpr: 2, imgAspect: meta.aspect, fit: "cover" },
  meta
); // → VariantMeta (falls back to "original" past the top of the ladder)
```

`neededPx` always includes DPR: a 400px CSS slot on a dpr=2 screen shops for
800 physical pixels.

## `useImageSlot()`

ResizeObserver measurement of the rendered slot. SSR-safe (`size` is
`undefined` until mounted). The reported size is a per-axis high-water mark —
it only grows, so resize jitter or a transient shrink never re-picks a
smaller, already-loaded tier.

## `<Image>`

```tsx
import { Image } from "@stapel/image";

<Image meta={attachment.render_meta} alt={attachment.name} fit="cover" />
```

1. `aspect-ratio` from metadata lands on the container before any measurement
   — zero layout shift, zero network.
2. The 16px `preview_b64` renders instantly underneath (blur-up).
3. The measured slot picks `(branch, tier)` via `chooseVariant`.
4. Upgrades only: a bigger pick loads off-DOM and swaps after `decode()`;
   an equal-or-smaller pick is ignored — never a blank frame, never a
   visual downgrade.

`fit` defaults to `"cover"`; `alt` is required.
