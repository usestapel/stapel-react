---
"@stapel/cdn-react": minor
---

The pair stops throwing away the metadata the backend went to the trouble of producing, and a browser can finally describe a reference it did not upload.

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
