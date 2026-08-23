# @stapel/cdn-react

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
