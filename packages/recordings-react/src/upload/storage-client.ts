/**
 * The one request of a chunked upload that is not a Stapel API call: the part
 * PUT to the store's presigned URL. XHR rather than fetch because fetch has no
 * upload-progress events; the headers are exactly the ones the server minted
 * (the checksum the URL is signed over). No cookie, no Authorization.
 */
import type { PartPutter, PartPutResult } from "./chunkedUpload.js";

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}

/** XHR part PUT: upload progress events, response ETag, error body. */
export const xhrPutPart: PartPutter = ({ url, headers, body, signal, onProgress }) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortReason(signal));
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    const onAbort = (): void => xhr.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    const done = (r: PartPutResult | null): void => {
      signal.removeEventListener("abort", onAbort);
      if (r) resolve(r);
      else reject(abortReason(signal));
    };
    xhr.onload = () =>
      done({
        status: xhr.status,
        etag: xhr.getResponseHeader("ETag"),
        body: typeof xhr.responseText === "string" ? xhr.responseText : "",
      });
    xhr.onerror = () => done({ status: 0, etag: null, body: "" });
    xhr.ontimeout = () => done({ status: 0, etag: null, body: "" });
    xhr.onabort = () => done(null);
    xhr.send(body);
  });
