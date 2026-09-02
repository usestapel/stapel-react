---
"@stapel/drive-react": patch
---

Three defects a live drive e2e walk (2026-09-02) found in the row-actions
sheet, each with a red-first test:

- **Rename now refreshes the listing the row came from.** The rename PATCH
  is the docs pair's write and invalidates only the docs keys; a folder row
  is drawn from this pair's own per-rung read (`driveQueryKeys.children`),
  so the old name stayed on screen until a full reload. On success the
  drive namespace is dropped — the same mechanism create-folder and the
  upload queue already use — and the row shows its new name in place.

- **The actions sheet settles WITH the rename, not before it.** The old
  handler fired the mutation and closed everything in the same tick, so a
  refused rename vanished without a trace. Now the prompt stays up (busy)
  while the PATCH is in flight, everything closes only on success, and a
  refusal returns to the actions sheet with the refusal's own sentence
  (`drive-rename-error`) — retry and dismiss both stay reachable.

- **The share sheet stops re-rendering while its data settles.** Opening
  any row's sheet fired the docs pair's whole-tree `useFolders` (the move
  picker's read, despite the comment claiming it ran only while the move
  prompt is open), and a document row also kept `RevisionsModal` mounted,
  whose ungated `useDocument` re-read `GET /documents/:id` while closed.
  Both stray reads landed mid-settle and moved the sheet's tree again —
  enough churn on a slow stand to starve a browser driver's actionability
  check on the mint button. The folder list is now read only while the move
  prompt is open, the revisions modal mounts only when History is tapped,
  and a render-count probe test pins the sheet as motionless once its own
  two share listings have settled.
