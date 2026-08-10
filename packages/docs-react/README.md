# @stapel/docs-react

Headless React flow pair for **stapel-docs** (frontend-standard §2): typed API
client, TanStack Query hooks, snapshot-save discipline (`If-Match: head_seq`),
the **editor registry** (`registerDocEditor`), headless render-prop components,
and i18n keys. Business + state only, zero visual opinion — any design layers
on top. Built on `@stapel/core` (typed client + `StapelApiError` envelope,
token refresh, verification-403 interception, i18n engine, analytics seam,
TanStack Query).

> **Contract note.** stapel-docs has not committed its contract artifacts
> (`docs/schema.json` / `flows.json` / `errors.json`) yet. The api layer is
> hand-typed to the module's endpoint table, this pair is not enrolled in the
> monorepo `gen:*` drivers, and `manifest.json`/`llms.txt` are hand-authored.
> Enrolling the pair + regenerating those surfaces is a mandatory follow-up
> once the backend contract lands (see `src/api/types.ts`).

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
  headless/   DocumentList · FolderTree · Breadcrumbs · DocEditor · RevisionHistory
              · TrashBin · DocUploader · MediaViewer  (render-prop bags)
  flows/      zero-flow shim (stapel-docs documents no flows yet)
  i18n/       keys + en bundle (+ empty error map until the backend registry lands)
```

## Uploads

`useUpload` / `<DocUploader>` run the full flow — `POST /uploads` → bytes →
`finalize` — over either delivery path: the presigned `put_url` (default), or
`PUT /documents/:id/content` for the local-storage backend profile where
`put_url` is not writable (`via: "content"`).

## License

MIT © Stapel contributors
