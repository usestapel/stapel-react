/**
 * `@stapel/drive-react` — the phone-first Drive PRODUCT surface over
 * stapel-docs 0.6.
 *
 * ── What this package is, in one paragraph ────────────────────────────────
 *
 * `@stapel/docs-react` is the headless pair for stapel-docs plus a
 * desktop-ish file-manager skin. This package is the opinionated product on
 * top of it: the surfaces stapel-docs 0.5.0 added (starred, recents, name
 * search, image thumbnails), the one machine a drive needs that a pair does
 * not (a multi-file upload queue with real per-file progress), a share sheet
 * drawn over that pair's 0.6 share axis, and a single-column phone-first
 * screen that composes them with the docs pair's existing rows, dialogs and
 * trash. It peer-depends on `@stapel/docs-react`
 * and duplicates NOTHING of it — no second client, no second folder model, no
 * second trash. Adding a second implementation of a shipped surface is the
 * integration-seam defect this whole design exists to avoid.
 *
 * ── The five operations this package owns ─────────────────────────────────
 *
 * `POST/DELETE /documents|folders/:id/star`, `GET /starred`, `GET /recents`,
 * `GET /search?q=`, `GET /documents/:id/thumbnail?tier=` — plus one rung read
 * (`GET /folders?parent_id=`) the docs client cannot express, and one
 * transport (`XMLHttpRequest` at the presigned `put_url`) that `fetch` cannot
 * provide because it cannot observe request-body progress.
 *
 * CONTRACT: generated against stapel-docs' own committed artifacts at the
 * PINNED v0.6.1 ref — `src/api/generated/schema.ts`,
 * `src/i18n/generated/errors*.ts` (84 codes, en/ru/es) and `manifest.json` +
 * `llms.txt` are emitted by the root `gen:*` drivers and drift-gated.
 *
 * MOUNTING: `<DriveProvider>` goes inside `<DocsProvider>`; both runtimes take
 * the SAME `baseUrl` (`/docs/api/v1/`), because these are one module's
 * endpoints.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createDriveApi } from "./api/driveApi.js";
export type { DriveApi, DriveApiOptions } from "./api/driveApi.js";
export { thumbnailUrl } from "./api/thumbnails.js";
export { putWithProgress } from "./api/upload.js";
export type {
  PutProgress,
  PutProgressOptions,
  PutProgressResult,
} from "./api/upload.js";
export { THUMBNAIL_TIERS } from "./api/types.js";
export { fetchArchiveEntry, ARCHIVE_PASSWORD_HEADER } from "./api/archive.js";
export type {
  ArchiveEntryBytes,
  ArchiveRawTransport,
  FetchArchiveEntryOptions,
} from "./api/archive.js";
export type {
  Schemas,
  ArchiveEntry,
  ArchiveListing,
  DriveBreadcrumbNode,
  DriveSearchHit,
  DriveSearchParams,
  StarredListing,
  StarTarget,
  StarTargetKind,
  ThumbnailTier,
} from "./api/types.js";

// ── model (runtime wiring, query keys, context, hooks) ───────────────────────
export { createDriveRuntime } from "./model/runtime.js";
export type { DriveRuntime, CreateDriveRuntimeOptions } from "./model/runtime.js";
export {
  DriveRuntimeContext,
  useDriveRuntime,
  useDriveApi,
  useDriveAnalytics,
} from "./model/context.js";
export { driveQueryKeys } from "./model/queryKeys.js";
export {
  useArchiveListing,
  useFolderChildren,
  useStarred,
  useRecents,
  useDriveSearch,
} from "./model/queries.js";
export { viewerKindFor } from "./model/viewers.js";
export type { ViewerKind } from "./model/viewers.js";
export { useToggleStar } from "./model/mutations.js";
export type { ToggleStarVariables } from "./model/mutations.js";
export {
  hasImagePreview,
  thumbnailTierFor,
  useThumbnailUrl,
} from "./model/thumbnails.js";
export {
  DEFAULT_UPLOAD_CONCURRENCY,
  useUploadQueue,
} from "./model/uploadQueue.js";
export type {
  UploadItem,
  UploadItemStatus,
  UploadQueueBag,
  UploadQueueOptions,
} from "./model/uploadQueue.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { DriveProvider } from "./headless/DriveProvider.js";
export { DriveList, DriveGrid } from "./headless/DriveList.js";
export type { DriveListBag } from "./headless/DriveList.js";
export { Starred } from "./headless/Starred.js";
export type { StarredBag } from "./headless/Starred.js";
export { Recents } from "./headless/Recents.js";
export type { RecentsBag } from "./headless/Recents.js";
export { DriveSearch } from "./headless/DriveSearch.js";
export type { DriveSearchBag } from "./headless/DriveSearch.js";
export { DriveBreadcrumb } from "./headless/DriveBreadcrumb.js";
export type { BreadcrumbBag } from "./headless/DriveBreadcrumb.js";
export { UploadTray } from "./headless/UploadTray.js";
export type { UploadTrayBag } from "./headless/UploadTray.js";
export { driveRows, folderRow, documentRow } from "./headless/rows.js";
export type { DriveRow } from "./headless/rows.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  DRIVE_I18N_KEYS,
  driveI18nBundleEn,
  registerDriveI18n,
} from "./i18n/keys.js";
export type { DriveI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated post-contract) ─
export {
  DRIVE_ERRORS,
  DRIVE_ERROR_CODES,
  driveErrorBundleEn,
  explainDriveError,
} from "./i18n/errorsMap.js";
export type {
  DriveErrorCode,
  DriveErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
