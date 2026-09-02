/**
 * `@stapel/drive-react/default` — the phone-first Drive product skin (the
 * fleet's `/default` split, §54): a separate entry point so consumers who
 * bring their own visuals never pull `antd` into their bundle; importing this
 * subpath is the opt-in.
 *
 * What ships:
 *  - `DriveScreen` — the product: sticky breadcrumb bar, one scrolling column
 *    with a list/grid toggle, folder tap-through, a bottom action sheet per
 *    row, a FAB with the upload tray, and the Starred / Recent / Trash tabs.
 *  - The parts, each mountable on its own AND swappable through the slot
 *    registry: `DriveBreadcrumbBar`, `DriveRowActions`, `DriveSearchField`,
 *    `DriveThumbnail`, `StarredPane`, `RecentsPane`, `UploadTrayPanel`,
 *    `ShareSheetPanel`, `DriveTrashPane`.
 *
 * Two hard properties (fleet scars):
 *  - SELF-THEMING: every surface wraps itself in the SHARED `SkinTheme`
 *    (`@stapel/tokens-antd/skin`) — the live document mode via
 *    `useThemeMode()`, overridable with the `mode` prop, 44px controls on a
 *    phone — never inherits an unthemed host.
 *  - REPLACEABLE WITHOUT FORKING: every part resolves through
 *    `registerDriveSkinComponent`, and the trash pane is deliberately the
 *    docs pair's, not a second implementation of a solved screen.
 *
 * ```tsx
 * import { DriveScreen } from "@stapel/drive-react/default";
 * // under <DocsProvider> + <DriveProvider> + core's <I18nProvider>:
 * <DriveScreen workspaceId="ws-1" onOpenDocument={(id) => navigate(`/files/${id}`)} />
 * ```
 */
export {
  registerDriveSkinComponent,
  unregisterDriveSkinComponent,
  resolveDriveSkinComponent,
} from "./slots.js";
export type { DriveSkinSlots, DriveSkinSlotName } from "./slots.js";
export { DriveScreen } from "./DriveScreen.js";
export type { DriveScreenProps, DriveTab } from "./DriveScreen.js";
export { DriveBreadcrumbBar } from "./DriveBreadcrumbBar.js";
export type { DriveBreadcrumbBarProps } from "./DriveBreadcrumbBar.js";
export { DriveRowActions } from "./DriveRowActions.js";
export type { DriveRowActionsProps } from "./DriveRowActions.js";
export { DriveSearchField, SEARCH_DEBOUNCE_MS } from "./DriveSearchField.js";
export type { DriveSearchFieldProps } from "./DriveSearchField.js";
export { DriveThumbnail } from "./DriveThumbnail.js";
export type { DriveThumbnailProps } from "./DriveThumbnail.js";
export { StarredPane } from "./StarredPane.js";
export type { StarredPaneProps } from "./StarredPane.js";
export { RecentsPane } from "./RecentsPane.js";
export type { RecentsPaneProps } from "./RecentsPane.js";
export { ShareSheetPanel } from "./ShareSheetPanel.js";
export type { ShareSheetPanelProps } from "./ShareSheetPanel.js";
export { MediaLightboxPanel } from "./MediaLightboxPanel.js";
export type { MediaLightboxPanelProps } from "./MediaLightboxPanel.js";
export { ArchiveSheetPanel, entriesUnder } from "./ArchiveSheetPanel.js";
export type { ArchiveSheetPanelProps } from "./ArchiveSheetPanel.js";
export { UploadTrayPanel } from "./UploadTrayPanel.js";
export type { UploadTrayPanelProps } from "./UploadTrayPanel.js";
export { DriveTrashPane } from "./DriveTrashPane.js";
export type { DriveTrashPaneProps } from "./DriveTrashPane.js";
export {
  DRIVE_MEASURE,
  ROW_THUMBNAIL,
  TILE_THUMBNAIL,
  TILE_MIN_WIDTH,
  LIGHTBOX_MEDIA_HEIGHT,
  LIGHTBOX_SWIPE_THRESHOLD,
  ARCHIVE_PREVIEW_HEIGHT,
} from "./measure.js";
