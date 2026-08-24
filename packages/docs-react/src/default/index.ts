/**
 * `@stapel/docs-react/default` — the default skin for this pair (mirrors the
 * fleet's `/default` split, §54): a separate entry point so consumers who
 * bring their own visuals never pull `antd` into their bundle; importing
 * this subpath is the opt-in.
 *
 * What ships (owner directive: docs get good default skins):
 *  - `FileManager` — folder tree + document list + breadcrumbs + trash as
 *    one composable surface, with right-click context menus wired 1:1 to
 *    the server's operations (rename / move / trash / restore / download /
 *    version history — no duplicate item: stapel-docs has no duplicate
 *    endpoint).
 *  - `RevisionsModal` — history list, inline preview, rollback-as-new-head.
 *  - `DocSurface` + default editors (text / markdown source / CSV table)
 *    riding the `DocEditor` If-Match bag, and `FileCard` for download-only.
 *
 * Two hard properties (fleet scars):
 *  - SELF-THEMING: every surface wraps itself in the SHARED `SkinTheme`
 *    (`@stapel/tokens-antd/skin`) — the live document mode via
 *    `useThemeMode()`, overridable with the `mode` prop, 44px controls on a
 *    phone — never inherits an unthemed host (tracker #26's 1.00:1
 *    contrast). The pair's own `theme.tsx` copy and its local `ErrorAlert`
 *    are deleted: the substrate owns both, so the fleet-wide fixes land
 *    once instead of nine times.
 *  - REPLACEABLE WITHOUT FORKING: every part resolves through the skin slot
 *    registry (`registerDocsSkinComponent`), and editors additionally
 *    respect the editor registry (`registerDocEditor` wins in `DocSurface`).
 *
 * ```tsx
 * import { FileManager, DocSurface } from "@stapel/docs-react/default";
 * // under this pair's <DocsProvider> + core <I18nProvider>:
 * <FileManager workspaceId="ws-1" onOpenDocument={(d) => navigate(d.id)} />
 * <DocSurface documentId={docId} />
 * ```
 */
export {
  registerDocsSkinComponent,
  unregisterDocsSkinComponent,
  resolveDocsSkinComponent,
} from "./slots.js";
export type { DocsSkinSlots, DocsSkinSlotName } from "./slots.js";
export { FileManager, FOLDER_PANE_WIDTH } from "./FileManager.js";
export type { FileManagerProps } from "./FileManager.js";
export { FolderTreePane } from "./FolderTreePane.js";
export type { FolderTreePaneProps } from "./FolderTreePane.js";
export { DocumentListPane } from "./DocumentListPane.js";
export type { DocumentListPaneProps } from "./DocumentListPane.js";
export { FileManagerBreadcrumbs } from "./FileManagerBreadcrumbs.js";
export type { FileManagerBreadcrumbsProps } from "./FileManagerBreadcrumbs.js";
export { TrashPane } from "./TrashPane.js";
export type { TrashPaneProps } from "./TrashPane.js";
export { RevisionsModal, REVISIONS_MODAL_WIDTH } from "./RevisionsModal.js";
export type { RevisionsModalProps } from "./RevisionsModal.js";
export { DocSurface } from "./DocSurface.js";
export type { DocSurfaceProps } from "./DocSurface.js";
export {
  EditorChrome,
  DefaultTextEditor,
  DefaultMarkdownEditor,
  DefaultCsvEditor,
} from "./editors.js";
export { FileCard } from "./FileCard.js";
export type { FileCardProps } from "./FileCard.js";
export { NameDialog, MoveDialog, NewDocumentDialog } from "./dialogs.js";
export type {
  NameDialogProps,
  MoveDialogProps,
  NewDocumentDialogProps,
} from "./dialogs.js";
export { useSplitLayout, SPLIT_STACK_WIDTH } from "./useSplitLayout.js";
export type { SplitLayout } from "./useSplitLayout.js";
