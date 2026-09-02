---
"@stapel/docs-react": minor
---

The viewing wave, against stapel-docs 0.8.0: media that plays, and history
you can look at.

- **Contract pin → v0.8.0** (`contract-pins.json`): the regen picks up the
  archive surface (`ArchiveListingDTO`/`ArchiveEntryDTO`, 44 → 49
  operations) and 10 new error codes (85 → 95, en/ru/es). Manifest range
  becomes `>=0.8 <0.9`.
- **`MediaViewer` grows the `audio` kind** (`audio/*` by MIME prefix), and
  `FileCard` plays it inline — a voice note used to be a download button.
- **The one 503 with an honest local answer**: a storage backend that
  cannot sign a URL (`error.503.docs_download_url_unavailable` — the
  DjangoStorage dev profile) no longer fails the viewer; the bag falls
  back to the authorized content stream, which speaks single-range 206
  itself since stapel-docs 0.8.0 (video revisions of the dev profile can
  seek). Every other error stays an error.
- **`DocsApi.documentContentUrl` / `revisionContentUrl`** — the authorized
  stream URLs as strings, for media subresources (the thumbnail-endpoint
  cookie discipline; a header-token host swaps the surface, a URL cannot
  carry a header).
- **`RevisionsModal` previews media revisions**: an old revision of an
  `image/*` / `audio/*` / `video/*` file renders through the revision
  content stream instead of degrading to "binary — download it". Text
  hints keep their text preview; genuinely opaque binaries keep the
  download link.
