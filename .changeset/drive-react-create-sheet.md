---
"@stapel/drive-react": minor
---

FAB action sheet + create folder.

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
