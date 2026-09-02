---
"@stapel/drive-react": minor
---

Proper file viewing — the owner-mandated wave over stapel-docs 0.8.0. A
drive whose files only downloaded now opens them.

- **`MediaLightboxPanel`** (slot `mediaLightbox`): tapping a viewable file
  opens it IN PLACE — a photo full-size with tap-to-zoom and the folder's
  other photos one swipe (or arrow, or arrow key) away, stepping through
  the rows the listing already had rather than refetching; audio as an
  inline player; video as a player that can SEEK. Bytes ride the docs
  pair's `MediaViewer` bag: presigned download URL where the store signs
  one (MinIO/S3 honour `Range` on it), the authorized content stream where
  it cannot (the 503 fallback). Editable documents still route to the
  host's `onOpenDocument` — the viewers are additive.
- **`ArchiveSheetPanel`** (slot `archiveSheet`): a zip opens as a
  compressed folder. ONE listing request (the server reads the central
  directory by ranged reads and refuses past its ceilings rather than
  truncating), the folder illusion done locally by prefix, implied
  directories drawn even when the zip carries no directory rows.
  Encryption is a state: the lock banner, per-entry Locked tags, and a
  password that rides each extraction as the `X-Docs-Archive-Password`
  header — component state for the life of the sheet, stored nowhere,
  never in a URL. Viewable members preview inline from a blob object URL
  (the password is a header no `<img src>` can carry); everything else
  downloads via the browser's own save flow. Refusals render the
  backend's own named sentences (wrong password, ratio, entry count).
- **Version history from the row**: a document row's action sheet gains
  History, mounting the docs pair's `RevisionsModal` — which, since its
  own viewing slice, previews old revisions of media files inline.
- `useArchiveListing` + `viewerKindFor` + the archive client
  (`getArchiveListing` / `fetchArchiveEntry`) join the headless surface;
  contract pin regen at v0.8.0 (49 operations, 95 error codes).
- Size budgets raised deliberately: index 8 → 9 KB (the 95-key en floor +
  the archive client), default 14 → 16 KB (two whole product surfaces,
  12.4 → 15.4 KB measured).
