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
import { MediaGalleryField, ImageUploadField } from "@stapel/cdn-react/default";
```

## One slot (avatar, cover)

```tsx
const { upload, previewUrl, phase, error } = useUploadImage({
  target: { kind: "avatar" },
});
```

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

**Reading somebody else's reference is not possible here, and that is upstream's
gap, not this pair's.** `file/exists/` filters on `uploaded_by=request.user`
unconditionally, so `useCdnRef` resolves the caller's OWN references — which is
what a reopened draft needs and what a buyer looking at a seller's gallery does
not. stapel-cdn exposes no public read-by-reference endpoint; a storefront
renders a listing's photos from what the listings API hands it. Recorded here
rather than worked around with a URL convention this pair would have invented.

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
