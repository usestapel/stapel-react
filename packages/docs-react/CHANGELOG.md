# @stapel/docs-react

## 0.3.2

### Patch Changes

- Raise the peer floors that understated what these packages import.

  `docs-react` and `profiles-react` both call `resolveThemeMode`, which
  `@stapel/tokens-antd` did not export until 0.5.0, while declaring `>=0.2.0`;
  `profiles-react` also imports `Image` and `StapelImage` from `@stapel/image`,
  which first shipped them in 0.2.0, while declaring `>=0.1.0`. A consumer
  installing at the declared floor got an unresolvable import.

  `check:peer-floors` now checks every `@stapel/*` peer instead of only
  `@stapel/core`, and refuses to run against a checkout with no tags — where it
  previously answered "unknown" for every symbol and passed each package
  unchecked.

## 0.3.1

### Patch Changes

- 74c8c0d: Raise the `@stapel/core` peer floor to 0.13.0 — the 0.3.0 headless bags hand
  out `LoadState` and are rendered through `matchList`/`matchLoad`, all of which
  ship in core 0.13.0. A host on core 0.12 satisfied the declared peer range and
  then failed at runtime on the missing imports; the floor now states what the
  code already requires.

## 0.3.0

### Minor Changes

- 400f9e6: Headless bags hand out a `LoadState` instead of a flattened array, so a failed
  read can no longer be mistaken for an empty one: `DocumentListBag`,
  `FolderTreeBag`, `BreadcrumbsBag`, `RevisionHistoryBag`, `TrashBag`,
  `MediaViewerBag` and `NotificationFeedBag` expose `state` (plus `urlState` on
  the media bag) and drop their `isLoading`/`isError`/`error` read fields; the
  default skins render through `matchList`/`matchLoad`, so the empty state is
  reachable only from a load that actually succeeded.

  Controls that switch off because a read failed now say why: "Empty trash"
  (`TrashPane`) and the download button (`FileCard`) go through
  `useActionGate` and render the reason as text beside the control.

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
