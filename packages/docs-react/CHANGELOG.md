# @stapel/docs-react

## 0.9.0

### Minor Changes

- b9d6a09: The viewing wave, against stapel-docs 0.8.0: media that plays, and history
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

## 0.8.0

### Minor Changes

- 95cdfac: The crdt-consumption slice over stapel-docs 0.7.0: live co-editing on the
  update journal, both transports, one downstream shape.

  - **Contract pin → v0.7.0** (`contract-pins.json`): the regen picks up
    `socket_path` on the document envelope (null on a polling-only host),
    the two live builtin types (`ymd`/`ytxt`, hints
    `markdown.crdt`/`text.crdt`), and `error.400.docs_invalid_crdt_payload`
    (85 codes, en/ru/es). Manifest range becomes `>=0.7 <0.8`.
  - **`useDocStream(documentId)`** in the main entry — wire-level only, no
    CRDT library: resolves `socket_path` off the document row, consumes the
    resumable stream through `@stapel/realtime` (NEW required peer,
    `>=0.1.1` — the fleet's one socket runtime; the main entry stays inside
    its 12 KB budget), and hands out ordered `{seq, update(base64),
authorId, clientId}` events plus a resync signal. When the row says
    null, no `<RealtimeProvider>` is mounted, or the socket closes with a
    verdict, the same events flow from the `useDocUpdates` poll at
    `fallbackRefetchInterval` — taken up at the cursor the socket got to,
    never from zero.
  - **NEW subpath `./editors/collab`** (optional peers `yjs` >=13.6 and
    `y-codemirror.next` >=0.3, dynamic `import()`, own 9 KB budget): a
    framework-free Y.Doc session (hydrate from the binary `/content` state;
    origin-tagged remote application so nothing echoes back; debounced
    `POST /updates` batches under `client_id`/`client_seq` — a failed batch
    retries AS-IS under its own seq; resync MERGES the fresh state into the
    live doc, so unsent local edits survive and flush) and
    `registerCollabDocEditors()` — CodeMirror 6 + `yCollab` bound to the
    `"content"` Y.Text for both live hints, no awareness (0.7.0 ships no
    transport; stated, not faked). With the peers absent the surface stays
    read-only — no textarea fallback, because a snapshot save over a crdt
    body is refused by the write door.
  - **`CRDT_DOCUMENT_TYPES`** — the `ymd`/`ytxt` picker options, exported
    but NOT folded into `DEFAULT_DOCUMENT_TYPES`: the server registers the
    live types only with the `[crdt]` extra installed and still publishes
    no `/types` listing to ask.

## 0.7.0

### Minor Changes

- 0db4a6e: The share axis, against stapel-docs 0.6.1 — access grants, bearer links, and
  the bearer's own read.

  The contract pin moves 0.5.0 → 0.6.1 and both halves of the pair regenerate
  from it: 35 → 44 operations in `src/api/generated/schema.ts`, 77 → 84 error
  codes in the en/ru/es bundles. 0.6.1 rather than 0.6.0 deliberately — 0.6.0
  shipped the mechanism with `authorize()` called without the document at every
  document-scoped view, so a whitelist grantee was refused by every URL that
  would have honoured the grant. A pair built against 0.6.0 would have drawn a
  share sheet whose grants did nothing.

  **The client.** Nine operations: `GET`/`POST /documents/<id>/access` +
  `DELETE …/access/<id>` (whitelist grants — one subject, one level, upsert on
  repeat), `GET`/`POST /documents/<id>/links` + `DELETE …/links/<id>` (bearer
  links), and `GET /shared/<token>` + `/content` + `/download`. The bearer's
  body read joins the raw-bytes surface in `api/content.ts`, because it carries
  `X-Docs-Head-Seq` like every other content read and a JSON client cannot
  surface a header.

  **Hooks.** `useDocumentAccess` / `useDocumentLinks` / `useSharedDocument` /
  `useSharedDocumentContent`, and `useGrantAccess` / `useRevokeAccess` /
  `useMintShareLink` / `useRevokeShareLink` / `useSharedDownloadUrl`. The share
  writes invalidate ONE listing, never the module root every other write in this
  pair drops: granting access moves no document, and dropping the root would
  refetch the whole file manager sitting behind the sheet.

  **`<ShareSheet>`** composes the two halves into one bag, and two of its
  properties are the point rather than an implementation detail:

  - **The capability IS the 403.** Both listings are themselves gated
    (`docs.share.whitelist` / `docs.share.link` — the whitelist listing names
    other people, and the link listing carries live tokens), so a refusal to
    list is the honest "you may not administer this". There is no capabilities
    endpoint and `DocumentPresenterDTO` carries no "can share" flag; the pair
    checked the 0.6.1 schema rather than inventing a second source.
  - **A suspended row is shown, never filtered.** The kill switch is a display
    state: an operator who cannot see an inert grant believes it was revoked,
    and re-enabling the mode then restores access nobody expected.

  The four share 400s are surfaced by name (`DOCS_SHARE_ERROR_CODES`, typed
  against the generated registry so a backend rename stops the build), because
  each names a different remedy: a mode nobody in the sheet can switch on, a
  level to retry one step lower, a form that sent both subject fields or
  neither, and a reference kind this host registered no resolver for.

  **HONEST GAP.** `SHARING.LINK.MAX_LEVEL` is published by no endpoint in 0.6.1
  and the document envelope does not carry it, so the level ceiling cannot be
  known before a mint. `ShareSheetBag.levelRefused` reports the backend's
  refusal instead; a client-side cap invented from nothing would be a second
  answer to an authorization question, which is how a share mode ships
  half-enforced. Recorded for the backend rather than guessed at here.

  **`<SharedDocumentView>`** is the seam for the bearer route, not the route:
  the stripped envelope (no workspace, no folder, no owner, no star, no
  revisions), the level the link carries, `readOnly` as a structural fact rather
  than a guess, and one honest sentence for a dead token — expired, revoked and
  never-existed all answer 404 on purpose, so that the endpoint is not an oracle
  for guessing tokens. The one refusal that names a remedy,
  `error.401.docs_share_auth_required`, is told apart from it and is keyed on
  the CODE, never on a bare 401, which is the session layer's business.

  The bearer PAGE, and the product share sheet, are somebody else's:
  `@stapel/drive-react/default` draws the sheet, and the page's URL shape and
  chrome are host composition. This pair ships no share skin — a second
  implementation of a surface that already exists is the integration-seam defect
  the drive package was designed to avoid.

  Two demos (the sheet, the bearer view) and 22 tests, including the two
  properties a re-skin can silently lose: a mint refreshes its listing, and a
  suspended row still renders. en/ru/es copy for all of it.

## 0.6.0

### Minor Changes

- b844c9a: Real editors, behind optional peers — and the update journal finally has a reader.

  Two things this pair promised and had not delivered: an editing surface worth
  the name, and any consumer at all for the `crdt` half of the module's contract.

  **The editors — `./editors/codemirror` and `./editors/milkdown`.**
  The verdict the editors research reached (§1.3) implemented as written:
  CodeMirror 6 for source editing, Milkdown for markdown WYSIWYG, both as
  OPTIONAL peer dependencies fetched with a dynamic `import()` at mount, both
  behind their own subpaths, neither anywhere near the main entry. That is a
  structural rule, not a preference: the main entry is budgeted at 12 KB and the
  lightest WYSIWYG on the market is 109 KB gzip. `size-limit` measures the
  consequence; `test/prodBundlePurity.test.ts` now names the cause, so a leak is
  reported as "an engine reached the main entry" rather than as "the budget
  moved". Registration is the only integration surface —
  `registerCodeMirrorDocEditors()`, `registerMilkdownDocEditor()`, or
  `registerDocsRichEditors()` from `/default` for both at once with the skin's
  `EditorChrome` kept, so Save, the dirty marker and the conflict override stay
  exactly where they were.

  **Round-trip, stated in the API and not only in a doc.** CodeMirror is
  byte-stable by construction — its document model IS the string, which is the
  acceptance criterion for a module written to by services: a machine-generated
  document opened and closed untouched is the same FILE, not merely the same
  document. Milkdown is markdown-native but **not** byte-stable: remark
  normalizes list markers, escapes, emphasis and the trailing newline, so the
  first WYSIWYG save of a generated file can read as a rewrite of the whole
  thing in a server-side diff. Hence a one-click source mode (CodeMirror) on the
  markdown surface, `defaultSourceMode` for products whose documents are written
  by machine, and a codec whose identity is asserted over the strings that break
  normalizing editors rather than asserted in prose.

  **Absence is a designed screen.** With the peers not installed, each surface
  renders the pair's own plain builtin under a sentence saying why, and the
  document is still edited and saved through the same If-Match bag — a missing
  `@milkdown/crepe` degrades to CodeMirror source, a missing CodeMirror to the
  textarea. `csv` is deliberately untouched: the zero-dependency grid is the
  better surface for a table.

  **`useDocUpdates` — the journal poll.** `getUpdates`/`postUpdate` have been on
  the client since 0.1.0 with nothing reading them, which is why a `crdt`
  document could only be told "no collaborative editor is registered". The hook
  polls `?since=`, keeps the sequence cursor, hands out each batch of new rows,
  and treats a **resync** as what it is — not an error but an order to stop
  replaying: it invalidates the content and document reads, drops its buffer and
  re-arms the cursor at the head the backend named. Polling is a floor, not a
  claim about transport: `enabled: false` turns it off for a host that has a
  socket, and `useAppendUpdates` posts a batch while invalidating only the
  document head (an append happens as often as a person types — the module-root
  invalidation every other mutation performs would be a refetch storm).

  Five new i18n keys (en/ru/es), a demo of all four editor arms including the
  one where nothing is installed, and 39 new tests.

## 0.5.0

### Minor Changes

- 57bd738: The dialogs go dark, "Actions" becomes an affordance, and "OK" learns what it
  does.

  **Every dialog and every pane carries its own theme.** `NameDialog`,
  `MoveDialog` and `NewDocumentDialog` render into a portal, so they inherit a
  `ConfigProvider` only from the tree they are DECLARED in. The header comment
  claimed the owning pane's `SkinTheme` covered them; the visual pass photographed
  the result — a WHITE sheet over a black page in every dark shot (CF-1 / N-1).
  Each dialog now declares `<SkinTheme surface="bare">` around itself and takes a
  `mode`. The same applies to the panes: `DocumentListPane`, `FolderTreePane`,
  `TrashPane`, `FileManagerBreadcrumbs`, `FileCard` and `EditorChrome` are mounted
  standalone as often as inside `<FileManager>`, and unthemed antd is where this
  package's SECOND brand blue came from (`#007aff` in the document list and trash
  against `#4f46e5` in the file manager — N-8). They self-theme now, and
  `<FileManager>` forwards its `mode` to all of them.

  **`<FileManager>` paints the page, not a panel.** `surface="base"` instead of
  the default `raised`: as a raised panel it drew a slightly lighter box that
  stopped at content height with a hard edge over the page's own background, and
  the segmented controls inside it — designed against a layout background — read
  as holes punched in the panel. Its two tab groups no longer both say "Files":
  the pane switch is `Folders | Documents`, which is also what the pane lists.

  **The row's overflow action is an icon button.** `Typography.Link` reading
  "Actions" — a control named after its own category, three times per screen, with
  no icon, no affordance and a touch target well under 44px, pinned to the far
  edge of a full-bleed list with ~1400px of dead gap before it — is now a shared
  `<RowActions>`: the ⋯ glyph as inline SVG (no icon-font dependency), the
  category name moved to `aria-label`, at the antd control height. The list panes
  also gained a `READING_MEASURE` cap, so a desktop row is a row and not a
  1900px-wide gap.

  **Confirms name their action.** "OK" is what a button says when nobody decided
  what it does. Rename says Rename, new-folder says Create folder, move says Move,
  new-document says Create — and the blocked reason stacks UNDER the affirmative
  instead of trailing past the right edge of a 390px sheet. Same fix for
  `RevisionsModal`'s Restore, whose inline reason ("This is the document's current
  version.") ran off the sheet and cut the row in half.

  **Two states stop lying.** `FileManagerBreadcrumbs` draws a skeleton while the
  folder read is in flight — it used to render the finished root crumb, which made
  `loading` and `root` pixel-identical in a package that already ships a skeleton
  for the file list. `FileCard`'s download mint says "Preparing the download
  link…" instead of four unlabelled skeleton bars that read the same as a stuck
  screen.

  **An openable row says so.** The document title is a link button when the host
  passed `onOpenDocument` and plain text when it did not, so the §83 rule the
  `no-open-route` variant exists to prove is finally visible (it is a
  `Button type="link"`, not `Typography.Link`, because antd's
  `.ant-list-item-meta-title > a` rule repaints an anchor in there to the plain
  text colour). `RevisionsModal`'s redundant `desktop` variant is gone: the
  surface is width-driven, so the shot runner photographing the story at both
  widths already covered it.

  Tests updated where the copy they assert changed (the affirmative's label, and
  `<FileManager/>`'s root now painting the layout surface); nothing was relaxed.
  10 demos, 15/15 skin covered under `DEMOS_SKIN_GATE=strict`.

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
