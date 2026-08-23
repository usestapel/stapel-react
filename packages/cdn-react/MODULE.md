# @stapel/cdn-react — module guide

Headless React pair for **stapel-cdn**. This is the human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## The one thing to understand first: dedup is a step, not a side effect

Three modules in this fleet upload media, under three DIFFERENT contracts: cdn
takes a multipart POST, docs opens a session and finalises it, recordings opens
a session with a size ceiling. They were never one algorithm wearing three hats,
and this package does not pretend otherwise — it implements **cdn's** contract.
The two genuinely contract-free bones the other two shared were extracted into
`@stapel/core` instead (`putToForeignOrigin`, `useObjectUrlPreview`), and only
the second of them appears here: there is no foreign origin in this contract to
PUT to.

What cdn's contract has, and the others do not, is a content-addressed store
with a public "do you already have these bytes?" question. So the flow is:

```
validate ─┬─ refuse (client-side mirror, cdn's own error codes)
          │
          └─ hash ── GET file/exists/?file_hash=… ─┬─ HIT  → done, no POST
                                                   │
                                                   └─ MISS → POST multipart
                                                              └─ poll for variants
```

`test/dedup.test.ts` asserts the HIT leg by **counting requests**, which is the
only assertion that cannot be satisfied by a flow that merely looks right.

### What a hit promises, and what a miss does not

A hit means: these bytes are stored, owned by this caller, as the asset type
this upload would produce. All three conditions are checked, because
`file/exists/` answers about any object with those bytes — the same file stored
earlier as a video, or as an avatar rather than a listing photo, is not the row
the POST would return, and short-circuiting on it would hand a composer a
reference to the wrong thing.

A miss promises nothing about the server. `file/exists/` filters on
`uploaded_by=request.user` **unconditionally**, while the upload views honour
`STAPEL_CDN["DEDUP_SCOPE"]` (default `"owner"`, optionally `"global"`). Under a
global scope the POST can still answer 200 "already exists". `deduped` therefore
reports what this client observed, never a claim about what the server did.

## Layers

| Layer | What lives there |
|---|---|
| `api/generated/schema.ts` | `pnpm gen:api` from stapel-cdn's `docs/schema.json`. Never hand-edited. |
| `api/types.ts` | The public projection, with two documented widenings (see below). |
| `api/cdnApi.ts` | One method per endpoint a browser may call. The one legal home of a path string. |
| `model/limits.ts` | The client-side mirror of `STAPEL_CDN`'s ceilings — configurable, because they are settings. |
| `model/hash.ts` | SHA-256 over the file, and the honest answer when the platform cannot compute one. |
| `model/upload.ts` | The flow. No React. |
| `model/refs.ts` | `<type>/<hash>` and the single conversion to `@stapel/image`'s ladder. |
| `model/queries.ts` | `useCdnRef` — the pair's one cached read. |
| `headless/` | `useUploadQueue` / `useUploadImage` and their render-prop components. |
| `default/` | The antd skin, behind its own subpath. |
| `i18n/` | Keys + the generated error bundles + authored ru/es. |
| `flows/registry.ts` | The zero-flow shim: stapel-cdn annotates no `@flow_step`. |

## Two widenings of the generated types, and why

1. **`Image.type` is a string here, not the generated `"avatar"` enum.** The
   schema builds `TypeEnum` from `STAPEL_CDN["ASSET_TYPES"]`, whose library
   default is `("avatar",)`. `POST /upload/image/` never reads that setting: it
   writes `type="product"` unconditionally. So on a default deployment the
   general intake returns a value the generated union does not contain — and
   `POST /images/product/upload/` (which DOES validate against `ASSET_TYPES`)
   answers 400 for the very type the other endpoint just stored. Both facts are
   upstream's; the pair reflects them rather than pretending the enum is closed.
2. **`FileExistsResponse.type`** is `string | null` on the wire. `CdnFileKind`
   names the three values the view can produce without narrowing the parsed
   value, so a fourth kind added upstream is not a runtime cast that lies.

## The progress question, answered once

There is no honest byte-percentage available. `fetch` cannot observe
request-body progress through the injected client, and `SubtleCrypto.digest`
takes the whole buffer and reports nothing until it is done. The two ways to
show a moving bar anyway are to fork the transport onto `XMLHttpRequest` — a
second transport with its own bearer/refresh/verification/error handling, i.e.
the duplication this package exists to end — or to animate a number nobody
measured. `UploadPhase` names the step instead, and the skins render an
indeterminate indicator for the two steps that take real time.

## The gates a composer reads

```ts
bag.canAdd    // available | blocked{ cdn.upload.blocked.full, {max} }
bag.settled   // available | blocked{ …blocked.pending } | blocked{ …blocked.failed }
```

Both are `ActionAvailability` rather than booleans because a Save button that is
off has to be able to say WHICH of the two reasons it is. `bag.refs` contains
only settled references, so it is never a promise about bytes that are not
there.

### …and the gallery has to be drawing the same bag

`<MediaGalleryField>` takes `bag` for exactly this reason. Its props are a
UNION — `{ bag }` or `{ max, target, initialRefs, onRefsChange }` — so a caller
cannot ask for both, and a composer's wiring is:

```tsx
const gallery = useUploadQueue({ max: 10 });
<ListingComposerPage images={gallery} gallerySlot={<MediaGalleryField bag={gallery} />} … />
```

Until 0.2.0 the field always built its own queue, and the two gates above were
then computed over a queue nobody was adding to: the composer's `settled` said
"wait for the photos" about photos it could not see, and `images_draft` went
out empty while ten tiles sat on screen. The prop was in this pair's README
before it was in the package — `test/galleryBag.test.tsx` now gates the README
against the props declaration so that cannot recur.

## Upstream notes (recorded, not worked around)

- **No public read-by-reference.** `file/exists/` is owner-scoped, so nothing in
  this contract resolves a stranger's `<type>/<hash>` to URLs. A storefront
  renders a listing's photos from the listings API's own payload.
- **`refs/sync/` is `IsServiceRequest`** and unreachable from a browser: the
  consuming module's server syncs references. Not on this pair's API surface.
- **`GET /images/{type}/random/` is `IsStaffUser`** — an admin convenience, not
  a storefront operation. Also not on the surface.
- **413 is undeclared for the image endpoints.** `upload/video/` lists it;
  `upload/image/`, `upload/avatar/` and `images/{type}/upload/` describe the
  ceiling in prose and return 413 without declaring it in `responses`. The pair
  handles it identically for all four.
- **The variant ladder has no readiness callback.** Polling `file/exists/` is the
  only way to learn that the background task finished, so the wait is bounded
  and its exhaustion is a stated outcome (`variantsReady: false`), not a hang.

## Testing

`test/` mocks the WIRE, never the module: every request goes through the real
`StapelClient`, the bodies are the ones stapel-cdn's serializers render, and the
SHA-256 is really computed — which is what makes the request-count assertions
meaningful. jsdom's gaps (`Blob.prototype.arrayBuffer`, `URL.createObjectURL`)
are filled minimally in `test/vitest.setup.ts` and nowhere else.
