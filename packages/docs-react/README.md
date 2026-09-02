# @stapel/docs-react

Headless React flow pair for **stapel-docs** (frontend-standard §2): typed API
client, TanStack Query hooks, snapshot-save discipline (`If-Match: head_seq`),
the **editor registry** (`registerDocEditor`), headless render-prop components
(including the 0.6 **share axis** — grants, bearer links, and the bearer's own
stripped view), and i18n keys. Business + state only, zero visual opinion — any design layers
on top. Built on `@stapel/core` (typed client + `StapelApiError` envelope,
token refresh, verification-403 interception, i18n engine, analytics seam,
TanStack Query).

> **Contract.** Generated against stapel-docs' own committed artifacts at the
> pinned **v0.6.1** ref (`contract-pins.json`): `src/api/generated/schema.ts`
> (44 operations), `src/i18n/generated/errors*.ts` (84 codes, en/ru/es) and
> `manifest.json` + `llms.txt` are emitted by the root `gen:*` drivers and
> drift-gated. `flows.json` is `[]` — this module declares no flows, so
> `DOCS_FLOWS` is empty by construction rather than by omission. The api
> layer's endpoint strings are hand-authored (the `stapel/no-string-paths`
> carve-out); every SHAPE they carry is an alias of the generated schema.

## Install

```
pnpm add @stapel/docs-react @stapel/core @tanstack/react-query react
```

## Wire the app once

One `<StapelProvider>` for the whole app, one `<DocsProvider>` for this pair:

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import { createDocsRuntime, DocsProvider, registerDocsI18n } from "@stapel/docs-react";

const runtime = createDocsRuntime({ baseUrl: "/docs/api/v1/" });
const i18n = createI18n({ locale: "en" });
registerDocsI18n(i18n);

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.1.0">
      <DocsProvider runtime={runtime}>{children}</DocsProvider>
    </StapelProvider>
  );
}
```

## The editor registry — the customer seam

A document declares its editing surface via `editor_hint`; the registry
resolves the hint to a component. Adding an editor for a new document type is
a **registration, not a fork**:

```tsx
import { registerDocEditor, resolveDocEditor, DocEditor, MediaViewer } from "@stapel/docs-react";

registerDocEditor("whiteboard", MyWhiteboardEditor); // once, at startup

function DocumentSurface({ doc }: { doc: DocDocument }) {
  const Editor = resolveDocEditor(doc.editor_hint); // explicit > builtin > null
  return Editor ? (
    <DocEditor documentId={doc.id}>{(bag) => <Editor bag={bag} />}</DocEditor>
  ) : (
    <MediaViewer documentId={doc.id}>{/* download-only presentation */}</MediaViewer>
  );
}
```

Builtins ship for `"text"`, `"markdown"` (source editing, deliberately no
preview dependency), and `"csv"` (hand-rolled parser, rows model with cell
edit) — all snapshot editors, all unstyled DOM.

## Real editors — optional peers, loaded with `import()`

Two production engines ship as their own subpaths. Neither is in the main
entry, and neither is installed for you: they are **optional peer
dependencies** fetched with a dynamic `import()` the moment a surface mounts.
The main entry's byte budget is 12 KB — a fifth of the lightest WYSIWYG on the
market — so this is a structural rule, not a preference, and `size-limit` plus
`test/prodBundlePurity.test.ts` both hold the line.

```
# CodeMirror 6 — byte-stable source editing (txt, and markdown source)
pnpm add @codemirror/state @codemirror/view @codemirror/lang-markdown

# Milkdown (Crepe) — markdown WYSIWYG; needs the CodeMirror trio for its source mode
pnpm add @milkdown/crepe
```

```tsx
// once, at startup — registration, not a fork
import { registerCodeMirrorDocEditors } from "@stapel/docs-react/editors/codemirror";
import { registerMilkdownDocEditor } from "@stapel/docs-react/editors/milkdown";
import { EditorChrome } from "@stapel/docs-react/default"; // optional: keeps Save/dirty/conflict

registerCodeMirrorDocEditors({ wrap: EditorChrome, hints: ["text"] });
registerMilkdownDocEditor({ wrap: EditorChrome });

// …or, with the default skin, the same two lines as one:
import { registerDocsRichEditors } from "@stapel/docs-react/default";
registerDocsRichEditors();
```

Milkdown draws itself from its own stylesheets — import them once in the host
entry (the pair does not decide anyone's CSS pipeline; `MILKDOWN_THEME_IMPORTS`
names them):

```ts
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
```

**Round-trip: read this before choosing.**

| Surface | `serialize ∘ parse` | Use it for |
|---|---|---|
| CodeMirror (`text`, markdown source) | **byte-for-byte identical** — the document model IS the string | machine-written documents, anything diffed on the server |
| Milkdown (markdown WYSIWYG) | **semantic, not byte-stable** — remark normalizes list markers, escapes, emphasis, the trailing newline | documents people write and edit by hand |

A machine-generated markdown file opened in the WYSIWYG and saved comes back
the same *document* and a different *file*. Knowledge chunking (AST/heading
based) does not care; a server-side line diff does — the first WYSIWYG save can
look like a rewrite of the whole file. That is why the markdown surface carries
a one-click **source mode** (CodeMirror, byte-stable), and why
`registerMilkdownDocEditor({ defaultSourceMode: true })` exists for a product
whose documents are written by services.

**With the peers absent nothing breaks.** Each surface renders the pair's own
plain builtin under a sentence saying the engine is not installed, and the
document is still edited and saved through the same If-Match bag. A missing
`@milkdown/crepe` falls back to CodeMirror source; a missing CodeMirror falls
back to the textarea. `csv` is deliberately untouched: its zero-dependency grid
is the better surface for a table.

## Collaborative documents — the update journal

`useDocUpdates` polls `GET /documents/:id/updates?since=` for a `crdt`-
discipline document, keeps the sequence cursor, and hands out each batch of
new rows. A **resync** answer (the requested sequence aged out of the retained
journal) is not an error: the hook invalidates the content and document reads,
drops its buffer and re-arms the cursor at the new head.

```tsx
const doc = useDocument(documentId);
const journal = useDocUpdates(documentId, {
  enabled: doc.data?.collab === "crdt", // snapshot types must not poll: the wire refuses
  onUpdates: (rows) => { for (const row of rows) applyEncoded(row.payload); },
});
const append = useAppendUpdates(documentId);
```

Polling is the floor a browser always reaches, not a claim about transport: a
host with a socket passes `enabled: false` and feeds the same consumer from
the wire. `intervalMs` defaults to `DOC_UPDATES_INTERVAL_MS` (2.5s).

## The default skin — `@stapel/docs-react/default` (opt-in)

The main entry stays zero-visual-opinion; importing the `/default` subpath is
the opt-in that brings `antd` (an optional peer, with `@stapel/tokens-antd`):

```tsx
import { FileManager, DocSurface } from "@stapel/docs-react/default";

<FileManager workspaceId="ws-1" onOpenDocument={(d) => navigate(d.id)} />
<DocSurface documentId={docId} />
```

- **`FileManager`** — folder tree + document list + breadcrumbs + trash view,
  with right-click context menus wired 1:1 to the server's operations
  (rename / move / move-to-trash / restore / download / version history —
  there is no duplicate endpoint on stapel-docs, so no duplicate item).
- **`RevisionsModal`** — history list, inline text preview, rollback (lands
  as a new head; history keeps everything).
- **`DocSurface`** + default editors — chrome-styled text, markdown-source,
  and CSV-table editors on the same If-Match snapshot path; `FileCard` for
  download-only documents (image/video preview by MIME).
- **Self-themed** — every surface wraps its own `DocsSkinTheme`
  (`@stapel/tokens` → `toAntdThemeConfig`; mode follows the host document's
  `data-theme`, the `mode` prop pins a side). A default skin never inherits
  an unthemed host.
- **Replaceable without forking** — every part resolves through
  `registerDocsSkinComponent("fileManager.listPane" | … , Component)` (same
  seam shape as the editor registry), and `DocSurface` gives an explicit
  `registerDocEditor` registration priority over the skin's own editors.

## Snapshot saves and conflicts

`DocEditor` loads the content plus its `head_seq` (from the `X-Docs-Head-Seq`
header), and `save()` PUTs the snapshot with `If-Match`. A refused save (409 /
412) becomes the bag's **typed `conflict` state** — `{headSeq, savedBy,
savedAt}` — never an exception; `overrideSave()` re-reads the current head and
lands this editor's value as a **new revision at the new head** (the other
author's save stays in history).

## Layers

```
src/
  api/        typed client (endpoint table) + raw content ops (If-Match, export, put_url)
  model/      runtime, context, docsQueryKeys, query/mutation hooks, folder-tree builder
  editors/    the registry (registerDocEditor/resolveDocEditor) + builtins + csv codec
              codemirror/ · milkdown/  — optional-peer engines, own subpaths, lazy import()
  headless/   DocumentList · FolderTree · Breadcrumbs · DocEditor · RevisionHistory
              · TrashBin · DocUploader · MediaViewer · ShareSheet
              · SharedDocumentView  (render-prop bags)
  flows/      zero-flow shim (stapel-docs documents no flows)
  i18n/       keys + en/ru/es bundles over the generated 84-code error registry
```

## Sharing — the 0.6 axis

`<ShareSheet documentId>` composes both grant sources into one bag: the
whitelist (`GET/POST /documents/<id>/access`) and bearer links
(`GET/POST /documents/<id>/links`), each with its own capability answer, its
own suspended-by-configuration state and its own writes.

- **The capability IS the 403.** Both listings are themselves gated
  (`docs.share.whitelist` names other people; `docs.share.link` hands back live
  tokens), so a refusal to list is the honest "you may not administer this".
  There is no capabilities endpoint and the document envelope carries no
  "can share" flag — the pair does not invent a second source for it.
- **A suspended row is shown, never filtered.** The kill switch is a display
  state: an operator who cannot see an inert grant believes it was revoked.
- **The four share 400s are surfaced by name** (`DOCS_SHARE_ERROR_CODES`),
  because each names a different remedy.

**Known gap (backend).** `SHARING.LINK.MAX_LEVEL` is published by no endpoint
in 0.6.1, so the ceiling on a minted link's level cannot be known before the
mint. `ShareSheetBag.levelRefused` reports the backend's refusal
(`error.400.docs_share_level`) instead — a client-side cap invented from
nothing would be a second answer to an authorization question.

`<SharedDocumentView token>` is the seam for the shared-link page — the
stripped envelope (no workspace, folder, owner, star or revisions), the level
the link carries, and one honest sentence for a dead token, because expired,
revoked and never-existed all answer 404 so that the endpoint is not an oracle.
The PAGE itself is host composition. The product share sheet lives in
`@stapel/drive-react/default`; this pair ships no share skin.

## Uploads

`useUpload` / `<DocUploader>` run the full flow — `POST /uploads` → bytes →
`finalize` — over either delivery path: the presigned `put_url` (default), or
`PUT /documents/:id/content` for the local-storage backend profile where
`put_url` is not writable (`via: "content"`).

## License

MIT © Stapel contributors
