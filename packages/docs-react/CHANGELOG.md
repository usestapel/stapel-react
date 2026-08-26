# @stapel/docs-react

## 0.4.0

### Minor Changes

- 80617e9: Wire the pair to the contract, and ship the product: generated schema + the 74-code error map, ru/es, nav, demos, and the shared skin substrate.

  **Contract.** `api/types.ts` is now derived from `api/generated/schema.ts` (regenerated from `stapel-docs/docs/schema.json`) instead of hand-written: `collab` is the discipline string `"crdt" | "snapshot"` the wire actually sends (it was typed `boolean`, so `if (doc.collab)` was true for a snapshot document), `DocRevision` carries `created_by` / `kind` / `size_bytes` / `document_id` (`author_id` was a field name the server has never sent), and `PostUpdateRequest` is the journal's real `{updates[], client_id?, client_seq?}` batch rather than an invented `{payload}`. `emptyTrash` and `postUpdate` now answer their typed results. Two shapes stay hand-authored WITH the reason on them — the trash listing and the `?since=` resync branch, both absent from the backend's schema.

  **Refusals have sentences.** `DOCS_ERRORS` was `{}` against a backend that declares 74 codes, so a lost save race and an exhausted workspace quota rendered as the same "Something went wrong". It is now the generated map, and `error.409.docs_seq_conflict` / `error.507.docs_workspace_quota` are named refusals in en, ru and es.

  **BREAKING (pre-1.0 = minor).** `/default` no longer exports `DocsSkinTheme` or its own `ErrorAlert`: the surfaces render through `SkinTheme` and `ErrorAlert` from `@stapel/tokens-antd/skin`, so the reactive-theme fix and the 44px phone controls are inherited rather than re-copied. `SaveContentResult.revisionId` is `string | null` (the wire's `revision_id` is nullable). Peer floors are `@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`.

  **New document.** `useCreateDocument` had no consumer — a documents product with no way to create a document. `FileManager` now carries it beside Upload, with a title + type dialog (`NewDocumentDialog`, exported), and hands the created document to the host's route.

  **Mobile.** The folder tree's fixed 240px column left ~150px for the list on a phone. The panes now stack into one at a time under the tablet breakpoint, measured off the CONTAINER's width (`useSplitLayout`, exported), so a file manager in a 380px desktop panel lays out like a phone too.

  **Reachable controls.** `Popconfirm` → `SkinConfirm` (a bottom sheet on a phone) for emptying the trash, purging one item and rolling back. Every boolean `disabled` → `GatedButton`, so an empty name, an unchanged move destination, a URL that could not be minted and an already-current revision each state their reason beside the control. Every row and folder gained a visible, focusable actions trigger — the menus were right-click only, i.e. unreachable by keyboard and on touch. "Open" is no longer offered when the host passes no `onOpenDocument`.

  **Honest crdt.** A `crdt`-discipline document with no registered collaborative editor gets a stated reason and its bytes instead of a snapshot Save the journal would refuse.

  **Also:** `src/nav/manifest.ts` + `nav-manifest.json` (`docs.files` at `/files`, `docs.document` at `/files/:id`); `./i18n/ru`, `./i18n/es` and `./nav-manifest` export subpaths; a `demo/` directory (10 demos, 27 variants, every one of the 15 `/default` exports drawn at phone width); dates and sizes through the APP locale (`model/format.ts`) instead of the browser's; raw dimension literals onto `@stapel/tokens`. Lint doctrine warnings: 24 → 0.

- 95e8eec: Every dialog is a bottom sheet on a phone, and two controls that offered
  nothing are gone.

  `RevisionsModal`, `NameDialog` and `MoveDialog` render through
  `@stapel/tokens-antd/skin`'s `SkinDialog`, so the fleet's surface rule reaches
  them without this package restating it.

  Rollback was offered on EVERY revision including the current head — restoring
  the head writes a new, identical revision, an action the document's own state
  makes meaningless. The head row's rollback is now blocked with the reason
  printed beside it. And `loading` was not keyed to the revision being restored,
  so one rollback spun every row's button.

  `MoveDialog`'s confirm was enabled when the chosen destination was the folder
  the document is already in; it is disabled now, consistent with `NameDialog`
  next to it, which already refused an unusable value.

### Patch Changes

- 350f61f: Generated artifacts these pairs were entitled to and never asked for.

  `gen:errors` pinned `ERRORS_LOCALES=ru` for gdpr-react and video-react while every other
  pair on that line used `ru,es`, so no Spanish bundle was ever emitted — even though
  `stapel-gdpr/translations/errors.es.json` already carried all 15 module keys and
  video's core-owned keys were sitting in stapel-core's catalog. One word per pair;
  `src/i18n/generated/errors.es.gen.ts` now exists in both (gdpr: 57 codes, complete over
  the registry; video: 51, `Partial` because stapel-video ships no catalog of its own and its
  keys stay the pair's to author). Reaching them needs an `./i18n/es` subpath, which is the
  pairs' own `package.json` to add.

  docs-react is enrolled in the root gen drivers for the first time — `gen:api`,
  `gen:errors` (ru+es), `gen:events`, `gen:flows`, `gen:manifest`. It was the only package in
  the monorepo that appeared in none of them, so everything the pipeline gives the other 16
  pairs was hand-written and ungated, and had drifted: `manifest.json` claimed
  `backend.contract ">=0.1 <0.2"` against stapel-docs 0.3.0 and invented two operationIds the
  backend has never had. The manifest and llms.txt are generated now (27 operations, 74 error
  codes with ru and es texts) and stand under the drift gate. The pair's own source said in
  three files that the backend emitted no contract artifacts; it does, and has for a while.
  `gen:nav` and `gen:demos` still wait on a `src/nav/manifest.ts` and a `demo/` directory.

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
