# @stapel/drive-react

## 0.3.0

### Minor Changes

- 4438ef3: FAB action sheet + create folder.

  The drive FAB no longer opens the file picker directly — it opens the pair's
  bottom sheet (the same `SkinDialog` shape the row actions use) with two
  actions: **Upload files** (the existing behaviour, one tap deeper — it
  triggers the same hidden input) and **New folder** — the docs pair's
  `NameDialog` (exactly the rename prompt's shape) calling `useCreateFolder`
  with the CURRENT folder as the parent, then invalidating the drive listing's
  per-rung key so the new row appears. The empty state gains an Upload button
  that opens the SAME sheet — one affordance, one behaviour. The FAB's label
  becomes "New" (`drive.create.label`); new keys `drive.create.*` /
  `drive.newFolder.*` land in the key table with ru + es translations.

### Patch Changes

- 95cdfac: Regenerated against the stapel-docs v0.7.0 pin (one pin per module):
  `socket_path` lands on the generated document schema, the error registry
  grows to 85 codes (`error.400.docs_invalid_crdt_payload`), and the manifest
  range becomes `>=0.7 <0.8`. No behavior change — the drive product does not
  open live documents; its create surface is untouched (there is still no
  `/types` listing to drive it from, and the live types exist only where the
  backend's `[crdt]` extra is installed).

## 0.2.0

### Minor Changes

- 0db4a6e: The share sheet — the surface 0.1.0 deliberately left a clean seam for.

  0.1.0's note said share-sheet surfaces would land once stapel-docs implemented
  the sharing mechanism, and that the seams were left clean for them: a slot, an
  export, a nav entry that does not move. That is exactly what this is. The
  contract pin moves to stapel-docs 0.6.1 (35 → 44 operations, 77 → 84 error
  codes), the peer floor on `@stapel/docs-react` rises to `>=0.7.0`, and nothing
  in the nav or the screen's shape changed.

  `ShareSheetPanel` is the skin half of `@stapel/docs-react`'s headless
  `ShareSheet`, exactly as `UploadTrayPanel` is the skin half of `UploadTray`,
  reached from a row's Share action. Two sections, because stapel-docs has two
  INDEPENDENT grant sources and a deployment may enable either, both or neither:

  - **Links** — mint a bearer link at a level, copy the URL, see the date it
    stops working and whether anybody has opened it yet (stamped once: evidence
    somebody got in, not a counter), revoke it behind a confirmation, because a
    revoke is terminal and a revoked link never revives.
  - **People** — grant to a user id or to a resolver-backed group reference, at
    a level, removable. The wire NAMES the subject kind rather than inferring it
    from which field is filled: an ACL write that guesses its own meaning is one
    typo away from granting to somebody nobody named.

  Every read and every write is the docs pair's. Nothing of the axis is
  re-implemented here — the same rule that made 0.1.0's trash tab a thin wrapper
  over that pair's `TrashPane`.

  **Three properties this drawing is responsible for.**

  1. A switched-off mode's rows stay VISIBLE, tagged "Paused", under a banner
     saying they were not revoked. The kill switch is a display state, not a
     filter: an admin who cannot see an inert grant believes the access was
     taken away, and re-enabling the mode then restores access nobody expected.
  2. A section the caller may not administer is ABSENT, not a dead form. Both
     listings are themselves the capability gates (`docs.share.whitelist` names
     other people; `docs.share.link` carries live tokens), so a 403 is the
     honest "you may not do this" — and a form whose every submit is refused is
     worse than no form. The two gates are independent, so one section can be
     live while the other is gone.
  3. A refused mint says WHICH refusal it was. `SHARING.LINK.MAX_LEVEL` is
     published by no endpoint in 0.6.1 and the document envelope does not carry
     it, so the sheet cannot check the ceiling before it asks. It offers both
     levels and renders `error.400.docs_share_level`'s own sentence — the one
     that names the remedy — rather than a generic failure. A client-side cap
     invented from nothing would be a second answer to an authorization
     question.

  Share is offered on a DOCUMENT and not on a folder: stapel-docs 0.6 shares a
  document, and a folder has no `/access` or `/links` route at all, so the action
  is absent rather than present and dead.

  The sheet is a slot — `registerDriveSkinComponent("shareSheet", …)` — and
  `DriveRowActions` resolves it through the registry, so a host's replacement is
  used from the row action too; a slot honoured at one call site and hardcoded at
  another is a slot only half the product keeps. It is the entry most likely to
  be swapped after `thumbnail`: a host that resolves group references against
  its own directory wants a people picker where this one takes a raw id.

  There is deliberately no shared-link ROUTE here. The bearer page's URL shape
  and chrome are host composition, `@stapel/docs-react`'s `SharedDocumentView` is
  the seam it is built on, and the one thing this sheet needs from the host is
  `shareLinkUrl` — the function that turns a token into the URL people paste.
  Without it Copy copies the bare token, which is honest; assembling an origin
  and a path this package cannot know would not be.

  Four demos at the strict skin gate (links + people, links-only, suspended,
  mint refused) and 10 tests. The default skin spent the headroom 0.1.0
  earmarked for exactly this: 10.2 → 12.4 KB against a 14 KB budget that was NOT
  raised. en/ru/es copy for all of it.

## 0.1.0

### Minor Changes

- 7588bb1: The phone-first Drive product over stapel-docs 0.5 — first release.

  `@stapel/docs-react` is the pair for stapel-docs plus a desktop-ish file
  manager. This is the product on top of it: the surfaces stapel-docs 0.5.0
  added, the one machine a drive needs that a pair does not, and a single-column
  screen that composes them with the docs pair's existing rows, dialogs and
  trash. `@stapel/docs-react` is a **peer** and nothing of it is duplicated — no
  second client, no second folder model, no second trash. A second implementation
  of a shipped surface is the integration-seam defect this package's whole design
  exists to avoid.

  **The five operations it owns.** `POST`/`DELETE /documents|folders/<id>/star`,
  `GET /starred`, `GET /recents`, `GET /search?q=` and
  `GET /documents/<id>/thumbnail?tier=`, generated against the pinned v0.5.0
  contract — plus one rung read the docs client cannot express
  (`GET /folders?parent_id=`) and one transport it cannot provide.

  **One rung per request.** Opening a folder reads that folder's children and
  that folder's documents, and nothing else: one cache entry per folder id, the
  categories-cascade discipline, never a whole-tree sync. The breadcrumb is
  normally FREE — the navigation that descended already holds the trail, and a
  search hit arrives with its container's chain materialized server-side — so a
  five-deep drive costs five folder reads. Only a cold deep link falls back to
  the docs pair's ancestor walk, which is one extra request, explicit rather than
  hidden in a prefetch.

  **Progress is real.** The presigned PUT runs over `XMLHttpRequest`, because
  `fetch` cannot observe request-body progress in any shipping browser — a file
  manager built on `fetch` can draw a spinner and nothing else. Same ticket
  contract as `@stapel/docs-react`'s `uploadToPutUrl`, same finalize; only the
  transport differs, and a non-2xx resolves as `{ok, status}` rather than
  throwing, because the queue has to tell "the store refused this file" from "the
  network died". The queue runs two files at once and says "waiting" for the
  rest, which is the truth about concurrency 2 — a third row animating a bar at
  0% is a lie a person waits on. Each file carries its own error and its own
  retry, so one refused file does not fail nineteen good ones.

  **A full workspace is not a failed upload.**
  `error.507.docs_workspace_quota` gets its own banner with the two remedies that
  help, and the failed rows deliberately offer no Retry: retrying a full
  workspace is the same refusal one second later, and a button that cannot work
  is worse than no button.

  **Previews decline honestly.** `<img>` at the authorized thumbnail URL — same
  cookie, same `authorize()` gate and same storage seam as the content endpoint,
  so the browser's cache and the response `ETag` do the work a blob round trip
  would undo. Three different refusals (not an image, no Pillow, no cached entry)
  land on one answer, the mime glyph, because to a person looking at a list they
  mean one thing. What never happens is the browser's broken-image placeholder.

  **Skin.** `/default` ships `DriveScreen` — sticky breadcrumb bar, one scrolling
  column with a list/grid toggle, folder tap-through, a bottom action sheet per
  row, a FAB with the upload tray, and the Starred / Recent / Trash tabs — plus
  each part on its own, every one swappable through
  `registerDriveSkinComponent`. The trash tab is deliberately a thin wrapper over
  the docs pair's `TrashPane`, and rename/move reuse that pair's dialogs and its
  `PATCH` writes. Desktop is the same single column capped at a measure: the
  two-pane file manager already exists, and a second one would be two screens to
  fix every bug in.

  Share-sheet surfaces are NOT in this release — they land after stapel-docs
  0.6.0 implements the sharing mechanism; the seams are left clean for them
  (a slot, an export, a nav entry that does not move).

  en in the main entry with the generated floor for all 77 backend codes, `ru`
  and `es` as opt-in subpaths. First npm publish is owner-gated: no trusted
  publisher can exist for a package the registry has never seen (CONTRIBUTING,
  "Publishing a pair for the FIRST time").
