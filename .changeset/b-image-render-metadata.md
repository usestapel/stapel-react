---
"@stapel/image": minor
---

`StapelImage` can carry what the CDN measured, and the placeholder stops being one thing.

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
