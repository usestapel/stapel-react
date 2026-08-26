# @stapel/image

## 0.4.1

### Patch Changes

- f9d8b66: Cap the element-width demo at the viewport — every container on the path to a frame now carries a definite width, so a percentage cap actually binds and a 640px rung no longer opens a 390px page to 664px — label the box width and the variant served in place with a legend above them, and give the reserved preview box a per-medium glyph instead of a blank rectangle.

## 0.4.0

### Minor Changes

- 80617e9: `StapelImage` can carry what the CDN measured, and the placeholder stops being one thing.

  stapel-cdn 0.16 produces a render-metadata snapshot in the same pass that stores
  the bytes — `kind`, `preview_kind`, `duration_ms`, `poster_url`, `meta_status`,
  `meta_reason` — and this package could express none of it. Five packages import
  this type, so the gap was fleet-wide by construction: `cdn-react` hardcoded
  `preview_b64: null` at the fleet's one boundary into `<Image>` because there was
  nowhere for the rest of the snapshot to go, and chat attachments had no
  renderer.

  The six fields are added as OPTIONAL, so every existing producer — a host's
  `resolveImage`, a `"link"` to somebody else's URL — keeps typechecking without
  writing `null` six times to say "I do not know".

  What reading them changes:

  - **The placeholder is branched on what it IS.** `filter: blur(12px)` used to be
    applied to whatever `preview_b64` held. For a `poster` that smears the one
    frame somebody chose; for a `waveform` it produces noise. Now `"blur"` blurs,
    `"poster"` is drawn sharp, and `"waveform"` is drawn whole (`contain`) —
    cropping an amplitude strip to fill a box removes the amplitudes.
  - **The box is reserved before the preview exists.** `preview_kind` is known
    while `preview_b64` is still `null`, which is the entire reason the contract
    separates them: a voice note carries no width and no height ever, so without a
    shape it collapsed to nothing and shoved the page down when its strip arrived.
    `PREVIEW_KIND_ASPECT` (new export) fixes a shape for `poster` and `waveform`
    and deliberately guesses nothing for `blur` — a still photograph can be any
    shape, and a wrong box has to jump twice.
  - **A time-based medium never loads its own bytes.** `<img src="clip.mp4">` is a
    broken image, not a video. With `kind`, a video shows its `poster_url` and an
    audio row shows its waveform; neither reaches for `url`.
  - **`preview_b64` is a stated trust boundary.** It goes straight into a `src`
    and `meta` is host-built as often as server-sent, so anything that is not a
    `data:image/` URI is refused rather than rendered.
  - **`loading="lazy"` by default** on the loaded variant, overridable through
    `imgProps` — the package that decides WHICH bytes an element needs now has an
    opinion on whether it needs them yet.

  BREAKING (pre-1.0, so minor): `RenderMetadata` is **removed**. It was a
  hand-written second spelling of a wire shape — unused by `<Image>`, stale since
  0.16, and disagreeing with `VariantMeta` about whether a tier is a string. The
  wire shape belongs to the pair that generates its types from the backend's own
  schema; this package declares only the renderer's contract.

  Also: the package finally has a **story**. `demo/Image.demo.tsx` draws six
  variants — element-width, fluid resize, the three preview kinds, the reserved
  box, a dead URL and a no-ladder link — and every rung of the demo ladder is a
  picture of its own tier, so the number visible in the frame is the file that was
  fetched. The subtlest runtime behaviour in the fleet was, until now, the only
  thing a visual review had nothing to open.

- 95e8eec: A small image asks for a small file. The slot is measured, not remembered.

  `useImageSlot` reported a per-axis HIGH-WATER MARK: the size only ever grew.
  The intent was right — never re-fetch a smaller variant for an image already
  on screen — but it was enforced one layer too early, and it cost three things.

  It stopped being a measurement: a page that lays out wide and settles narrow (a
  card grid before its container query resolves, a flex row before it wraps, a
  phone that starts in landscape) was measured WIDE once and frozen there, so a
  96px thumbnail asked for the tier a hero needs. The two axes were maxed
  independently, so `size` could describe a box that never existed — the widest
  width the element ever had beside the tallest height — and `chooseVariant`
  derives the limiting AXIS from that pair. And "never downgrade" is a statement
  about the NETWORK, true only once a larger variant is actually loaded and
  painted; before that, re-picking smaller is exactly right.

  So the rule moved to where it belongs — `<Image>`'s load effect, which knows
  what is on screen — and the hook now answers the question it is named for: how
  big is this element, right now. It stays cheap by coalescing a resize burst
  into one trailing measurement (`settleMs`, default 120, exposed as
  `<Image slotSettleMs>`), so a window-edge drag is one tier decision rather than
  forty. A zero-sided box is ignored rather than pinning an axis at 0 — the guard
  used `&&`, so a `200 x 0` pre-layout box got through.

  The load-layer guard compares TIERS, not pixel areas: `width`/`height` are
  `null` on every variant of a ladder whose resolver cannot read them, and an
  area comparison of `0 <= 0` is the bug 0.3.1 had to work around. An equal tier
  on a DIFFERENT branch is now allowed through — that is the slot's limiting axis
  having changed, not a downgrade.

  New: `useDevicePixelRatio()`, re-read when it changes. DPR is not a constant —
  browser zoom moves it, and so does dragging a window from a 1x monitor to a
  Retina one; read once at mount, the image stays visibly soft after the move.

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
