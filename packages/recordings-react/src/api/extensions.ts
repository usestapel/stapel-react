/**
 * Hand-authored API surface the codegen does not (yet) cover — the direct
 * media upload to the session's presigned storage URL and small domain guards.
 * Everything that CAN be derived from schema.json belongs in the generated
 * operations (`api/recordingsApi.ts`), not here.
 */
import type { UploadSession } from "./types.js";

/** Options for {@link uploadRecordingBlob}. */
export interface UploadBlobOptions {
  /** Inject a `fetch` (tests/SSR); defaults to `globalThis.fetch`. */
  readonly fetch?: typeof globalThis.fetch;
  /** Abort the upload mid-flight. */
  readonly signal?: AbortSignal;
  /** MIME type sent as `Content-Type` (e.g. `audio/webm`). */
  readonly contentType?: string;
}

/**
 * PUT the media blob to a recording's single-PUT upload session
 * (`UploadSessionDTO.presigned_url`). This is the connective step between
 * `createRecording` (opens the session) and `finalizeUpload` (enqueues the
 * pipeline): create → **upload** → finalize.
 *
 * The presigned URL points at the object store (a DIFFERENT origin from the
 * stapel API, no `stapel_jwt` cookie, no JSON envelope), so this is a raw `PUT`
 * NOT routed through the injected {@link StapelClient} — hence its home in the
 * `api/` fetch carve-out rather than a client operation. Guards `max_size_bytes`
 * up front (the same limit the backend enforces with
 * `error.413.recording_too_large`) so an over-size blob fails locally, before a
 * wasted round-trip. Resolves to the raw `Response`; a non-2xx is left for the
 * caller to branch on (the store's error body is not a `StapelApiError`).
 *
 * ```ts
 * const { recording, upload } = await api.createRecording(draft);
 * await uploadRecordingBlob(upload, file, { contentType: file.type });
 * await api.finalizeUpload(recording.id, { file_size_bytes: file.size });
 * ```
 */
export async function uploadRecordingBlob(
  session: Pick<UploadSession, "presigned_url" | "max_size_bytes">,
  blob: Blob,
  options?: UploadBlobOptions
): Promise<Response> {
  if (blob.size > session.max_size_bytes) {
    throw new RangeError(
      `recording blob is ${blob.size} bytes, over the session limit of ${session.max_size_bytes}`
    );
  }
  const doFetch = options?.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = {};
  if (options?.contentType !== undefined) {
    headers["Content-Type"] = options.contentType;
  }
  return doFetch(session.presigned_url, {
    method: "PUT",
    body: blob,
    headers,
    ...(options?.signal !== undefined ? { signal: options.signal } : {}),
  });
}

/**
 * Has a single-PUT upload session's window closed? A client-side gate for the
 * upload control (`UploadSessionDTO.expires_at`, an ISO 8601 instant): once
 * expired the presigned URL is dead and the host should re-`createRecording`
 * rather than PUT into a stale session. `now` defaults to the current time.
 */
export function isUploadExpired(
  session: Pick<UploadSession, "expires_at">,
  now: Date = new Date()
): boolean {
  return new Date(session.expires_at).getTime() <= now.getTime();
}
