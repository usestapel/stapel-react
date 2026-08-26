---
"@stapel/cdn-react": minor
---

feat: the read side ships — `MediaAttachment`, video/document intake, and a skin that looks like an upload control

Wave D on top of the describe keystone. The pair could already ASK what a
reference was; nothing could draw the answer, and two shipped endpoints still
had no widget.

**`<MediaAttachment/>` — the surface chat and listings mount.** One reference,
drawn by its `render_meta.kind`: a photo picks its tier from its own element, a
video renders `poster_url` with the clip's length over it (an `<img>` cannot
load an mp4), an audio row renders the waveform that IS its render, and a
document renders its extension and size because no pixels for it exist. A
snapshot handed in (`meta={…}`) makes NO request — a thread resolves thirty refs
with one `useDescribe` and hands each bubble its answer. A reference that
resolves to nothing says "this attachment is no longer available" (data, with a
200 behind it); a reference we could not ASK about says something different and
carries a retry. `preview_kind` reserves the box in the right shape before
`preview_b64` exists, so the only movement left is the describe round trip
itself, which holds a reserved slot rather than collapsing.

**`<MediaUploadField kind="video" | "file">`.** `POST /upload/video/` and
`POST /upload/file/` have been typed and callable since this package was
written, documented in its own source as endpoints with "no hook and no widget
over it". They have both now. The ceilings, the `accept` string and the result
renderer are all data, so it is one component with two arms rather than the same
file twice with a different noun — and this is where `duration_ms`,
`poster_url` and the waveform half of §83.2 finally have a producer.

**The upload controls are upload controls.** Both fields now stand on a real
drop target: a bordered region that takes a drag, a `<label htmlFor>` that makes
the whole rectangle open the picker (and gives the hidden input the association
it never had), and a focusable button beside it, because a `<label>` is not
focusable and a `display: none` input is out of the tab order. The picked or
stored image is drawn inside the frame. The phase is announced
(`aria-live="polite"`) instead of only painted, and it no longer says "Waiting
its turn" under a control nothing was ever queued on.

**`variants_status` is read, and shown.** Every `variant_<n>_url` is a derived
path present in the 201 that creates the row, before any file exists behind it;
the contract says to read `variants_status` before rendering one. The flow read
`is_processed` — equivalent today by derivation, and the field whose meaning the
release notes moved. `variantsStatusOf` / `variantsReadyAtOf` are exported, the
outcome, the queue item and the image bag carry it, and the skins show the
server's own word for "the previews are still being made".

**Counting, and the substrate.** `cdn.gallery.count` is a plural family rendered
with `tPlural` — it read "1 of 1 photos" in three languages — and the full-gallery
refusal is worded without a counted noun, because `useActionGate` resolves a
block's code with `t`, which cannot select a form. The local
`src/default/ErrorAlert.tsx` is deleted in favour of the shared skin's, the
gallery's empty state is an `EmptyState`, the add control is a `GatedButton`, and
every surface is wrapped in `SkinTheme` (so a phone gets 44px controls — the tile
buttons lost `size="small"`, which had opted every one of them out of that rule
on the surface it is for). `CdnThumbnail`'s empty frame takes the border role
instead of inheriting text colour.

Breaking, pre-1.0 (minor): `UploadOutcome` gains `variantsStatus` /
`variantsReadyAt`, `UploadItem` and `UploadImageBag` gain `variantsStatus`, and
`ImageUploadField` / `MediaGalleryField` accept `mode`. The gallery's internal
test ids moved under the drop zone (`cdn-gallery-drop-*`).

New: `MediaAttachment`, `MediaUploadField`, `formatBytes`, `formatDurationMs`,
`variantsStatusOf`, `variantsReadyAtOf`, `CdnVariantsStatus`,
`ATTACHMENT_MAX_WIDTH_PX`, `RESERVED_ASPECT`. Peer floors raised to
`@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`.

Fixed alongside: the batching describe loader could hang every waiter in a batch
if the injected client threw synchronously — the call is now raised inside a
promise chain, so a failure that reaches nobody is impossible.

Tests 104 → 175, including dedicated suites for the describe loader/hook and for
the `render_meta` read. Five default-skin demos, every one with a phone variant
and a seeded step; `cdn.single`'s two byte-identical variants are one.
