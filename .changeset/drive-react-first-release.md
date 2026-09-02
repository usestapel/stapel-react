---
"@stapel/drive-react": minor
---

The phone-first Drive product over stapel-docs 0.5 — first release.

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
