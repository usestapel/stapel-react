/**
 * The raw-bytes half of the archive surface — hand-authored api/ carve-out
 * (the docs pair's `api/content.ts` precedent, the one legal home of `fetch`
 * per `stapel/no-raw-fetch`). `GET /documents/:id/archive/entry?path=` is not
 * a JSON operation: the payload is the extracted member's raw bytes, and the
 * per-request password travels in a HEADER (`X-Docs-Archive-Password`) that a
 * media element's `src` could never carry — which is why an entry preview is
 * a blob fetch and an object URL rather than a plain `<img src>`.
 *
 * The password is a parameter of ONE request: it is sent, used by the server
 * for the life of one extraction, and stored nowhere on either side.
 */
import { parseErrorEnvelope } from "@stapel/core";

/** Request header carrying the ZipCrypto password for one extraction. */
export const ARCHIVE_PASSWORD_HEADER = "X-Docs-Archive-Password";

/** The raw-transport binding (same shape the upload PUT closes over). */
export interface ArchiveRawTransport {
  /** e.g. `/docs/api/v1` — the same base the pair's `StapelClient` uses. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  /** Merged into every raw request (e.g. a tenant id / auth header). */
  readonly headers?: Record<string, string>;
}

/** What one extracted member comes back as. */
export interface ArchiveEntryBytes {
  readonly blob: Blob;
  /** The response's content type — the server's serving decision: the
   * guessed type for a member on the upload allowlist, else
   * `application/octet-stream` (an opaque attachment). */
  readonly mimeType: string;
}

/** Options for {@link fetchArchiveEntry}. */
export interface FetchArchiveEntryOptions {
  /** ZipCrypto password for an encrypted member — one request's worth. */
  readonly password?: string;
  readonly signal?: AbortSignal;
}

export async function fetchArchiveEntry(
  transport: ArchiveRawTransport,
  documentId: string,
  path: string,
  options?: FetchArchiveEntryOptions
): Promise<ArchiveEntryBytes> {
  const base = transport.baseUrl.endsWith("/")
    ? transport.baseUrl.slice(0, -1)
    : transport.baseUrl;
  const url = `${base}/documents/${encodeURIComponent(documentId)}/archive/entry?path=${encodeURIComponent(path)}`;
  const headers = new Headers(transport.headers);
  if (options?.password !== undefined && options.password.length > 0) {
    headers.set(ARCHIVE_PASSWORD_HEADER, options.password);
  }
  const doFetch = transport.fetch ?? globalThis.fetch;
  const init: RequestInit = { method: "GET", headers };
  if (transport.credentials !== undefined) {
    init.credentials = transport.credentials;
  }
  if (options?.signal !== undefined) init.signal = options.signal;
  const response = await doFetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      // a non-JSON error body rides as text
    }
    throw parseErrorEnvelope(response.status, body);
  }
  return {
    blob: await response.blob(),
    mimeType: response.headers.get("Content-Type") ?? "application/octet-stream",
  };
}
