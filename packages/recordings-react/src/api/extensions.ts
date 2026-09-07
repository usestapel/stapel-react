/**
 * Hand-authored API surface the codegen does not (yet) cover — the direct
 * media upload to the session's presigned storage URL and small domain guards.
 * Everything that CAN be derived from schema.json belongs in the generated
 * operations (`api/recordingsApi.ts`), not here.
 */
import { StapelApiError, putToForeignOrigin } from "@stapel/core";
import type { UploadLimits, UploadSession } from "./types.js";

/**
 * Why an upload was refused BEFORE any bytes left the browser.
 *
 * A reason, not a sentence: this layer has no i18n and should not acquire it
 * (the layer order is api → model → flows → headless → i18n). The headless
 * layer maps a reason to its key, so the copy stays translatable and this file
 * stays a transport.
 */
export type UploadPreflightReason =
  | "too_large"
  | "session_expired"
  | "unsupported_type";

/**
 * The upload cannot start — the file is over the ceiling this deployment
 * accepts, or the session's window has closed. Thrown instead of a bare
 * `RangeError` so a UI can name WHICH of them happened without parsing a
 * message.
 *
 * `sizeBytes` / `limitBytes` travel with a `too_large`, because the whole
 * reason `GET /recordings/upload-limits` exists is that a refusal can now say
 * the two numbers instead of "too big". A skin formats them; this layer has no
 * i18n and acquires none.
 */
export class UploadPreflightError extends Error {
  readonly reason: UploadPreflightReason;
  /** The file's own size, when the refusal is about a size. */
  readonly sizeBytes: number | undefined;
  /** The ceiling it broke, in the same unit. */
  readonly limitBytes: number | undefined;

  constructor(
    reason: UploadPreflightReason,
    message: string,
    numbers?: { readonly sizeBytes?: number; readonly limitBytes?: number }
  ) {
    super(message);
    this.name = "UploadPreflightError";
    this.reason = reason;
    this.sizeBytes = numbers?.sizeBytes;
    this.limitBytes = numbers?.limitBytes;
  }
}

/** How far along a media upload is. Bytes, not a percentage: a caller that
 * wants "37 %" can divide, and a caller that wants "12.4 MB of 33 MB" cannot
 * get the bytes back out of a percentage. */
export interface UploadProgress {
  readonly loaded: number;
  readonly total: number;
  /** `loaded / total`, clamped to 0…1. `0` when the total is not yet known. */
  readonly ratio: number;
}

/** Options for {@link uploadRecordingBlob}. */
export interface UploadBlobOptions {
  /** Inject a `fetch` (tests/SSR); defaults to `globalThis.fetch`. Only used
   * on the no-progress path — see {@link UploadBlobOptions.onProgress}. */
  readonly fetch?: typeof globalThis.fetch;
  /** Abort the upload mid-flight. */
  readonly signal?: AbortSignal;
  /** MIME type sent as `Content-Type` (e.g. `audio/webm`). */
  readonly contentType?: string;
  /**
   * Called as bytes leave the browser. Progress is the reason this upload does
   * NOT go through `fetch`: a `fetch` PUT reports nothing until it finishes, so
   * a meeting-length recording is a frozen button for minutes. `XMLHttpRequest`
   * is the only transport that emits upload progress in every browser we
   * support, so passing this switches to it; without it the request goes
   * through core's `putToForeignOrigin` unchanged.
   */
  readonly onProgress?: (progress: UploadProgress) => void;
}

/**
 * MIME prefixes this module's INGEST accepts, which is not the same list as
 * what it stores. A video container is still a legal upload — it is transport,
 * and the pipeline extracts its audio track and discards the rest (see
 * {@link UploadLimits}) — so refusing one here would refuse a file the backend
 * would have taken.
 *
 * A local pre-check only: the backend's answer
 * (`error.415.recording_unsupported_media`) is authoritative, and a blob with
 * no `type` at all is NOT rejected here — browsers omit it often enough that
 * refusing on absence would block real uploads.
 */
const ACCEPTED_MEDIA_PREFIXES = ["audio/", "video/"];

/**
 * Is this MIME type one the pipeline plausibly accepts? `""`/`undefined`
 * answers `true`: an unknown type is the backend's call to make, and refusing
 * it locally would turn a browser quirk into a dead upload button.
 */
export function isAcceptedMediaType(contentType?: string): boolean {
  if (contentType === undefined || contentType === "") return true;
  return ACCEPTED_MEDIA_PREFIXES.some((prefix) => contentType.startsWith(prefix));
}

/**
 * The `accept` attribute for a file input, from the deployment's own allowlist.
 *
 * With limits in hand this is the deployment's `allowed_extensions` — the same
 * list `error.415.recording_unsupported_media` enforces — so the picker offers
 * exactly what will be taken. Without them (the read has not landed, or a host
 * never made it) it falls back to the MIME prefixes above rather than to
 * nothing: a picker that filters on a list it does not have is a picker that
 * shows no files at all.
 */
export function uploadAccept(limits?: UploadLimits | null): string {
  const extensions = limits?.allowed_extensions ?? [];
  if (extensions.length === 0) return ACCEPTED_MEDIA_PREFIXES.map((p) => `${p}*`).join(",");
  return extensions.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`)).join(",");
}

/**
 * Is this filename's extension one the deployment allows? `true` whenever
 * there is no allowlist to check against — the backend is the authority, and a
 * pair that has not read the limits yet must not invent a refusal.
 */
export function isAllowedUploadName(
  filename: string,
  limits?: UploadLimits | null
): boolean {
  const extensions = limits?.allowed_extensions ?? [];
  if (extensions.length === 0) return true;
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return false;
  const found = filename.slice(dot + 1).toLowerCase();
  return extensions.some(
    (ext) => (ext.startsWith(".") ? ext.slice(1) : ext).toLowerCase() === found
  );
}

/**
 * What an hour of recording costs this deployment in STORED bytes.
 *
 * Not the file's own size: while `audio_only_ingest` is on, the container is
 * transport and what survives is the mono track at the deployment's audio
 * profile, so the honest number to show someone planning a long meeting is
 * this one. `hours` may be fractional.
 */
export function storedBytesForHours(limits: UploadLimits, hours: number): number {
  return Math.round(limits.stored_bytes_per_hour * Math.max(0, hours));
}

/**
 * PUT the media blob to a recording's single-PUT upload session
 * (`UploadSessionDTO.presigned_url`). This is the connective step between
 * `createRecording` (opens the session) and `finalizeUpload` (enqueues the
 * pipeline): create → **upload** → finalize.
 *
 * The presigned URL points at the object store (a DIFFERENT origin from the
 * stapel API, no `stapel_jwt` cookie, no JSON envelope), so this is a raw `PUT`
 * NOT routed through the injected `StapelClient` — hence its home in the
 * `api/` fetch carve-out rather than a client operation. Guards
 * `max_size_bytes` up front (the same limit the backend enforces with
 * `error.413.recording_too_large`) so an over-size blob fails locally, before a
 * wasted round-trip.
 *
 * A non-2xx from the store THROWS `StapelApiError{code:"stapel.http.<status>"}`
 * — one dialect, the same one `putToForeignOrigin` speaks. Returning a raw
 * `Response` (as this did before) is how a failed upload gets awaited and then
 * treated as done.
 *
 * ```ts
 * const { recording, upload } = await api.createRecording(draft);
 * await uploadRecordingBlob(upload, file, {
 *   contentType: file.type,
 *   onProgress: ({ ratio }) => setProgress(ratio),
 * });
 * await api.finalizeUpload(recording.id, { file_size_bytes: file.size });
 * ```
 */
export async function uploadRecordingBlob(
  session: Pick<UploadSession, "presigned_url" | "max_size_bytes">,
  blob: Blob,
  options?: UploadBlobOptions
): Promise<Response> {
  if (blob.size > session.max_size_bytes) {
    throw new UploadPreflightError(
      "too_large",
      `recording blob is ${String(blob.size)} bytes, over the session limit of ${String(session.max_size_bytes)}`,
      { sizeBytes: blob.size, limitBytes: session.max_size_bytes }
    );
  }
  if (options?.onProgress === undefined || typeof XMLHttpRequest === "undefined") {
    return putToForeignOrigin(session.presigned_url, blob, {
      ...(options?.contentType !== undefined
        ? { contentType: options.contentType }
        : {}),
      ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      ...(options?.fetch !== undefined ? { fetch: options.fetch } : {}),
    });
  }
  return putWithProgress(session.presigned_url, blob, options);
}

/**
 * The `XMLHttpRequest` half of {@link uploadRecordingBlob}: identical contract
 * (2xx resolves to a `Response`, anything else throws the same
 * `StapelApiError`), plus `upload.onprogress`.
 */
function putWithProgress(
  url: string,
  blob: Blob,
  options: UploadBlobOptions
): Promise<Response> {
  const { onProgress, contentType, signal } = options;
  return new Promise<Response>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url, true);
    if (contentType !== undefined) {
      request.setRequestHeader("Content-Type", contentType);
    }
    const abort = (): void => {
      request.abort();
    };
    if (signal !== undefined) {
      if (signal.aborted) {
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
    }
    const done = (): void => {
      signal?.removeEventListener("abort", abort);
    };
    if (onProgress !== undefined) {
      request.upload.onprogress = (event): void => {
        const total = event.lengthComputable ? event.total : blob.size;
        onProgress({
          loaded: event.loaded,
          total,
          ratio: total > 0 ? Math.min(1, Math.max(0, event.loaded / total)) : 0,
        });
      };
    }
    request.onload = (): void => {
      done();
      if (request.status >= 200 && request.status < 300) {
        onProgress?.({ loaded: blob.size, total: blob.size, ratio: 1 });
        resolve(
          new Response(request.response as BodyInit | null, {
            status: request.status,
          })
        );
        return;
      }
      reject(
        new StapelApiError({
          code: `stapel.http.${String(request.status)}`,
          message: `PUT to a foreign origin failed with ${String(request.status)}`,
          status: request.status,
        })
      );
    };
    request.onerror = (): void => {
      done();
      reject(new TypeError("recording upload failed to reach the object store"));
    };
    request.onabort = (): void => {
      done();
      reject(
        (signal?.reason as Error | undefined) ??
          new DOMException("Aborted", "AbortError")
      );
    };
    request.send(blob);
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
