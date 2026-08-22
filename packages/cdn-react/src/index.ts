/**
 * `@stapel/cdn-react` — the headless React pair for stapel-cdn
 * (frontend-standard §2). Business + state only, zero visual opinion; the antd
 * skin lives behind the `./default` subpath, so a host that renders its own
 * upload control carries none of it.
 *
 * ── The one-liner ──────────────────────────────────────────────────────────
 *
 * ```tsx
 * const runtime = createCdnRuntime({ baseUrl: "/cdn/api/v1/" });
 * <CdnProvider runtime={runtime}>
 *   <MediaUploader max={10} onRefsChange={setImagesDraft}>
 *     {(bag) => <YourGrid bag={bag} />}
 *   </MediaUploader>
 * </CdnProvider>
 * ```
 *
 * ── The three properties this pair exists to guarantee ─────────────────────
 *
 * 1. **Dedup happens before the bytes move.** The flow hashes the file, asks
 *    `file/exists/`, and on a hit returns the reference having sent NOTHING.
 *    That is the property the storefront spec asks to be proven, and
 *    `test/dedup.test.ts` proves it by counting requests. The pre-check is an
 *    optimisation, so it is never allowed to fail the upload: a guest (401 —
 *    the endpoint is stricter than the upload endpoints), a page with no
 *    `crypto.subtle`, or a check that simply errors all fall through to the
 *    POST and say so in `dedupSkipped`.
 * 2. **The unit handed out is the reference, not a URL.** `<type>/<hash>` is
 *    what `Profile.avatar` and `Listing.images_draft` store, and it is opaque:
 *    the pair does not build URLs out of it and neither should a caller. The
 *    row that comes back carries the URLs, and `toStapelImage` converts its
 *    ladder for `@stapel/image` in the single place that knows the two
 *    contracts spell `tier` differently.
 * 3. **A switched-off control states its reason.** `canAdd` and `settled` are
 *    `ActionAvailability`, so "the gallery is full", "wait for the uploads"
 *    and "retry the ones that failed" are three different sentences rather
 *    than one grey button.
 *
 * ── What this pair does NOT do ─────────────────────────────────────────────
 *
 * No progress percentage: `fetch` cannot observe request-body progress and
 * `crypto.subtle` reports nothing mid-digest, so the bag names the PHASE and a
 * skin shows an indeterminate indicator. Forking onto `XMLHttpRequest` to get
 * a number would mean a second transport with its own auth, refresh and error
 * handling — the exact duplication this package was extracted to end.
 *
 * No `refs/sync/`: that endpoint is `IsServiceRequest` and unreachable from a
 * browser by construction. Reference bookkeeping belongs to the module that
 * owns the entity.
 *
 * No public read-by-reference: `file/exists/` is owner-scoped, so `useCdnRef`
 * resolves the CALLER's own references (a reopened draft) and cannot render a
 * stranger's gallery. Recorded as an upstream gap in the README rather than
 * worked around with a URL convention this pair would have invented.
 *
 * Layers: api → model → headless → i18n. Generated surfaces (the typed schema,
 * the error map, the manifest, llms.txt) are produced by the monorepo `gen:*`
 * drivers from stapel-cdn's own `docs/` artifacts and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createCdnApi } from "./api/cdnApi.js";
export type { CdnApi } from "./api/cdnApi.js";
export type {
  CdnFileExistsResponse,
  CdnFileKind,
  CdnFileModel,
  CdnFileUploadResponse,
  CdnImage,
  CdnImageUploadResponse,
  CdnRef,
  CdnVariantMeta,
  CdnVideo,
  CdnVideoUploadResponse,
  ParsedCdnRef,
  Schemas,
} from "./api/types.js";

// ── model: the flow, the mirror, the reference ───────────────────────────────
export { createCdnRuntime } from "./model/runtime.js";
export type { CdnRuntime, CreateCdnRuntimeOptions } from "./model/runtime.js";
export {
  CdnRuntimeContext,
  useCdnAnalytics,
  useCdnApi,
  useCdnRuntime,
} from "./model/context.js";
export { cdnQueryKeys } from "./model/queryKeys.js";
export { useCdnRef } from "./model/queries.js";
export type { CdnRefBag } from "./model/queries.js";
export {
  isUploadCanceled,
  runUpload,
  targetAssetType,
  UploadCanceled,
} from "./model/upload.js";
export type {
  CdnUploadTarget,
  CdnVariantWaitOptions,
  DedupSkipReason,
  RunUploadOptions,
  UploadOutcome,
  UploadPhase,
} from "./model/upload.js";
export {
  acceptAttribute,
  CDN_DEFAULT_LIMITS,
  ERROR_FILE_TOO_LARGE,
  ERROR_INVALID_FORMAT,
  ERROR_NO_FILE,
  fileExtension,
  resolveCdnLimits,
  validateFile,
} from "./model/limits.js";
export type {
  CdnIntakeLimits,
  CdnLimits,
  CdnLimitsOverride,
} from "./model/limits.js";
export { formatCdnRef, parseCdnRef, refOf, toStapelImage } from "./model/refs.js";
export { canHashLocally, sha256Hex } from "./model/hash.js";

// ── headless ─────────────────────────────────────────────────────────────────
export { CdnProvider } from "./headless/CdnProvider.js";
export { ImageUpload } from "./headless/ImageUpload.js";
export { MediaUploader } from "./headless/MediaUploader.js";
export { useUploadImage } from "./headless/useUploadImage.js";
export type { UploadImageBag } from "./headless/useUploadImage.js";
export { useUploadQueue } from "./headless/useUploadQueue.js";
export type {
  UploadItem,
  UploadQueueBag,
  UseUploadQueueOptions,
} from "./headless/useUploadQueue.js";
export { smallestVariantUrl, useUploadPreview } from "./headless/useUploadPreview.js";
export type { UploadPreview } from "./headless/useUploadPreview.js";

// ── flows (zero-flow shim — stapel-cdn annotates none) ───────────────────────
export { CDN_FLOWS, flowEndpoints } from "./flows/registry.js";
export type { CdnFlowId, CdnFlowSpec, FlowEndpoint } from "./flows/registry.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export { CDN_I18N_KEYS, cdnI18nBundleEn, registerCdnI18n } from "./i18n/keys.js";
export {
  CDN_ERROR_CODES,
  CDN_ERRORS,
  cdnErrorBundleEn,
  explainCdnError,
} from "./i18n/errorsMap.js";
export type {
  CdnErrorCode,
  CdnErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
