import type { StapelClient } from "@stapel/core";
import type {
  CdnDescribeResponse,
  CdnFileExistsResponse,
  CdnFileUploadResponse,
  CdnImageUploadResponse,
  CdnRef,
  CdnVideoUploadResponse,
} from "./types.js";

/**
 * `metadata.DESCRIBE_MANY_LIMIT` — how many refs one `POST /describe/` may
 * carry. Mirrored, not guessed: over it the server answers
 * `error.400.too_many_refs` with `count` and `max`, and the fix is mechanical
 * (page the batch), which is exactly the kind of refusal a client should never
 * make a person discover. `useDescribe` pages on this number.
 *
 * The ceiling exists because every snapshot may inline a preview, so batch size
 * IS response size.
 */
export const CDN_DESCRIBE_MAX_REFS = 50;

/**
 * The pair's typed operation surface — one method per stapel-cdn endpoint a
 * browser may call, bound to the injected {@link StapelClient} (the per-module
 * override seam of frontend-standard §7.2). Paths are relative to the
 * runtime's `baseUrl` (`/cdn/api/v1/`).
 *
 * ── The two endpoints that are NOT here, and why ───────────────────────────
 *
 * `POST /refs/sync/` is `IsServiceRequest`: it is how one BACKEND tells the
 * CDN that an entity now references a set of media, and a browser cannot
 * authenticate as a service. A pair that exposed it would invite a screen to
 * call something that can only answer 403 (`stapel_cdn/views.py`, RefSyncView).
 * Reference bookkeeping is the consuming module's server-side job — the
 * storefront's part is to hand `images_draft` to stapel-listings and let it
 * sync.
 *
 * `GET /images/{image_type}/random/` is `IsStaffUser` and exists to let an
 * admin UI grab a test image. Same argument.
 *
 * Both stay in the generated schema (and therefore in `manifest.json`, which
 * lists the whole contract), so nothing is hidden; they are simply not this
 * pair's surface.
 *
 * ── Upload is a POST of `multipart/form-data`, not a presigned PUT ─────────
 *
 * This is the whole reason `@stapel/core`'s `putToForeignOrigin` does not
 * appear anywhere in this package. That primitive exists for the docs and
 * recordings contracts, which open a session and hand back a URL at an object
 * store. stapel-cdn takes the bytes itself, through the same authenticated
 * origin as every other call, so the injected client IS the right instrument
 * here and there is no foreign origin to PUT to. Three upload implementations,
 * three contracts (spec §1.6) — the bones core extracted are the ones the
 * OTHER two share.
 */
export interface CdnApi {
  readonly client: StapelClient;

  /**
   * Has the CDN already got these bytes?
   *
   * The dedup pre-check, and the pair's only read. Answers `200` either way:
   * `{exists: false, type: null, file: null}` is a successful answer, not an
   * error — "we asked and there is none" (`FileExistsView`).
   *
   * OWNER-SCOPED, ALWAYS. The view filters on `uploaded_by=request.user`
   * unconditionally, unlike the upload paths, which honour
   * `STAPEL_CDN["DEDUP_SCOPE"]`. Two consequences the flow in `model/upload.ts`
   * is built around: (a) a miss here does NOT mean the upload will store new
   * bytes — under `DEDUP_SCOPE: "global"` the POST may still answer "already
   * exists"; (b) a buyer cannot resolve a seller's reference through this
   * endpoint, so it is a re-open-your-own-draft read, never a public one.
   *
   * `IsAuthenticated | IsServiceRequest` — note that this is STRICTER than the
   * upload endpoints, which take `IsNotAnonymousUser` (a guest identity is
   * enough). A guest can therefore upload but not pre-check, which is why a
   * 401 here is a skipped optimisation rather than a failed upload.
   */
  fileExists(
    fileHash: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CdnFileExistsResponse>;

  /**
   * `POST /describe/` — render metadata for up to
   * {@link CDN_DESCRIBE_MAX_REFS} refs (stapel-cdn 0.17.0).
   *
   * THE READ THIS PAIR DID NOT HAVE. Until 0.17 `describe` was a comm Function
   * only: a browser could see `render_meta` for something it had just uploaded
   * itself and for nothing else, so a chat bubble holding somebody else's
   * `<prefix>/<hash>` had nothing to draw with and an attachment renderer was
   * not expressible. This is that transport, and the contract is unchanged —
   * the endpoint and the comm Function are two doors onto one function.
   *
   * NOT OWNER-SCOPED, unlike {@link fileExists}. The default guard is
   * `IsAuthenticatedOrService`, and the snapshot carries no uploader, no
   * filename and no reference list — geometry, duration and a bounded inline
   * preview. That is what lets it answer for a ref the caller did not upload,
   * which is the entire case it exists for.
   *
   * UNKNOWN REFS ARE DATA. Deleted, never stored, or malformed all come back in
   * `missing` with a 200, so one dead attachment never costs a page its other
   * thirty-nine. A caller that treats `missing` as an error re-invents the
   * failure this contract exists to avoid.
   *
   * Duplicates collapse server-side BEFORE the ceiling is applied.
   */
  describe(
    refs: readonly CdnRef[],
    options?: { readonly signal?: AbortSignal }
  ): Promise<CdnDescribeResponse>;

  /**
   * `POST /upload/image/` — the general image intake (`IsNotAnonymousUser`).
   *
   * Answers `201` for stored bytes and `200` for a server-side dedup hit, with
   * the SAME body either way. The pair does not report which: `StapelClient`
   * resolves a body, not a status, and the only in-body difference is the
   * English `message` string, which is not a contract. Dedup is therefore
   * reported from the pre-check (which is a contract) and from nowhere else —
   * see `model/upload.ts`.
   *
   * The stored row's `type` is `"product"`, hardcoded in the view.
   */
  uploadImage(
    file: File,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CdnImageUploadResponse>;

  /**
   * `POST /upload/avatar/` — the same intake with `type="avatar"`, and the one
   * upload endpoint that requires a real `IsAuthenticated` principal. This is
   * what `profiles-react`'s `useSetAvatar` calls (today through its own
   * documented stopgap, `api/cdnAvatarApi.ts`, which this pair exists to
   * replace).
   */
  uploadAvatar(
    file: File,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CdnImageUploadResponse>;

  /**
   * `POST /images/{image_type}/upload/` — an image stored under a caller-named
   * type, validated against `STAPEL_CDN["ASSET_TYPES"]`.
   *
   * Refuses `error.400.invalid_image_type` for a type this deployment does not
   * declare. Note the asymmetry with {@link uploadImage}, which writes
   * `"product"` without consulting that setting at all: on a default
   * deployment `POST /images/product/upload/` is a 400 while
   * `POST /upload/image/` happily stores a `product` row. A host that wants
   * `product` addressable by name adds it to `ASSET_TYPES`.
   */
  uploadTypedImage(
    imageType: string,
    file: File,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CdnImageUploadResponse>;

  /**
   * `POST /upload/video/`. Typed and callable; this pair ships no hook and no
   * widget over it (the storefront MVP is images), so a host that needs video
   * today calls it directly rather than waiting for a version of the pair that
   * has the queue for it. Variants are not generated yet upstream — the
   * response's `is_processed` stays false and the ladder is empty.
   */
  uploadVideo(
    file: File,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CdnVideoUploadResponse>;

  /**
   * `POST /upload/file/` — documents and archives. Same status as
   * {@link uploadVideo}: typed, callable, no hook. Its allowlist is a MIME
   * allowlist as well as an extension one, and deliberately excludes
   * `application/octet-stream`.
   */
  uploadFile(
    file: File,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CdnFileUploadResponse>;
}

/**
 * The one multipart body every upload endpoint takes: a single `file` part.
 * `FormData` is a `BodyInit`, so `StapelClient` sends it verbatim and lets the
 * browser write the `Content-Type` boundary — setting that header by hand is
 * the classic way to make a multipart POST unparseable server-side.
 */
function filePart(file: File): FormData {
  const form = new FormData();
  form.append("file", file);
  return form;
}

const signalOf = (options?: {
  readonly signal?: AbortSignal;
}): { signal?: AbortSignal } =>
  options?.signal !== undefined ? { signal: options.signal } : {};

export function createCdnApi(client: StapelClient): CdnApi {
  return {
    client,

    fileExists: (fileHash, options) =>
      client.get("/file/exists/", {
        query: { file_hash: fileHash },
        ...signalOf(options),
      }),

    describe: (refs, options) =>
      client.post("/describe/", { refs: [...refs] }, signalOf(options)),

    uploadImage: (file, options) =>
      client.post("/upload/image/", filePart(file), signalOf(options)),

    uploadAvatar: (file, options) =>
      client.post("/upload/avatar/", filePart(file), signalOf(options)),

    uploadTypedImage: (imageType, file, options) =>
      client.post(
        `/images/${encodeURIComponent(imageType)}/upload/`,
        filePart(file),
        signalOf(options)
      ),

    uploadVideo: (file, options) =>
      client.post("/upload/video/", filePart(file), signalOf(options)),

    uploadFile: (file, options) =>
      client.post("/upload/file/", filePart(file), signalOf(options)),
  };
}
