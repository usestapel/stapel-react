# @stapel/cdn-react

## 0.4.2

### Patch Changes

- 8fb45d7: Fix: a reopened draft's photos painted as empty frames. `useUploadQueue`
  seeded a restored item (`initialRefs`) with `row: null` and never resolved
  it, so `CdnThumbnail` had nothing to draw — count, order, removal and the
  publish gate were all correct, only the picture was missing.

  Restored items now resolve their row through the same owner-scoped
  `file/exists/` read `useCdnRef` wraps, sharing its cache (a hash already
  resolved elsewhere on the page, or by a sibling restored item, is never
  asked for twice) and batched per queue via `useQueries`. `CdnThumbnail`
  gained `resolving`/`broken` states: a skeleton while the lookup is in
  flight, a broken-image glyph once it settles on nothing, and the real
  thumbnail once the row arrives — the same paint a fresh upload gets.

## 0.4.1

### Patch Changes

- f952306: Visual pass VISUAL3: the attachment card fits the phone, the document arm stops
  saying "PDF" twice, and the legacy queue chip-dump demo is gone.

  **M-4, the 8-pixel overflow, was a box-sizing bug in the shared frame.** Every
  arm of `MediaAttachment` draws inside one `frameStyle` that sets `width: 100%`
  plus a `maxWidth`, and the document arm adds padding — measured content-box that
  made the card 32px wider than the column it sits in, so the phone shot of the
  document variant was a 398px document on a 390px viewport. The frame now
  declares `boxSizing: "border-box"`: an element that owns its own width owns its
  own padding.

  **M-4 again, 664px this time.** The `thumbnail-tier` demo drew three fixed boxes
  of 96 / 240 / 640 CSS pixels side by side, and the 640 one alone is wider than a
  phone. Each frame is now `min(Npx, 100%)` with the image at `100%` of it. That
  is not a compromise on the claim the demo exists to make — it is the claim:
  `<Image>` measures THIS element, so on a phone the large frame requests the tier
  that fits the width it actually got.

  **M-4 copy:** the document badge and its label both spelled the extension, so
  every PDF read `PDF  PDF document`. The badge keeps the extension; the label
  names the medium (`Document` / `Документ` / `Documento`).

  **N-4:** `cdn.gallery` — the headless `MediaUploader` drawn as three `state.step`
  chip dumps — is deleted. `cdn.gallery-field` is the same queue with the shipped
  skin on it and now carries the `MediaUploader` + `CdnProvider` coverage, so the
  completeness gate is unchanged at 3 headless / 5-of-5 skin. That also removes
  the one story in this package that rendered a raw i18n key (`cdn.gallery.count`)
  as user-facing text.

## 0.4.0

### Minor Changes

- 308e3d6: feat: the read side ships — `MediaAttachment`, video/document intake, and a skin that looks like an upload control

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

- 80617e9: The pair stops throwing away the metadata the backend went to the trouble of producing, and a browser can finally describe a reference it did not upload.

  **`toStapelImage` reads `render_meta`.** This function is the fleet's one boundary
  into `<Image>`, and it hardcoded `preview_b64: null` under a comment stating that
  stapel-cdn generates no inline placeholder — false since 0.16, which is why the
  blur-up path was dead code fleet-wide. It also recomputed `aspect` from the row's
  own width and height, producing a second answer to a question the server had
  already answered and rounded differently. Now the snapshot wins: `preview_b64`,
  `aspect`, `mime`, `square` are read, and `kind` / `preview_kind` / `duration_ms` /
  `meta_status` / `meta_reason` are carried through to `@stapel/image`'s widened
  `StapelImage`. Local arithmetic survives only as the fallback for a host still on
  an older stapel-cdn. The ladder is taken from `render_meta.variants`, which is the
  only list carrying the `original` rung — the one a hero needs.

  **Contract pin 0.12 → 0.17** with the schema, the manifest and the error bundles
  regenerated: 54 error keys now, including `error.400.too_many_refs`, authored in
  en/ru/es because stapel-cdn ships English only. The limits mirror was re-verified
  line by line against `conf.py` at 0.17 and is still byte-accurate.

  **`describe` is reachable** (stapel-cdn 0.17.0's new `POST /describe/`):

  - `CdnApi.describe(refs)` + `CDN_DESCRIBE_MAX_REFS`, and the `CdnRenderMeta` /
    `CdnDescribeResponse` types — with `variants[]` widened out of the generated
    `Record<string, never>[]`, which describes nothing.
  - `useDescribe(refs)` / `useDescribeRef(ref)` over a batching loader. Callers ask
    per ref; requests raised in the same tick coalesce into as few POSTs as the
    50-ref ceiling allows, and the CACHE UNIT IS THE REF — so thirty attachments
    sharing references cost one request, and a thirty-first does not re-fetch the
    thirty already in hand. Neither of the obvious shapes would do: one request per
    ref walks into the rate limit while a page draws itself, and one query keyed on
    "the list this component happens to hold" caches an overlapping copy per
    component.
  - **Missing is data.** A ref that was deleted, never stored or is malformed
    resolves to `null` with a 200 behind it, never a rejection — one dead
    attachment must not cost a page its other thirty-nine. A transport failure
    stays a failure, because "this attachment is gone" and "we could not ask" are
    different sentences.
  - Rate limiting is re-asked on the server's own `retry_after` (clamped);
    everything else is a settled answer a retry would only repeat.
  - `renderMetaToStapelImage(meta)` converts a snapshot for `<Image>`, which is
    what makes an attachment renderer expressible at all.

  **Video and document intake are one flow with images, at the model layer.**
  `CdnUploadTarget` gains `{kind:"video"}` and `{kind:"file"}`; `runUpload` returns
  `{row, kind}` for all three models. The dedup pre-check now matches on KIND as
  well as asset type (the same bytes stored earlier as a document are not the image
  this POST would return), the variant wait polls the right kind, a document is born
  settled because it has no derived work to wait for, and a queue validates against
  the ceilings for ITS intake instead of always the image ones. `refOf(row, kind)`
  reads `render_meta.ref` — the backend's own `media_ref()` — before falling back to
  `prefix`, and only builds `<kind>/<hash>` for the video row, the one serializer
  that publishes neither. Video references were unreachable before.

  BREAKING (pre-1.0, so minor): `UploadOutcome.image` → `{row, kind}`;
  `UploadItem.image` → `{row, kind}` with the new `imageRowOf(item)` narrowing
  helper. `UploadImageBag.image` is unchanged — that bag is the image slot and stays
  narrowed. `refOf` takes the row and its kind.

  Also: the `cdn.thumbnail-tier` `fluid` story rendered a blank white page — its
  `useT()` sat one level ABOVE the `<I18nProvider>` its own harness renders, so the
  hook threw. Moved into a child, where the working variant already had it. Both
  variants now declare their viewport and seeded step, and the tile geometry and the
  two reorder buttons carry their reasons in code rather than as bare numbers and
  bare booleans — the package is at zero doctrine-lint warnings.

- 95e8eec: An upload tile asks for the tier its own box needs, not for the smallest file
  on the ladder.

  Both upload skins rendered a raw `<img>` into a hardcoded 96x96 frame with
  `smallestVariantUrl(image)` as its source — the bottom rung, chosen with no
  reference to the frame at all. On a 2x or 3x phone that frame wants 192-288
  device pixels, so the smallest tier is guaranteed to be under-resolution, and
  every thumbnail in the fleet's upload grids was soft on exactly the screens
  that show it most.

  The new `<CdnThumbnail>` (exported from `/default`) routes the CDN case through
  `@stapel/image`'s `<Image>`, which measures the element's own rendered box,
  multiplies by the live device pixel ratio and picks the smallest tier that does
  not upscale. The local pick stays a plain `<img>`: an object URL has no ladder,
  and the whole point of it is that it paints before any request is made.
  `smallestVariantUrl` remains exported — it is still the right answer for a
  caller that genuinely wants the cheapest byte — it is just no longer what a
  rendered tile uses.

## 0.3.0

### Minor Changes

- 88a8be4: `<MediaGalleryField bag={…}>` — the prop the README documented and the package did not have

  The field always built its own `useUploadQueue`, so a composer beside it had
  two queues: its own, permanently empty, and the one on screen. `bag.settled` —
  the publish gate — then talked about photos it could not see, and
  `images_draft` went out empty while ten tiles sat there uploading. The
  documented wiring (`<MediaGalleryField bag={gallery} />`, in this pair's README
  and in `@stapel/listings-react`'s) simply did not compile.

  Props are now a union: `{ bag }` **or** `{ max, target, initialRefs,
onRefsChange }`. Passing both is a type error rather than a runtime decision
  about which queue wins.

  ```tsx
  const gallery = useUploadQueue({ max: 10 });
  <ListingComposerPage images={gallery} gallerySlot={<MediaGalleryField bag={gallery} />} … />
  ```

  `test/galleryBag.test.tsx` proves the two halves see ONE queue — a pick through
  the tiles reaches the caller's `refs` and moves the caller's `settled` — and
  gates the README against the props declaration, because the defect was
  documented for a whole release and nothing in the suite could tell.

## 0.2.0

### Minor Changes

- 234a091: New pair: `@stapel/cdn-react` — the React half of `stapel-cdn`, and the end of
  `profiles-react/src/api/cdnAvatarApi.ts`'s stated reason to exist.

  The storefront spec's verdict was that the three upload implementations in this
  fleet are three DIFFERENT contracts, not three copies of one algorithm, and this
  package holds to it: it implements cdn's contract (multipart POST to an
  authenticated origin), while the two genuinely contract-free bones the OTHER two
  share stayed in `@stapel/core` (`putToForeignOrigin`, `useObjectUrlPreview`).
  Only the second appears here — there is no foreign origin in this contract to
  PUT to, and inventing a use for the first would have been the fourth copy in a
  different disguise.

  What cdn's contract has that the others do not is a content-addressed store with
  a public "do you already have these bytes?" question, so the flow leads with it:

  ```
  validate ─┬─ refuse (client-side mirror of the deployment's own ceilings)
            └─ hash ── file/exists/ ─┬─ HIT  → done, ZERO bytes sent
                                     └─ MISS → multipart POST → wait for variants
  ```

  The hit leg is asserted by **counting requests**, which is the only assertion a
  flow that merely looks right cannot pass. And a hit is checked three ways, not
  one: `exists` alone answers about any object with those bytes, so the same file
  stored earlier as a video — or as an avatar rather than a listing photo — is not
  the row the POST would return, and short-circuiting on it would hand a composer
  a reference to the wrong thing.

  Surface:

  - `useUploadQueue` / `<MediaUploader max={N}>` — the bag a listing composer
    consumes. `refs` is the ordered `<type>/<hash>` list to store, `reorder` is the
    only way that order moves, and `canAdd` / `settled` are `ActionAvailability`
    so a switched-off Add and a switched-off Save each say which of the reasons
    they are. Per-item cancel (including of an item still waiting for a
    concurrency slot), retry, remove; a reopened draft starts from stored
    references and makes no requests.
  - `useUploadImage` / `<ImageUpload>` — the one-slot shape, built for
    `profiles-react`'s `useSetAvatar` to sit on.
  - `/default` — antd `<MediaGalleryField>` (grid, drag-reorder AND move buttons,
    because drag reaches neither a keyboard nor a phone) and `<ImageUploadField>`.
  - `toStapelImage` — the single place that knows stapel-cdn spells `tier` as an
    int while `@stapel/image` spells it as a string.
  - en inline, `./i18n/ru` and `./i18n/es` opt-in; the 11 error keys stapel-cdn
    owns are authored here because upstream ships no `translations/` at all.

  Two decisions recorded rather than papered over:

  **No progress percentage.** `fetch` cannot observe request-body progress through
  the injected client and `SubtleCrypto.digest` reports nothing mid-digest. A bar
  would have meant forking onto `XMLHttpRequest` — a second transport with its own
  auth, refresh and error handling — or animating a number nobody measured. The
  bag names the PHASE instead.

  **The pre-check is an optimisation and never fails the upload.** `file/exists/`
  is `IsAuthenticated` while the upload endpoints take `IsNotAnonymousUser`, so a
  guest reaches a 401 there and must still be able to post a photo; a page served
  over plain `http://` has no `crypto.subtle` at all. Both fall through to the
  POST and report `dedupSkipped` so a skin can explain it.
