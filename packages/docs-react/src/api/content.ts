/**
 * The raw-bytes half of the stapel-docs surface — hand-authored api/ carve-out
 * (mirrors recordings-react's `uploadRecordingBlob` precedent, the one legal
 * home of `fetch` per `stapel/no-raw-fetch`). `GET/PUT /documents/:id/content`,
 * `GET /documents/:id/export`, revision content, and the presigned upload PUT
 * are NOT JSON operations: the payload is the document's raw bytes, and the
 * optimistic-concurrency handshake lives in HTTP headers (`If-Match`,
 * `X-Docs-Head-Seq`, `ETag`) that core's `StapelClient.request` — a JSON
 * body parser — cannot surface. So these ops speak `fetch` directly, bound to
 * the runtime's base URL / credentials / default headers by `createDocsApi`.
 *
 * Auth: standard pairs authenticate via the `stapel_jwt` cookie (build the
 * runtime with `credentials: "include"` for a cross-origin API) or via
 * `defaultHeaders` — both are forwarded here. The bearer-refresh and
 * verification-403 seams of `createStapelClient` do NOT run on this raw
 * surface (v1 limitation; a 401 here throws like any other error status).
 */
import { parseErrorEnvelope } from "@stapel/core";
import type {
  DocumentContent,
  SaveContentOk,
  SaveContentResult,
} from "./types.js";

/** Response header carrying the document's head sequence (also in `ETag`). */
export const DOCS_HEAD_SEQ_HEADER = "X-Docs-Head-Seq";

/** The raw-transport binding `createDocsApi` closes over. */
export interface DocsRawTransport {
  /** e.g. `/docs/api/v1` — same base the pair's `StapelClient` uses. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  /** Merged into every raw request (e.g. a tenant id / auth header). */
  readonly headers?: Record<string, string>;
}

/** Options for {@link putDocumentContent}. */
export interface PutContentOptions {
  /** The `If-Match` value — the head sequence this save is based on. */
  readonly ifMatchSeq: number;
  /** MIME type sent as `Content-Type` (e.g. `text/markdown`). */
  readonly contentType?: string;
  readonly signal?: AbortSignal;
}

function rawUrl(transport: DocsRawTransport, path: string): string {
  const base = transport.baseUrl.endsWith("/")
    ? transport.baseUrl.slice(0, -1)
    : transport.baseUrl;
  return `${base}${path}`;
}

function rawInit(
  transport: DocsRawTransport,
  init: RequestInit & { headers: Headers }
): RequestInit {
  if (transport.headers) {
    for (const [key, value] of Object.entries(transport.headers)) {
      if (!init.headers.has(key)) init.headers.set(key, value);
    }
  }
  if (transport.credentials !== undefined) {
    init.credentials = transport.credentials;
  }
  return init;
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function throwEnvelope(response: Response): Promise<never> {
  throw parseErrorEnvelope(response.status, await parseJsonBody(response));
}

function headSeqOf(response: Response): number | null {
  const raw = response.headers.get(DOCS_HEAD_SEQ_HEADER);
  if (raw === null) return null;
  const seq = Number(raw);
  return Number.isFinite(seq) ? seq : null;
}

/**
 * `GET /documents/:id/content` — the document's raw bytes plus the head
 * sequence the response headers carry. The seq is what a later save sends
 * back as `If-Match` (snapshot discipline).
 */
export async function getDocumentContent(
  transport: DocsRawTransport,
  documentId: string,
  signal?: AbortSignal
): Promise<DocumentContent> {
  const doFetch = transport.fetch ?? globalThis.fetch;
  const response = await doFetch(
    rawUrl(transport, `/documents/${encodeURIComponent(documentId)}/content`),
    rawInit(transport, {
      method: "GET",
      headers: new Headers(),
      ...(signal !== undefined ? { signal } : {}),
    })
  );
  if (!response.ok) await throwEnvelope(response);
  return {
    blob: await response.blob(),
    headSeq: headSeqOf(response),
    etag: response.headers.get("ETag"),
    mimeType: response.headers.get("Content-Type"),
  };
}

/**
 * `PUT /documents/:id/content` with `If-Match: <head_seq>` — the snapshot
 * save. A 409 (someone saved past our seq; body `{head_seq, saved_by,
 * saved_at}`) and a bare 412 are folded into the `"conflict"` arm of
 * {@link SaveContentResult} — a conflict is a STATE the editor renders, not
 * an exception. Every other error status throws `StapelApiError`.
 */
export async function putDocumentContent(
  transport: DocsRawTransport,
  documentId: string,
  body: BodyInit,
  options: PutContentOptions
): Promise<SaveContentResult> {
  const doFetch = transport.fetch ?? globalThis.fetch;
  const headers = new Headers({
    "If-Match": String(options.ifMatchSeq),
    // CSRF rule for cookie-authenticated browser clients (mirrors the JSON
    // ops' `mutating()` helper): always sent, harmless for header-token hosts.
    "X-Requested-With": "XMLHttpRequest",
  });
  if (options.contentType !== undefined) {
    headers.set("Content-Type", options.contentType);
  }
  const response = await doFetch(
    rawUrl(transport, `/documents/${encodeURIComponent(documentId)}/content`),
    rawInit(transport, {
      method: "PUT",
      body,
      headers,
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    })
  );
  if (response.ok) {
    const ok = (await parseJsonBody(response)) as SaveContentOk;
    return { status: "saved", headSeq: ok.head_seq, revisionId: ok.revision_id };
  }
  if (response.status === 409) {
    const conflictBody = (await parseJsonBody(response)) as {
      readonly head_seq?: number;
      readonly saved_by?: string | null;
      readonly saved_at?: string | null;
    } | undefined;
    return {
      status: "conflict",
      conflict: {
        headSeq: conflictBody?.head_seq ?? null,
        savedBy: conflictBody?.saved_by ?? null,
        savedAt: conflictBody?.saved_at ?? null,
      },
    };
  }
  if (response.status === 412) {
    return {
      status: "conflict",
      conflict: { headSeq: null, savedBy: null, savedAt: null },
    };
  }
  return throwEnvelope(response);
}

/**
 * `GET /documents/:id/export?format=` — a rendered export (e.g. `pdf`) as a
 * Blob. Non-2xx throws `StapelApiError`.
 */
export async function exportDocument(
  transport: DocsRawTransport,
  documentId: string,
  format: string,
  signal?: AbortSignal
): Promise<Blob> {
  const doFetch = transport.fetch ?? globalThis.fetch;
  const response = await doFetch(
    rawUrl(
      transport,
      `/documents/${encodeURIComponent(documentId)}/export?format=${encodeURIComponent(format)}`
    ),
    rawInit(transport, {
      method: "GET",
      headers: new Headers(),
      ...(signal !== undefined ? { signal } : {}),
    })
  );
  if (!response.ok) await throwEnvelope(response);
  return response.blob();
}

/**
 * `GET /documents/:id/revisions/:rid/content` — a revision's raw bytes.
 */
export async function getRevisionContent(
  transport: DocsRawTransport,
  documentId: string,
  revisionId: string,
  signal?: AbortSignal
): Promise<Blob> {
  const doFetch = transport.fetch ?? globalThis.fetch;
  const response = await doFetch(
    rawUrl(
      transport,
      `/documents/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revisionId)}/content`
    ),
    rawInit(transport, {
      method: "GET",
      headers: new Headers(),
      ...(signal !== undefined ? { signal } : {}),
    })
  );
  if (!response.ok) await throwEnvelope(response);
  return response.blob();
}

/**
 * PUT the file's bytes at an upload session's `put_url` (step 2 of
 * `createUpload` → **PUT** → `finalizeUpload`). The URL points at the object
 * store — generally a DIFFERENT origin, no cookie, no JSON envelope — so this
 * is a bare `PUT` with none of the transport's auth binding, resolving to the
 * raw `Response` for the caller to branch on. On the local-storage backend
 * profile `put_url` is not writable at all; callers fall back to
 * {@link putDocumentContent} (see `useUpload`, which exposes both paths).
 */
export async function uploadToPutUrl(
  putUrl: string,
  blob: Blob,
  options?: {
    readonly contentType?: string;
    readonly signal?: AbortSignal;
    readonly fetch?: typeof globalThis.fetch;
  }
): Promise<Response> {
  const doFetch = options?.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = {};
  if (options?.contentType !== undefined) {
    headers["Content-Type"] = options.contentType;
  }
  return doFetch(putUrl, {
    method: "PUT",
    body: blob,
    headers,
    ...(options?.signal !== undefined ? { signal: options.signal } : {}),
  });
}
