# @stapel/docs-react

## 0.2.0

### Minor Changes

- Default skins (owner directive): the opt-in `@stapel/docs-react/default`
  subpath ships the pair's antd skin — the main entry stays zero visual
  opinion, `antd` + `@stapel/tokens-antd` are optional peers that only the
  subpath touches.

  - **`FileManager`** — folder tree + document list + breadcrumbs + trash
    view as one composable surface, with right-click context menus wired 1:1
    to stapel-docs' endpoint table: rename and move are the object PATCH
    (`name`/`parent_id` on folders, `title`/`folder_id` on documents),
    move-to-trash is the DELETE, restore, download (documents), version
    history. No duplicate item — the backend has no duplicate endpoint.
  - **`RevisionsModal`** — revision list, inline text preview
    (`useRevisionContent`), pin-as-named, and rollback via
    `POST …/revisions/:id/restore` (lands as a new head; history keeps
    everything). Binary documents get the revision download link instead.
  - **`DocSurface` + default editors** — chrome-styled text, markdown-SOURCE
    (no Tiptap: the package carries no such peer, and a default adds no new
    rendering dependency), and CSV-table editors, all on the existing
    If-Match snapshot save path with the conflict banner + informed
    override; `FileCard` (image/video preview, download) for
    `editor_hint: ""` and unknown hints.
  - **Self-theming** — every surface wraps its own `DocsSkinTheme`
    (`@stapel/tokens` → `toAntdThemeConfig`, mode from the host document's
    `data-theme`; `mode` prop pins a side), proven by computed-color tests
    (text ≠ background in both modes).
  - **Replaceable without forking** — the skin slot registry
    (`registerDocsSkinComponent` / `resolveDocsSkinComponent`, same seam
    shape as the editor registry) covers every part; `DocSurface` resolves
    explicit `registerDocEditor` registrations above the skin's editors.

  Model-layer additions the skin rides on (all public): `useRevisionContent`,
  `useCreateFolder`, `useUpdateFolder`, `useTrashFolder`,
  `useCreateDocument`, `useUpdateDocument`, `useTrashDocument`,
  `explicitDocEditor`.

  **LoadState sweep (breaking within 0.x):** the read side of the headless
  bags (`DocumentList`, `FolderTree`, `Breadcrumbs`, `RevisionHistory`,
  `TrashBin`) now hands out `state: LoadState<…>` (core's
  `loadStateFromQuery`; render with `matchList`/`matchLoad`) instead of
  flattened `rows + isLoading/isError` fields — the fleet's
  `stapel/no-flattened-load-state` discipline ("you have no workspaces"
  during a 404, 2026-08-09). Write mutations keep their own
  `createError`/`restoreError`/`writeError` fields.

  **Fix (breaking within 0.x):** `GET /trash` was hand-typed as
  `DocDocument[]` in 0.1.0 — the backend's `TrashView` actually returns
  `{folders, documents}`. `listTrash`/`useTrash` now return the real
  `TrashListing`, and the `TrashBin` bag's ready state carries
  `{folders, documents}` (the old documents-only `items` field is gone).

## 0.1.0

Initial release: typed api, query hooks, editor registry, headless bags.
