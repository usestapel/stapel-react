# @stapel/drive-react

The **phone-first Drive product** over `stapel-docs` 0.6 — the drive wave of
that module, drawn, plus its share axis. It is not a second documents pair: `@stapel/docs-react` is
a **peer**, and this package reuses its client, its model hooks, its dialogs
and its trash rather than reimplementing any of them.

What is genuinely here, and nowhere else in the fleet:

- **starred / recents / name search / image thumbnails** — typed hooks over the
  five endpoints stapel-docs 0.5.0 added;
- **an upload queue with REAL per-file progress** — the presigned PUT runs over
  `XMLHttpRequest`, because `fetch` cannot observe request-body progress;
  concurrency 2, per-file retry and cancel, and the workspace-quota 507 as a
  state of its own;
- **server-driven folder navigation** — one request per rung, one cache entry
  per folder id, never a whole-tree sync;
- **a share sheet** over the docs pair's headless share axis — bearer links
  (mint at a level, copy, expiry, first-opened, revoke) and whitelist grants,
  with a switched-off mode's rows shown under a banner rather than hidden;
- **a single-column product skin** behind `/default` — sticky breadcrumb bar,
  list/grid toggle, bottom action sheet, FAB + tray, Starred/Recent/Trash tabs.

> **Contract.** Generated against stapel-docs' own committed artifacts at the
> pinned **v0.6.1** ref (`contract-pins.json`): `src/api/generated/schema.ts`,
> `src/i18n/generated/errors*.ts` (84 codes, en/ru/es) and
> `manifest.json` + `llms.txt` are emitted by the root `gen:*` drivers and
> drift-gated.

## Install

```
pnpm add @stapel/drive-react @stapel/docs-react @stapel/core @tanstack/react-query react
```

`antd` + `@stapel/tokens-antd` are optional peers — needed only for the
`/default` skin.

## Wire the app once

Both runtimes take the **same base URL**: these are one module's endpoints.
`<DriveProvider>` goes **inside** `<DocsProvider>`.

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import { createDocsRuntime, DocsProvider, registerDocsI18n } from "@stapel/docs-react";
import { createDriveRuntime, DriveProvider, registerDriveI18n } from "@stapel/drive-react";

const docs = createDocsRuntime({ baseUrl: "/docs/api/v1/" });
const drive = createDriveRuntime({ baseUrl: "/docs/api/v1/" });
const i18n = createI18n({ locale: "en" });
registerDocsI18n(i18n);
registerDriveI18n(i18n);

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={docs.client} i18n={i18n} cacheVersion="0.1.0">
      <DocsProvider runtime={docs}>
        <DriveProvider runtime={drive}>{children}</DriveProvider>
      </DocsProvider>
    </StapelProvider>
  );
}
```

A drive hook mounted without `<DocsProvider>` above it fails in the docs pair's
own `useDocsRuntime`, with that pair's message — the honest place for it, and
the reason this package does not re-wrap the docs context.

## The screen

```tsx
import { DriveScreen } from "@stapel/drive-react/default";

<DriveScreen workspaceId="ws-1" onOpenDocument={(id) => navigate(`/files/${id}`)} />
```

One route (`/drive`, per `nav-manifest.json`), four tabs. Opening a document
hands it to `@stapel/docs-react`'s document surface — this package declares no
`:id` route of its own, and the docs pair keeps `/files` and `/files/:id`.

Every part resolves through the slot registry, so a host replaces one without
forking the screen:

```ts
import { registerDriveSkinComponent } from "@stapel/drive-react/default";
registerDriveSkinComponent("thumbnail", MyHeaderTokenThumbnail);
```

Slots: `breadcrumbBar`, `rowActions`, `searchField`, `thumbnail`, `trashPane`,
`recentsPane`, `starredPane`, `uploadTray`.

## Headless

Every surface has a renderless twin — bring your own visuals:

```tsx
import { DriveList, matchList } from "@stapel/drive-react";

<DriveList workspaceId="ws-1" folderId={folderId}>
  {({ state, toggleStar }) =>
    matchList(state, { loading, failed, empty, ready: (rows) => … })}
</DriveList>
```

`DriveList` / `DriveGrid` (one bag, two renderings), `Starred`, `Recents`,
`DriveSearch`, `DriveBreadcrumb`, `UploadTray`, `DriveProvider`.

## The three decisions worth knowing

**One rung per request.** `useFolderChildren` reads
`GET /folders?parent_id=` — the children of ONE folder — and the document read
is already folder-scoped. Opening `/a/b/c` costs three folder reads, and a
sibling nobody opened is never fetched. The breadcrumb is normally free: the
navigation that descended already holds the trail, and a search hit arrives
with its container's chain materialized server-side. Only a cold deep link
falls back to the docs pair's ancestor walk.

**Progress is real.** `putWithProgress` (in `api/upload.ts`) is the one step
this package does not take from `@stapel/docs-react`, and only its transport
differs: same ticket, same `Content-Type`, same finalize. A non-2xx **resolves**
as `{ok, status}` rather than throwing, because the queue has to tell "the
store refused this file" from "the network died".

**A full workspace is not a failed upload.** `error.507.docs_workspace_quota`
gets its own banner with the two remedies, and the failed rows deliberately
offer no Retry — a button that cannot work is worse than no button.

## Sharing

`ShareSheetPanel` (a row's **Share** action, and a slot:
`registerDriveSkinComponent("shareSheet", …)`) draws
`@stapel/docs-react`'s headless `ShareSheet`. Two sections, because
stapel-docs has two independent grant sources and a deployment may enable
either, both or neither — and three things it is responsible for getting
right:

- a **switched-off mode's rows stay visible**, tagged Paused, under a banner
  saying they were not revoked. Hiding them tells an admin the access was
  taken away, and re-enabling the mode then restores access nobody expected;
- a **section the caller may not administer is absent**, not a dead form: both
  listings are themselves the capability gates, so a 403 is the answer;
- a **refused mint says which refusal it was.** `SHARING.LINK.MAX_LEVEL` is
  published by no endpoint in 0.6.1, so the sheet cannot check the ceiling
  before asking; it renders `error.400.docs_share_level`'s own sentence.

Share is offered on a **document**, not a folder — a folder has no `/access`
or `/links` route at all.

The bearer PAGE is not here. Its URL shape and chrome are host composition;
`@stapel/docs-react`'s `SharedDocumentView` is the seam it is built on. Pass
`shareLinkUrl` (on `DriveScreen` or `ShareSheetPanel`) to turn a minted token
into the URL your app serves — without it, Copy copies the bare token rather
than a guessed origin and path.

## i18n

English ships in the main entry (UI keys **and** the generated en floor for all
84 backend codes, so a host that registers only this pair still gets a sentence
for every refusal). `ru` and `es` are opt-in subpaths:

```ts
import { registerDriveI18nRu } from "@stapel/drive-react/i18n/ru";
registerDriveI18nRu(i18n); // after registerDriveI18n — the en floor stays under it
```

## Known gap (backend)

`GET /documents?folder_id=` is a `UUIDField`, so the wire has no spelling for
"the documents with no folder"; an absent parameter means the whole workspace.
At the workspace ROOT only, this package therefore filters `folder_id === null`
client-side. Inside a folder the server scopes it and the filter is a no-op.
A `parent_id`-style spelling (what `GET /folders` already has) would close it.
