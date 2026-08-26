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
| `model/queries.ts` | `useCdnRef` — the caller's OWN reference, through `file/exists/`. |
| `model/describe.ts` | The batching loader behind `useDescribe`: the batch is transport, the cache unit is the ref. |
| `model/format.ts` | A clock reading and a byte count — a number plus a UNIT NAME, never a string with an English abbreviation in it. |
| `headless/` | `useUploadQueue` / `useUploadImage` / `useDescribe` and their render-prop components. |
| `default/` | The antd skin, behind its own subpath: two upload fields, the video/document intake, and the attachment renderer. |
| `i18n/` | Keys + the generated error bundles + authored ru/es. |
| `flows/registry.ts` | The zero-flow shim: stapel-cdn annotates no `@flow_step`. |

## The read side: `describe`, and why an attachment renderer needs it

Until stapel-cdn 0.17.0 a browser holding a `<type>/<hash>` it had not itself
uploaded could not find out what it WAS. That is the structural reason this
fleet had no attachment renderer anywhere — not an oversight, an impossibility.
`POST /describe/` answers it in batches of up to 50, and returns unknown refs in
`missing` **inside a 200**.

Three decisions follow from the shape of that endpoint, and they are the whole
of `model/describe.ts`:

1. **The batch is a transport detail; the cache unit is the ref.** The consumer
   is a LIST — thirty bubbles, ten tiles — each of which knows one ref and
   nothing about its neighbours. One request per ref hits the rate limiter while
   a page is drawing itself; one query keyed on "the list this component happened
   to hold" re-fetches thirty refs to add a thirty-first. So callers ask per ref
   and a microtask-windowed loader coalesces.
2. **Missing is data.** A deleted, never-stored or malformed ref resolves to
   `null`, never a rejection. One dead attachment must not cost a page its other
   thirty-nine — that is what the endpoint was designed around, and a client that
   turned a 200 into a throw would give it away.
3. **The rate limiter is the one failure worth re-asking, and the server says
   when.** `retry_after` off the refusal's own params, clamped. Everything else
   (a 403 from a deployment that keeps describe service-side, a 400) is a settled
   answer that a retry would only repeat.

`<MediaAttachment>` is the skin over it, and it branches on `render_meta.kind`:
an `<img>` cannot load an mp4, so a video renders its `poster_url`, an audio row
renders the waveform that IS its render, and a document renders facts because no
pixels for it exist. A snapshot handed in (`meta={…}`) makes NO request, which is
what lets a thread resolve thirty refs once and hand each bubble its answer.

## `render_meta` is read, not recomputed

`toStapelImage` is the one boundary the whole fleet renders images through.
Until 0.3.1 it recomputed `aspect` from the row's own width and height — a second
answer to a question the server had already answered, rounded differently — and
hardcoded `preview_b64: null` under a comment claiming stapel-cdn generated no
inline placeholder. That comment had been false since 0.16, so the micro-preview
the backend produced in the same pass that stored the bytes was discarded at the
one line that could discard it for everything.

It now reads the snapshot and falls back to the local arithmetic only for a
server that has not shipped one (a host on 0.15). The four §83.2 facts —
`kind`, `preview_kind`, `duration_ms`, `meta_status`/`meta_reason` — travel
through to `@stapel/image`, which is what makes a box reservable in the right
SHAPE while `preview_b64` is still null.

`refOf` reads `render_meta.ref` — the backend's own `media_ref()` — before
falling back to `prefix`, and only builds `<kind>/<hash>` for the video row, the
one serializer that publishes neither. Video references were unreachable before.

## `variants_status`, not `is_processed`

Every `variant_<n>_url` on an image row is derived from `<type>/<hash>`, so all
of them are present and well-formed in the 201 that creates the row — before the
background task has written a single file. The contract says so in as many
words: "read `variants_status` before you render a variant URL". The pair polled
`is_processed` instead, which is equivalent TODAY by derivation and is also the
field whose meaning the release notes moved ("Video.is_processed now means
measured facts exist" — a statement about a probe, not about a ladder). The read
is now `variants_status` first, `is_processed` as the fallback, and `null` for
the two models that publish no ladder rather than a guessed `"ready"`.

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

- **A describe snapshot carries no canonical URL.** It answers geometry, mime,
  the ladder, a video's poster and a clip's length — but a DOCUMENT has an empty
  ladder and no `url` field, so nothing in the response points at the file. A
  document attachment is therefore drawn without a link unless the host supplies
  one; building one out of the reference is the one thing this pair refuses to
  do, because a reference is opaque.
- **`file/exists/` is still owner-scoped**, which is why it remains the read for
  the caller's OWN references (a reopened draft) and `describe` is the read for
  anybody else's.
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
