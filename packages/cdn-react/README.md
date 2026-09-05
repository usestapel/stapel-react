# @stapel/cdn-react

Headless React pair for **stapel-cdn** (frontend-standard §2). Business + state
only in the main entry, zero visual opinion — any design layers on top. Built on
`@stapel/core` (typed client + `StapelApiError` envelope, token refresh,
verification-403 interception, i18n engine, TanStack Query).

It uploads media the way stapel-cdn wants it uploaded, and its first move is not
to upload: it hashes the file and asks whether the CDN already has these bytes.
When it does, nothing is sent.

## Install

```
pnpm add @stapel/cdn-react @stapel/core @tanstack/react-query react
```

## Wire the app once

```tsx
import { CdnProvider, createCdnRuntime } from "@stapel/cdn-react";

const cdn = createCdnRuntime({ baseUrl: "/cdn/api/v1/" });

<StapelConfigProvider config={{ clients: { cdn: cdn.client } }}>
  <CdnProvider runtime={cdn}>{app}</CdnProvider>
</StapelConfigProvider>;
```

## A gallery (what a listing composer uses)

```tsx
import { MediaUploader } from "@stapel/cdn-react";

<MediaUploader max={10} onRefsChange={(refs) => form.set("images_draft", refs)}>
  {({ items, refs, canAdd, settled, add, remove, reorder }) => …}
</MediaUploader>;
```

`refs` is the list of `<type>/<hash>` strings to store, **in display order**.
`canAdd` and `settled` are `ActionAvailability`, so the Add button and the Save
button can each say why they are off — "this gallery holds at most 10 photos",
"wait for the uploads to finish", "retry the photos that failed".

The antd skin over the same bag is one import away:

```tsx
import {
  ImageUploadField,
  MediaGalleryField,
  MediaUploadField,
  MediaAttachment,
} from "@stapel/cdn-react/default";
```

### Whose queue is it

`<MediaGalleryField>` either owns its queue or draws yours, and the two are
spelled as different prop sets so that "both" cannot be written:

```tsx
// standalone: the field owns the queue
<MediaGalleryField max={10} onRefsChange={(refs) => form.set("images_draft", refs)} />

// beside a composer: the CALLER owns it, and both halves see one queue
const gallery = useUploadQueue({ max: 10 });
<ListingComposerPage images={gallery} gallerySlot={<MediaGalleryField bag={gallery} />} … />
```

The second form is not a convenience. A composer reads `bag.refs` as
`images_draft` and `bag.settled` as its publish gate; a field that built its
own queue left the container with two — the composer's, permanently empty, and
the one on screen — so the publish gate talked about photos it could not see
and the listing was submitted with no images at all.

## One slot (avatar, cover)

```tsx
const { upload, previewUrl, phase, error } = useUploadImage({
  target: { kind: "avatar" },
});
```

## Video and documents

The same flow over the other two intakes, with the ceilings and the `accept`
string for **that** intake rather than the image ones (100 MB and five container
extensions for a clip; 50 MB plus a MIME allowlist for a document):

```tsx
<MediaUploadField kind="video" onUploaded={(ref) => form.set("clip", ref)} />
<MediaUploadField kind="file" onUploaded={(ref) => form.set("attachment", ref)} />
```

## Rendering a reference somebody else uploaded

```tsx
// one bubble
<MediaAttachment mediaRef={ref} />

// a whole thread: ONE request for thirty refs, then draw from the answers
const described = useDescribe(message.attachments);
{message.attachments.map((ref) => (
  <MediaAttachment key={ref} mediaRef={ref} meta={described.get(ref) ?? null} />
))}
```

`MediaAttachment` branches on the snapshot's `kind`, so a video shows its poster
still and its length (an `<img>` cannot load an mp4), an audio row shows the
waveform that *is* its render, and a document shows its extension and size
because no pixels for it exist. A reference that resolves to nothing renders
"this attachment is no longer available" — data, with a 200 behind it, which is
a different sentence from "we could not ask" (that one carries a retry).

A describe snapshot carries no canonical URL, so a document is drawn without a
link unless you supply one (`href`). This pair does not build URLs out of
references; a reference is opaque.

## What the flow does, in order

```
validate ─┬─ refuse (client-side mirror of the deployment's own ceilings)
          └─ hash ── file/exists/ ─┬─ HIT  → done, ZERO bytes sent
                                   └─ MISS → multipart POST → wait for variants
```

## Three things worth knowing before you use it

**There is no progress percentage, on purpose.** `fetch` cannot observe how much
of a request body has gone out, and `crypto.subtle.digest` reports nothing
mid-digest. So the bag names the **phase** — hashing, checking, uploading,
preparing previews — and a skin shows an indeterminate indicator. Getting a real
number would mean re-implementing the upload on `XMLHttpRequest`, with its own
copy of the client's auth, refresh and error handling. A bar that is measured
beats a bar that moves.

**The pre-check can be skipped and that is never fatal.** `file/exists/` needs
`IsAuthenticated`, while the upload endpoints take `IsNotAnonymousUser` — so a
guest can upload but cannot pre-check. A page served over plain `http://` has no
`crypto.subtle` at all. Both fall through to the POST (the server deduplicates
on its own side regardless) and report `dedupSkipped` so a skin can explain it.

**Two reads, and they answer different questions.** `useCdnRef` goes through
`file/exists/`, which filters on `uploaded_by=request.user` unconditionally — so
it resolves the caller's OWN references, which is what a reopened draft needs.
`useDescribe` goes through `POST /describe/` (stapel-cdn 0.17.0), which resolves
ANY reference to the metadata needed to draw it: geometry, mime, the inline
micro-preview, the variant ladder, a video's poster, a clip's length. That is
the read a chat bubble needs and the reason an attachment renderer is possible
at all. Requests raised in one tick coalesce into as few POSTs as the 50-ref
ceiling allows, and the cache unit is the ref — thirty bubbles sharing
references cost one request.

`useUploadQueue`'s `initialRefs` runs the `useCdnRef` read itself, for every
restored item, sharing its cache: `MediaGalleryField`'s tile shows a skeleton
while a reopened draft's photo is being looked up, the picture once the row
comes back, and a broken-image glyph if the reference no longer resolves —
never an empty frame for a photo that is actually there.

## Layers

`api/` (generated schema + the typed operations) → `model/` (the flow, the
limits mirror, the reference, the one cached read) → `headless/` (the bags and
their render-prop components) → `i18n/`. `default/` is the antd skin behind its
own subpath. `MODULE.md` has the full map.

## Locales

English is inline. `./i18n/ru` and `./i18n/es` are opt-in subpaths. stapel-cdn
ships no `translations/` directory at all, so the 11 error keys it owns are
authored in this package until upstream localizes them; the 42 cross-cutting
keys come from stapel-core's catalogue through `gen:errors`.
