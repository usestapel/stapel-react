/**
 * The presigned PUT, over `XMLHttpRequest`, because progress is the feature.
 *
 * ── Why this file exists at all ───────────────────────────────────────────
 *
 * `@stapel/docs-react` already implements the upload flow
 * (`POST /uploads` → PUT at `put_url` → `POST /uploads/:id/finalize`) and this
 * package reuses every JSON step of it. Exactly one step is re-implemented,
 * and only its TRANSPORT: `fetch` cannot observe request-body progress. There
 * is no `upload.onprogress` on `fetch` in any shipping browser (a
 * `ReadableStream` request body is Chromium-only, requires HTTP/2 and
 * `duplex: "half"`, and reports what was ENQUEUED, not what was sent), so a
 * file manager built on `fetch` can draw a spinner and nothing else. The drive
 * product's upload tray shows a real bar per file, which means XHR.
 *
 * What is NOT re-implemented: the ticket contract. The `put_url`, its
 * `expires_at`, the `Content-Type` the object store expects, and the finalize
 * that follows are exactly docs-react's — this function is a drop-in for its
 * `uploadToPutUrl`, with the same "resolve the outcome, do not throw on a
 * status" shape, so the queue above it branches identically.
 *
 * The URL points at the object store — generally a DIFFERENT origin, no
 * cookie, no Stapel error envelope — so, like docs-react's version, this
 * carries none of the transport's auth binding by default. `credentials` is
 * forwarded only when a host explicitly configured it (a same-origin storage
 * profile), and the outcome resolves as `{ok, status}` for the caller to fold.
 *
 * `stapel/no-raw-fetch` bans XHR outside the api layer; this IS the api
 * layer, which is the point of the carve-out.
 */

/** Progress of one in-flight PUT, as the browser reports it. */
export interface PutProgress {
  readonly loaded: number;
  /** `0` while the length is not computable (rare for a Blob body). */
  readonly total: number;
}

/** Options for {@link putWithProgress}. */
export interface PutProgressOptions {
  /** Sent as `Content-Type` (the object store signs against it). */
  readonly contentType?: string;
  /** Called on every `upload.onprogress` tick, plus once at 100% on load. */
  readonly onProgress?: (progress: PutProgress) => void;
  /** Abort the transfer (a cancelled queue item, an unmounted tray). */
  readonly signal?: AbortSignal;
  /** Only for a same-origin storage profile; omitted otherwise. */
  readonly credentials?: RequestCredentials;
  /** Injected in tests and demos; defaults to the platform constructor. */
  readonly xhrFactory?: () => XMLHttpRequest;
}

/**
 * The outcome of a presigned PUT. A non-2xx is an OUTCOME, not an exception —
 * the same choice docs-react made by resolving the raw `Response`: the queue
 * has to tell "the store refused this file" from "the network died", and a
 * thrown status flattens the two.
 */
export interface PutProgressResult {
  readonly ok: boolean;
  /** `0` when the request failed before any response line was read. */
  readonly status: number;
}

/** The `AbortError` a caller expects from an aborted transfer. */
function abortError(): DOMException {
  return new DOMException("The upload was aborted.", "AbortError");
}

/**
 * PUT `blob` at `putUrl`, reporting real upload progress.
 *
 * Rejects only for a transport failure (network error, timeout) and for an
 * abort — with a `DOMException("AbortError")`, so a cancelled item is never
 * mistaken for a dead backend. Every HTTP status resolves.
 */
export function putWithProgress(
  putUrl: string,
  blob: Blob,
  options?: PutProgressOptions
): Promise<PutProgressResult> {
  return new Promise<PutProgressResult>((resolve, reject) => {
    if (options?.signal?.aborted === true) {
      reject(abortError());
      return;
    }
    const xhr = options?.xhrFactory ? options.xhrFactory() : new XMLHttpRequest();
    const signal = options?.signal;
    const onAbort = (): void => {
      xhr.abort();
    };

    const detach = (): void => {
      signal?.removeEventListener("abort", onAbort);
    };

    xhr.open("PUT", putUrl, true);
    if (options?.contentType !== undefined) {
      xhr.setRequestHeader("Content-Type", options.contentType);
    }
    if (options?.credentials === "include") {
      xhr.withCredentials = true;
    }

    if (options?.onProgress) {
      const report = options.onProgress;
      xhr.upload.onprogress = (event: ProgressEvent): void => {
        report({
          loaded: event.loaded,
          // `lengthComputable` false means the browser cannot say; reporting
          // the blob's own size instead would draw a bar out of a guess.
          total: event.lengthComputable ? event.total : 0,
        });
      };
    }

    xhr.onload = (): void => {
      detach();
      // The bar must land on 100% even when the last progress tick did not
      // fire (a small file often produces one event, at 0).
      options?.onProgress?.({ loaded: blob.size, total: blob.size });
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
    };
    xhr.onerror = (): void => {
      detach();
      reject(new Error("The upload transport failed before a response."));
    };
    xhr.ontimeout = (): void => {
      detach();
      reject(new Error("The upload timed out."));
    };
    xhr.onabort = (): void => {
      detach();
      reject(abortError());
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    xhr.send(blob);
  });
}
