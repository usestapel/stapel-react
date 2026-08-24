---
"@stapel/docs-react": minor
---

Wire the pair to the contract, and ship the product: generated schema + the 74-code error map, ru/es, nav, demos, and the shared skin substrate.

**Contract.** `api/types.ts` is now derived from `api/generated/schema.ts` (regenerated from `stapel-docs/docs/schema.json`) instead of hand-written: `collab` is the discipline string `"crdt" | "snapshot"` the wire actually sends (it was typed `boolean`, so `if (doc.collab)` was true for a snapshot document), `DocRevision` carries `created_by` / `kind` / `size_bytes` / `document_id` (`author_id` was a field name the server has never sent), and `PostUpdateRequest` is the journal's real `{updates[], client_id?, client_seq?}` batch rather than an invented `{payload}`. `emptyTrash` and `postUpdate` now answer their typed results. Two shapes stay hand-authored WITH the reason on them — the trash listing and the `?since=` resync branch, both absent from the backend's schema.

**Refusals have sentences.** `DOCS_ERRORS` was `{}` against a backend that declares 74 codes, so a lost save race and an exhausted workspace quota rendered as the same "Something went wrong". It is now the generated map, and `error.409.docs_seq_conflict` / `error.507.docs_workspace_quota` are named refusals in en, ru and es.

**BREAKING (pre-1.0 = minor).** `/default` no longer exports `DocsSkinTheme` or its own `ErrorAlert`: the surfaces render through `SkinTheme` and `ErrorAlert` from `@stapel/tokens-antd/skin`, so the reactive-theme fix and the 44px phone controls are inherited rather than re-copied. `SaveContentResult.revisionId` is `string | null` (the wire's `revision_id` is nullable). Peer floors are `@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`.

**New document.** `useCreateDocument` had no consumer — a documents product with no way to create a document. `FileManager` now carries it beside Upload, with a title + type dialog (`NewDocumentDialog`, exported), and hands the created document to the host's route.

**Mobile.** The folder tree's fixed 240px column left ~150px for the list on a phone. The panes now stack into one at a time under the tablet breakpoint, measured off the CONTAINER's width (`useSplitLayout`, exported), so a file manager in a 380px desktop panel lays out like a phone too.

**Reachable controls.** `Popconfirm` → `SkinConfirm` (a bottom sheet on a phone) for emptying the trash, purging one item and rolling back. Every boolean `disabled` → `GatedButton`, so an empty name, an unchanged move destination, a URL that could not be minted and an already-current revision each state their reason beside the control. Every row and folder gained a visible, focusable actions trigger — the menus were right-click only, i.e. unreachable by keyboard and on touch. "Open" is no longer offered when the host passes no `onOpenDocument`.

**Honest crdt.** A `crdt`-discipline document with no registered collaborative editor gets a stated reason and its bytes instead of a snapshot Save the journal would refuse.

**Also:** `src/nav/manifest.ts` + `nav-manifest.json` (`docs.files` at `/files`, `docs.document` at `/files/:id`); `./i18n/ru`, `./i18n/es` and `./nav-manifest` export subpaths; a `demo/` directory (10 demos, 27 variants, every one of the 15 `/default` exports drawn at phone width); dates and sizes through the APP locale (`model/format.ts`) instead of the browser's; raw dimension literals onto `@stapel/tokens`. Lint doctrine warnings: 24 → 0.
