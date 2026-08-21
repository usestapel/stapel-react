/**
 * PUT bytes at a URL that is not the Stapel API — the one step of an upload
 * that no generated client can carry.
 *
 * Three modules already do direct-to-storage uploads, under three DIFFERENT
 * contracts: cdn takes a multipart POST, docs opens a session and finalises
 * it (`createUpload` → PUT → `finalizeUpload`), recordings opens a session
 * with a size ceiling and an expiry. Those contracts are not the same thing
 * wearing three hats, and this file does not try to unify them.
 *
 * What IS the same in all three is the middle step, and it is the step where
 * the transport's assumptions stop holding: the presigned URL points at an
 * object store, so there is no `stapel_jwt` cookie to send (sending one would
 * leak it to a third party), no `Authorization` header, no JSON envelope
 * coming back, and no retry policy that makes sense. That is why the injected
 * {@link StapelClient} is the wrong instrument here and a bare `fetch` is the
 * right one.
 *
 * ── Why this folds the failure instead of returning it ──────────────────────
 *
 * `docs-react` and `recordings-react` both wrote the PUT as "resolve the raw
 * `Response`, let the caller branch". Both callers then had to reconstruct
 * the same thing — `docs`' mutation folds a non-2xx into
 * `StapelApiError{code: "stapel.http.<n>"}` (`model/mutations.ts`), and
 * `recordings` leaves it to the host, which is how a failed upload can be
 * awaited and then silently treated as done. A primitive that hands back a
 * failure in a shape nothing else in the system speaks is a primitive that
 * gets re-wrapped at every call site, differently.
 *
 * So a non-2xx throws, in the one dialect (`@stapel/core` errors.ts, "One
 * dialect"). The code is `stapel.http.<status>` because that is what the
 * store's status honestly is — its error body is XML or HTML, never a Stapel
 * envelope, and inventing a domain code for it would be a lie about who
 * failed. The floor in `i18n/coreErrors.ts` already has a sentence for every
 * class of that code, so a host renders it without knowing an upload was
 * involved.
 *
 * The resolved value is still the `Response`: a caller that needs the store's
 * `ETag` (multipart completion) or its `Location` has it, and nothing has to
 * re-read the body to find out whether it worked.
 */
import { StapelApiError } from "./errors.js";

/** Options for {@link putToForeignOrigin}. */
export interface PutToForeignOriginOptions {
  /** Sent as `Content-Type`. Omitted entirely when absent — a presigned URL
   * is often signed over the header set, and adding one the signature does
   * not cover is a 403 from the store. */
  readonly contentType?: string;
  /** Abort the upload mid-flight. */
  readonly signal?: AbortSignal;
  /** Inject a `fetch` (tests/SSR); defaults to `globalThis.fetch`. */
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * `PUT blob` at `url`, with none of the API transport's auth binding.
 *
 * Resolves to the raw {@link Response} on 2xx. Throws
 * `StapelApiError{code: "stapel.http.<status>"}` on anything else — see the
 * module doc for why the failure is folded here rather than at each call
 * site. A transport fault (the store unreachable, the request aborted) throws
 * whatever `fetch` throws: it never reached an HTTP outcome, and
 * `toStapelApiError` folds it as `stapel.transport.failed`, which is the
 * true statement.
 *
 * ```ts
 * const { upload } = await api.createUpload(draft);
 * await putToForeignOrigin(upload.put_url, file, { contentType: file.type });
 * await api.finalizeUpload(upload.upload_id);
 * ```
 */
export async function putToForeignOrigin(
  url: string,
  blob: Blob,
  options?: PutToForeignOriginOptions
): Promise<Response> {
  const doFetch = options?.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = {};
  if (options?.contentType !== undefined) {
    headers["Content-Type"] = options.contentType;
  }
  const response = await doFetch(url, {
    method: "PUT",
    body: blob,
    headers,
    ...(options?.signal !== undefined ? { signal: options.signal } : {}),
  });
  if (!response.ok) {
    throw new StapelApiError({
      code: `stapel.http.${String(response.status)}`,
      message: `PUT to a foreign origin failed with ${String(response.status)}`,
      status: response.status,
    });
  }
  return response;
}
